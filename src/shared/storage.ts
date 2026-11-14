import {
  BatchOpenResult,
  BookmarkEntry,
  DEFAULT_MAX_BATCH_OPEN_TABS,
  FolderInfo,
  SYNC_KEY_PREFIX
} from './types';
import {
  isBookmarkletUrl,
  isDynamicUrl,
  isSameUrl,
  matchesDynamicEntry,
  normalizeNicknamePath,
  resolveFallbackUrl,
  resolveNavigableUrl
} from './url';
import { showToast } from './toast';
import { t } from '../i18n';

// 8192バイト制限に対する安全な文字数（2,000文字 * UTF-8最大3バイト = 6,000バイト）
const SYNC_CHUNK_SIZE = 2000;
// Sync 全体の容量上限（100KB）
const SYNC_QUOTA_BYTES = 100 * 1024;
// 1日あたりのスコア減衰率
const DECAY_RATE = 0.95;

// 入力中に何度もストレージを読み込むのを防ぐためのメモリキャッシュ
let maxBatchOpenTabsCache: number | null = null;
let bookmarksCache: Record<string, BookmarkEntry[]> | null = null;
let isSyncEnabledCache: boolean | null = null;
let loadBookmarksPromise: Promise<Record<string, BookmarkEntry[]>> | null = null;

/**
 * Google アカウント同期が有効かどうかを取得します。
 * @returns 同期が有効な場合は true、無効な場合は false
 */
export async function getSyncEnabled(): Promise<boolean> {
  if (isSyncEnabledCache !== null) return isSyncEnabledCache;
  const data = await chrome.storage.local.get('isSyncEnabled');
  isSyncEnabledCache = !!data.isSyncEnabled;
  return isSyncEnabledCache;
}

/**
 * Google アカウント同期設定を更新します。
 * @param enabled - 同期を有効にする場合は true、無効にする場合は false
 * @returns 更新完了を示す Promise
 */
export async function setSyncEnabled(enabled: boolean): Promise<void> {
  isSyncEnabledCache = enabled;
  await chrome.storage.local.set({ isSyncEnabled: enabled });
}

/**
 * 同期設定のメモリキャッシュを外部（storage.onChanged リスナー等）から更新します。
 * @param enabled - 更新後の同期設定値
 * @returns なし
 */
export function updateSyncEnabledCache(enabled: boolean): void {
  isSyncEnabledCache = enabled;
}

/**
 * フォルダ一括オープン時の安全上限タブ数を取得します。
 * @returns 安全上限タブ数（デフォルト: 20）
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
 * @param limit - 設定する安全上限タブ数（1〜100）
 * @returns 更新完了を示す Promise
 */
export async function setMaxBatchOpenTabs(limit: number): Promise<void> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit) || DEFAULT_MAX_BATCH_OPEN_TABS));
  maxBatchOpenTabsCache = safeLimit;
  await chrome.storage.local.set({ maxBatchOpenTabs: safeLimit });
}

/**
 * 新規ブックマークエントリオブジェクトを生成します。
 * @param url - 登録する URL またはブックマークレット
 * @param title - タイトル文字列
 * @param defaultValue - 動的 URL（%s）用の省略時デフォルト値（任意）
 * @returns 初期化された BookmarkEntry オブジェクト
 */
export function createBookmarkEntry(
  url: string,
  title: string,
  defaultValue?: string
): BookmarkEntry {
  const now = Date.now();
  const entry: BookmarkEntry = {
    url,
    title,
    score: 1.0,
    last_used_at: now,
    created_at: now
  };
  if (defaultValue && defaultValue.trim()) {
    entry.default_value = defaultValue.trim();
  }
  return entry;
}

/**
 * ブックマーク保存時のエラーに応じたユーザー向けメッセージを解決します。
 * @param err - キャッチされたエラーオブジェクト
 * @param fallback - 不明エラー時のフォールバック文言
 * @returns 表示用のエラーメッセージ文字列
 */
export function getSaveErrorMessage(err: unknown, fallback?: string): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'QUOTA_EXCEEDED') {
    return (
      t('errorSyncQuotaExceeded') ||
      'データサイズ制限（100KB）を超えたため保存できませんでした。'
    );
  }
  return fallback || message || 'エラーが発生しました。';
}

/**
 * ブックマーク辞書のすべてのキーを正規化し、同一キーに衝突するエントリを重複排除・統合します。
 * 空文字キーのエントリは除外します。
 * @param rawBookmarks - 未正規化のブックマーク辞書
 * @returns 正規化済みのブックマーク辞書
 */
