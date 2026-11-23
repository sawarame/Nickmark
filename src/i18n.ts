/**
 * サポートしている表示言語のロケール型
 */
export type Locale = 'en' | 'ja' | 'zh_CN' | 'zh_TW' | 'ko';

/**
 * ストレージおよび設定画面で扱う言語設定値の型（`'auto'` はブラウザ UI 言語へ自動追従）
 */
export type LanguageSetting = 'auto' | Locale;

type LocaleMessagesMap = Record<string, { message?: string }>;

const I18N_LOCALE_CACHE_KEY = 'nickmark:i18n:locale';
const I18N_MESSAGES_CACHE_PREFIX = 'nickmark:i18n:messages:';

let currentLanguageSetting: LanguageSetting = 'auto';
let currentLocale: Locale = 'en';
let messages: LocaleMessagesMap = {};
let loadedMessagesLocale: Locale | null = null;
let hasLoadedMessages = false;

/**
 * 任意の値をサポート対象のロケール（`'en' | 'ja' | 'zh_CN' | 'zh_TW' | 'ko'`）へ正規化します。
 * @param value - 検証対象の値
 * @returns 有効なロケールの場合はその値、それ以外は `undefined`
 */
export function normalizeLocale(value: unknown): Locale | undefined {
  if (
    value === 'en' ||
    value === 'ja' ||
    value === 'zh_CN' ||
    value === 'zh_TW' ||
    value === 'ko'
  ) {
    return value;
  }
  return undefined;
}

/**
 * 任意の値を言語設定値（`'auto'` またはサポート対象ロケール）へ正規化します。
 * 未設定（`undefined` / `null`）や不正値は `'auto'` にフォールバックします。
 * @param value - 検証対象の値
 * @returns 正規化された言語設定値
 */
export function normalizeLanguageSetting(value: unknown): LanguageSetting {
  if (value === 'auto') return 'auto';
  return normalizeLocale(value) ?? 'auto';
}

/**
 * ブラウザ UI 言語文字列（例: `ja`, `zh-TW`, `zh_Hant_HK`, `ko-KR` 等）から対応ロケールを決定します。
 * ハイフン／アンダースコアおよび大文字・小文字を正規化したうえでマッピングします。
 * @param uiLanguage - ブラウザ UI 言語文字列
 * @returns マッピングされたサポート対象ロケール
 */
export function resolveLocaleFromBrowserLanguage(uiLanguage?: string): Locale {
  if (!uiLanguage || typeof uiLanguage !== 'string') return 'en';
  const normalized = uiLanguage.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return 'en';

  if (normalized === 'ja' || normalized.startsWith('ja-')) {
    return 'ja';
  }
  if (normalized === 'ko' || normalized.startsWith('ko-')) {
    return 'ko';
  }
  if (
    normalized === 'zh-tw' ||
    normalized === 'zh-hk' ||
    normalized === 'zh-mo' ||
    normalized === 'zh-hant' ||
    normalized.startsWith('zh-hant-') ||
    normalized.startsWith('zh-tw-') ||
    normalized.startsWith('zh-hk-') ||
    normalized.startsWith('zh-mo-')
  ) {
    return 'zh_TW';
  }
  if (normalized === 'zh' || normalized.startsWith('zh-')) {
    return 'zh_CN';
  }
  return 'en';
}

/**
 * 現在のブラウザ UI 言語からデフォルトのロケールを判定します。
 * @returns 判定されたロケール
 */
export function resolveBrowserDefaultLocale(): Locale {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
    return resolveLocaleFromBrowserLanguage(chrome.i18n.getUILanguage());
  }
  return 'en';
}

/**
 * 言語設定値（`'auto'` または明示ロケール）を実際に表示するロケールへ解決します。
 * @param setting - 言語設定値
 * @returns 表示に使用するロケール
 */
export function resolveLanguageSetting(setting: LanguageSetting): Locale {
  return setting === 'auto' ? resolveBrowserDefaultLocale() : setting;
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
 * 言語設定値（`'auto'` または明示ロケール）を `localStorage` に同期保存します。
 * @param setting - 保存する言語設定値
 * @returns なし
 */
function saveLanguageSettingCache(setting: LanguageSetting): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(I18N_LOCALE_CACHE_KEY, setting);
  } catch {
    // ストレージ容量制限等で書き込みに失敗しても動作継続を優先する
  }
}

