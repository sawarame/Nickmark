/**
 * サポートしている表示言語のロケール型
 */
export type Locale = 'en' | 'ja';

type LocaleMessagesMap = Record<string, { message?: string }>;

const I18N_LOCALE_CACHE_KEY = 'nickmark:i18n:locale';
const I18N_MESSAGES_CACHE_PREFIX = 'nickmark:i18n:messages:';

let currentLocale: Locale = 'en';
let messages: LocaleMessagesMap = {};
let loadedMessagesLocale: Locale | null = null;
let hasLoadedMessages = false;

/**
 * 任意の値をサポート対象のロケール（`'en'` または `'ja'`）へ正規化します。
 * @param value - 検証対象の値
 * @returns 有効なロケールの場合は `'en'` または `'ja'`、それ以外は `undefined`
 */
function normalizeLocale(value: unknown): Locale | undefined {
  return value === 'ja' || value === 'en' ? value : undefined;
}

/**
 * ブラウザ UI 言語からデフォルトのロケールを判定します。
 * @returns `'ja'` または `'en'`
 */
function resolveBrowserDefaultLocale(): Locale {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
    return chrome.i18n.getUILanguage().startsWith('ja') ? 'ja' : 'en';
  }
  return 'en';
}

/**
 * 拡張機能マニフェストのバージョン文字列を取得します（キャッシュキーの世代管理用）。
 * @returns バージョン文字列（取得不可時は `'dev'`）
 */
function getExtensionVersion(): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      return chrome.runtime.getManifest().version || 'dev';
    }
  } catch {
    // テスト環境等で getManifest が利用できない場合は既定値を使用する
  }
  return 'dev';
}

/**
 * 現在の拡張機能バージョンとロケールに対応する `localStorage` メッセージキャッシュキーを生成します。
 * @param locale - 対象ロケール
 * @returns キャッシュキー文字列
 */
function buildMessagesCacheKey(locale: Locale): string {
  return `${I18N_MESSAGES_CACHE_PREFIX}${getExtensionVersion()}:${locale}`;
}

/**
 * メッセージ辞書から不要なメタ情報（`description` 等）を取り除き、キャッシュ用に軽量化します。
 * @param raw - `messages.json` から取得した生の辞書オブジェクト
 * @returns `{ message }` のみを抽出した軽量辞書
 */
function compactMessagesMap(raw: LocaleMessagesMap): LocaleMessagesMap {
  const compacted: LocaleMessagesMap = {};
  for (const [key, entry] of Object.entries(raw || {})) {
    if (entry && typeof entry.message === 'string') {
      compacted[key] = { message: entry.message };
    }
  }
  return compacted;
}

/**
 * ロケールとメッセージ辞書を `localStorage` に同期キャッシュとして保存します。
 * Service Worker など `localStorage` が存在しない環境では何もしません。
 * @param locale - 保存するロケール
 * @param loadedMessages - 保存するメッセージ辞書
 * @returns なし
 */
