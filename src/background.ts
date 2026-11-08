import { initI18n, t, getCurrentLocale } from './i18n';

/**
 * ブックマークエントリの型定義
 */
export interface BookmarkEntry {
  url: string;
  title: string;
  score: number;
  last_used_at: number;
  created_at: number;
  is_pinned?: boolean;
  default_value?: string;
}

/**
 * 拡張機能全体のデータ構造
 */
export interface NickmarkData {
  bookmarks: Record<string, BookmarkEntry[]>;
}

/**
 * 動的に導出されるフォルダ情報の型定義
 */
export interface FolderInfo {
  /** フォルダの完全パスプレフィックス（例: "work", "infra/aws"） */
  path: string;
  /** フォルダの表示名（最後のセグメント。例: "aws"） */
  name: string;
  /** フォルダ階層の深さ（ルート直下は 0） */
  depth: number;
  /** 所属する全ニックネームのリスト（再帰的配下を含む） */
  nicknames: string[];
  /** 所属する一意な開く対象URL（重複除外後、ブックマークレット除外）の総件数 */
  openableUrlCount: number;
}

/**
 * 一括オープン時のデフォルト安全上限タブ数
 */
export const DEFAULT_MAX_BATCH_OPEN_TABS = 20;

let maxBatchOpenTabsCache: number | null = null;

// 入力中に何度もストレージを読み込むのを防ぐためのローカルキャッシュ
let bookmarksCache: Record<string, BookmarkEntry[]> | null = null;
let isSyncEnabledCache: boolean | null = null;
let loadBookmarksPromise: Promise<Record<string, BookmarkEntry[]>> | null = null;

const SYNC_CHUNK_SIZE = 2000; // 8192 bytes limit. 2000 chars * 3 bytes (UTF-8) = 6000 bytes. Safe for Japanese.
const SYNC_KEY_PREFIX = 'sync_data_';

/**
 * 同期が有効かどうかを取得します。
 */
export async function getSyncEnabled(): Promise<boolean> {
  if (isSyncEnabledCache !== null) return isSyncEnabledCache;
  const data = await chrome.storage.local.get('isSyncEnabled');
  isSyncEnabledCache = !!data.isSyncEnabled;
  return isSyncEnabledCache;
}

/**
 * 同期設定を更新します。
 */
export async function setSyncEnabled(enabled: boolean) {
  isSyncEnabledCache = enabled;
  await chrome.storage.local.set({ isSyncEnabled: enabled });
}

/**
 * フォルダ一括オープン時の安全上限タブ数を取得します。
 * @returns {Promise<number>} 安全上限タブ数（デフォルト: 20）
 */
export async function getMaxBatchOpenTabs(): Promise<number> {
  if (maxBatchOpenTabsCache !== null) return maxBatchOpenTabsCache;
  const data = await chrome.storage.local.get('maxBatchOpenTabs');
  const val = Number(data.maxBatchOpenTabs);
  if (!Number.isInteger(val) || val < 1 || val > 100) {
    maxBatchOpenTabsCache = DEFAULT_MAX_BATCH_OPEN_TABS;
  } else {
    maxBatchOpenTabsCache = val;
  }
  return maxBatchOpenTabsCache;
}

/**
 * フォルダ一括オープン時の安全上限タブ数を設定します。
 * @param {number} limit - 設定する安全上限タブ数（1〜100）
 */
export async function setMaxBatchOpenTabs(limit: number): Promise<void> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit) || DEFAULT_MAX_BATCH_OPEN_TABS));
  maxBatchOpenTabsCache = safeLimit;
  await chrome.storage.local.set({ maxBatchOpenTabs: safeLimit });
}

/**
 * ブックマーク辞書からすべてのフォルダ階層情報を抽出・導出します。
 * @param {Record<string, BookmarkEntry[]>} bookmarks - 登録されている全ブックマーク辞書
 * @returns {Map<string, FolderInfo>} 抽出されたフォルダ情報のマップ（キー: フォルダパス）
 */
export function extractFolders(bookmarks: Record<string, BookmarkEntry[]>): Map<string, FolderInfo> {
  const folderMap = new Map<string, FolderInfo>();

  for (const nickname of Object.keys(bookmarks)) {
    const parts = nickname.split('/');
    if (parts.length <= 1) continue; // スラッシュを含まないものは未分類（ルート）

    // 親階層を順次走査（例: a/b/c の場合、"a" と "a/b"）
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      if (!folderMap.has(currentPath)) {
        folderMap.set(currentPath, {
          path: currentPath,
          name: parts[i],
          depth: i,
          nicknames: [],
          openableUrlCount: 0,
        });
      }
      folderMap.get(currentPath)!.nicknames.push(nickname);
    }
  }

  // 各フォルダの開く対象URL総数（重複排除後、ブックマークレット除外）を集計
  for (const folder of folderMap.values()) {
    const uniqueUrls = new Set<string>();
    for (const nick of folder.nicknames) {
      const entries = bookmarks[nick] || [];
      for (const entry of entries) {
        if (!isBookmarkletUrl(entry.url)) {
          uniqueUrls.add(entry.url);
        }
      }
    }
    folder.openableUrlCount = uniqueUrls.size;
  }

  return folderMap;
}

/**
 * フォルダ一括オープンの実行結果型
 */
export interface BatchOpenResult {
  /** 実行が成功したか（上限超過による中断の場合は false） */
  success: boolean;
  /** 実際に開いたタブの件数 */
  openedCount: number;
  /** 対象となった一意な URL の総件数 */
  totalCount: number;
  /** 上限超過により確認が必要な状態か */
  requiresConfirmation?: boolean;
  /** 確認が必要な場合のフォルダパス */
  folderPath?: string;
  /** 確認が必要な場合の URL リスト */
  urls?: string[];
  /** 確認が必要な場合のニックネームリスト */
  nicknames?: string[];
  /** エラーメッセージ（存在する場合） */
  error?: string;
}

/**
 * 指定したフォルダ配下の全ブックマークを一括で開きます。
 * 重複URLは除外し、ブックマークレットはスキップ、動的URLはフォールバック展開します。
 * 安全上限件数を超え、force が false の場合は自動オープンを中断して確認要求状態を返します。
 * @param {string} folderPath - 対象のフォルダパス（例: "work" または "work/"）
 * @param {boolean} [force=false] - 上限超過時でも強制的に開くかどうか（ユーザー承認後は true）
 * @param {number} [currentTabId] - 現在のアクティブタブID（トースト通知用、任意）
 * @returns {Promise<BatchOpenResult>} 一括オープンの実行結果
 */
export async function openFolderUrls(
  folderPath: string,
  force: boolean = false,
  currentTabId?: number
): Promise<BatchOpenResult> {
  const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');
  if (!normalizedPath) {
    return { success: false, openedCount: 0, totalCount: 0, error: 'INVALID_FOLDER_PATH' };
  }

  const bookmarks = await loadBookmarksData();
  const folderPrefix = normalizedPath + '/';

  // 対象となるニックネームを収集（完全一致またはプレフィックス前方一致）
  const matchingNicknames = Object.keys(bookmarks).filter(
    nick => nick === normalizedPath || nick.startsWith(folderPrefix)
  );

  if (matchingNicknames.length === 0) {
    if (currentTabId !== undefined) {
      await showToast(currentTabId, t('errorNicknameNotFound', [normalizedPath]) || `フォルダ「${normalizedPath}」が見つかりませんでした。`);
    }
    return { success: false, openedCount: 0, totalCount: 0, error: 'FOLDER_NOT_FOUND' };
  }

  // 重複を除外した開く対象 URL と、各 URL に紐づくスコア更新用エントリを収集
  const targetMap = new Map<string, { templateUrl: string; nickname: string }>();

  for (const nick of matchingNicknames) {
    const entries = bookmarks[nick] || [];
    for (const entry of entries) {
      if (isBookmarkletUrl(entry.url)) {
        continue; // ブックマークレットはスキップ
      }
      const urlToOpen = isDynamicUrl(entry.url) ? resolveFallbackUrl(entry) : entry.url;
      if (!targetMap.has(urlToOpen)) {
        targetMap.set(urlToOpen, { templateUrl: entry.url, nickname: nick });
      }
    }
  }

  const totalCount = targetMap.size;
  if (totalCount === 0) {
    if (currentTabId !== undefined) {
      await showToast(currentTabId, t('errorBatchOpenZeroUrls', [normalizedPath]) || `フォルダ「${normalizedPath}」には開く対象のURLがありません。`);
    }
    return { success: false, openedCount: 0, totalCount: 0, error: 'NO_OPENABLE_URLS' };
  }

  // 安全上限の確認
  const maxLimit = await getMaxBatchOpenTabs();
  if (totalCount > maxLimit && !force) {
    return {
      success: false,
      openedCount: 0,
      totalCount,
      requiresConfirmation: true,
      folderPath: normalizedPath,
      urls: Array.from(targetMap.keys()),
      nicknames: matchingNicknames,
    };
  }

  // タブを一括で開いてスコアを更新
  let openedCount = 0;
  for (const [urlToOpen, info] of targetMap.entries()) {
    chrome.tabs.create({ url: urlToOpen, active: false });
    await updateScore(urlToOpen, info.templateUrl, info.nickname);
    openedCount++;
  }

  return { success: true, openedCount, totalCount };
}

/**
 * 安全上限を超過したフォルダ一括オープンについて、アクティブタブ上に確認プロンプトを表示します。
 * スクリプト実行が許可されていない特殊ページの場合は、管理画面（list.html）へフォールバックします。
 * @param {number} tabId - 対象タブの ID
 * @param {string} folderPath - 対象のフォルダパス
 * @param {string[]} urls - 開く対象の URL リスト
 * @param {string[]} nicknames - 所属するニックネームリスト
 * @returns {Promise<void>} 処理完了を示す Promise
 */