/**
 * ロケール、言語設定値、およびメッセージ辞書を `localStorage` に同期キャッシュとして保存します。
 * Service Worker など `localStorage` が存在しない環境では何もしません。
 * @param locale - 保存する解決済みロケール
 * @param loadedMessages - 保存するメッセージ辞書
 * @param setting - 保存する言語設定値（`'auto'` または明示ロケール）
 * @returns なし
 */
function saveI18nCache(
  locale: Locale,
  loadedMessages: LocaleMessagesMap,
  setting: LanguageSetting
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const targetKey = buildMessagesCacheKey(locale);
    const compacted = compactMessagesMap(loadedMessages);
    localStorage.setItem(I18N_LOCALE_CACHE_KEY, setting);
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
 * モジュール読み込み時に `localStorage` から前回の言語設定および辞書キャッシュを同期復元します。
 * `'auto'` がキャッシュされている場合は都度ブラウザ UI 言語から解決するため、
 * ブラウザ言語変更後に古いロケールのキャッシュが誤って表示され続けることを防ぎます。
 * @returns なし
 */
export function restoreI18nCacheSync(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const cachedSetting = normalizeLanguageSetting(localStorage.getItem(I18N_LOCALE_CACHE_KEY));
    const cachedLocale = resolveLanguageSetting(cachedSetting);
    currentLanguageSetting = cachedSetting;
    currentLocale = cachedLocale;

    const cachedJson = localStorage.getItem(buildMessagesCacheKey(cachedLocale));
    if (!cachedJson) {
      messages = {};
      loadedMessagesLocale = null;
      hasLoadedMessages = false;
      return;
    }

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

  const setting = normalizeLanguageSetting(rawLanguage);
  const targetLocale = resolveLanguageSetting(setting);
  currentLanguageSetting = setting;
  currentLocale = targetLocale;

  if (hasLoadedMessages && loadedMessagesLocale === targetLocale) {
    saveLanguageSettingCache(setting);
    return prevLocale !== targetLocale;
  }

  await loadMessages(targetLocale, setting);
  return !wasReady || prevLocale !== targetLocale;
}

/**
 * 指定されたロケールのメッセージ定義 JSON を読み込み、キャッシュへ保存します。
 * @param locale - 読み込む対象ロケール
 * @param setting - キャッシュに記録する言語設定値（`'auto'` または明示ロケール）
 * @returns 読み込み完了を示す Promise
 */
async function loadMessages(locale: Locale, setting: LanguageSetting): Promise<void> {
  const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
  const response = await fetch(url);
  messages = await response.json();
  loadedMessagesLocale = locale;
  hasLoadedMessages = true;
  saveI18nCache(locale, messages, setting);
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
 * 言語設定（`'auto'` または明示ロケール）を変更し、解決後のメッセージを即時再読み込みしてローカルストレージへ保存します。
 * @param setting - 新しく設定する言語設定値（`'auto'` またはサポート対象ロケール）
 * @returns 更新完了を示す Promise
 */
export async function setLocale(setting: LanguageSetting): Promise<void> {
  const normalizedSetting = normalizeLanguageSetting(setting);
  const targetLocale = resolveLanguageSetting(normalizedSetting);
  currentLanguageSetting = normalizedSetting;
  currentLocale = targetLocale;
  await loadMessages(targetLocale, normalizedSetting);
  await chrome.storage.local.set({ language: normalizedSetting });
}

/**
 * 現在適用されている表示ロケール（`'auto'` 解決後の実ロケール）を取得します。
 * @returns 現在のロケール
 */
export function getCurrentLocale(): Locale {
  return currentLocale;
}

/**
 * 現在適用されている言語設定値（`'auto'` または明示ロケール）を取得します。
 * @returns 現在の言語設定値
 */
export function getLanguageSetting(): LanguageSetting {
  return currentLanguageSetting;
}
