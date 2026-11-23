import { getCurrentLocale, initI18n, t } from './i18n';
import {
  ENABLED_PRESETS_STORAGE_KEY,
  OPEN_IN_CURRENT_IF_NEW_TAB_STORAGE_KEY,
  OPEN_IN_NEW_TAB_STORAGE_KEY,
  RuntimeMessage,
  SYNC_KEY_PREFIX,
  THEME_COLOR_STORAGE_KEY
} from './shared/types';
import { getHelpUrl } from './shared/url';
import {
  clearBookmarksCache,
  clearEnabledPresetsCache,
  clearOpenInCurrentIfNewTabCache,
  clearOpenInNewTabCache,
  clearThemeColorCache,
  getSyncEnabled,
  loadBookmarksData,
  updateEnabledPresetsCache,
  updateHistorySearchEnabledCache,
  updateListSortOrderCache,
  updateMaxBatchOpenTabsCache,
  updateOpenInCurrentIfNewTabCache,
  updateOpenInNewTabCache,
  updateSyncEnabledCache,
  updateThemeColorCache
} from './shared/storage';
import { executeBookmarklet } from './shared/commands';

// 共有型・定数・ユーティリティ・ストレージ・コマンド操作関数をバックグラウンドモジュールからも再エクスポート
export * from './shared/types';
export * from './shared/url';
export * from './shared/toast';
export * from './shared/listSort';
export * from './shared/bookmarkImport';
export * from './shared/presets';
export * from './shared/theme';
export * from './shared/storage';
export * from './shared/search';
export * from './shared/commands';

// バックグラウンドの Service Worker 環境でのみ初期化とリスナー登録を行う
if (typeof window === 'undefined') {
  initI18n();

  // 起動時にブックマークキャッシュを先読みする
  loadBookmarksData().catch(err => {
    console.error('Failed to pre-warm bookmarks cache on startup:', err);
  });

  // ストレージの変更を監視し、キャッシュや言語設定を常に最新状態に保つ
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local') {
      if (changes.language) {
        await initI18n(changes.language.newValue ?? null);
        chrome.contextMenus.update('help-page', {
          title: t('helpMenu')
        }, () => {
          // 拡張機能インストール直後などメニュー未作成時の runtime.lastError を無害化する
          void chrome.runtime.lastError;
        });
      }
      if (changes.isSyncEnabled) {
        updateSyncEnabledCache(!!changes.isSyncEnabled.newValue);
        clearBookmarksCache();
        clearEnabledPresetsCache();
        clearOpenInNewTabCache();
        clearOpenInCurrentIfNewTabCache();
        clearThemeColorCache();
      }
      if (changes.maxBatchOpenTabs) {
        updateMaxBatchOpenTabsCache(changes.maxBatchOpenTabs.newValue);
      }
      if (changes.historySearchEnabled) {
        updateHistorySearchEnabledCache(!!changes.historySearchEnabled.newValue);
      }
      if (changes.listSortOrder) {
        updateListSortOrderCache(changes.listSortOrder.newValue);
      }
    }

    const isSync = await getSyncEnabled();
    if ((isSync && area === 'sync') || (!isSync && area === 'local')) {
      if (changes.bookmarks || Object.keys(changes).some(k => k.startsWith(SYNC_KEY_PREFIX))) {
        clearBookmarksCache();
      }
      if (changes[ENABLED_PRESETS_STORAGE_KEY]) {
        updateEnabledPresetsCache(changes[ENABLED_PRESETS_STORAGE_KEY].newValue);
      }
      if (changes[OPEN_IN_NEW_TAB_STORAGE_KEY]) {
        updateOpenInNewTabCache(changes[OPEN_IN_NEW_TAB_STORAGE_KEY].newValue);
      }
      if (changes[OPEN_IN_CURRENT_IF_NEW_TAB_STORAGE_KEY]) {
        updateOpenInCurrentIfNewTabCache(changes[OPEN_IN_CURRENT_IF_NEW_TAB_STORAGE_KEY].newValue);
      }
      if (changes[THEME_COLOR_STORAGE_KEY]) {
        updateThemeColorCache(changes[THEME_COLOR_STORAGE_KEY].newValue);
      }
    }
  });

  // 拡張機能のインストール・更新時にコンテキストメニューを作成する
  chrome.runtime.onInstalled.addListener(async () => {
    await initI18n();
    chrome.contextMenus.create({
      id: 'help-page',
      title: t('helpMenu'),
      contexts: ['action']
    });
  });

  // コンテキストメニューのクリックイベント
  chrome.contextMenus.onClicked.addListener(async info => {
    if (info.menuItemId === 'help-page') {
      await initI18n();
      chrome.tabs.create({ url: getHelpUrl(getCurrentLocale()) });
    }
  });

  // ポップアップからのランタイムメッセージを受信する
  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (!message) return;

    if (message.action === 'EXECUTE_BOOKMARKLET') {
      executeBookmarklet(message.payload).then(result => {
        sendResponse(result);
      });
      return true;
    }
  });
}
