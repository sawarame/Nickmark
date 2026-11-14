import { BookmarkEntry } from './types';
import { Locale } from '../i18n';

/**
 * ニックネームまたはフォルダパス文字列を正規化します。
 * - 前後の空白を除去
 * - 連続するスラッシュ（// など）を単一のスラッシュ（/）に統合
 * - 先頭および末尾のスラッシュ（/）を除去
 * - 各階層セグメントの前後の余分な空白も除去
 * @param rawPath - 入力された生のニックネームまたはフォルダパス
 * @returns 正規化されたパス文字列（スラッシュのみの場合は空文字 ""）
 */
export function normalizeNicknamePath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') return '';
  return rawPath
    .trim()
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0)
    .join('/');
}

/**
 * 2つの URL が同一のものか比較します。
 * @param u1 - 比較対象の URL 1
 * @param u2 - 比較対象の URL 2
 * @returns 同一の URL であれば true、それ以外は false
 */
export function isSameUrl(u1: string, u2: string): boolean {
  if (u1 === u2) return true;
  try {
    if (decodeURI(u1) === decodeURI(u2)) return true;
  } catch {
    // 不正なエンコード文字列はフォールバック比較へ進む
  }
  try {
    if (decodeURIComponent(u1) === decodeURIComponent(u2)) return true;
  } catch {
    // デコード不可の場合は不一致として扱う
  }
  return false;
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
  } catch {
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
  } catch {
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
  } catch {
    // そのままでは URL としてパースできない場合は仮文字列に置換して再試行する
  }
  try {
    const sanitized = entry.url.replace(/%s/g, '');
    const parsedFallback = new URL(sanitized);
    if (parsedFallback.origin && parsedFallback.origin !== 'null') {
      return parsedFallback.origin;
    }
  } catch {
    // オリジン抽出に失敗した場合はプレースホルダーを除去した文字列を返す
  }
  return entry.url.replace(/%s/g, '');
}

/**
 * ブックマークエントリから実際に開く対象となる遷移先 URL を取得します。
 * 動的 URL の場合はフォールバック展開を行い、通常 URL はそのまま返します。
 * @param entry - 対象のブックマークエントリ
 * @returns 遷移可能な URL 文字列
 */
export function resolveNavigableUrl(entry: BookmarkEntry): string {
  return isDynamicUrl(entry.url) ? resolveFallbackUrl(entry) : entry.url;
}

/**
 * 展開済みの遷移先 URL が、指定された動的 URL エントリから生成されたものかを判定します。
 * @param entry - 動的 URL を持つブックマークエントリ
 * @param targetUrl - 実際に遷移した URL
 * @returns エントリに一致する場合は true、それ以外は false
 */
export function matchesDynamicEntry(entry: BookmarkEntry, targetUrl: string): boolean {
  if (!isDynamicUrl(entry.url)) return false;
  if (isSameUrl(resolveFallbackUrl(entry), targetUrl)) return true;

  // 正規表現の特殊文字をエスケープした上で %s をワイルドカード (.+) に変換して比較する
  const escapedPattern = entry.url
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%s/g, '.+');
  try {
    const regex = new RegExp(`^${escapedPattern}$`);
    return regex.test(targetUrl);
  } catch {
    return false;
  }
}

/**
 * オムニボックスのサジェスト表示用に URL 文字列を整形します。
 * 長大なワンライナーになりやすいブックマークレットの場合は連続空白を圧縮し、一定文字数で省略します。
 * @param url - 表示対象の URL またはブックマークレット文字列
 * @param maxLength - ブックマークレット省略時の最大文字数（デフォルト: 100）
 * @returns サジェスト表示用に整形された文字列
 */
export function formatUrlForOmniboxDisplay(url: string, maxLength: number = 100): string {
  if (!url) return '';
  if (!isBookmarkletUrl(url)) return url;
  const normalized = url.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength) + '...';
}

/**
 * オムニボックスの XML 記述用にテキストを安全にエスケープします。
 * 改行や XML で無効な制御文字も除去・空白化してパースエラーを防ぎます。
 * @param unsafe - エスケープ対象の任意の値
 * @returns XML エスケープ済みの安全な文字列
 */
export function escapeXml(unsafe: unknown): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '＆'; // Chrome の XML パーサーのバグを回避するため全角アンパサンドを使用
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
}

/**
 * 表示言語に応じた公式ヘルプページの URL を取得します。
 * @param locale - 現在のロケール（'ja' または 'en'）
 * @returns ヘルプページの URL
 */
export function getHelpUrl(locale: Locale): string {
  return locale === 'ja'
    ? 'https://sawara.me/extensions/nickmark'
    : 'https://sawara.me/en/extensions/nickmark';
}

/**
 * Chrome の Favicon API を用いて指定 URL 向けのアイコン画像 URL を生成します。
 * ブックマークレットや不正 URL の場合は空文字を返します。
 * @param pageUrl - 対象ページの URL
 * @param size - アイコンサイズ（ピクセル、デフォルト: 32）
 * @returns Favicon 画像 URL 文字列（取得不可時は空文字）
 */
export function getFaviconUrl(pageUrl: string, size: number = 32): string {
  if (!pageUrl || isBookmarkletUrl(pageUrl)) return '';
  try {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', pageUrl);
    url.searchParams.set('size', String(size));
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * 実行環境の OS に応じたポップアップ起動ショートカットキー表記を返します。
 * macOS では `Option+Shift+D`、Windows / Linux 等では `Alt+Shift+D` を返します。
 * @returns OS に合わせたショートカットキー表記文字列
 */
export function getShortcutLabel(): string {
  try {
    const nav = typeof navigator !== 'undefined'
      ? (navigator as Navigator & { userAgentData?: { platform?: string } })
      : undefined;
    const platform = nav?.userAgentData?.platform || nav?.platform || nav?.userAgent || '';
    return /mac/i.test(platform) ? 'Option+Shift+D' : 'Alt+Shift+D';
  } catch {
    return 'Alt+Shift+D';
  }
}
