import {
  BookmarkEntry,
  ParsedImportResult
} from './types';
import { normalizeBookmarksDictionary } from './storage';
import { isDynamicUrl, normalizeNicknamePath } from './url';

/**
 * インポート解析・検証処理で発生するエラー種別コード
 */
export type BookmarkImportErrorCode =
  | 'EMPTY_FILE'
  | 'INVALID_JSON_FORMAT'
  | 'INVALID_JSON_STRUCTURE'
  | 'INVALID_BOOKMARK_ENTRY'
  | 'INVALID_HTML_BOOKMARKS'
  | 'NO_VALID_BOOKMARKS';

/**
 * ブックマークインポートの解析・バリデーション失敗時に送出される構造化エラークラス
 */
export class BookmarkImportError extends Error {
  /** エラー種別コード */
  readonly code: BookmarkImportErrorCode;
  /** エラー詳細パラメータ（不正キー名など） */
  readonly detailParam?: string;

  /**
   * BookmarkImportError のインスタンスを生成します。
   * @param code - エラー種別コード
   * @param message - 開発者・フォールバック向けエラーメッセージ
   * @param detailParam - エラー原因となったニックネーム等の補足情報（任意）
   * @returns 生成された BookmarkImportError インスタンス
   */
  constructor(code: BookmarkImportErrorCode, message: string, detailParam?: string) {
    super(message);
    this.name = 'BookmarkImportError';
    this.code = code;
    this.detailParam = detailParam;
  }
}

/**
 * ブックマーク辞書に含まれる一意なニックネーム数およびブックマーク総件数を集計します。
 * @param bookmarks - 集計対象のブックマーク辞書
 * @returns ニックネーム数とブックマーク総件数のサマリーオブジェクト
 */
export function countBookmarksSummary(
  bookmarks: Record<string, BookmarkEntry[]>
): { nicknameCount: number; bookmarkCount: number } {
  let nicknameCount = 0;
  let bookmarkCount = 0;

  for (const entries of Object.values(bookmarks || {})) {
    if (!Array.isArray(entries) || entries.length === 0) continue;
    nicknameCount++;
    bookmarkCount += entries.length;
  }

  return { nicknameCount, bookmarkCount };
}

/**
 * 指定されたブックマーク辞書の全ニックネーム先頭にベースフォルダパスを付与し、再正規化します。
 * ベースフォルダが空または空白のみの場合は、元の辞書をディープコピー相当で返します。
 * @param bookmarks - 変換対象のブックマーク辞書
 * @param baseFolder - 付与する取り込み先フォルダパス（例: "chrome"）
 * @returns ベースフォルダ付与および正規化済みのブックマーク辞書
 */
export function applyBaseFolderPrefix(
  bookmarks: Record<string, BookmarkEntry[]>,
  baseFolder: string
): Record<string, BookmarkEntry[]> {
  const normalizedBase = normalizeNicknamePath(baseFolder);
  if (!normalizedBase) {
    return normalizeBookmarksDictionary(bookmarks);
  }

  const prefixed: Record<string, BookmarkEntry[]> = {};
  for (const [rawNickname, entries] of Object.entries(bookmarks || {})) {
    const normalizedNick = normalizeNicknamePath(rawNickname);
    if (!normalizedNick) continue;
    const targetKey = `${normalizedBase}/${normalizedNick}`;
    if (!prefixed[targetKey]) {
      prefixed[targetKey] = [];
    }
    for (const entry of entries) {
      prefixed[targetKey].push({ ...entry });
    }
  }

  return normalizeBookmarksDictionary(prefixed);
}

/**
 * 既存のブックマーク辞書にインポート対象の辞書を非破壊でマージし、重複 URL を統合します。
 * 同一ニックネームかつ同一 URL が衝突した場合は、高いスコア・最新使用日時・最古作成日時・
 * ピン留め維持・非空メタデータの補完ルールに従って 1 件へ統合されます。
 * @param existing - 現在保存されているブックマーク辞書
 * @param incoming - 新たに取り込むブックマーク辞書
 * @returns マージおよび正規化済みの新しいブックマーク辞書
 */
