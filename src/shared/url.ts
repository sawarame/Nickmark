import { BookmarkEntry } from './types';
import { Locale } from '../i18n';

/**
 * 入力文字列のサニタイズ用に除去する不可視のゼロ幅文字パターンです。
 */
const ZERO_WIDTH_ALL_REGEX = /[\u200B-\u200D\uFEFF]/g;

/**
 * 文字列に含まれるゼロ幅文字（不可視文字）をすべて除去します。
 * @param text - 対象の文字列
 * @returns ゼロ幅文字を除去したクリーンな文字列
 */
export function stripZeroWidthChars(text: string): string {
  if (!text) return '';
  return text.replace(ZERO_WIDTH_ALL_REGEX, '');
}

/**
 * ニックネームまたはフォルダ名に使用できない文字（ブラックリスト）の正規表現です。
 * コマンド起動文字（`:`, `;`）、空白文字（`\s`）、バックスラッシュ（`\`）、
 * URL・動的プレースホルダー・ワイルドカード／構文衝突の恐れがある記号（`%`, `?`, `#`, `&`, `=`, `*`, `"`, `'`, `` ` ``, `<`, `>`, `|`）、
 * および制御文字・ゼロ幅文字を禁止対象とします（フォルダ区切り `/` は許可）。
 */