export async function handleBatchOpenConfirmationRequest(
  tabId: number,
  folderPath: string,
  urls: string[],
  nicknames: string[]
): Promise<void> {
  const maxLimit = await getMaxBatchOpenTabs();
  const title = t('confirmBatchOpenTitle') || '大量タブオープンの確認';
  const msg =
    t('confirmBatchOpenMessage', [folderPath, String(urls.length), String(maxLimit)]) ||
    `フォルダ「${folderPath}」には ${urls.length} 件のタブが含まれています。安全上限（${maxLimit}件）を超えていますが、すべて開きますか？`;
  const confirmBtnText = t('confirmBatchOpenBtn') || 'すべて開く';
  const cancelBtnText = t('cancelBtn') || 'キャンセル';

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (
        folder: string,
        urlList: string[],
        nickList: string[],
        dialogTitle: string,
        message: string,
        okLabel: string,
        cancelLabel: string
      ) => {
        const modalId = 'nickmark-batch-open-confirm';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.id = modalId;
        Object.assign(backdrop.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: '2147483647',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });

        const dialog = document.createElement('div');
        Object.assign(dialog.style, {
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          padding: '24px',
          borderRadius: '12px',
          maxWidth: '440px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          border: '1px solid #334155'
        });

        const h3 = document.createElement('h3');
        h3.textContent = dialogTitle;
        Object.assign(h3.style, { margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#f59e0b' });

        const p = document.createElement('p');
        p.textContent = message;
        Object.assign(p.style, { margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5', color: '#cbd5e1' });

        const btnContainer = document.createElement('div');
        Object.assign(btnContainer.style, { display: 'flex', justifyContent: 'flex-end', gap: '12px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelLabel;
        Object.assign(cancelBtn.style, {
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid #475569',
          backgroundColor: '#334155',
          color: '#f8fafc',
          cursor: 'pointer',
          fontSize: '13px'
        });
        cancelBtn.onclick = () => backdrop.remove();

        const okBtn = document.createElement('button');
        okBtn.textContent = okLabel;
        Object.assign(okBtn.style, {
          padding: '8px 16px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#2563eb',
          color: '#ffffff',
          cursor: 'pointer',
          fontWeight: '500',
          fontSize: '13px'
        });
        okBtn.onclick = () => {
          backdrop.remove();
          chrome.runtime.sendMessage({
            action: 'EXECUTE_BATCH_OPEN',
            payload: { folderPath: folder, urls: urlList, nicknames: nickList }
          });
        };

        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(okBtn);
        dialog.appendChild(h3);
        dialog.appendChild(p);
        dialog.appendChild(btnContainer);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
      },
      args: [folderPath, urls, nicknames, title, msg, confirmBtnText, cancelBtnText]
    });
  } catch (e) {
    // 特殊ページ（スクリプト実行不可）では管理画面を開く
    await openOrReuseListTab({ msg });
  }
}

/**
 * 指定したフォルダ名（プレフィックス）を新しいフォルダ名に一括置換します。
 * @param {string} oldPath - 変更前のフォルダパス（例: "work"）
 * @param {string} newPath - 変更後のフォルダパス（例: "office"）
 * @returns {Promise<{ success: boolean; affectedCount: number; error?: string }>} 処理結果
 */
export async function renameFolder(
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; affectedCount: number; error?: string }> {
  const normOld = oldPath.replace(/^\/+|\/+$/g, '');
  const normNew = newPath.replace(/^\/+|\/+$/g, '');

  if (!normOld || !normNew) {
    return { success: false, affectedCount: 0, error: 'INVALID_PATH' };
  }
  if (normOld === normNew) {
    return { success: true, affectedCount: 0 };
  }

  const bookmarks = await loadBookmarksData();
  const oldPrefix = normOld + '/';
  const newPrefix = normNew + '/';
  const newBookmarks: Record<string, BookmarkEntry[]> = {};
  let affectedCount = 0;

  for (const [key, entries] of Object.entries(bookmarks)) {
    if (key === normOld) {
      newBookmarks[normNew] = entries;
      affectedCount += entries.length;
    } else if (key.startsWith(oldPrefix)) {
      const rest = key.substring(oldPrefix.length);
      const newKey = `${newPrefix}${rest}`;
      newBookmarks[newKey] = entries;
      affectedCount += entries.length;
    } else {
      newBookmarks[key] = entries;
    }
  }

  await saveBookmarksData(newBookmarks);
  return { success: true, affectedCount };
}

/**
 * 指定したフォルダ配下のすべてのブックマークを一括削除します。
 * @param {string} folderPath - 削除対象のフォルダパス
 * @returns {Promise<{ success: boolean; deletedCount: number; error?: string }>} 処理結果
 */
export async function deleteFolder(
  folderPath: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const normPath = folderPath.replace(/^\/+|\/+$/g, '');
  if (!normPath) {
    return { success: false, deletedCount: 0, error: 'INVALID_PATH' };
  }

  const bookmarks = await loadBookmarksData();
  const prefix = normPath + '/';
  const newBookmarks: Record<string, BookmarkEntry[]> = {};
  let deletedCount = 0;

  for (const [key, entries] of Object.entries(bookmarks)) {
    if (key === normPath || key.startsWith(prefix)) {
      deletedCount += entries.length;
    } else {
      newBookmarks[key] = entries;
    }
  }

  await saveBookmarksData(newBookmarks);
  return { success: true, deletedCount };
}

/**
 * 指定したストレージから生データを読み込み、チャンク化を解除します。
 */
async function loadFromStorage(area: 'local' | 'sync'): Promise<Record<string, BookmarkEntry[]>> {
  if (area === 'local') {
    const data = await chrome.storage.local.get('bookmarks');
    return (data.bookmarks as Record<string, BookmarkEntry[]>) || {};
  } else {
    const allSyncData = await chrome.storage.sync.get(null);
    const keys = Object.keys(allSyncData)
      .filter(k => k.startsWith(SYNC_KEY_PREFIX))
      .sort((a, b) => {
        const idxA = parseInt(a.replace(SYNC_KEY_PREFIX, ''), 10);
        const idxB = parseInt(b.replace(SYNC_KEY_PREFIX, ''), 10);
        return idxA - idxB;
      });
    
    if (keys.length === 0) return {};
    
    const jsonStr = keys.map(k => allSyncData[k]).join('');
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse sync data:', e);
      // パースに失敗した場合は空を返さず、エラーを投げることで
      // 呼び出し元が不完全なデータに基づいてストレージを上書きするのを防ぐ
      throw new Error('CORRUPTED_SYNC_DATA');
    }
  }
}

/**
 * 指定したストレージにデータを保存し、必要に応じてチャンク化します。
 */
async function saveToStorage(area: 'local' | 'sync', bookmarks: Record<string, BookmarkEntry[]>) {
  if (area === 'local') {
    await chrome.storage.local.set({ bookmarks });
  } else {
    const jsonStr = JSON.stringify(bookmarks);
    
    // Sync の制限チェック (100KB)
    if (jsonStr.length > 100 * 1024) {
      console.error('Data size exceeds sync quota:', jsonStr.length);
      throw new Error('QUOTA_EXCEEDED');
    }

    const chunks: Record<string, string> = {};
    let chunkCount = 0;
    for (let i = 0; i < jsonStr.length; i += SYNC_CHUNK_SIZE) {
      const chunk = jsonStr.substring(i, i + SYNC_CHUNK_SIZE);
      chunks[`${SYNC_KEY_PREFIX}${chunkCount}`] = chunk;
      chunkCount++;
    }

    // 既存の同期データを完全にクリアする。
    // これにより、古い形式の巨大なデータ（8KB超え）や、
    // 不適切なキー形式のデータが残っていることによる Quota エラーを確実に回避する。
    await chrome.storage.sync.clear();

    // 新しいデータを保存
    await chrome.storage.sync.set(chunks);
  }
}

/**
 * ストレージからブックマークデータを読み込みます。
 * キャッシュが存在する場合はキャッシュを返します。
 * 同時呼び出し時は同一の Promise を共有して重複読み込みを防ぎます。
 * @returns {Promise<Record<string, BookmarkEntry[]>>} 正規化されたブックマークデータのプロミス
 */
export async function loadBookmarksData(): Promise<Record<string, BookmarkEntry[]>> {
  if (bookmarksCache) return bookmarksCache;
  if (loadBookmarksPromise) return loadBookmarksPromise;

  loadBookmarksPromise = (async () => {
    try {
      const isSync = await getSyncEnabled();
      const rawBookmarks = await loadFromStorage(isSync ? 'sync' : 'local');
      
      const normalizedBookmarks: Record<string, BookmarkEntry[]> = {};
      
      for (const [nickname, entries] of Object.entries(rawBookmarks)) {
        if (Array.isArray(entries)) {
          normalizedBookmarks[nickname] = entries;
        } else if (entries && typeof entries === 'object') {
          normalizedBookmarks[nickname] = Object.values(entries) as BookmarkEntry[];
        } else {
          normalizedBookmarks[nickname] = [];
        }
      }
      
      bookmarksCache = normalizedBookmarks;
      return normalizedBookmarks;
    } finally {
      loadBookmarksPromise = null;
    }
  })();

  return loadBookmarksPromise;
}

/**
 * ブックマークデータを保存します。
 * 同期設定に応じて、適切なストレージ（local または sync）に保存します。
 * @param {Record<string, BookmarkEntry[]>} bookmarks 保存するブックマークデータ
 * @returns {Promise<void>}
 */
export async function saveBookmarksData(bookmarks: Record<string, BookmarkEntry[]>): Promise<void> {
  const isSync = await getSyncEnabled();
  await saveToStorage(isSync ? 'sync' : 'local', bookmarks);
  bookmarksCache = bookmarks;
  loadBookmarksPromise = null;
}

/**
 * 指定されたストレージ領域のデータと、最新の更新日時を取得します。
 */
export async function getStorageDataWithTimestamp(area: 'local' | 'sync'): Promise<{ bookmarks: Record<string, BookmarkEntry[]>, lastUpdated: number }> {
  const rawBookmarks = await loadFromStorage(area);
  const normalizedBookmarks: Record<string, BookmarkEntry[]> = {};
  let latest = 0;

  for (const [nickname, entries] of Object.entries(rawBookmarks)) {
    let normalizedEntries: BookmarkEntry[] = [];
    if (Array.isArray(entries)) {
      normalizedEntries = entries;
    } else if (entries && typeof entries === 'object') {
      normalizedEntries = Object.values(entries) as BookmarkEntry[];
    }

    normalizedBookmarks[nickname] = normalizedEntries;
    for (const entry of normalizedEntries) {
      latest = Math.max(latest, entry.last_used_at || 0, entry.created_at || 0);
    }
  }
  
  return { bookmarks: normalizedBookmarks, lastUpdated: latest };
}

/**
 * データサイズ（JSON文字列長）が 100KB を超えているかチェックします。
 */
export function isOverQuota(bookmarks: Record<string, BookmarkEntry[]>): boolean {
  const jsonStr = JSON.stringify(bookmarks);
  return jsonStr.length > 100 * 1024; // 100KB limit
}

// 1日あたりのスコア減衰率
const DECAY_RATE = 0.95;

/**
 * 経過日数に基づいて新しいスコアを計算します。
 * @param {number} oldScore 古いスコア
 * @param {number} lastUsedAt 最後に使用された日時のタイムスタンプ
 * @returns {number} 計算された新しいスコア
 */
function calculateNewScore(oldScore: number, lastUsedAt: number): number {
  const now = Date.now();
  const elapsedMs = Math.max(0, now - lastUsedAt);
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return (oldScore * Math.pow(DECAY_RATE, elapsedDays)) + 1.0;
}

/**
 * オムニボックスの XML 記述用にテキストを安全にエスケープします。
 * 改行や XML で無効な制御文字も除去・空白化してパースエラーを防ぎます。
 * @param unsafe - エスケープ対象の任意の値
 * @returns XML エスケープ済みの安全な文字列
 */
function escapeXml(unsafe: any): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '＆'; // Chrome の XML パーサーのバグを回避するため、全角のアンパサンドを使用します
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
}