export function normalizeBookmarksDictionary(
  rawBookmarks: Record<string, BookmarkEntry[]>
): Record<string, BookmarkEntry[]> {
  const normalized: Record<string, BookmarkEntry[]> = {};

  for (const [rawKey, entries] of Object.entries(rawBookmarks || {})) {
    const normKey = normalizeNicknamePath(rawKey);
    if (!normKey) continue;

    if (!normalized[normKey]) {
      normalized[normKey] = [];
    }

    const safeEntries = Array.isArray(entries)
      ? entries
      : entries && typeof entries === 'object'
        ? (Object.values(entries) as BookmarkEntry[])
        : [];

    for (const entry of safeEntries) {
      if (!entry || !entry.url) continue;
      const existing = normalized[normKey].find(e => isSameUrl(e.url, entry.url));
      if (!existing) {
        normalized[normKey].push({ ...entry });
      } else {
        // 同一URLが存在する場合はより高いスコアや最新の日時、ピン留め設定をマージする
        existing.score = Math.max(existing.score || 1.0, entry.score || 1.0);
        existing.last_used_at = Math.max(existing.last_used_at || 0, entry.last_used_at || 0);
        existing.created_at = Math.min(existing.created_at || Date.now(), entry.created_at || Date.now());
        if (entry.is_pinned) existing.is_pinned = true;
        if (!existing.title && entry.title) existing.title = entry.title;
        if (!existing.default_value && entry.default_value) existing.default_value = entry.default_value;
      }
    }
  }

  return normalized;
}

/**
 * 指定したストレージから生データを読み込み、チャンク化を解除します。
 * @param area - 読み込み元のストレージ領域（'local' または 'sync'）
 * @returns 読み込まれたブックマーク辞書
 */
async function loadFromStorage(area: 'local' | 'sync'): Promise<Record<string, BookmarkEntry[]>> {
  if (area === 'local') {
    const data = await chrome.storage.local.get('bookmarks');
    return (data.bookmarks as Record<string, BookmarkEntry[]>) || {};
  }

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
    // パース失敗時に空データを返すと呼び出し元で上書き消失する恐れがあるためエラーを送出する
    throw new Error('CORRUPTED_SYNC_DATA');
  }
}

/**
 * 指定したストレージにデータを保存し、sync 時は必要に応じてチャンク化します。
 * @param area - 保存先のストレージ領域（'local' または 'sync'）
 * @param bookmarks - 保存するブックマーク辞書
 * @returns 保存完了を示す Promise
 */
async function saveToStorage(
  area: 'local' | 'sync',
  bookmarks: Record<string, BookmarkEntry[]>
): Promise<void> {
  if (area === 'local') {
    await chrome.storage.local.set({ bookmarks });
    return;
  }

  const jsonStr = JSON.stringify(bookmarks);
  if (jsonStr.length > SYNC_QUOTA_BYTES) {
    console.error('Data size exceeds sync quota:', jsonStr.length);
    throw new Error('QUOTA_EXCEEDED');
  }

  const chunks: Record<string, string> = {};
  let chunkCount = 0;
  for (let i = 0; i < jsonStr.length; i += SYNC_CHUNK_SIZE) {
    chunks[`${SYNC_KEY_PREFIX}${chunkCount}`] = jsonStr.substring(i, i + SYNC_CHUNK_SIZE);
    chunkCount++;
  }

  // 古いチャンクやサイズ超過データの残存による Quota エラーを防ぐため事前にクリアする
  await chrome.storage.sync.clear();
  await chrome.storage.sync.set(chunks);
}

/**
 * メモリ上に保持されているブックマークキャッシュおよび読み込みプロミスを破棄します。
 * @returns なし
 */
export function clearBookmarksCache(): void {
  bookmarksCache = null;
  loadBookmarksPromise = null;
}

/**
 * ストレージからブックマークデータを読み込みます。
 * キャッシュが存在する場合はキャッシュを返し、同時呼び出し時は同一の Promise を共有します。
 * @param forceRefresh - true の場合、キャッシュを破棄して強制的にストレージから再読み込みします
 * @returns 正規化されたブックマークデータのプロミス
 */