export function mergeBookmarksDictionaries(
  existing: Record<string, BookmarkEntry[]>,
  incoming: Record<string, BookmarkEntry[]>
): Record<string, BookmarkEntry[]> {
  const merged: Record<string, BookmarkEntry[]> = {};

  const appendAll = (source: Record<string, BookmarkEntry[]>): void => {
    for (const [nickname, entries] of Object.entries(source || {})) {
      if (!Array.isArray(entries)) continue;
      if (!merged[nickname]) {
        merged[nickname] = [];
      }
      for (const entry of entries) {
        merged[nickname].push({ ...entry });
      }
    }
  };

  appendAll(existing);
  appendAll(incoming);

  return normalizeBookmarksDictionary(merged);
}

/**
 * 文字列の先頭 UTF-8 BOM を取り除き、前後の空白をトリムします。
 * @param rawText - 入力テキスト文字列
 * @returns BOM 除去およびトリム済み文字列
 */
function stripBomAndTrim(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText.replace(/^\uFEFF/, '').trim();
}

/**
 * 値が配列ではないプレーンなキーバリューオブジェクトであるかを判定します。
 * @param value - 判定対象の値
 * @returns プレーンオブジェクトの場合は true、それ以外は false
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Nickmark のエクスポート JSON 文字列（または辞書直書き JSON）を検証・補完・正規化します。
 * `title`, `score`, `last_used_at`, `created_at` 等が省略されている場合は安全な初期値を補完します。
 * @param jsonText - パース対象の JSON 文字列
 * @param now - タイムスタンプ補完に使用する基準時刻（ミリ秒、省略時は現在時刻）
 * @returns 解析および正規化済みのインポート結果オブジェクト
 */