/**
 * 指定された URL 文字列がブックマークレット（`javascript:` スキーム）であるかを判定します。
 * @param url - 判定対象の URL 文字列
 * @returns `javascript:` で始まる場合は true、それ以外は false
 */
export function isBookmarkletUrl(url: string): boolean {
  if (!url) return false;
  return /^javascript:/i.test(url.trim());
}

/**
 * ブックマークレット URL から先頭の `javascript:` を除去し、パーセントエンコードを展開した実行用コードを抽出します。
 * 全体の `decodeURIComponent` が生の `%`（剰余演算子や `100%` 等）によって失敗した場合は、
 * 妥当なパーセントエンコード列（`%XX` の連続）のみを安全にデコードします。
 * @param url - `javascript:` で始まるブックマークレット文字列
 * @returns デコード済みの JavaScript コード文字列
 */
export function extractBookmarkletCode(url: string): string {
  const rawCode = url.trim().replace(/^javascript:/i, '');
  try {
    return decodeURIComponent(rawCode);
  } catch (e) {
    // 生の '%' が含まれる場合でも '%20' などの有効なエンコード箇所のみ展開する
    return rawCode.replace(/(?:%[0-9A-Fa-f]{2})+/g, (encodedSeq) => {
      try {
        return decodeURIComponent(encodedSeq);
      } catch {
        return encodedSeq;
      }
    });
  }
}

/**
 * `chrome.userScripts` API が現在の環境で有効（「ユーザー スクリプトを許可する」がオン）かどうかを判定します。
 * @returns 利用可能な場合は true、未許可または非対応の場合は false
 */
export function isUserScriptsAvailable(): boolean {
  try {
    return (
      typeof chrome !== 'undefined' &&
      !!chrome.userScripts &&
      typeof chrome.userScripts.execute === 'function'
    );
  } catch (e) {
    return false;
  }
}

/**
 * 指定されたタブ URL がブラウザの仕様上スクリプト注入を禁止されている保護ページ（`chrome://` やウェブストア等）かを判定します。
 * @param url - 判定対象のタブ URL
 * @returns スクリプト実行不可のページであれば true、実行可能であれば false
 */
export function isRestrictedTabUrl(url?: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  // http, https, file 以外の内部スキーム（chrome://, edge://, about:, chrome-extension:// 等）は実行不可
  if (!/^(?:https?|file):\/\//i.test(trimmed)) {
    return true;
  }
  // Chrome ウェブストア上では拡張機能によるスクリプト注入がブラウザ側で禁止されている
  if (
    /^https:\/\/chromewebstore\.google\.com(?:\/|$)/i.test(trimmed) ||
    /^https:\/\/chrome\.google\.com\/webstore(?:\/|$)/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

/**
 * オムニボックスのサジェスト表示用に URL 文字列を整形します。
 * 長大なワンライナーになりやすいブックマークレットの場合は連続空白を圧縮し、一定文字数で省略します。
 * @param url - 表示対象の URL またはブックマークレット文字列
 * @param maxLength - ブックマークレット省略時の最大文字数（デフォルト: 100）
 * @returns サジェスト表示用に整形された文字列
 */
function formatUrlForOmniboxDisplay(url: string, maxLength: number = 100): string {
  if (!url) return '';
  if (!isBookmarkletUrl(url)) return url;
  const normalized = url.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength) + '...';
}

/**
 * 2つの URL が同一のものか比較します。
 * @param {string} u1 URL 1
 * @param {string} u2 URL 2
 * @returns {boolean} 同一の URL であれば true
 */
export function isSameUrl(u1: string, u2: string): boolean {
  if (u1 === u2) return true;
  try {
    if (decodeURI(u1) === decodeURI(u2)) return true;
  } catch (e) {}
  try {
    if (decodeURIComponent(u1) === decodeURIComponent(u2)) return true;
  } catch (e) {}
  return false;
}

/**
 * URL 文字列に動的パラメータのプレースホルダー（%s）が含まれているかを判定します。
 * ブックマークレット（`javascript:`）内の `%s` はコード破損を防ぐため動的 URL として扱いません。
 * @param url - 判定対象の URL 文字列
 * @returns 通常 URL かつプレースホルダー `%s` を含む場合は true、それ以外は false
 */
export function isDynamicUrl(url: string): boolean {
  if (isBookmarkletUrl(url)) return false;
  return url.includes('%s');
}

/**
 * 動的 URL において引数が省略された場合の遷移先 URL を解決します。
 * `default_value` が設定されていれば `%s` にそのデフォルト値を展開した URL を返し、
 * 未設定の場合は URL のオリジン（トップページ）を返します。
 * @param entry - 対象のブックマークエントリ
 * @returns 解決された遷移先 URL
 */
export function resolveFallbackUrl(entry: BookmarkEntry): string {
  if (entry.default_value && entry.default_value.trim()) {
    return expandDynamicUrl(entry.url, entry.default_value);
  }
  try {
    const parsed = new URL(entry.url);
    if (parsed.origin && parsed.origin !== 'null' && !parsed.origin.includes('%s')) {
      return parsed.origin;
    }
  } catch (e) {
    // そのままでは URL としてパースできない場合は仮文字列に置換して再試行する
  }
  try {
    const sanitized = entry.url.replace(/%s/g, '');
    const parsedFallback = new URL(sanitized);
    if (parsedFallback.origin && parsedFallback.origin !== 'null') {
      return parsedFallback.origin;
    }
  } catch (e) {
    // オリジン抽出に失敗した場合はプレースホルダーを除去した文字列を返す
  }
  return entry.url.replace(/%s/g, '');
}

/**
 * 動的 URL の `%s` プレースホルダーを入力クエリで展開します。
 * パス領域（`?` および `#` より前）の `%s` は `/` を区切りとして保持しつつセグメントごとにエンコードし、
 * クエリ・ハッシュ領域（`?` または `#` 以降）の `%s` は全体を `encodeURIComponent` でエンコードします。
 * @param templateUrl - `%s` を含むテンプレート URL
 * @param query - 埋め込む引数文字列
 * @returns プレースホルダー展開後の URL
 */
export function expandDynamicUrl(templateUrl: string, query: string): string {
  const trimmedQuery = query.trim();
  const queryIdx = templateUrl.indexOf('?');
  const hashIdx = templateUrl.indexOf('#');
  let boundaryIdx = templateUrl.length;
  if (queryIdx !== -1) boundaryIdx = Math.min(boundaryIdx, queryIdx);
  if (hashIdx !== -1) boundaryIdx = Math.min(boundaryIdx, hashIdx);

  // パス用：スラッシュは維持し、各パスセグメントのみエンコードする
  const encodedForPath = trimmedQuery
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  // クエリ・ハッシュ用：スラッシュも含めて全体をエンコードする
  const encodedForQuery = encodeURIComponent(trimmedQuery);

  return templateUrl.replace(/%s/g, (_match: string, offset: number) => {
    return offset < boundaryIdx ? encodedForPath : encodedForQuery;
  });
}

/**
 * 展開済みの遷移先 URL が、指定された動的 URL エントリから生成されたものかを判定します。
 * @param entry - 動的 URL を持つブックマークエントリ
 * @param targetUrl - 実際に遷移した URL
 * @returns エントリに一致する場合は true、それ以外は false
 */
function matchesDynamicEntry(entry: BookmarkEntry, targetUrl: string): boolean {
  if (!isDynamicUrl(entry.url)) return false;
  if (isSameUrl(resolveFallbackUrl(entry), targetUrl)) return true;

  // 正規表現の特殊文字をエスケープした上で %s をワイルドカード (.+) に変換して比較する
  const escapedPattern = entry.url
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%s/g, '.+');
  try {
    const regex = new RegExp(`^${escapedPattern}$`);
    return regex.test(targetUrl);
  } catch (e) {
    return false;
  }
}

/**
 * ブックマークデータ内のニックネーム一覧を優先度順（ピン留め ＞ 最大スコア降順 ＞ 名前昇順）で取得します。
 * @param bookmarks - 現在のブックマークデータ
 * @returns ソート済みのニックネーム配列
 */
function getSortedNicknames(bookmarks: Record<string, BookmarkEntry[]>): string[] {
  return Object.keys(bookmarks).sort((a, b) => {
    const entriesA = bookmarks[a] || [];
    const entriesB = bookmarks[b] || [];
    const pinA = entriesA.some(e => e.is_pinned) ? 1 : 0;
    const pinB = entriesB.some(e => e.is_pinned) ? 1 : 0;
    if (pinB !== pinA) return pinB - pinA;

    const maxScoreA = entriesA.reduce((max, e) => Math.max(max, e.score || 0), 0);
    const maxScoreB = entriesB.reduce((max, e) => Math.max(max, e.score || 0), 0);
    if (maxScoreB !== maxScoreA) return maxScoreB - maxScoreA;

    return a.localeCompare(b);
  });
}

/**
 * 通常検索におけるマッチ結果の型定義
 */
export interface ResolvedSearchMatch {
  nickname: string;
  entry: BookmarkEntry;
  resolvedUrl: string;
  tier: number;
  isDynamic: boolean;
  dynamicArg: string;
}

/**
 * サジェスト候補の content 文字列から遷移先ブックマークを特定するためのターゲット情報
 */
export interface SuggestedMatchTarget {
  nickname: string;
  resolvedUrl: string;
  templateUrl: string;
}

// オムニボックス候補の一意化およびエントリ識別に使用する不可視文字（ゼロ幅文字）
const ZW_BIT_ZERO = '\u200B'; // ゼロ幅スペース（ビット 0）
const ZW_BIT_ONE = '\u200C';  // ゼロ幅非接合子（ビット 1）
const ZERO_WIDTH_ALL_REGEX = /[\u200B-\u200D\uFEFF]/g;
const TRAILING_ZW_MARKER_REGEX = /^([^\u200B-\u200D\uFEFF]+)([\u200B\u200C]+)$/;

// 直近でオムニボックスに提示したサジェスト候補の content と遷移先情報の対応マップ
let lastSuggestedMatchMap = new Map<string, SuggestedMatchTarget>();

/**
 * 文字列に含まれるゼロ幅文字（不可視マーカー）をすべて除去します。
 * @param text - 対象の文字列
 * @returns ゼロ幅文字を除去したクリーンな文字列
 */
export function stripZeroWidthChars(text: string): string {
  if (!text) return '';
  return text.replace(ZERO_WIDTH_ALL_REGEX, '');
}

/**
 * 非負整数インデックスをゼロ幅文字（`\u200B` と `\u200C`）の2進数ビット列にエンコードします。
 * アドレスバー上の見た目をニックネームのまま維持しつつ、Chrome の重複候補フィルタリングを回避し、
 * 同一ニックネーム内の複数 URL エントリを一意に識別するために使用します。
 * @param index - エンコード対象の非負整数インデックス
 * @returns ゼロ幅文字のみで構成された識別マーカー文字列
 */
