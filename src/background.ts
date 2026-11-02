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
 * @param {any} unsafe エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
function escapeXml(unsafe: any): string {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, function (c) {
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
 * 2つの URL が同一のものか比較します。
 * @param {string} u1 URL 1
 * @param {string} u2 URL 2
 * @returns {boolean} 同一の URL であれば true
 */
function isSameUrl(u1: string, u2: string): boolean {
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
 * @param url - 判定対象の URL 文字列
 * @returns プレースホルダー `%s` を含む場合は true、それ以外は false
 */
export function isDynamicUrl(url: string): boolean {
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
 * 通常検索の入力テキストを解析し、マッチ度ティア・ピン留め・スコア順にソートされた候補リストを返します。
 * @param text - オムニボックスに入力された検索文字列
 * @param bookmarks - 現在のブックマークデータ
 * @returns ソート済みの検索マッチ結果配列
 */
export function resolveRegularSearchMatches(
  text: string,
  bookmarks: Record<string, BookmarkEntry[]>
): ResolvedSearchMatch[] {
  const trimmed = text.trim();
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
      const url = escapeXml(entries[0].url);
      return `<match>${escapedN}</match> ${title} - <url>${url}</url>`;
    } else if (entries.length > 1) {
      return `<match>${escapedN}</match> - Multiple URLs (${entries.length})`;
    }
    return `<match>${escapedN}</match>`;
  };

  // :add / :a コマンド
  if (isCmdMatch([':add', ':a'])) {
    const restParts = restTrimmed ? restTrimmed.split(/\s+/) : [];
    const isDirectUrl = restParts.length >= 2 && /^https?:\/\/\S+$/i.test(restParts[1]);
    const modeHint = isDirectUrl ? 'Add custom URL' : 'Add current tab (or [nickname] [https://...] [title])';

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
    if (!restTrimmed) {
      commandMatches.push({
        content: ':open ',
        description: `<match>:open</match> [nickname] - Open all URLs in new tabs`
      });
      if (cmd === ':open' || cmd === ':o') {
        for (const n of sortedNicknames.slice(0, 8)) {
          commandMatches.push({
            content: `:open ${n}`,
            description: `<match>:open</match> ${getNicknameSummary(n)}`
          });
        }
      }
    } else {
      const lowerInput = restTrimmed.toLowerCase();
      const matches = sortedNicknames.filter(n => n.toLowerCase().startsWith(lowerInput));
      if (matches.length === 0) {
        commandMatches.push({
          content: text,
          description: `<match>:open</match> No nicknames match "${escapeXml(restTrimmed)}"`
        });
      } else {
        for (const n of matches) {
          commandMatches.push({
            content: `:open ${n}`,
            description: `<match>:open</match> ${getNicknameSummary(n)}`
          });
        }
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
                const url = escapeXml(entry.url);
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
  const mUrl = escapeXml(match.resolvedUrl);
  const dynamicBadge = match.isDynamic
    ? match.dynamicArg
      ? ` <dim>(${escapeXml(match.dynamicArg)})</dim>`
      : ' <dim>[%s]</dim>'
    : '';
  return `<match>${escapeXml(match.nickname)}</match>${dynamicBadge}: ${mTitle} - <url>${mUrl}</url>`;
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
  const trimmed = text.trim();
  const allMatches = resolveRegularSearchMatches(trimmed, bookmarks);

  if (allMatches.length === 1) {
    chrome.omnibox.setDefaultSuggestion({
      description: `Go to ${formatSearchMatchDescription(allMatches[0])}`
    });
  } else if (allMatches.length > 0) {
    const top = allMatches[0];
    const topTitle = escapeXml(top.entry.title) || 'No title';
    const topUrl = escapeXml(top.resolvedUrl);
    chrome.omnibox.setDefaultSuggestion({
      description: `Search for: <match>${escapeXml(trimmed)}</match> <dim>- ${topTitle} (${topUrl})</dim>`
    });
  } else {
    chrome.omnibox.setDefaultSuggestion({
      description: `No matches found for: <match>${escapeXml(trimmed)}</match>`
    });
  }

  const suggestions: chrome.omnibox.SuggestResult[] = [];
  for (const match of allMatches.slice(0, 10)) {
    suggestions.push({
      content: match.resolvedUrl,
      description: formatSearchMatchDescription(match)
    });
  }

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
 * @param {number} tabId 対象となるタブの ID
 * @param {string} message 表示するメッセージ
 */
async function showToast(tabId: number, message: string) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg) => {
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
          padding: '12px 24px',
          backgroundColor: '#323232',
          color: '#ffffff',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
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
        }, 3000);
      },
      args: [message]
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
 * @returns 処理完了を示す Promise
 */
async function updateScore(url: string, templateUrl?: string): Promise<void> {
  const bookmarks = await loadBookmarksData();
  let updated = false;
  for (const entries of Object.values(bookmarks)) {
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

    // 第2引数が http:// または https:// で始まる場合は直接 URL 指定モードとして扱う
    const secondArg = parts[2] || '';
    const isDirectUrl = /^https?:\/\/\S+$/i.test(secondArg);
    const targetUrl = isDirectUrl ? secondArg : (currentTab.url || '');
    const customTitle = isDirectUrl
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
    const nickname = parts[1];
    if (!nickname) {
      await showToast(currentTab.id, t("errorNicknameRequired") || 'ニックネームを指定してください。');
      return;
    }

    const bookmarks = await loadBookmarksData();
    const entries = bookmarks[nickname];
    if (entries && entries.length > 0) {
      for (const entry of entries) {
        // 動的 URL が含まれる場合はフォールバック先 URL を開く
        const urlToOpen = isDynamicUrl(entry.url) ? resolveFallbackUrl(entry) : entry.url;
        chrome.tabs.create({ url: urlToOpen, active: false });
        await updateScore(urlToOpen, entry.url);
      }
    } else {
      await showToast(currentTab.id, t("errorNicknameNotFound", [nickname]) || `ニックネームが見つかりませんでした。`);
    }
    return;
  }

  if (cmd === ':rm') {
    const nickname = parts[1];
    const urlToDelete = parts.slice(2).join(' ').trim();

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
  });

  // オムニボックスで入力が変更されるたびに発火します
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    // 前回の保留中サジェストを空配列で解決してキャンセル
    clearPendingSuggest();

    const trimmed = text.trim();

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

        if (text.startsWith(':')) {
          handleCommandModeSuggestions(text, suggest, bookmarks);
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
    const trimmed = text.trim();

    // コマンドモードの処理
    if (trimmed.startsWith(':')) {
      const bookmarks = await loadBookmarksData();
      const commandMatches = resolveCommandMatches(trimmed, bookmarks);
      
      let resolvedContent = trimmed;
      // 提案がある場合は解決を試みる。
      // ただし、:rm コマンドで複数の候補がある場合は、誤削除防止のため自動解決せずに入力値をそのまま使用する。
      if (commandMatches.length > 0) {
        const isRm = trimmed.startsWith(':rm');
        if (commandMatches.length === 1 || !isRm) {
          resolvedContent = commandMatches[0].content;
        }
      }

      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await executeCommand(resolvedContent, currentTab);
      return;
    }

    // 通常検索モードの処理
    let targetUrl = trimmed;
    let matchedTemplateUrl: string | undefined;

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const bookmarks = await loadBookmarksData();
      const allMatches = resolveRegularSearchMatches(trimmed, bookmarks);

      if (allMatches.length > 0) {
        targetUrl = allMatches[0].resolvedUrl;
        matchedTemplateUrl = allMatches[0].entry.url;
      } else {
        return; // 一致するものがなければ何もしない
      }
    }

    // スコアを更新して遷移
    await updateScore(targetUrl, matchedTemplateUrl);
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
}
