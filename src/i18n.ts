export type Locale = 'en' | 'ja';

let currentLocale: Locale = 'en';
let messages: Record<string, any> = {};

export async function initI18n() {
  const data = await chrome.storage.local.get('language');
  const storedLocale = data.language as Locale | undefined;
  currentLocale = storedLocale || (chrome.i18n.getUILanguage().startsWith('ja') ? 'ja' : 'en');
  await loadMessages(currentLocale);
}

async function loadMessages(locale: Locale) {
  const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
  const response = await fetch(url);
  messages = await response.json();
}

export function t(key: string, substitutions?: string[]): string {
  const messageObj = messages[key];
  if (!messageObj) {
    // Fallback to chrome.i18n if not found in our manual load (unlikely but safe)
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

export async function setLocale(locale: Locale) {
  currentLocale = locale;
  await loadMessages(locale);
  await chrome.storage.local.set({ language: locale });
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}