export function encodeZeroWidthIndex(index: number): string {
  const safeIndex = Math.max(0, Math.floor(index));
  return safeIndex
    .toString(2)
    .split('')
    .map(bit => (bit === '0' ? ZW_BIT_ZERO : ZW_BIT_ONE))
    .join('');
}

/**
 * ゼロ幅文字で構成された識別マーカー文字列を元の非負整数インデックスにデコードします。
 * @param marker - `\u200B` および `\u200C` で構成されたマーカー文字列
 * @returns デコードされた非負整数インデックス。不正な形式の場合は null
 */
export function decodeZeroWidthIndex(marker: string): number | null {
  if (!marker || !/^[\u200B\u200C]+$/.test(marker)) return null;
  // 2文字以上で先頭ビットが 0 のものは正規のエンコード値ではないため除外する
  if (marker.length > 1 && marker[0] === ZW_BIT_ZERO) return null;

  const binaryStr = marker
    .split('')
    .map(ch => (ch === ZW_BIT_ZERO ? '0' : '1'))
    .join('');
  const parsed = parseInt(binaryStr, 2);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 末尾に付与されたゼロ幅文字マーカーから対象のブックマーク遷移先情報を復元します。
 * Service Worker が再起動してメモリ上のサジェストマップが失われた場合のフォールバックとして機能します。
 * @param rawText - オムニボックスから渡された生テキスト
 * @param bookmarks - 現在のブックマークデータ
 * @returns 復元された遷移先情報。マーカーが存在しない、または該当エントリがない場合は null
 */
export function resolveMatchFromZeroWidthMarker(
  rawText: string,
  bookmarks: Record<string, BookmarkEntry[]>
): SuggestedMatchTarget | null {
  const markerMatch = rawText.match(TRAILING_ZW_MARKER_REGEX);
  if (!markerMatch) return null;

  const visibleText = markerMatch[1].trim();
  const marker = markerMatch[2];
  const entryIndex = decodeZeroWidthIndex(marker);
  if (entryIndex === null || entryIndex < 0) return null;

  // 表示文字列全体がニックネームとして存在する場合
  if (bookmarks[visibleText] && bookmarks[visibleText][entryIndex]) {
    const entry = bookmarks[visibleText][entryIndex];
    const resolvedUrl = isDynamicUrl(entry.url) ? resolveFallbackUrl(entry) : entry.url;
    return {
      nickname: visibleText,
      resolvedUrl,
      templateUrl: entry.url
    };
  }

  // 「ニックネーム 動的URL引数」の形式である場合
  const firstSpaceMatch = visibleText.match(/\s+/);
  if (firstSpaceMatch && firstSpaceMatch.index !== undefined) {
    const firstToken = visibleText.slice(0, firstSpaceMatch.index);
    const restArg = visibleText.slice(firstSpaceMatch.index + firstSpaceMatch[0].length).trim();
    if (bookmarks[firstToken] && bookmarks[firstToken][entryIndex]) {
      const entry = bookmarks[firstToken][entryIndex];
      const resolvedUrl =
        isDynamicUrl(entry.url) && restArg
          ? expandDynamicUrl(entry.url, restArg)
          : isDynamicUrl(entry.url)
            ? resolveFallbackUrl(entry)
            : entry.url;
      return {
        nickname: firstToken,
        resolvedUrl,
        templateUrl: entry.url
      };
    }
  }

  return null;
}

/**
 * 通常検索の入力テキストを解析し、マッチ度ティア・ピン留め・スコア順にソートされた候補リストを返します。
 * @param text - オムニボックスに入力された検索文字列
 * @param bookmarks - 現在のブックマークデータ
 * @returns ソート済みの検索マッチ結果配列
 */
export function resolveRegularSearchMatches(
  text: string,
  bookmarks: Record<string, BookmarkEntry[]>
): ResolvedSearchMatch[] {
  const trimmed = stripZeroWidthChars(text).trim();
  if (!trimmed) return [];

  // 1語目（ニックネーム候補）と2語目以降（動的URLの引数または絞り込みキーワード）に分割する
  const firstSpaceMatch = trimmed.match(/\s+/);
  const firstToken = firstSpaceMatch ? trimmed.slice(0, firstSpaceMatch.index) : trimmed;
  const restQuery = firstSpaceMatch
    ? trimmed.slice((firstSpaceMatch.index ?? 0) + firstSpaceMatch[0].length).trim()
    : '';

  const firstTokenLower = firstToken.toLowerCase();
  const restTokensLower = restQuery ? restQuery.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const allTokensLower = trimmed.toLowerCase().split(/\s+/).filter(Boolean);

  const allMatches: ResolvedSearchMatch[] = [];

  for (const [nickname, entries] of Object.entries(bookmarks)) {
    const nickLower = nickname.toLowerCase();
    let nickTier: number | null = null;

    if (nickLower === firstTokenLower) {
      nickTier = 1; // ニックネーム完全一致
    } else if (nickLower.startsWith(firstTokenLower)) {
      nickTier = 2; // ニックネーム前方一致
    } else if (nickLower.includes(firstTokenLower)) {
      nickTier = 3; // ニックネーム部分一致
    }

    for (const entry of entries) {
      const dynamic = isDynamicUrl(entry.url);
      let addedInNickTier = false;

      if (nickTier !== null) {
        if (dynamic) {
          // 動的URLの場合は2語目以降を引数として %s に展開し、引数未入力ならフォールバックURLを使用する
          const resolvedUrl = restQuery ? expandDynamicUrl(entry.url, restQuery) : resolveFallbackUrl(entry);
          allMatches.push({
            nickname,
            entry,
            resolvedUrl,
            tier: nickTier,
            isDynamic: true,
            dynamicArg: restQuery
          });
          addedInNickTier = true;
        } else {
          // 通常URLの場合は2語目以降があればタイトル・URL（およびニックネーム）でAND絞り込みを行う
          const searchable = `${nickname} ${entry.title || ''} ${entry.url}`.toLowerCase();
          const passesFilter =
            restTokensLower.length === 0 || restTokensLower.every(token => searchable.includes(token));

          if (passesFilter) {
            allMatches.push({
              nickname,
              entry,
              resolvedUrl: entry.url,
              tier: nickTier,
              isDynamic: false,
              dynamicArg: ''
            });
            addedInNickTier = true;
          }
        }
      }

      // ニックネーム基準でヒットしなかった場合でも、全キーワードがタイトル・URL等に含まれれば横断検索（Tier 4）としてヒットさせる
      if (!addedInNickTier) {
        const fullSearchable = `${nickname} ${entry.title || ''} ${entry.url} ${entry.default_value || ''}`.toLowerCase();
        if (allTokensLower.every(token => fullSearchable.includes(token))) {
          allMatches.push({
            nickname,
            entry,
            resolvedUrl: dynamic ? resolveFallbackUrl(entry) : entry.url,
            tier: 4,
            isDynamic: dynamic,
            dynamicArg: ''
          });
        }
      }
    }
  }

  // マッチ度ティア昇順 ＞ ピン留め優先 ＞ スコア降順 ＞ URL昇順 でソートする
  allMatches.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const pA = a.entry.is_pinned ? 1 : 0;
    const pB = b.entry.is_pinned ? 1 : 0;
    if (pB !== pA) return pB - pA;
    if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
    return a.resolvedUrl.localeCompare(b.resolvedUrl);
  });

  return allMatches;
}

/**
 * コマンド入力文字列を解析し、マッチするコマンドのリストを返します。
 * @param text - 入力されたコマンド文字列（例: ":add mynick"）
 * @param bookmarks - 現在のブックマークデータ
 * @returns マッチしたコマンド候補の配列
 */