export function parseNickmarkBookmarksJson(
  jsonText: string,
  now: number = Date.now()
): ParsedImportResult {
  const cleaned = stripBomAndTrim(jsonText);
  if (!cleaned) {
    throw new BookmarkImportError('EMPTY_FILE', 'The selected file is empty.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new BookmarkImportError('INVALID_JSON_FORMAT', 'Invalid JSON format.');
  }

  if (!isPlainObject(parsed)) {
    throw new BookmarkImportError('INVALID_JSON_STRUCTURE', 'Invalid JSON structure.');
  }

  // 標準エクスポート形式（{ bookmarks: ... }）と辞書直書き形式の双方に対応する
  let rawRecord: Record<string, unknown>;
  if ('bookmarks' in parsed) {
    const rootBookmarks = parsed.bookmarks;
    if (!isPlainObject(rootBookmarks)) {
      throw new BookmarkImportError(
        'INVALID_JSON_STRUCTURE',
        'Invalid JSON structure. "bookmarks" must be an object.'
      );
    }
    rawRecord = rootBookmarks;
  } else {
    rawRecord = parsed;
  }

  const sanitized: Record<string, BookmarkEntry[]> = {};

  for (const [rawNickname, entries] of Object.entries(rawRecord)) {
    const normalizedNick = normalizeNicknamePath(rawNickname);
    if (!normalizedNick) {
      throw new BookmarkImportError(
        'INVALID_BOOKMARK_ENTRY',
        'Nickname cannot be empty.',
        rawNickname
      );
    }

    if (!Array.isArray(entries)) {
      throw new BookmarkImportError(
        'INVALID_BOOKMARK_ENTRY',
        `Expected an array for nickname "${rawNickname}".`,
        rawNickname
      );
    }

    if (!sanitized[normalizedNick]) {
      sanitized[normalizedNick] = [];
    }

    for (const rawEntry of entries) {
      if (!isPlainObject(rawEntry)) {
        throw new BookmarkImportError(
          'INVALID_BOOKMARK_ENTRY',
          `Invalid entry object for nickname "${rawNickname}".`,
          rawNickname
        );
      }

      const rawUrl = typeof rawEntry.url === 'string' ? rawEntry.url.trim() : '';
      if (!rawUrl) {
        throw new BookmarkImportError(
          'INVALID_BOOKMARK_ENTRY',
          `URL is required for nickname "${rawNickname}".`,
          rawNickname
        );
      }

      if (rawEntry.default_value !== undefined && typeof rawEntry.default_value !== 'string') {
        throw new BookmarkImportError(
          'INVALID_BOOKMARK_ENTRY',
          `Invalid default_value for nickname "${rawNickname}".`,
          rawNickname
        );
      }

      const normalizedEntry: BookmarkEntry = {
        url: rawUrl,
        title: typeof rawEntry.title === 'string' ? rawEntry.title : '',
        score:
          typeof rawEntry.score === 'number' &&
          Number.isFinite(rawEntry.score) &&
          rawEntry.score > 0
            ? rawEntry.score
            : 1.0,
        last_used_at:
          typeof rawEntry.last_used_at === 'number' &&
          Number.isFinite(rawEntry.last_used_at) &&
          rawEntry.last_used_at >= 0
            ? rawEntry.last_used_at
            : now,
        created_at:
          typeof rawEntry.created_at === 'number' &&
          Number.isFinite(rawEntry.created_at) &&
          rawEntry.created_at >= 0
            ? rawEntry.created_at
            : now
      };

      if (rawEntry.is_pinned === true) {
        normalizedEntry.is_pinned = true;
      }

      if (
        typeof rawEntry.default_value === 'string' &&
        rawEntry.default_value.trim() &&
        isDynamicUrl(rawUrl)
      ) {
        normalizedEntry.default_value = rawEntry.default_value.trim();
      }

      sanitized[normalizedNick].push(normalizedEntry);
    }
  }

  const normalizedBookmarks = normalizeBookmarksDictionary(sanitized);
  const { nicknameCount, bookmarkCount } = countBookmarksSummary(normalizedBookmarks);

  if (bookmarkCount === 0) {
    throw new BookmarkImportError('NO_VALID_BOOKMARKS', 'No valid bookmarks found to import.');
  }

  return {
    format: 'json',
    bookmarks: normalizedBookmarks,
    nicknameCount,
    bookmarkCount,
    skippedCount: 0
  };
}

/**
 * Chrome ブックマーク HTML のフォルダ名やタイトル文字列を Nickmark のニックネーム用単一セグメントへサニタイズします。
 * フォルダ区切り記号（`/`）および空白文字の連続を `-` に置換し、前後の余分なハイフンを除去します。
 * @param rawText - サニタイズ元のフォルダ名またはタイトル文字列
 * @returns サニタイズ済みの単一セグメント文字列（有効文字がない場合は空文字）
 */
export function sanitizeBookmarkNicknameSegment(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .trim()
    .replace(/[/\\]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * HTML インポート時に取り込み対象として許可される URL スキームであるかを判定します。
 * @param rawUrl - 判定対象の URL 文字列
 * @returns `http://`, `https://`, `file://`, `javascript:` のいずれかであれば true
 */
function isSupportedImportUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  return /^(?:https?:\/\/|file:\/\/|javascript:)/i.test(rawUrl.trim());
}

/**
 * タイトルが空または記号のみでニックネームセグメントを生成できない場合に、URL から代替セグメントを導出します。
 * @param url - ブックマークの対象 URL
 * @returns URL ホスト名またはフォールバック文字列 `'bookmark'`
 */
function extractFallbackSegmentFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const hostSegment = sanitizeBookmarkNicknameSegment(parsed.hostname);
    if (hostSegment) return hostSegment;
  } catch {
    // javascript: や非標準 URL の場合はフォールバック名を返す
  }
  return 'bookmark';
}

/**
 * Netscape Bookmark HTML の `ADD_DATE` 属性値（Unix 秒またはミリ秒）をミリ秒タイムスタンプへ変換します。
 * @param rawAttr - `ADD_DATE` 属性の文字列表現
 * @param fallbackNow - 解析不能時に使用するフォールバック現在時刻（ミリ秒）
 * @returns ミリ秒単位の Unix タイムスタンプ
 */