function saveI18nCache(locale: Locale, loadedMessages: LocaleMessagesMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const targetKey = buildMessagesCacheKey(locale);
    const compacted = compactMessagesMap(loadedMessages);
    localStorage.setItem(I18N_LOCALE_CACHE_KEY, locale);
    localStorage.setItem(targetKey, JSON.stringify(compacted));

    // 古いバージョン向けのキャッシュキーが残っていれば削除する
    const currentPrefix = `${I18N_MESSAGES_CACHE_PREFIX}${getExtensionVersion()}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(I18N_MESSAGES_CACHE_PREFIX) && !key.startsWith(currentPrefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ストレージ容量制限等で書き込みに失敗しても動作継続を優先する
  }
}

/**
 * モジュール読み込み時に `localStorage` から前回のロケールおよび辞書キャッシュを同期復元します。
 * ポップアップ起動時の初回レンダリングから正しい言語・Tips を即座に表示するために使用します。
 * @returns なし
 */
function restoreI18nCacheSync(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const cachedLocale =
      normalizeLocale(localStorage.getItem(I18N_LOCALE_CACHE_KEY)) ?? resolveBrowserDefaultLocale();
    currentLocale = cachedLocale;

    const cachedJson = localStorage.getItem(buildMessagesCacheKey(cachedLocale));
    if (!cachedJson) return;

    const parsed = JSON.parse(cachedJson) as LocaleMessagesMap;
    if (parsed && typeof parsed === 'object') {
      messages = parsed;
      loadedMessagesLocale = cachedLocale;
      hasLoadedMessages = true;
    }
  } catch {
    // パース失敗時は安全に初期化前状態へ戻し、後続の非同期読み込みへ委ねる
    messages = {};
    loadedMessagesLocale = null;
    hasLoadedMessages = false;
  }
}

// 画面コンテキストではモジュール評価時に同期キャッシュを復元しておく
restoreI18nCacheSync();

/**
 * 現在メモリ上にメッセージ辞書が読み込み済み（同期キャッシュ復元または `initI18n` 完了済み）かを返します。
 * @returns 辞書が利用可能な場合は `true`
 */
export function hasI18nMessagesReady(): boolean {
  return hasLoadedMessages;
}

/**
 * 国際化（i18n）システムを初期化し、設定済みまたはブラウザ標準の言語メッセージを読み込みます。
 * `preloadedLanguage` に取得済みの設定値（未設定の場合は `null`）を渡すことで重複ストレージ読み込みを省けます。
 * 同一バージョン・同一ロケールの辞書が既にメモリ上にある場合は `fetch` をスキップします。
 * @param preloadedLanguage - 事前取得済みの言語設定値（未取得時は `undefined`、取得済み未設定時は `null`）
 * @returns ロケールまたは辞書が更新され、呼び出し側の再描画が必要な場合は `true`
 */
export async function initI18n(preloadedLanguage?: unknown): Promise<boolean> {
  const prevLocale = currentLocale;
  const wasReady = hasLoadedMessages;

  let rawLanguage = preloadedLanguage;
  if (rawLanguage === undefined) {
    const data = await chrome.storage.local.get('language');
    rawLanguage = data.language ?? null;
  }

  const storedLocale = normalizeLocale(rawLanguage);
  const targetLocale = storedLocale || resolveBrowserDefaultLocale();
  currentLocale = targetLocale;

  if (hasLoadedMessages && loadedMessagesLocale === targetLocale) {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(I18N_LOCALE_CACHE_KEY, targetLocale);
      } catch {
        // 書き込み不可時は無視する
      }
    }
    return prevLocale !== targetLocale;
  }

  await loadMessages(targetLocale);
  return !wasReady || prevLocale !== targetLocale;
}

/**
 * 指定されたロケールのメッセージ定義 JSON を読み込み、キャッシュへ保存します。
 * @param locale - 読み込む対象ロケール（'en' または 'ja'）
 * @returns 読み込み完了を示す Promise
 */
async function loadMessages(locale: Locale): Promise<void> {
  const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
  const response = await fetch(url);
  messages = await response.json();
  loadedMessagesLocale = locale;
  hasLoadedMessages = true;
  saveI18nCache(locale, messages);
}

/**
 * 指定されたメッセージキーに対応するローカライズ済み文字列を取得します。
 * @param key - メッセージキー名
 * @param substitutions - プレースホルダー（$1, $2...）へ埋め込む置換文字列配列
 * @returns ローカライズされた文字列（未定義時は chrome.i18n へフォールバックし、それもなければキー名）
 */
export function t(key: string, substitutions?: string[]): string {
  const messageObj = messages[key];
  if (!messageObj || !messageObj.message) {
    // 手動ロードした辞書に見つからない場合は chrome.i18n へフォールバックする
    return chrome.i18n.getMessage(key, substitutions) || key;
  }

  let message = messageObj.message;
  if (substitutions) {
    substitutions.forEach((sub, index) => {
      message = message.replace(`$${index + 1}`, sub);
    });
  }
  return message;
}

/**
 * 表示言語を変更し、メッセージを即時再読み込みしてローカルストレージへ保存します。
 * @param locale - 新しく設定するロケール
 * @returns 更新完了を示す Promise
 */
export async function setLocale(locale: Locale): Promise<void> {
  currentLocale = locale;
  await loadMessages(locale);
  await chrome.storage.local.set({ language: locale });
}

/**
 * 現在適用されているロケールを取得します。
 * @returns 現在のロケール（'en' または 'ja'）
 */
export function getCurrentLocale(): Locale {
  return currentLocale;
}