export function resolveCommandMatches(
  text: string,
  bookmarks: Record<string, BookmarkEntry[]>
): { content: string; description: string }[] {
  const firstSpaceIndex = text.indexOf(' ');
  const hasSpace = firstSpaceIndex !== -1;
  const cmd = !hasSpace ? text : text.substring(0, firstSpaceIndex);
  const restTrimmed = (!hasSpace ? '' : text.substring(firstSpaceIndex + 1)).trim();
  const rawRest = !hasSpace ? '' : text.substring(firstSpaceIndex + 1);

  const commandMatches: { content: string; description: string }[] = [];
  const sortedNicknames = getSortedNicknames(bookmarks);

  /**
   * コマンド名が入力にマッチするかを判定します。
   * スペース入力前は前方一致、スペース入力後はコマンド確定とみなして完全一致で判定します。
   * @param targetCmds - 判定対象のコマンド名リスト
   * @returns マッチする場合は true
   */
  const isCmdMatch = (targetCmds: string[]): boolean => {
    if (hasSpace) {
      return targetCmds.includes(cmd);
    }
    return targetCmds.some(target => target.startsWith(cmd));
  };

  /**
   * ニックネームのサマリー（タイトルや URL 件数など）をオムニボックス用の XML 形式で取得します。
   * @param n - 対象のニックネーム
   * @returns フォーマット済みの説明文字列
   */
  const getNicknameSummary = (n: string): string => {
    const entries = bookmarks[n] || [];
    const escapedN = escapeXml(n);
    if (entries.length === 1) {
      const title = escapeXml(entries[0].title) || 'No title';
      const url = escapeXml(formatUrlForOmniboxDisplay(entries[0].url));
      return `<match>${escapedN}</match> ${title} - <url>${url}</url>`;
    } else if (entries.length > 1) {
      return `<match>${escapedN}</match> - Multiple URLs (${entries.length})`;
    }
    return `<match>${escapedN}</match>`;
  };

  // :add / :a コマンド
  if (isCmdMatch([':add', ':a'])) {
    const restParts = restTrimmed ? restTrimmed.split(/\s+/) : [];
    const isBookmarkletArg = restParts.length >= 2 && isBookmarkletUrl(restParts[1]);
    const isDirectUrl = restParts.length >= 2 && /^https?:\/\/\S+$/i.test(restParts[1]);
    const modeHint = isBookmarkletArg
      ? 'Add bookmarklet'
      : isDirectUrl
        ? 'Add custom URL'
        : 'Add current tab (or [nickname] [https://... | javascript:...] [title])';

    // 新規ニックネーム登録時に既存候補へ意図せず補完されないよう、先頭は常に入力値そのままを維持する
    commandMatches.push({
      content: ':add ' + restTrimmed,
      description: `<match>:add</match> ${escapeXml(rawRest) || '[nickname] [url(optional)] [title(optional)]'} - ${modeHint}`
    });

    // スペース入力後かつニックネーム入力段階（0〜1トークン）の場合は、2行目以降に既存ニックネーム候補を補完表示する
    if (hasSpace && restParts.length <= 1) {
      const nicknameInput = restParts[0] || '';
      const nickCandidates = nicknameInput
        ? sortedNicknames.filter(
            n => n.toLowerCase().startsWith(nicknameInput.toLowerCase()) && n !== nicknameInput
          )
        : sortedNicknames;

      for (const n of nickCandidates.slice(0, 8)) {
        commandMatches.push({
          content: `:add ${n}`,
          description: `<match>:add</match> ${getNicknameSummary(n)}`
        });
      }
    }
  }

  // :addall / :aa コマンド
  if (isCmdMatch([':addall', ':aa'])) {
    const restParts = restTrimmed ? restTrimmed.split(/\s+/) : [];

    // 先頭は常に入力値そのままを維持する
    commandMatches.push({
      content: ':addall ' + restTrimmed,
      description: `<match>:addall</match> ${escapeXml(rawRest) || '[nickname]'} - Add all tabs in current window`
    });

    // スペース入力後かつニックネーム入力段階では既存ニックネーム候補を2行目以降に補完表示する
    if (hasSpace && restParts.length <= 1) {
      const nicknameInput = restParts[0] || '';
      const nickCandidates = nicknameInput
        ? sortedNicknames.filter(
            n => n.toLowerCase().startsWith(nicknameInput.toLowerCase()) && n !== nicknameInput
          )
        : sortedNicknames;

      for (const n of nickCandidates.slice(0, 8)) {
        commandMatches.push({
          content: `:addall ${n}`,
          description: `<match>:addall</match> ${getNicknameSummary(n)}`
        });
      }
    }
  }

  // :ls コマンド
  if (isCmdMatch([':ls'])) {
    commandMatches.push({
      content: ':ls',
      description: `<match>:ls</match> - Open Options / Manage Nickmarks`
    });
  }

  // :prefs コマンド
  if (isCmdMatch([':prefs'])) {
    commandMatches.push({
      content: ':prefs',
      description: `<match>:prefs</match> - Open Preferences / Language Settings`
    });
  }

  // :help コマンド
  if (isCmdMatch([':help'])) {
    commandMatches.push({
      content: ':help',
      description: `<match>:help</match> - Open Help / Documentation`
    });
  }

  // :open / :o コマンド
  if (isCmdMatch([':open', ':o'])) {
    const folders = extractFolders(bookmarks);
    if (!restTrimmed) {
      commandMatches.push({
        content: ':open ',
        description: `<match>:open</match> [nickname or folder/] - Open all URLs in new tabs`
      });
      if (cmd === ':open' || cmd === ':o') {
        // フォルダ候補を優先提示
        for (const f of Array.from(folders.values()).slice(0, 4)) {
          if (f.openableUrlCount > 0) {
            commandMatches.push({
              content: `:open ${f.path}/`,
              description: `<match>:open</match> 📁 ${escapeXml(f.path)}/ <dim>(${f.openableUrlCount} tabs)</dim>`
            });
          }
        }
        for (const n of sortedNicknames.slice(0, 6)) {
          commandMatches.push({
            content: `:open ${n}`,
            description: `<match>:open</match> ${getNicknameSummary(n)}`
          });
        }
      }
    } else {
      const lowerInput = restTrimmed.toLowerCase();
      // フォルダ候補の一致を検索
      for (const f of folders.values()) {
        if (
          f.openableUrlCount > 0 &&
          (f.path.toLowerCase().startsWith(lowerInput) || `${f.path}/`.toLowerCase().startsWith(lowerInput))
        ) {
          commandMatches.push({
            content: `:open ${f.path}/`,
            description: `<match>:open</match> 📁 ${escapeXml(f.path)}/ <dim>(${f.openableUrlCount} tabs)</dim>`
          });
        }
      }
      const matches = sortedNicknames.filter(n => n.toLowerCase().startsWith(lowerInput));
      for (const n of matches) {
        commandMatches.push({
          content: `:open ${n}`,
          description: `<match>:open</match> ${getNicknameSummary(n)}`
        });
      }
      if (commandMatches.length === 0) {
        commandMatches.push({
          content: text,
          description: `<match>:open</match> No nicknames or folders match "${escapeXml(restTrimmed)}"`
        });
      }
    }
  }

  // :rm コマンド
  if (isCmdMatch([':rm'])) {
    if (!restTrimmed) {
      commandMatches.push({
        content: ':rm ',
        description: `<match>:rm</match> [nickname] - Remove Nickmark`
      });
      if (cmd === ':rm') {
        for (const n of sortedNicknames.slice(0, 8)) {
          commandMatches.push({
            content: `:rm ${n}`,
            description: `<match>:rm</match> ${getNicknameSummary(n)}`
          });
        }
      }
    } else {
      const nicknameParts = restTrimmed.split(/\s+/);
      const nicknameInput = nicknameParts[0];
      const urlInput = nicknameParts.slice(1).join(' ').trim();
      const lowerNickInput = nicknameInput.toLowerCase();

      const matches = sortedNicknames.filter(n => n.toLowerCase().startsWith(lowerNickInput));
      
      if (matches.length === 0) {
        commandMatches.push({
          content: text,
          description: `<match>:rm</match> No nicknames match "${escapeXml(restTrimmed)}"`
        });
      } else {
        for (const n of matches) {
          const entries = bookmarks[n];
          if (n.toLowerCase() === lowerNickInput && entries.length > 1) {
            // 複数の URL がある場合は、誤削除防止のために警告/案内を先頭に表示する
            if (!urlInput) {
              const msg = t("errorMultipleUrlsFound") || "Multiple URLs found. Select one below or Enter to manage.";
              commandMatches.push({
                content: `:rm ${n}`,
                description: `⚠️ <match>${escapeXml(n)}</match> - ${msg}`
              });
            }

            for (const entry of entries) {
              if (!urlInput || entry.url.toLowerCase().includes(urlInput.toLowerCase())) {
                const title = escapeXml(entry.title) || 'No title';
                const url = escapeXml(formatUrlForOmniboxDisplay(entry.url));
                commandMatches.push({
                  content: `:rm ${n} ${entry.url}`,
                  description: `<match>:rm ${escapeXml(n)}</match> ${title} - <url>${url}</url>`
                });
              }
            }
          } else {
            commandMatches.push({
              content: `:rm ${n}`,
              description: `<match>:rm</match> ${getNicknameSummary(n)}`
            });
          }
        }
      }
    }
  }

  return commandMatches;
}

/**
 * コマンドモード入力時のサジェストを処理します。
 * @param text - 入力されたテキスト
 * @param suggest - サジェスト結果を返すためのコールバック関数
 * @param bookmarks - 現在のブックマークデータ
 * @returns なし
 */
function handleCommandModeSuggestions(
  text: string, 
  suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void, 
  bookmarks: Record<string, BookmarkEntry[]>
): void {
  const commandMatches = resolveCommandMatches(text, bookmarks);
  const suggestions: chrome.omnibox.SuggestResult[] = [];
  const hasSpace = text.includes(' ');

  if (commandMatches.length === 1 || (hasSpace && commandMatches.length > 0)) {
    // コマンドが1つに絞られた場合、またはスペース入力によりコマンドが確定している場合は実行表示にする
    chrome.omnibox.setDefaultSuggestion({ description: `Run command: ${commandMatches[0].description}` });
  } else if (commandMatches.length > 1) {
    chrome.omnibox.setDefaultSuggestion({ description: `Search commands for: <match>${escapeXml(text)}</match>` });
  } else {
    chrome.omnibox.setDefaultSuggestion({ description: `Invalid command: <match>${escapeXml(text)}</match>` });
  }

  for (const match of commandMatches) {
    let finalContent = match.content;
    // Chrome が候補を非表示にするのを防ぐため、入力テキストで始まるように調整します
    if (!finalContent.startsWith(text) && text.startsWith(match.content)) {
      finalContent = text;
    }
    suggestions.push({ content: finalContent, description: match.description });
  }

  suggest(suggestions);
}

/**
 * 検索マッチ結果からオムニボックス表示用の説明文（XML）を生成します。
 * @param match - 検索マッチ結果
 * @returns XML エスケープ済みのサジェスト説明文
 */
function formatSearchMatchDescription(match: ResolvedSearchMatch): string {
  const mTitle = escapeXml(match.entry.title) || 'No title';
  const isBookmarklet = isBookmarkletUrl(match.resolvedUrl);
  const mUrl = escapeXml(formatUrlForOmniboxDisplay(match.resolvedUrl));
  const typeBadge = isBookmarklet
    ? ' <dim>[JS]</dim>'
    : match.isDynamic
      ? match.dynamicArg
        ? ` <dim>(${escapeXml(match.dynamicArg)})</dim>`
        : ' <dim>[%s]</dim>'
      : '';
  return `<match>${escapeXml(match.nickname)}</match>${typeBadge}: ${mTitle} - <url>${mUrl}</url>`;
}

/**
 * 通常検索のマッチ結果リストから、オムニボックスに渡すサジェスト候補配列と遷移先解決マップを構築します。
 * 候補を選択（ハイライト）した際に URL ではなく選択したニックネーム（動的 URL の引数入力時は「ニックネーム 引数」）が
 * アドレスバーに表示されるように `content` を生成します。
 * 同一ニックネームに複数の URL が登録されている場合や、横断検索等でニックネーム単独検索時の最上位と異なるエントリが
 * ヒットした場合には、不可視のゼロ幅文字マーカーを付与して候補の一意性と正確な遷移先解決を保証します。
 * @param rawText - オムニボックスの現在の生入力テキスト
 * @param allMatches - ソート済みの検索マッチ結果配列
 * @param bookmarks - 現在のブックマークデータ
 * @returns サジェスト候補配列と content 文字列から遷移先への対応マップ
 */
export function buildRegularSearchSuggestions(
  rawText: string,
  allMatches: ResolvedSearchMatch[],
  bookmarks: Record<string, BookmarkEntry[]>
): {
  suggestions: chrome.omnibox.SuggestResult[];
  matchMap: Map<string, SuggestedMatchTarget>;
} {
  const suggestions: chrome.omnibox.SuggestResult[] = [];
  const matchMap = new Map<string, SuggestedMatchTarget>();
  const usedContents = new Set<string>();
  const defaultTopCache = new Map<string, ResolvedSearchMatch | null>();

  const topMatches = allMatches.slice(0, 10);

  for (let i = 0; i < topMatches.length; i++) {
    const match = topMatches[i];
    // アドレスバー上に表示させたいベース文字列（通常はニックネーム、動的URL引数がある場合は「ニックネーム 引数」）
    const baseContent =
      match.isDynamic && match.dynamicArg
        ? `${match.nickname} ${match.dynamicArg}`
        : match.nickname;

    // ベース文字列そのままで検索した際の先頭候補をキャッシュ付きで取得する
    if (!defaultTopCache.has(baseContent)) {
      const resolved = resolveRegularSearchMatches(baseContent, bookmarks);
      defaultTopCache.set(baseContent, resolved.length > 0 ? resolved[0] : null);
    }
    const defaultTop = defaultTopCache.get(baseContent) || null;

    // プレーンな baseContent をそのまま onInputEntered に渡しても同じエントリに解決されるかを判定する
    const resolvesToSameEntry =
      !!defaultTop &&
      defaultTop.nickname === match.nickname &&
      defaultTop.entry.url === match.entry.url &&
      defaultTop.resolvedUrl === match.resolvedUrl;

    // 候補が複数ある状態で content が生入力 rawText と完全一致すると Chrome がその行を非表示にするため回避する
    const conflictsWithRawInput = allMatches.length > 1 && baseContent === rawText;

    const canUsePlainContent =
      !usedContents.has(baseContent) &&
      !conflictsWithRawInput &&
      resolvesToSameEntry;

    let finalContent: string;
    if (canUsePlainContent) {
      finalContent = baseContent;
    } else {
      const entriesForNick = bookmarks[match.nickname] || [];
      const entryIndex = entriesForNick.indexOf(match.entry);
      let markerSeed = entryIndex >= 0 ? entryIndex : i;
      finalContent = baseContent + encodeZeroWidthIndex(markerSeed);

      // 万が一既存の候補や現在の生入力と衝突した場合はシードを増やして確実に一意化する
      let fallbackSeed = entriesForNick.length + i + 1;
      while (usedContents.has(finalContent) || (allMatches.length > 1 && finalContent === rawText)) {
        finalContent = baseContent + encodeZeroWidthIndex(fallbackSeed++);
      }
    }

    usedContents.add(finalContent);
    matchMap.set(finalContent, {
      nickname: match.nickname,
      resolvedUrl: match.resolvedUrl,
      templateUrl: match.entry.url
    });

    suggestions.push({
      content: finalContent,
      description: formatSearchMatchDescription(match)
    });
  }

  return { suggestions, matchMap };
}