function parseHtmlAddDate(rawAttr: string | null, fallbackNow: number): number {
  if (!rawAttr) return fallbackNow;
  const parsed = Number(rawAttr.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackNow;
  // Chrome は通常 Unix 秒（10桁前後）を出力するため 1e12 未満はミリ秒へ換算する
  return parsed < 1e12 ? Math.floor(parsed * 1000) : Math.floor(parsed);
}

/**
 * DOM ツリー走査中に直前フォルダ見出し（`<H3>`）の状態を引き継ぐための内部状態型
 */
interface HtmlWalkState {
  pendingFolderName: string | null;
}

/**
 * 既に構築された HTML `Document` オブジェクトから Chrome 互換ブックマーク要素を抽出します。
 * `<DT>` の暗黙閉じタグ処理によって `<DL>` が `<DT>` の子要素または兄弟要素のいずれに配置されても
 * 正しく階層を復元できるよう、コンテナ単位で `pendingFolderName` を引き継ぎながら再帰走査します。
 * @param doc - パース済みの HTML Document オブジェクト
 * @param now - タイムスタンプ補完に使用する基準時刻（ミリ秒）
 * @returns 解析および正規化済みのインポート結果オブジェクト
 */
export function parseChromeBookmarksDocument(
  doc: Document,
  now: number = Date.now()
): ParsedImportResult {
  const rawBookmarks: Record<string, BookmarkEntry[]> = {};
  let skippedCount = 0;

  const appendBookmark = (
    folderStack: string[],
    rawTitle: string,
    rawHref: string,
    addDateAttr: string | null
  ): void => {
    const trimmedUrl = rawHref.trim();
    if (!isSupportedImportUrl(trimmedUrl)) {
      skippedCount++;
      return;
    }

    const itemSegment =
      sanitizeBookmarkNicknameSegment(rawTitle) || extractFallbackSegmentFromUrl(trimmedUrl);
    const fullNickname = normalizeNicknamePath([...folderStack, itemSegment].join('/'));
    if (!fullNickname) {
      skippedCount++;
      return;
    }

    const timestamp = parseHtmlAddDate(addDateAttr, now);
    if (!rawBookmarks[fullNickname]) {
      rawBookmarks[fullNickname] = [];
    }

    rawBookmarks[fullNickname].push({
      url: trimmedUrl,
      title: rawTitle.trim(),
      score: 1.0,
      last_used_at: timestamp,
      created_at: timestamp
    });
  };

  const walkElements = (
    container: Element,
    folderStack: string[],
    state: HtmlWalkState
  ): void => {
    for (const child of Array.from(container.children)) {
      const tag = child.tagName.toUpperCase();

      if (tag === 'H3') {
        const folderSegment = sanitizeBookmarkNicknameSegment(child.textContent || '');
        state.pendingFolderName = folderSegment || 'folder';
        continue;
      }

      if (tag === 'A') {
        const href = child.getAttribute('href') || '';
        const linkTitle = child.textContent || '';
        const addDate = child.getAttribute('add_date');
        appendBookmark(folderStack, linkTitle, href, addDate);
        // フォルダ見出しの直後に <DL> ではなく <A> が続いた場合に備えてリセットする
        state.pendingFolderName = null;
        continue;
      }

      if (tag === 'DL') {
        const nextStack = state.pendingFolderName
          ? [...folderStack, state.pendingFolderName]
          : [...folderStack];
        state.pendingFolderName = null;
        walkElements(child, nextStack, { pendingFolderName: null });
        continue;
      }

      // <DT>, <P>, <DIV> 等のラッパー要素は同一スコープの state を引き継いで子要素を走査する
      walkElements(child, folderStack, state);
    }
  };

  const allDlElements = Array.from(doc.querySelectorAll('dl'));
  // ネストされた内側の <DL> を二重走査しないよう、親に他の <DL> を持たない最上位 <DL> のみ起点にする
  const topLevelDls = allDlElements.filter(dl => !dl.parentElement?.closest('dl'));

  if (topLevelDls.length > 0) {
    for (const rootDl of topLevelDls) {
      walkElements(rootDl, [], { pendingFolderName: null });
    }
  } else if (doc.body) {
    // <DL> を持たない簡易 HTML ブックマーク断片にも対応する
    walkElements(doc.body, [], { pendingFolderName: null });
  }

  const normalizedBookmarks = normalizeBookmarksDictionary(rawBookmarks);
  const { nicknameCount, bookmarkCount } = countBookmarksSummary(normalizedBookmarks);

  if (bookmarkCount === 0) {
    throw new BookmarkImportError('NO_VALID_BOOKMARKS', 'No valid bookmarks found to import.');
  }

  return {
    format: 'chrome_html',
    bookmarks: normalizedBookmarks,
    nicknameCount,
    bookmarkCount,
    skippedCount
  };
}

/**
 * Chrome 標準のブックマーク HTML 文字列（Netscape Bookmark File Format）を解析してインポート結果へ変換します。
 * @param htmlText - 読み込んだ HTML ファイルの文字列
 * @param now - タイムスタンプ補完に使用する基準時刻（ミリ秒、省略時は現在時刻）
 * @returns 解析および正規化済みのインポート結果オブジェクト
 */
export function parseChromeBookmarksHtml(
  htmlText: string,
  now: number = Date.now()
): ParsedImportResult {
  const cleaned = stripBomAndTrim(htmlText);
  if (!cleaned) {
    throw new BookmarkImportError('EMPTY_FILE', 'The selected file is empty.');
  }

  const looksLikeBookmarkHtml =
    /NETSCAPE-Bookmark-file-1/i.test(cleaned) ||
    /<dl[\s>]/i.test(cleaned) ||
    /<a\s+[^>]*href\s*=/i.test(cleaned);

  if (!looksLikeBookmarkHtml) {
    throw new BookmarkImportError(
      'INVALID_HTML_BOOKMARKS',
      'Could not parse as a valid bookmark HTML file.'
    );
  }

  if (typeof DOMParser === 'undefined') {
    throw new BookmarkImportError(
      'INVALID_HTML_BOOKMARKS',
      'DOMParser is not available in the current environment.'
    );
  }

  const doc = new DOMParser().parseFromString(cleaned, 'text/html');
  return parseChromeBookmarksDocument(doc, now);
}

/**
 * 読み込んだファイルの内容とファイル名から形式（Nickmark JSON または Chrome ブックマーク HTML）を自動判別し、
 * 適切なパーサーで解析・正規化した結果を返します。
 * @param content - 選択されたファイルのテキスト内容
 * @param fileName - 選択されたファイル名（形式判別の補助に使用、任意）
 * @param now - タイムスタンプ補完に使用する基準時刻（ミリ秒、省略時は現在時刻）
 * @returns 解析および正規化済みのインポート結果オブジェクト
 */
export function parseImportFileContent(
  content: string,
  fileName: string = '',
  now: number = Date.now()
): ParsedImportResult {
  const cleaned = stripBomAndTrim(content);
  if (!cleaned) {
    throw new BookmarkImportError('EMPTY_FILE', 'The selected file is empty.');
  }

  // 先頭が JSON オブジェクトまたは配列であれば JSON パーサーを優先する
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return parseNickmarkBookmarksJson(cleaned, now);
  }

  const lowerName = fileName.toLowerCase();
  const looksLikeHtml =
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    /<!doctype\s+netscape-bookmark-file-1|<dl[\s>]|<html[\s>]|<meta\s+/i.test(cleaned);

  if (looksLikeHtml) {
    return parseChromeBookmarksHtml(cleaned, now);
  }

  // 拡張子も HTML 特徴も一致しない場合は JSON フォーマットエラーとして扱う
  return parseNickmarkBookmarksJson(cleaned, now);
}