export const FORBIDDEN_NICKNAME_CHAR_REGEX =
  /[:;\\\s%?#&=*"'`<>|\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/;

/**
 * Chrome ブックマーク HTML インポート等のセグメントサニタイズ用正規表現です。
 * フォルダ区切り記号（`/`）およびニックネーム使用不可文字の連続を `-` へ置換するために使用します。
 */
export const FORBIDDEN_NICKNAME_CHAR_WITH_SLASH_GLOBAL_REGEX =
  /[/\\:;\s%?#&=*"'`<>|\u0000-\u001F\u007F\u200B-\u200D\uFEFF]+/g;

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
 * ニックネームまたはフォルダ名の入力値から半角・全角スペースを含むすべての空白文字を除去します。
 * @param value - 除去対象の入力文字列
 * @returns 空白文字を除去した文字列
 */
export function stripNicknameWhitespace(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\s+/g, '');
}

/**
 * 指定されたニックネームまたはフォルダパス文字列に使用不可文字が含まれているかを判定します。
 * @param value - 検証対象のニックネームまたはフォルダパス文字列
 * @returns 使用不可文字が含まれている場合は true、問題ない場合は false
 */
export function hasForbiddenNicknameChars(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return FORBIDDEN_NICKNAME_CHAR_REGEX.test(value);
}

/**
 * コマンドパレットの入力文字列がコマンドモード（`:` または `;` で開始）かどうかを判定します。
 * 先頭の空白および不可視のゼロ幅文字は除去した上で判定します。
 * @param rawQuery - 検索入力欄の文字列
 * @returns コマンドモードの入力である場合は true、それ以外は false
 */
export function isCommandPrefixQuery(rawQuery: string): boolean {
  if (!rawQuery || typeof rawQuery !== 'string') return false;
  const trimmedStart = stripZeroWidthChars(rawQuery).trimStart();
  return trimmedStart.startsWith(':') || trimmedStart.startsWith(';');
}

/**
 * コマンド入力文字列の先頭プレフィックス（`;`）を標準の `:` へ正規化します。
 * 先頭の空白および不可視のゼロ幅文字も取り除いた上で変換します。
 * @param rawQuery - 検索入力欄またはコマンド実行文字列
 * @returns 先頭プレフィックスが `:` に正規化されたコマンド文字列
 */
export function normalizeCommandPrefix(rawQuery: string): string {
  if (!rawQuery || typeof rawQuery !== 'string') return '';
  const trimmedStart = stripZeroWidthChars(rawQuery).trimStart();
  if (trimmedStart.startsWith(';')) {
    return `:${trimmedStart.slice(1)}`;
  }
  return trimmedStart;
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
 * 候補の重複判定用に URL 文字列を正規化します。
 * スキームとホストを小文字化し、`decodeURI` を適用した上で、ルートパス以外の末尾スラッシュ差異を吸収します。
 * @param rawUrl - 正規化対象の URL 文字列
 * @returns 重複比較用の正規化済み URL 文字列
 */
export function normalizeUrlForComparison(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  let decoded = trimmed;
  try {
    decoded = decodeURI(trimmed);
  } catch {
    // 不正なパーセントエンコードを含む場合は元の文字列でパースを試みる
  }

  try {
    const parsed = new URL(decoded);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.host.toLowerCase();
    let pathname = parsed.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${protocol}//${host}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    // URL としてパースできない場合は末尾スラッシュのみを取り除いて比較する
    return decoded.length > 1 && decoded.endsWith('/') ? decoded.slice(0, -1) : decoded;
  }
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
 * ブラウザの「新しいタブ」ページと判定する URL プレフィックス一覧
 */
const NEW_TAB_URLS = new Set([
  'chrome://newtab',
  'chrome://new-tab-page',
  'edge://newtab',
  'brave://newtab',
  'about:newtab'
]);

/**
 * 指定された URL がブラウザの「新しいタブ」ページであるかを判定します。
 * 末尾スラッシュやクエリ／ハッシュ、大文字・小文字の差異を吸収して判定します。
 * @param url - 判定対象の URL 文字列
 * @returns 新しいタブページの場合は true、それ以外は false
 */
export function isNewTabUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;
  const withoutQueryOrHash = trimmed.split(/[?#]/)[0];
  const normalized = withoutQueryOrHash.replace(/\/+$/, '');
  return NEW_TAB_URLS.has(normalized);
}

/**
 * タブ情報がブラウザの「新しいタブ」ページを開いている状態かを判定します。
 * 遷移開始直後など `pendingUrl` が存在する場合は `pendingUrl` を優先して参照します。
 * @param tab - 判定対象のタブ情報（`url` / `pendingUrl` を持つオブジェクト）
 * @returns 新しいタブページの場合は true、それ以外は false
 */
export function isChromeNewTab(tab?: { url?: string; pendingUrl?: string }): boolean {
  if (!tab) return false;
  return isNewTabUrl(tab.pendingUrl || tab.url);
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
 * パレットおよび履歴候補の表示用に URL 文字列を整形します。
 * 長大なワンライナーになりやすいブックマークレットの場合は連続空白を圧縮し、一定文字数で省略します。
 * @param url - 表示対象の URL またはブックマークレット文字列
 * @param maxLength - ブックマークレット省略時の最大文字数（デフォルト: 100）
 * @returns 表示用に整形された文字列
 */
export function formatUrlForDisplay(url: string, maxLength: number = 100): string {
  if (!url) return '';
  if (!isBookmarkletUrl(url)) return url;
  const normalized = url.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength) + '...';
}

/**
 * ロケール別の公式ヘルプページ URL マップ
 */
const HELP_PAGE_URLS: Record<Locale, string> = {
  ja: 'https://sawara.me/extensions/nickmark',
  en: 'https://sawara.me/en/extensions/nickmark',
  zh_CN: 'https://sawara.me/zh-Hans/extensions/nickmark',
  zh_TW: 'https://sawara.me/zh-Hant/extensions/nickmark',
  ko: 'https://sawara.me/ko/extensions/nickmark'
};

/**
 * 表示言語に応じた公式ヘルプページの URL を取得します。
 * @param locale - 現在のロケール
 * @returns ヘルプページの URL
 */
export function getHelpUrl(locale: Locale): string {
  return HELP_PAGE_URLS[locale] ?? HELP_PAGE_URLS.en;
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
 * 現在の実行環境が macOS プラットフォームであるかを判定します。
 * @returns macOS 環境の場合は true、それ以外または判定不可時は false
 */
export function isMacPlatform(): boolean {
  try {
    const nav = typeof navigator !== 'undefined'
      ? (navigator as Navigator & { userAgentData?: { platform?: string } })
      : undefined;
    const platform = nav?.userAgentData?.platform || nav?.platform || nav?.userAgent || '';
    return /mac/i.test(platform);
  } catch {
    return false;
  }
}

/**
 * 実行環境の OS に応じた主修飾キー表記を返します。
 * macOS では `Cmd`、Windows / Linux 等では `Ctrl` を返します。
 * @returns OS に合わせた修飾キー表記文字列
 */
export function getPrimaryModifierLabel(): 'Cmd' | 'Ctrl' {
  return isMacPlatform() ? 'Cmd' : 'Ctrl';
}