/**
 * 通常検索モード入力時のサジェストを処理します。
 * @param text - 入力されたテキスト
 * @param suggest - サジェスト結果を返すためのコールバック関数
 * @param bookmarks - 現在のブックマークデータ
 * @returns なし
 */
function handleRegularSearchSuggestions(
  text: string, 
  suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void, 
  bookmarks: Record<string, BookmarkEntry[]>
): void {
  const trimmed = stripZeroWidthChars(text).trim();
  const allMatches = resolveRegularSearchMatches(trimmed, bookmarks);
  const folders = extractFolders(bookmarks);

  // 末尾がスラッシュの場合はフォルダ一括オープンの指定とみなす
  const isExplicitFolderInput = trimmed.endsWith('/');
  const normalizedFolderQuery = trimmed.replace(/\/+$/, '');
  const matchedFolder = folders.get(normalizedFolderQuery);

  if (isExplicitFolderInput && matchedFolder && matchedFolder.openableUrlCount > 0) {
    // フォルダ一括オープンを最上位（デフォルト候補）に設定
    const desc = t('openAllInFolder', [matchedFolder.path, String(matchedFolder.openableUrlCount)]) ||
      `📁 フォルダ「${matchedFolder.path}」の全ブックマークを一括オープン (${matchedFolder.openableUrlCount}タブ)`;
    chrome.omnibox.setDefaultSuggestion({
      description: `<match>${escapeXml(matchedFolder.path)}/</match> - ${escapeXml(desc)}`
    });
  } else if (allMatches.length === 1) {
    const actionLabel = isBookmarkletUrl(allMatches[0].resolvedUrl) ? 'Run' : 'Go to';
    chrome.omnibox.setDefaultSuggestion({
      description: `${actionLabel} ${formatSearchMatchDescription(allMatches[0])}`
    });
  } else if (allMatches.length > 0) {
    const top = allMatches[0];
    const topTitle = escapeXml(top.entry.title) || 'No title';
    const topUrl = escapeXml(formatUrlForOmniboxDisplay(top.resolvedUrl));
    chrome.omnibox.setDefaultSuggestion({
      description: `Search for: <match>${escapeXml(trimmed)}</match> <dim>- ${topTitle} (${topUrl})</dim>`
    });
  } else {
    chrome.omnibox.setDefaultSuggestion({
      description: `No matches found for: <match>${escapeXml(trimmed)}</match>`
    });
  }

  const { suggestions, matchMap } = buildRegularSearchSuggestions(text, allMatches, bookmarks);

  // 末尾スラッシュでない通常入力時でも、該当するフォルダが存在する場合はサジェスト内に一括オープン候補を提示
  if (!isExplicitFolderInput && trimmed) {
    const lowerTrimmed = trimmed.toLowerCase();
    for (const folder of folders.values()) {
      if (
        folder.openableUrlCount > 0 &&
        (folder.path.toLowerCase() === lowerTrimmed || folder.path.toLowerCase().startsWith(lowerTrimmed))
      ) {
        const folderContent = `${folder.path}/`;
        const summaryDesc = t('openFolderSummary', [folder.path, String(folder.openableUrlCount)]) ||
          `📁 ${folder.path} (${folder.openableUrlCount}タブを一括オープン)`;
        suggestions.unshift({
          content: folderContent,
          description: `<match>${escapeXml(folder.path)}/</match> <dim>- ${escapeXml(summaryDesc)}</dim>`
        });
        break; // 候補が氾濫しないよう最上位の一致フォルダ1件を提示
      }
    }
  }

  lastSuggestedMatchMap = matchMap;

  suggest(suggestions);
}

/**
 * ブックマーク一覧画面を既存のタブで開くか、なければ新しく開きます。
 * メッセージがある場合はトーストとして表示します。
 */
async function openOrReuseListTab(params?: { msg?: string; url?: string; title?: string }) {
  const listUrl = chrome.runtime.getURL('list.html');
  const tabs = await chrome.tabs.query({ url: listUrl + '*' });

  if (tabs.length > 0) {
    const tab = tabs[0];
    if (tab.id !== undefined) {
      // 既存のタブをアクティブにする
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      // ページの状態を更新するメッセージを送信
      chrome.tabs.sendMessage(tab.id, { action: 'updatePage', ...params });
    }
  } else {
    // 存在しない場合は新しく開く
    let url = listUrl;
    if (params) {
      const query = new URLSearchParams();
      if (params.msg) query.append('msg', params.msg);
      if (params.url) query.append('url', params.url);
      if (params.title) query.append('title', params.title);
      url += '?' + query.toString();
    }
    chrome.tabs.create({ url });
  }
}

/**
 * 現在のタブに一時的なトースト通知を表示します。
 * スクリプトの実行権限がないページ（chrome:// やストア等）では、既存の一覧画面があればそこに移動し、なければ新しいタブで開いてメッセージを表示します。
 * @param tabId - 対象となるタブの ID
 * @param message - 表示するメッセージ文字列
 * @param durationMs - トーストの表示時間（ミリ秒、デフォルト: 3000）
 * @returns 処理完了を示す Promise
 */
export async function showToast(tabId: number, message: string, durationMs: number = 3000): Promise<void> {
  // 事前にスクリプト実行不可ページと判明している場合は直接一覧画面で通知を表示する
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg: string, duration: number) => {
        const id = 'nickmark-toast';
        const existing = document.getElementById(id);
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = id;
        div.textContent = msg;
        Object.assign(div.style, {
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: '2147483647',
          maxWidth: '80vw',
          padding: '12px 24px',
          backgroundColor: '#323232',
          color: '#ffffff',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          lineHeight: '1.5',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: 'opacity 0.3s, transform 0.3s',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          pointerEvents: 'none',
          opacity: '0'
        });

        document.body.appendChild(div);
        div.offsetHeight;
        div.style.opacity = '1';
        div.style.transform = 'translateX(-50%) translateY(8px)';

        setTimeout(() => {
          div.style.opacity = '0';
          div.style.transform = 'translateX(-50%)';
          setTimeout(() => div.remove(), 300);
        }, duration);
      },
      args: [message, durationMs]
    });
  } catch (e) {
    // スクリプト実行権限がないページの場合はブックマーク一覧画面で表示
    await openOrReuseListTab({ msg: message });
  }
}

/**
 * 対象の URL が使用された際に、スコアと最終使用日時を更新します。
 * 動的 URL から展開された遷移先 URL の場合も、元のテンプレートエントリを特定して更新します。
 * @param url - 実際に使用（遷移）された URL
 * @param templateUrl - 元のブックマークエントリの URL（既知の場合に指定）
 * @param nickname - 対象のニックネーム（既知の場合に指定するとそのニックネーム配下のみを更新）
 * @returns 処理完了を示す Promise
 */
async function updateScore(url: string, templateUrl?: string, nickname?: string): Promise<void> {
  const bookmarks = await loadBookmarksData();
  let updated = false;
  const targetGroups =
    nickname && bookmarks[nickname]
      ? [bookmarks[nickname]]
      : Object.values(bookmarks);

  for (const entries of targetGroups) {
    for (const entry of entries) {
      const isMatched = templateUrl
        ? entry.url === templateUrl
        : entry.url === url || matchesDynamicEntry(entry, url);
      if (isMatched) {
        entry.score = calculateNewScore(entry.score, entry.last_used_at);
        entry.last_used_at = Date.now();
        updated = true;
      }
    }
  }
  if (updated) await saveBookmarksData(bookmarks);
}

/**
 * `chrome.userScripts` API を使用して、現在アクティブなタブのメインワールド（MAIN）でブックマークレットを実行します。
 * 特殊ページ（`chrome://` やストア等）や「ユーザー スクリプトを許可する」が未有効な場合はエラートーストを表示します。
 * @param bookmarkletUrl - `javascript:` で始まるブックマークレット文字列
 * @param currentTab - 実行対象となる現在アクティブなタブ
 * @param matchedTemplateUrl - スコア更新用の元テンプレート URL
 * @param matchedNickname - スコア更新用の対象ニックネーム
 * @returns 処理完了を示す Promise
 */
async function executeBookmarkletOnTab(
  bookmarkletUrl: string,
  currentTab: chrome.tabs.Tab | undefined,
  matchedTemplateUrl?: string,
  matchedNickname?: string
): Promise<void> {
  if (!currentTab || currentTab.id === undefined) return;

  // chrome:// やウェブストア等のスクリプト注入が禁止されている保護ページをガードする
  if (isRestrictedTabUrl(currentTab.url)) {
    await showToast(
      currentTab.id,
      t('errorBookmarkletRestrictedPage') ||
        'このページ（ブラウザ内部ページやストア等）ではブックマークレットを実行できません。',
      4500
    );
    return;
  }

  // 拡張機能の詳細設定で「ユーザー スクリプトを許可する」が有効になっているか確認する
  if (!isUserScriptsAvailable()) {
    await showToast(
      currentTab.id,
      t('errorUserScriptsNotAllowed') ||
        'ブックマークレットを実行するには、拡張機能の詳細設定（chrome://extensions）で「ユーザー スクリプトを許可する」を有効にしてください。',
      5000
    );
    return;
  }

  // 先頭の javascript: を除去し、%20 などのパーセントエンコードをデコードする
  const code = extractBookmarkletCode(bookmarkletUrl).trim();
  if (!code) {
    await showToast(
      currentTab.id,
      t('errorBookmarkletEmpty') || 'ブックマークレットのコードが空です。',
      4000
    );
    return;
  }

  try {
    const results = await chrome.userScripts.execute({
      target: { tabId: currentTab.id },
      js: [{ code }],
      world: 'MAIN',
      injectImmediately: true
    });

    // 実行結果にエラーが含まれている場合はトーストで通知する
    const failedResult = results?.find((res) => 'error' in res && !!res.error);
    if (failedResult && 'error' in failedResult && failedResult.error) {
      await showToast(
        currentTab.id,
        t('errorBookmarkletExecutionFailed', [failedResult.error]) ||
          `ブックマークレットの実行中にエラーが発生しました: ${failedResult.error}`,
        5000
      );
      return;
    }

    // 正常に実行されたら対象エントリのスコアと最終使用日時を更新する
    await updateScore(bookmarkletUrl, matchedTemplateUrl, matchedNickname);
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (/Cannot access|extensions gallery cannot be scripted|scheme/i.test(errMsg)) {
      await showToast(
        currentTab.id,
        t('errorBookmarkletRestrictedPage') ||
          'このページ（ブラウザ内部ページやストア等）ではブックマークレットを実行できません。',
        4500
      );
    } else if (/userScripts|User scripts/i.test(errMsg)) {
      await showToast(
        currentTab.id,
        t('errorUserScriptsNotAllowed') ||
          'ブックマークレットを実行するには、拡張機能の詳細設定（chrome://extensions）で「ユーザー スクリプトを許可する」を有効にしてください。',
        5000
      );
    } else {
      await showToast(
        currentTab.id,
        t('errorBookmarkletExecutionFailed', [errMsg]) ||
          `ブックマークレットの実行中にエラーが発生しました: ${errMsg}`,
        5000
      );
    }
  }
}

