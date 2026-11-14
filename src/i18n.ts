/**
 * サポートしている表示言語のロケール型
 */
export type Locale = 'en' | 'ja';

let currentLocale: Locale = 'en';
let messages: Record<string, { message?: string }> = {};

/**
 * 国際化（i18n）システムを初期化し、設定済みまたはブラウザ標準の言語メッセージを読み込みます。
 * @returns 初期化完了を示す Promise
 */
export async function initI18n(): Promise<void> {
  const data = await chrome.storage.local.get('language');
  const storedLocale = data.language as Locale | undefined;
  currentLocale = storedLocale || (chrome.i18n.getUILanguage().startsWith('ja') ? 'ja' : 'en');
  await loadMessages(currentLocale);
}

/**
 * 指定されたロケールのメッセージ定義 JSON を読み込みます。
 * @param locale - 読み込む対象ロケール（'en' または 'ja'）
 * @returns 読み込み完了を示す Promise
 */
async function loadMessages(locale: Locale): Promise<void> {
  const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
  const response = await fetch(url);
  messages = await response.json();
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