export async function loadBookmarksData(
  forceRefresh: boolean = false
): Promise<Record<string, BookmarkEntry[]>> {
  if (forceRefresh) {
    clearBookmarksCache();
  }
  if (bookmarksCache) return bookmarksCache;
  if (loadBookmarksPromise) return loadBookmarksPromise;

  loadBookmarksPromise = (async () => {
    try {
      const isSync = await getSyncEnabled();
      const rawBookmarks = await loadFromStorage(isSync ? 'sync' : 'local');
      const normalizedBookmarks = normalizeBookmarksDictionary(rawBookmarks);
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
 * 同期設定に応じて適切なストレージ（local または sync）に保存し、キーの正規化と重複統合も実施します。
 * @param bookmarks - 保存するブックマークデータ
 * @returns 保存完了を示す Promise
 */
export async function saveBookmarksData(
  bookmarks: Record<string, BookmarkEntry[]>
): Promise<void> {
  const isSync = await getSyncEnabled();
  const normalizedBookmarks = normalizeBookmarksDictionary(bookmarks);
  await saveToStorage(isSync ? 'sync' : 'local', normalizedBookmarks);
  bookmarksCache = normalizedBookmarks;
  loadBookmarksPromise = null;
}

/**
 * 指定されたストレージ領域のデータと、最新の更新日時を取得します。
 * @param area - 取得対象のストレージ領域（'local' または 'sync'）
 * @returns ブックマーク辞書と最新更新タイムスタンプ
 */
export async function getStorageDataWithTimestamp(
  area: 'local' | 'sync'
): Promise<{ bookmarks: Record<string, BookmarkEntry[]>; lastUpdated: number }> {
  const rawBookmarks = await loadFromStorage(area);
  const normalizedBookmarks = normalizeBookmarksDictionary(rawBookmarks);
  let latest = 0;

  for (const entries of Object.values(normalizedBookmarks)) {
    for (const entry of entries) {
      latest = Math.max(latest, entry.last_used_at || 0, entry.created_at || 0);
    }
  }

  return { bookmarks: normalizedBookmarks, lastUpdated: latest };
}

/**
 * データサイズ（JSON 文字列長）が 100KB を超えているかチェックします。
 * @param bookmarks - チェック対象のブックマーク辞書
 * @returns 100KB を超えている場合は true、それ以外は false
 */
export function isOverQuota(bookmarks: Record<string, BookmarkEntry[]>): boolean {
  return JSON.stringify(bookmarks).length > SYNC_QUOTA_BYTES;
}

/**
 * 経過日数に基づいて指数減衰後の新しいスコアを計算します。
 * @param oldScore - 前回のスコア
 * @param lastUsedAt - 最終使用日時のタイムスタンプ
 * @returns 計算された新しいスコア
 */
function calculateNewScore(oldScore: number, lastUsedAt: number): number {
  const elapsedMs = Math.max(0, Date.now() - lastUsedAt);
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return (oldScore * Math.pow(DECAY_RATE, elapsedDays)) + 1.0;
}

/**
 * 対象の URL が使用された際に、スコアと最終使用日時を更新します。
 * 動的 URL から展開された遷移先 URL の場合も、元のテンプレートエントリを特定して更新します。
 * @param url - 実際に使用（遷移）された URL
 * @param templateUrl - 元のブックマークエントリの URL（既知の場合に指定）
 * @param nickname - 対象のニックネーム（既知の場合に指定するとそのニックネーム配下のみを更新）
 * @returns 更新処理完了を示す Promise
 */
export async function updateScore(
  url: string,
  templateUrl?: string,
  nickname?: string
): Promise<void> {
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
 * 指定された開く対象リストをバックグラウンドタブで開き、スコアを更新します。
 * @param targets - 開く URL・テンプレート URL・ニックネームの配列
 * @returns 開いた件数
 */
export async function openTargetsAndUpdateScores(
  targets: Array<{ urlToOpen: string; templateUrl: string; nickname: string }>
): Promise<number> {
  let openedCount = 0;
  for (const item of targets) {
    chrome.tabs.create({ url: item.urlToOpen, active: false });
    await updateScore(item.urlToOpen, item.templateUrl, item.nickname);
    openedCount++;
  }
  return openedCount;
}

/**
 * ブックマーク辞書からすべてのフォルダ階層情報を抽出・導出します。
 * @param bookmarks - 登録されている全ブックマーク辞書
 * @returns 抽出されたフォルダ情報のマップ（キー: フォルダパス）
 */
export function extractFolders(bookmarks: Record<string, BookmarkEntry[]>): Map<string, FolderInfo> {
  const folderMap = new Map<string, FolderInfo>();

  for (const rawNickname of Object.keys(bookmarks)) {
    const nickname = normalizeNicknamePath(rawNickname);
    if (!nickname) continue;

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
          openableUrlCount: 0
        });
      }
      folderMap.get(currentPath)!.nicknames.push(nickname);
    }
  }

  // 各フォルダの開く対象 URL 総数（重複除外後、ブックマークレット除外）を集計する
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
 * 指定したフォルダ配下の全ブックマークを一括で開きます。
 * 重複 URL は除外し、ブックマークレットはスキップ、動的 URL はフォールバック展開します。
 * 安全上限件数を超え、force が false の場合は自動オープンを中断して確認要求状態を返します。
 * @param folderPath - 対象のフォルダパス（例: "work" または "work/"）
 * @param force - 上限超過時でも強制的に開くかどうか（ユーザー承認後は true）
 * @param currentTabId - 現在のアクティブタブ ID（トースト通知用、任意）
 * @returns 一括オープンの実行結果
 */
export async function openFolderUrls(
  folderPath: string,
  force: boolean = false,
  currentTabId?: number
): Promise<BatchOpenResult> {
  const normalizedPath = normalizeNicknamePath(folderPath);
  if (!normalizedPath) {
    return { success: false, openedCount: 0, totalCount: 0, error: 'INVALID_FOLDER_PATH' };
  }

  const bookmarks = await loadBookmarksData();
  const folderPrefix = normalizedPath + '/';

  // フォルダ配下のニックネームのみを収集（フォルダ名と同名の単体ニックネームは除外）
  const matchingNicknames = Object.keys(bookmarks).filter(nick =>
    normalizeNicknamePath(nick).startsWith(folderPrefix)
  );

  if (matchingNicknames.length === 0) {
    if (currentTabId !== undefined) {
      await showToast(
        currentTabId,
        t('errorNicknameNotFound', [normalizedPath]) ||
          `フォルダ「${normalizedPath}」が見つかりませんでした。`
      );
    }
    return { success: false, openedCount: 0, totalCount: 0, error: 'FOLDER_NOT_FOUND' };
  }

  // 重複を除外した開く対象 URL とスコア更新用メタ情報を収集する
  const targetMap = new Map<string, { urlToOpen: string; templateUrl: string; nickname: string }>();

  for (const nick of matchingNicknames) {
    const entries = bookmarks[nick] || [];
    for (const entry of entries) {
      if (isBookmarkletUrl(entry.url)) continue;
      const urlToOpen = resolveNavigableUrl(entry);
      if (!targetMap.has(urlToOpen)) {
        targetMap.set(urlToOpen, { urlToOpen, templateUrl: entry.url, nickname: nick });
      }
    }
  }

  const totalCount = targetMap.size;
  if (totalCount === 0) {
    if (currentTabId !== undefined) {
      await showToast(
        currentTabId,
        t('errorBatchOpenZeroUrls', [normalizedPath]) ||
          `フォルダ「${normalizedPath}」には開く対象のURLがありません。`
      );
    }
    return { success: false, openedCount: 0, totalCount: 0, error: 'NO_OPENABLE_URLS' };
  }

  const maxLimit = await getMaxBatchOpenTabs();
  if (totalCount > maxLimit && !force) {
    return {
      success: false,
      openedCount: 0,
      totalCount,
      requiresConfirmation: true,
      folderPath: normalizedPath,
      urls: Array.from(targetMap.keys()),
      nicknames: matchingNicknames
    };
  }

  const openedCount = await openTargetsAndUpdateScores(Array.from(targetMap.values()));
  return { success: true, openedCount, totalCount };
}

/**
 * 指定したフォルダ名（プレフィックス）を新しいフォルダ名に一括置換します。
 * @param oldPath - 変更前のフォルダパス（例: "work"）
 * @param newPath - 変更後のフォルダパス（例: "office"）
 * @returns 処理結果（成否、影響件数、エラーコード）
 */
export async function renameFolder(
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; affectedCount: number; error?: string }> {
  const normOld = normalizeNicknamePath(oldPath);
  const normNew = normalizeNicknamePath(newPath);

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
    const normKey = normalizeNicknamePath(key);
    let targetKey = normKey;
    if (normKey.startsWith(oldPrefix)) {
      targetKey = `${newPrefix}${normKey.substring(oldPrefix.length)}`;
      affectedCount += entries.length;
    }

    if (!newBookmarks[targetKey]) {
      newBookmarks[targetKey] = [];
    }
    for (const entry of entries) {
      if (!newBookmarks[targetKey].some(e => isSameUrl(e.url, entry.url))) {
        newBookmarks[targetKey].push(entry);
      }
    }
  }

  await saveBookmarksData(newBookmarks);
  return { success: true, affectedCount };
}

/**
 * 指定したフォルダ配下のすべてのブックマークを一括削除します。
 * @param folderPath - 削除対象のフォルダパス
 * @returns 処理結果（成否、削除件数、エラーコード）
 */
export async function deleteFolder(
  folderPath: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const normPath = normalizeNicknamePath(folderPath);
  if (!normPath) {
    return { success: false, deletedCount: 0, error: 'INVALID_PATH' };
  }

  const bookmarks = await loadBookmarksData();
  const prefix = normPath + '/';
  const newBookmarks: Record<string, BookmarkEntry[]> = {};
  let deletedCount = 0;

  for (const [key, entries] of Object.entries(bookmarks)) {
    const normKey = normalizeNicknamePath(key);
    if (normKey.startsWith(prefix)) {
      deletedCount += entries.length;
    } else {
      newBookmarks[normKey] = entries;
    }
  }

  await saveBookmarksData(newBookmarks);
  return { success: true, deletedCount };
}