/**
 * 確定したコマンド（:add, :addall, :open, :ls, :prefs, :help, :rm）を実行します。
 * @param resolvedContent - 補完済みのコマンド文字列
 * @param currentTab - 現在アクティブなタブ
 * @returns 処理完了を示す Promise
 */
async function executeCommand(resolvedContent: string, currentTab: chrome.tabs.Tab): Promise<void> {
  const parts = resolvedContent.split(/\s+/);
  const cmd = parts[0];

  if (cmd === ':ls') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (cmd === ':prefs') {
    const prefsUrl = chrome.runtime.getURL('preferences.html');
    chrome.tabs.create({ url: prefsUrl });
    return;
  }

  if (cmd === ':help') {
    const locale = getCurrentLocale();
    const helpUrl = locale === 'ja' 
      ? 'https://sawara.me/extensions/nickmark' 
      : 'https://sawara.me/en/extensions/nickmark';
    chrome.tabs.create({ url: helpUrl });
    return;
  }

  if (!currentTab || !currentTab.id) return;

  if (cmd === ':addall' || cmd === ':aa') {
    const nickname = parts[1];
    if (!nickname) {
      await showToast(currentTab.id, t("errorNicknameRequired") || 'ニックネームを指定してください。');
      return;
    }

    const tabs = await chrome.tabs.query({ currentWindow: true });
    const bookmarks = await loadBookmarksData();
    if (!bookmarks[nickname]) bookmarks[nickname] = [];

    let addedCount = 0;
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
        // まだ登録されていない場合のみ追加
        if (!bookmarks[nickname].some(b => isSameUrl(b.url, tab.url!))) {
          bookmarks[nickname].push({
            url: tab.url,
            title: tab.title || '',
            score: 1.0,
            last_used_at: Date.now(),
            created_at: Date.now()
          });
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      try {
        await saveBookmarksData(bookmarks);
        await showToast(currentTab.id, t("bookmarkAllAddedMessage", [addedCount.toString(), nickname]) || `${addedCount} 件のタブを '${nickname}' として登録しました！`);
      } catch (e: any) {
        if (e.message === 'QUOTA_EXCEEDED') {
          await showToast(currentTab.id, t("errorSyncQuotaExceeded") || 'データサイズ制限（100KB）を超えたため保存できませんでした。');
        } else {
          await showToast(currentTab.id, 'Error: ' + e.message);
        }
      }
    } else {
      await showToast(currentTab.id, t("bookmarkAlreadyExistsMessage", [nickname]) || `このURLはすでにニックネーム「${nickname}」に登録されています。`);
    }
    return;
  }

  if (cmd === ':add' || cmd === ':a') {
    const nickname = parts[1];
    if (!nickname) {
      const url = currentTab.url || '';
      const title = currentTab.title || '';
      await openOrReuseListTab({ url, title });
      return;
    }

    // 第2引数が http(s):// または javascript: で始まる場合は直接 URL 指定モードとして扱う
    const secondArg = parts[2] || '';
    const isBookmarkletArg = isBookmarkletUrl(secondArg);
    const isDirectHttpUrl = /^https?:\/\/\S+$/i.test(secondArg);
    const isDirectUrl = isBookmarkletArg || isDirectHttpUrl;

    // ブックマークレットはコード内にスペースを含み得るため、ニックネーム以降の文字列全体をコードとして取得する
    const rawAfterNicknameMatch = resolvedContent.match(/^:(?:add|a)\s+\S+\s+([\s\S]+)$/);
    const targetUrl = isBookmarkletArg
      ? (rawAfterNicknameMatch ? rawAfterNicknameMatch[1].trim() : secondArg)
      : isDirectHttpUrl
        ? secondArg
        : (currentTab.url || '');
    const customTitle = isBookmarkletArg
      ? ''
      : isDirectHttpUrl
        ? parts.slice(3).join(' ').trim()
        : parts.slice(2).join(' ').trim();
    const defaultTitle = isDirectUrl ? '' : (currentTab.title || '');

    if (targetUrl) {
      const bookmarks = await loadBookmarksData();
      if (!bookmarks[nickname]) bookmarks[nickname] = [];

      const existingEntry = bookmarks[nickname].find(b => isSameUrl(b.url, targetUrl));

      if (!existingEntry) {
        // 未登録の URL の場合は新規追加する
        bookmarks[nickname].push({
          url: targetUrl,
          title: customTitle || defaultTitle,
          score: 1.0,
          last_used_at: Date.now(),
          created_at: Date.now()
        });
        try {
          await saveBookmarksData(bookmarks);
          await showToast(currentTab.id, t("bookmarkAddedMessage", [nickname]) || `'${nickname}' として登録しました！`);
        } catch (e: any) {
          if (e.message === 'QUOTA_EXCEEDED') {
            await showToast(currentTab.id, t("errorSyncQuotaExceeded") || 'データサイズ制限（100KB）を超えたため保存できませんでした。');
          } else {
            await showToast(currentTab.id, 'Error: ' + e.message);
          }
        }
      } else if (customTitle) {
        // 既に登録済みでもカスタムタイトルが指定されている場合はタイトルを上書き更新する
        existingEntry.title = customTitle;
        try {
          await saveBookmarksData(bookmarks);
          await showToast(currentTab.id, t("bookmarkTitleUpdatedMessage", [nickname]) || `ニックネーム「${nickname}」のタイトルを更新しました！`);
        } catch (e: any) {
          if (e.message === 'QUOTA_EXCEEDED') {
            await showToast(currentTab.id, t("errorSyncQuotaExceeded") || 'データサイズ制限（100KB）を超えたため保存できませんでした。');
          } else {
            await showToast(currentTab.id, 'Error: ' + e.message);
          }
        }
      } else {
        // 既に登録済みでタイトル指定もない場合は登録済みである旨を通知する
        await showToast(currentTab.id, t("bookmarkAlreadyExistsMessage", [nickname]) || `このURLはすでにニックネーム「${nickname}」に登録されています。`);
      }
    }
    return;
  } 

  if (cmd === ':open' || cmd === ':o') {
    const rawTarget = parts[1];
    if (!rawTarget) {
      await showToast(currentTab.id, t("errorNicknameRequired") || 'ニックネームを指定してください。');
      return;
    }

    const bookmarks = await loadBookmarksData();
    const isExplicitFolder = rawTarget.endsWith('/');
    const cleanTarget = rawTarget.replace(/^\/+|\/+$/g, '');

    // 1. 明示的なフォルダ指定でなく、単一ニックネームとして存在する場合は単一ニックネームを開く
    if (!isExplicitFolder && bookmarks[rawTarget]) {
      const entries = bookmarks[rawTarget];
      let openedCount = 0;
      let skippedBookmarkletCount = 0;

      for (const entry of entries) {
        if (isBookmarkletUrl(entry.url)) {
          skippedBookmarkletCount++;
          continue;
        }
        const urlToOpen = isDynamicUrl(entry.url) ? resolveFallbackUrl(entry) : entry.url;
        chrome.tabs.create({ url: urlToOpen, active: false });
        await updateScore(urlToOpen, entry.url, rawTarget);
        openedCount++;
      }

      if (openedCount === 0 && skippedBookmarkletCount > 0) {
        await showToast(
          currentTab.id,
          t("errorOpenSkippedAllBookmarklets", [rawTarget]) ||
            `ニックネーム「${rawTarget}」はブックマークレットのみのため、:open での別タブ起動をスキップしました。`,
          4000
        );
      }
      return;
    }

    // 2. フォルダとして存在するか（または明示的フォルダ指定の場合）を判定して一括オープン
    const folders = extractFolders(bookmarks);
    if (folders.has(cleanTarget) || isExplicitFolder) {
      const result = await openFolderUrls(cleanTarget, false, currentTab.id);
      if (result.requiresConfirmation && result.folderPath && result.urls) {
        await handleBatchOpenConfirmationRequest(currentTab.id, result.folderPath, result.urls, result.nicknames || []);
      }
      return;
    }

    // 3. どちらも見つからない場合
    await showToast(currentTab.id, t("errorNicknameNotFound", [rawTarget]) || `ニックネームまたはフォルダ「${rawTarget}」が見つかりませんでした。`);
    return;
  }

  if (cmd === ':rm') {
    const nickname = parts[1];
    // ブックマークレット内の連続スペース等を潰さないよう、元のコマンド文字列から削除対象 URL を抽出する
    const rawAfterRmMatch = resolvedContent.match(/^:rm\s+\S+\s+([\s\S]+)$/);
    const urlToDelete = rawAfterRmMatch ? rawAfterRmMatch[1].trim() : '';

    if (!nickname) {
      await showToast(currentTab.id, t("errorNicknameRequired") || 'ニックネームを指定してください。');
      return;
    }

    const bookmarks = await loadBookmarksData();
    if (bookmarks[nickname]) {
      if (urlToDelete) {
        const initialLength = bookmarks[nickname].length;
        bookmarks[nickname] = bookmarks[nickname].filter(b => !isSameUrl(b.url, urlToDelete));
        if (bookmarks[nickname].length === 0) delete bookmarks[nickname];
        
        if (bookmarks[nickname]?.length < initialLength || !bookmarks[nickname]) {
          try {
            await saveBookmarksData(bookmarks);
            await showToast(currentTab.id, t("bookmarkUrlRemovedMessage", [nickname]) || `'${nickname}' の URL を削除しました。`);
          } catch (e: any) {
            await showToast(currentTab.id, 'Error: ' + e.message);
          }
        }
 else {
          await showToast(currentTab.id, t("errorUrlNotFound", [nickname]) || `URL が見つかりませんでした。`);
        }
      } else {
        if (bookmarks[nickname].length > 1) {
          const message = t("errorMultipleUrlsFound") || "複数の URL が登録されています。候補から選択するか、管理画面から削除してください。";
          await openOrReuseListTab({ msg: message });
        } else {
          delete bookmarks[nickname];
          try {
            await saveBookmarksData(bookmarks);
            await showToast(currentTab.id, t("bookmarkRemovedMessage", [nickname]) || `'${nickname}' を削除しました。`);
          } catch (e: any) {
            await showToast(currentTab.id, 'Error: ' + e.message);
          }
        }
      }
    } else {
      await showToast(currentTab.id, t("errorNicknameNotFound", [nickname]) || `ニックネームが見つかりませんでした。`);
    }
    return;
  }
}


// オムニボックス入力のデバウンス制御用変数
let omniboxDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastPendingSuggest: ((suggestResults: chrome.omnibox.SuggestResult[]) => void) | null = null;
let currentRequestId = 0;

/**
 * 保留中のサジェストタイマーとコールバックをクリアし、Chrome への応答を完了させます。
 * @returns {void}
 */
function clearPendingSuggest(): void {
  if (omniboxDebounceTimer) {
    clearTimeout(omniboxDebounceTimer);
    omniboxDebounceTimer = null;
  }
  if (lastPendingSuggest) {
    try {
      lastPendingSuggest([]);
    } catch (e) {
      // 既にコールバックが解決されている場合などの安全対策
    }
    lastPendingSuggest = null;
  }
}

// バックグラウンドの Service Worker 環境でのみ初期化とリスナー登録を行います。
if (typeof window === 'undefined') {

  // i18n 初期化
  initI18n();

  // 起動時にブックマークキャッシュを先読み
  loadBookmarksData().catch((err) => {
    console.error('Failed to pre-warm bookmarks cache on startup:', err);
  });

  // ストレージの変更を監視し、キャッシュや言語設定を常に最新の状態に保ちます
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local') {
      if (changes.language) {
        await initI18n();
        // 言語設定が変更されたらコンテキストメニューのタイトルも更新する
        chrome.contextMenus.update('help-page', {
          title: t('helpMenu')
        });
      }
      if (changes.isSyncEnabled) {
        isSyncEnabledCache = !!changes.isSyncEnabled.newValue;
        bookmarksCache = null; // 設定が変わったらキャッシュをクリア
        loadBookmarksPromise = null;
      }
    }
    
    // 現在の設定（Sync有効か否か）に合わせたストレージ変更のみ反映する
    const isSync = await getSyncEnabled();
    if ((isSync && area === 'sync') || (!isSync && area === 'local')) {
      if (changes.bookmarks || Object.keys(changes).some(k => k.startsWith(SYNC_KEY_PREFIX))) {
        // キャッシュを無効化して次回読み込み時に最新化する
        bookmarksCache = null;
        loadBookmarksPromise = null;
      }
    }
  });

  // 拡張機能のインストール・更新時にコンテキストメニューを作成
  chrome.runtime.onInstalled.addListener(async () => {
    await initI18n();
    chrome.contextMenus.create({
      id: 'help-page',
      title: t('helpMenu'),
      contexts: ['action']
    });
  });

  // コンテキストメニューのクリックイベント
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'help-page') {
      const locale = getCurrentLocale();
      const helpUrl = locale === 'ja' 
        ? 'https://sawara.me/extensions/nickmark' 
        : 'https://sawara.me/en/extensions/nickmark';
      chrome.tabs.create({ url: helpUrl });
    }
  });

  // オムニボックスでキーワードが入力され、セッションが開始された時に発火します
  chrome.omnibox.onInputStarted.addListener(() => {
    chrome.omnibox.setDefaultSuggestion({ 
      description: 'Search Nickmark' 
    });
    // 入力開始時にバックグラウンドでキャッシュを先読み（ウォームアップ）しておく
    loadBookmarksData().catch((err) => {
      console.error('Failed to pre-warm bookmarks cache:', err);
    });
  });

  // オムニボックスの入力がキャンセル（フォーカスアウトやEscキーなど）された時に発火します
  chrome.omnibox.onInputCancelled.addListener(() => {
    clearPendingSuggest();
    lastSuggestedMatchMap.clear();
  });

  // オムニボックスで入力が変更されるたびに発火します
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    // 前回の保留中サジェストを空配列で解決してキャンセルし、直近の候補マップも無効化する
    clearPendingSuggest();
    lastSuggestedMatchMap.clear();

    const cleanText = stripZeroWidthChars(text);
    const trimmed = cleanText.trim();

    // 入力が空の場合は即座にデフォルト表示を設定し、空候補を返して待機状態を解除する
    if (!trimmed) {
      chrome.omnibox.setDefaultSuggestion({ 
        description: 'Search Nickmark' 
      });
      suggest([]);
      return;
    }

    lastPendingSuggest = suggest;
    const thisRequestId = ++currentRequestId;

    // 連続キーストロークによる負荷を軽減するためのデバウンス（150ms）
    omniboxDebounceTimer = setTimeout(async () => {
      try {
        const bookmarks = await loadBookmarksData();

        // 待機中に新しい入力が来ていた場合は古いリクエストの処理を中断
        if (thisRequestId !== currentRequestId) return;

        if (cleanText.startsWith(':')) {
          handleCommandModeSuggestions(cleanText, suggest, bookmarks);
        } else {
          handleRegularSearchSuggestions(text, suggest, bookmarks);
        }
      } catch (error) {
        console.error('Failed to handle omnibox suggestions:', error);
        // エラー時でも必ず suggest を呼び出して Chrome を待機状態にしない
        suggest([]);
      } finally {
        if (thisRequestId === currentRequestId) {
          lastPendingSuggest = null;
          omniboxDebounceTimer = null;
        }
      }
    }, 150);
  });

  // オムニボックスでエンターキーが押された時に発火します
  chrome.omnibox.onInputEntered.addListener(async (text: string, disposition: "currentTab" | "newForegroundTab" | "newBackgroundTab") => {
    clearPendingSuggest();
    const cleanTrimmed = stripZeroWidthChars(text).trim();

    // コマンドモードの処理
    if (cleanTrimmed.startsWith(':')) {
      lastSuggestedMatchMap.clear();
      const bookmarks = await loadBookmarksData();
      const commandMatches = resolveCommandMatches(cleanTrimmed, bookmarks);
      
      let resolvedContent = cleanTrimmed;
      // 提案がある場合は解決を試みる。
      // ただし、:rm コマンドで複数の候補がある場合は、誤削除防止のため自動解決せずに入力値をそのまま使用する。
      if (commandMatches.length > 0) {
        const isRm = cleanTrimmed.startsWith(':rm');
        if (commandMatches.length === 1 || !isRm) {
          resolvedContent = commandMatches[0].content;
        }
      }

      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await executeCommand(resolvedContent, currentTab);
      return;
    }

    // 通常検索モードの処理
    // フォルダ一括オープンの判定（末尾スラッシュで終わる場合、またはサジェストから folder/ が渡された場合）
    if (cleanTrimmed.endsWith('/')) {
      const folderPath = cleanTrimmed.replace(/\/+$/, '');
      const bookmarks = await loadBookmarksData();
      const folders = extractFolders(bookmarks);
      if (folders.has(folderPath)) {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const result = await openFolderUrls(folderPath, false, currentTab?.id);
        if (result.requiresConfirmation && result.folderPath && result.urls && currentTab?.id !== undefined) {
          await handleBatchOpenConfirmationRequest(currentTab.id, result.folderPath, result.urls, result.nicknames || []);
        }
        return;
      }
    }

    let targetUrl = cleanTrimmed;
    let matchedTemplateUrl: string | undefined;
    let matchedNickname: string | undefined;

    // 1. 直近のサジェスト候補マップに完全一致するエントリがあれば最優先で解決する
    const mappedMatch = lastSuggestedMatchMap.get(text);
    lastSuggestedMatchMap.clear();

    if (mappedMatch) {
      targetUrl = mappedMatch.resolvedUrl;
      matchedTemplateUrl = mappedMatch.templateUrl;
      matchedNickname = mappedMatch.nickname;
    } else if (!cleanTrimmed.startsWith('http://') && !cleanTrimmed.startsWith('https://')) {
      const bookmarks = await loadBookmarksData();

      // 2. Service Worker 再起動時などのフォールバックとして末尾のゼロ幅マーカーから復元を試みる
      const decodedFromMarker = resolveMatchFromZeroWidthMarker(text, bookmarks);
      if (decodedFromMarker) {
        targetUrl = decodedFromMarker.resolvedUrl;
        matchedTemplateUrl = decodedFromMarker.templateUrl;
        matchedNickname = decodedFromMarker.nickname;
      } else {
        // 3. 通常の検索クエリとして最上位候補に解決する
        const allMatches = resolveRegularSearchMatches(cleanTrimmed, bookmarks);

        if (allMatches.length > 0) {
          targetUrl = allMatches[0].resolvedUrl;
          matchedTemplateUrl = allMatches[0].entry.url;
          matchedNickname = allMatches[0].nickname;
        } else {
          return; // 一致するものがなければ何もしない
        }
      }
    }

    // ブックマークレットの場合は新規タブを開かず、現在アクティブなタブ上でスクリプトを実行する
    if (isBookmarkletUrl(targetUrl)) {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await executeBookmarkletOnTab(targetUrl, currentTab, matchedTemplateUrl, matchedNickname);
      return;
    }

    // 通常 URL の場合はスコアを更新して遷移する
    await updateScore(targetUrl, matchedTemplateUrl, matchedNickname);
    switch (disposition) {
      case 'currentTab': chrome.tabs.update({ url: targetUrl }); break;
      case 'newForegroundTab': chrome.tabs.create({ url: targetUrl, active: true }); break;
      case 'newBackgroundTab': chrome.tabs.create({ url: targetUrl, active: false }); break;
    }
  });

  // 拡張機能アイコンがクリックされた時にブックマーク一覧画面を開きます
  chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
  });

  // ランタイムメッセージ（承認後の一括オープン、リネーム、削除）を処理します
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.action !== 'string') return;

    if (message.action === 'EXECUTE_BATCH_OPEN') {
      const payload = message.payload;
      if (payload && payload.folderPath) {
        openFolderUrls(payload.folderPath, true).then(result => {
          sendResponse(result);
        });
        return true; // 非同期レスポンス
      }
    }

    if (message.action === 'RENAME_FOLDER') {
      const payload = message.payload;
      if (payload && payload.oldPath && payload.newPath) {
        renameFolder(payload.oldPath, payload.newPath).then(result => {
          sendResponse(result);
        });
        return true;
      }
    }

    if (message.action === 'DELETE_FOLDER') {
      const payload = message.payload;
      if (payload && payload.folderPath) {
        deleteFolder(payload.folderPath).then(result => {
          sendResponse(result);
        });
        return true;
      }
    }
  });
}
