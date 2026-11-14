import { getCurrentLocale, initI18n, t } from './i18n';
import {
  BookmarkEntry,
  OMNIBOX_MIGRATION_HINT_CONTENT,
  RuntimeMessage,
  SuggestedMatchTarget,
  SYNC_KEY_PREFIX
} from './shared/types';
import {
  escapeXml,
  formatUrlForOmniboxDisplay,
  getHelpUrl,
  getShortcutLabel,
  isBookmarkletUrl,
  isRestrictedTabUrl,
  normalizeNicknamePath
} from './shared/url';
import { openOrReuseListTab, renderToastInDocument, showToast } from './shared/toast';
import {
  clearBookmarksCache,
  extractFolders,
  getMaxBatchOpenTabs,
  getSyncEnabled,
  loadBookmarksData,
  openFolderUrls,
  updateSyncEnabledCache
} from './shared/storage';
import {
  buildRegularSearchSuggestions,
  formatSearchMatchDescription,
  resolveCommandMatches,
  resolveMatchFromZeroWidthMarker,
  resolveRegularSearchMatches,
  stripZeroWidthChars
} from './shared/search';
import {
  executeBookmarklet,
  executeNickmarkCommand,
  navigateWithDisposition
} from './shared/commands';

// 共有型・定数・ユーティリティ・ストレージ・コマンド操作関数をバックグラウンドモジュールからも再エクスポート
export * from './shared/types';
export * from './shared/url';
export * from './shared/toast';
export * from './shared/storage';
export * from './shared/search';
export * from './shared/commands';

// 直近でオムニボックスに提示したサジェスト候補の content と遷移先情報の対応マップ
let lastSuggestedMatchMap = new Map<string, SuggestedMatchTarget>();

// オムニボックス入力のデバウンス制御用変数
let omniboxDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastPendingSuggest: ((suggestResults: chrome.omnibox.SuggestResult[]) => void) | null = null;
let currentRequestId = 0;

/**
 * 保留中のサジェストタイマーとコールバックをクリアし、Chrome への応答を完了させます。
 * @returns なし
 */
function clearPendingSuggest(): void {
  if (omniboxDebounceTimer) {
    clearTimeout(omniboxDebounceTimer);
    omniboxDebounceTimer = null;
  }
  if (lastPendingSuggest) {
    try {
      lastPendingSuggest([]);
    } catch {
      // 既にコールバックが解決されている場合は無視する
    }
    lastPendingSuggest = null;
  }
}

/**
 * 安全上限を超過したフォルダ一括オープンについて、アクティブタブ上に確認プロンプトを表示します。
 * スクリプト実行が許可されていない特殊ページの場合は、管理画面（list.html）へフォールバックします。
 * @param tabId - 対象タブの ID
 * @param folderPath - 対象のフォルダパス
 * @param urls - 開く対象の URL リスト
 * @param nicknames - 所属するニックネームリスト
 * @returns 処理完了を示す Promise
 */
export async function handleBatchOpenConfirmationRequest(
  tabId: number,
  folderPath: string,
  urls: string[],
  nicknames: string[]
): Promise<void> {
  const maxLimit = await getMaxBatchOpenTabs();
  const title = t('confirmBatchOpenTitle') || '大量タブオープンの確認';
  const msg =
    t('confirmBatchOpenMessage', [folderPath, String(urls.length), String(maxLimit)]) ||
    `フォルダ「${folderPath}」には ${urls.length} 件のタブが含まれています。安全上限（${maxLimit}件）を超えていますが、すべて開きますか？`;
  const confirmBtnText = t('confirmBatchOpenBtn') || 'すべて開く';
  const cancelBtnText = t('cancelBtn') || 'キャンセル';

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (
        folder: string,
        urlList: string[],
        nickList: string[],
        dialogTitle: string,
        message: string,
        okLabel: string,
        cancelLabel: string
      ) => {
        const modalId = 'nickmark-batch-open-confirm';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.id = modalId;
        Object.assign(backdrop.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: '2147483647',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });

        const dialog = document.createElement('div');
        Object.assign(dialog.style, {
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          padding: '24px',
          borderRadius: '12px',
          maxWidth: '440px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          border: '1px solid #334155'
        });

        const h3 = document.createElement('h3');
        h3.textContent = dialogTitle;
        Object.assign(h3.style, { margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#f59e0b' });

        const p = document.createElement('p');
        p.textContent = message;
        Object.assign(p.style, { margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5', color: '#cbd5e1' });

        const btnContainer = document.createElement('div');
        Object.assign(btnContainer.style, { display: 'flex', justifyContent: 'flex-end', gap: '12px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelLabel;
        Object.assign(cancelBtn.style, {
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid #475569',
          backgroundColor: '#334155',
          color: '#f8fafc',
          cursor: 'pointer',
          fontSize: '13px'
        });
        cancelBtn.onclick = () => backdrop.remove();

        const okBtn = document.createElement('button');
        okBtn.textContent = okLabel;
        Object.assign(okBtn.style, {
          padding: '8px 16px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#2563eb',
          color: '#ffffff',
          cursor: 'pointer',
          fontWeight: '500',
          fontSize: '13px'
        });
        okBtn.onclick = () => {
          backdrop.remove();
          chrome.runtime.sendMessage({
            action: 'EXECUTE_BATCH_OPEN',
            payload: { folderPath: folder, urls: urlList, nicknames: nickList }
          });
        };

        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(okBtn);
        dialog.appendChild(h3);
        dialog.appendChild(p);
        dialog.appendChild(btnContainer);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
      },
      args: [folderPath, urls, nicknames, title, msg, confirmBtnText, cancelBtnText]
    });
  } catch {
    // 特殊ページ（スクリプト実行不可）では管理画面を開く
    await openOrReuseListTab({ msg });
  }
}

/**
 * 現在アクティブなタブ上でブックマークレットを実行し、エラー発生時のみページ内トーストを表示します。
 * @param bookmarkletUrl - `javascript:` で始まるブックマークレット文字列
 * @param currentTab - 実行対象となる現在アクティブなタブ
 * @param matchedTemplateUrl - スコア更新用の元テンプレート URL
 * @param matchedNickname - スコア更新用の対象ニックネーム
 * @returns 処理完了を示す Promise
 */
async function executeBookmarkletOnTab(
  bookmarkletUrl: string,
  currentTab: chrome.tabs.Tab | undefined,
  matchedTemplateUrl?: string,
  matchedNickname?: string
): Promise<void> {
  if (!currentTab || currentTab.id === undefined) return;
  const result = await executeBookmarklet({
    tabId: currentTab.id,
    tabUrl: currentTab.url,
    bookmarkletUrl,
    matchedTemplateUrl,
    matchedNickname
  });
  if (!result.success && result.errorMessage) {
    const duration = result.errorKind === 'empty' ? 4000 : result.errorKind === 'restricted' ? 4500 : 5000;
    await showToast(currentTab.id, result.errorMessage, duration);
  }
}

/**
 * オムニボックスのデフォルト案内（空入力時）に表示するポップアップ移行促進メッセージを生成します。
 * @returns XML エスケープ済みの説明文
 */
function getMigrationDefaultDescription(): string {
  const shortcut = getShortcutLabel();
  const msg =
    t('omniboxMigrationDefault', [shortcut]) ||
    `Nickmark — 次回からは ${shortcut} でポップアップ版をご利用ください（アドレスバー機能は将来廃止予定）`;
  return escapeXml(msg);
}

/**
 * オムニボックスの候補リスト先頭に表示するポップアップ移行案内候補を生成します。
 * @returns オムニボックス用のサジェスト候補オブジェクト
 */
function buildMigrationSuggestResult(): chrome.omnibox.SuggestResult {
  const shortcut = getShortcutLabel();
  const msg =
    t('omniboxMigrationSuggestion', [shortcut]) ||
    `💡 ショートカット ${shortcut} でポップアップ版をご利用ください（アドレスバーは将来廃止予定）`;
  return {
    content: OMNIBOX_MIGRATION_HINT_CONTENT,
    description: `<dim>${escapeXml(msg)}</dim>`
  };
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
    chrome.omnibox.setDefaultSuggestion({ description: `Run command: ${commandMatches[0].description}` });
  } else if (commandMatches.length > 1) {
    chrome.omnibox.setDefaultSuggestion({ description: `Search commands for: <match>${escapeXml(text)}</match>` });
  } else {
    chrome.omnibox.setDefaultSuggestion({ description: `Invalid command: <match>${escapeXml(text)}</match>` });
  }

  for (const match of commandMatches) {
    let finalContent = match.content;
    // Chrome が候補を非表示にするのを防ぐため、入力テキストで始まるように調整する
    if (!finalContent.startsWith(text) && text.startsWith(match.content)) {
      finalContent = text;
    }
    suggestions.push({ content: finalContent, description: match.description });
  }

  // 移行期間中は先頭にポップアップ利用を促す候補を表示する
  suggestions.unshift(buildMigrationSuggestResult());
  suggest(suggestions);
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
  const trimmed = stripZeroWidthChars(text).trim();
  const allMatches = resolveRegularSearchMatches(trimmed, bookmarks);
  const folders = extractFolders(bookmarks);

  // 末尾がスラッシュの場合はフォルダ一括オープンの指定とみなす
  const isExplicitFolderInput = trimmed.endsWith('/');
  const normalizedFolderQuery = normalizeNicknamePath(trimmed);
  const matchedFolder = normalizedFolderQuery ? folders.get(normalizedFolderQuery) : undefined;

  if (isExplicitFolderInput && matchedFolder && matchedFolder.openableUrlCount > 0) {
    const desc =
      t('openAllInFolder', [matchedFolder.path, String(matchedFolder.openableUrlCount)]) ||
      `📁 フォルダ「${matchedFolder.path}」の全ブックマークを一括オープン (${matchedFolder.openableUrlCount}タブ)`;
    chrome.omnibox.setDefaultSuggestion({
      description: `<match>${escapeXml(matchedFolder.path)}/</match> - ${escapeXml(desc)}`
    });
  } else if (allMatches.length === 1) {
    const actionLabel = isBookmarkletUrl(allMatches[0].resolvedUrl) ? 'Run' : 'Go to';
    chrome.omnibox.setDefaultSuggestion({
      description: `${actionLabel} ${formatSearchMatchDescription(allMatches[0])}`
    });
  } else if (allMatches.length > 0) {
    const top = allMatches[0];
    const topTitle = escapeXml(top.entry.title) || 'No title';
    const topUrl = escapeXml(formatUrlForOmniboxDisplay(top.resolvedUrl));
    chrome.omnibox.setDefaultSuggestion({
      description: `Search for: <match>${escapeXml(trimmed)}</match> <dim>- ${topTitle} (${topUrl})</dim>`
    });
  } else {
    chrome.omnibox.setDefaultSuggestion({
      description: `No matches found for: <match>${escapeXml(trimmed)}</match>`
    });
  }

  const { suggestions, matchMap } = buildRegularSearchSuggestions(text, allMatches, bookmarks);

  // 末尾スラッシュでない通常入力時でも、該当フォルダが存在する場合はサジェスト内に一括オープン候補を提示する
  if (!isExplicitFolderInput && normalizedFolderQuery) {
    const lowerTrimmed = normalizedFolderQuery.toLowerCase();
    for (const folder of folders.values()) {
      if (
        folder.openableUrlCount > 0 &&
        (folder.path.toLowerCase() === lowerTrimmed || folder.path.toLowerCase().startsWith(lowerTrimmed))
      ) {
        const summaryDesc =
          t('openFolderSummary', [folder.path, String(folder.openableUrlCount)]) ||
          `📁 ${folder.path} (${folder.openableUrlCount}タブを一括オープン)`;
        suggestions.unshift({
          content: `${folder.path}/`,
          description: `<match>${escapeXml(folder.path)}/</match> <dim>- ${escapeXml(summaryDesc)}</dim>`
        });
        break;
      }
    }
  }

  // 移行期間中は先頭にポップアップ利用を促す候補を表示する
  suggestions.unshift(buildMigrationSuggestResult());
  lastSuggestedMatchMap = matchMap;
  suggest(suggestions);
}

/**
 * 確定したコマンド（:add, :addall, :open, :ls, :prefs, :help, :rm）を共有エンジン経由で実行し、
 * オムニボックス向けのトースト通知・確認プロンプト等のフィードバックを行います。
 * @param resolvedContent - 補完済みのコマンド文字列
 * @param currentTab - 現在アクティブなタブ
 * @returns 処理完了を示す Promise
 */
async function executeCommand(resolvedContent: string, currentTab: chrome.tabs.Tab): Promise<void> {
  const result = await executeNickmarkCommand(resolvedContent, currentTab, { source: 'omnibox' });
  const tabId = currentTab?.id;

  if (result.outcome === 'executed_close' || result.outcome === 'executed_keep_open') return;

  if (result.outcome === 'info_prompt') {
    if (result.legacyFallbackAction === 'open_list_with_tab') {
      await openOrReuseListTab({
        url: currentTab?.url || '',
        title: currentTab?.title || ''
      });
      return;
    }
    if (result.legacyFallbackAction === 'open_list_with_msg' && result.message) {
      await openOrReuseListTab({ msg: result.message });
      return;
    }
  }

  if (result.outcome === 'needs_confirmation' && result.confirmation && tabId !== undefined) {
    await handleBatchOpenConfirmationRequest(
      tabId,
      result.confirmation.folderPath,
      result.confirmation.urls,
      result.confirmation.nicknames
    );
    return;
  }

  if ((result.outcome === 'success_toast' || result.outcome === 'error') && result.message && tabId !== undefined) {
    const duration = resolvedContent.trim().startsWith(':open') || resolvedContent.trim().startsWith(':o') ? 4000 : 3000;
    await showToast(tabId, result.message, duration);
  }
}

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
        await initI18n();
        chrome.contextMenus.update('help-page', {
          title: t('helpMenu')
        });
      }
      if (changes.isSyncEnabled) {
        updateSyncEnabledCache(!!changes.isSyncEnabled.newValue);
        clearBookmarksCache();
      }
    }

    const isSync = await getSyncEnabled();
    if ((isSync && area === 'sync') || (!isSync && area === 'local')) {
      if (changes.bookmarks || Object.keys(changes).some(k => k.startsWith(SYNC_KEY_PREFIX))) {
        clearBookmarksCache();
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
  chrome.contextMenus.onClicked.addListener(info => {
    if (info.menuItemId === 'help-page') {
      chrome.tabs.create({ url: getHelpUrl(getCurrentLocale()) });
    }
  });

  // オムニボックス入力セッション開始時にキャッシュを先読みする
  chrome.omnibox.onInputStarted.addListener(() => {
    chrome.omnibox.setDefaultSuggestion({ description: getMigrationDefaultDescription() });
    loadBookmarksData().catch(err => {
      console.error('Failed to pre-warm bookmarks cache:', err);
    });
  });

  // オムニボックス入力キャンセル時の後片付け
  chrome.omnibox.onInputCancelled.addListener(() => {
    clearPendingSuggest();
    lastSuggestedMatchMap.clear();
  });

  // オムニボックス入力変更時のデバウンス付きサジェスト生成
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    clearPendingSuggest();
    lastSuggestedMatchMap.clear();

    const cleanText = stripZeroWidthChars(text);
    const trimmed = cleanText.trim();

    if (!trimmed) {
      chrome.omnibox.setDefaultSuggestion({ description: getMigrationDefaultDescription() });
      suggest([buildMigrationSuggestResult()]);
      return;
    }

    lastPendingSuggest = suggest;
    const thisRequestId = ++currentRequestId;

    omniboxDebounceTimer = setTimeout(async () => {
      try {
        const bookmarks = await loadBookmarksData();
        if (thisRequestId !== currentRequestId) return;

        if (cleanText.startsWith(':')) {
          handleCommandModeSuggestions(cleanText, suggest, bookmarks);
        } else {
          handleRegularSearchSuggestions(text, suggest, bookmarks);
        }
      } catch (error) {
        console.error('Failed to handle omnibox suggestions:', error);
        suggest([]);
      } finally {
        if (thisRequestId === currentRequestId) {
          lastPendingSuggest = null;
          omniboxDebounceTimer = null;
        }
      }
    }, 150);
  });

  // オムニボックスで Enter キーが押された時の実行処理
  chrome.omnibox.onInputEntered.addListener(
    async (text: string, disposition: 'currentTab' | 'newForegroundTab' | 'newBackgroundTab') => {
      clearPendingSuggest();
      const cleanTrimmed = stripZeroWidthChars(text).trim();

      // ポップアップ移行案内候補が選択された場合は誤遷移させず安全に案内のみ行う
      if (cleanTrimmed === OMNIBOX_MIGRATION_HINT_CONTENT) {
        lastSuggestedMatchMap.clear();
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currentTab?.id !== undefined && !isRestrictedTabUrl(currentTab.url)) {
          const shortcut = getShortcutLabel();
          const toastMsg =
            t('omniboxMigrationToast', [shortcut]) ||
            `次回からはショートカット ${shortcut} でポップアップ版をご利用ください！`;
          try {
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              func: renderToastInDocument,
              args: [toastMsg, 3500, 'nickmark-toast', '2147483647']
            });
          } catch {
            // 注入不可ページでは強制遷移せず静かに終了する
          }
        }
        return;
      }

      // コマンドモード
      if (cleanTrimmed.startsWith(':')) {
        lastSuggestedMatchMap.clear();
        const bookmarks = await loadBookmarksData();
        const commandMatches = resolveCommandMatches(cleanTrimmed, bookmarks);

        let resolvedContent = cleanTrimmed;
        if (commandMatches.length > 0) {
          const isRm = cleanTrimmed.startsWith(':rm');
          if (commandMatches.length === 1 || !isRm) {
            resolvedContent = commandMatches[0].content;
          }
        }

        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await executeCommand(resolvedContent, currentTab);
        return;
      }

      // フォルダ一括オープンの判定（末尾スラッシュ指定時）
      if (cleanTrimmed.endsWith('/')) {
        const folderPath = normalizeNicknamePath(cleanTrimmed);
        if (folderPath) {
          const bookmarks = await loadBookmarksData();
          const folders = extractFolders(bookmarks);
          if (folders.has(folderPath)) {
            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const result = await openFolderUrls(folderPath, false, currentTab?.id);
            if (
              result.requiresConfirmation &&
              result.folderPath &&
              result.urls &&
              currentTab?.id !== undefined
            ) {
              await handleBatchOpenConfirmationRequest(
                currentTab.id,
                result.folderPath,
                result.urls,
                result.nicknames || []
              );
            }
            return;
          }
        }
      }

      let targetUrl = cleanTrimmed;
      let matchedTemplateUrl: string | undefined;
      let matchedNickname: string | undefined;

      // 1. 直近のサジェスト候補マップを優先解決
      const mappedMatch = lastSuggestedMatchMap.get(text);
      lastSuggestedMatchMap.clear();

      if (mappedMatch) {
        targetUrl = mappedMatch.resolvedUrl;
        matchedTemplateUrl = mappedMatch.templateUrl;
        matchedNickname = mappedMatch.nickname;
      } else if (!cleanTrimmed.startsWith('http://') && !cleanTrimmed.startsWith('https://')) {
        const bookmarks = await loadBookmarksData();

        // 2. Service Worker 再起動時フォールバック：ゼロ幅マーカーから復元
        const decodedFromMarker = resolveMatchFromZeroWidthMarker(text, bookmarks);
        if (decodedFromMarker) {
          targetUrl = decodedFromMarker.resolvedUrl;
          matchedTemplateUrl = decodedFromMarker.templateUrl;
          matchedNickname = decodedFromMarker.nickname;
        } else {
          // 3. 通常検索として最上位候補に解決
          const allMatches = resolveRegularSearchMatches(cleanTrimmed, bookmarks);
          if (allMatches.length === 0) return;
          targetUrl = allMatches[0].resolvedUrl;
          matchedTemplateUrl = allMatches[0].entry.url;
          matchedNickname = allMatches[0].nickname;
        }
      }

      if (isBookmarkletUrl(targetUrl)) {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await executeBookmarkletOnTab(targetUrl, currentTab, matchedTemplateUrl, matchedNickname);
        return;
      }

      await navigateWithDisposition(targetUrl, disposition, undefined, matchedTemplateUrl, matchedNickname);
    }
  );

  // ページ内に注入した確認プロンプトおよびポップアップからのランタイムメッセージを受信する
  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (!message) return;

    if (message.action === 'EXECUTE_BATCH_OPEN') {
      const payload = message.payload;
      if (payload && payload.folderPath) {
        openFolderUrls(payload.folderPath, true).then(result => {
          sendResponse(result);
        });
        return true;
      }
      return;
    }

    if (message.action === 'EXECUTE_BOOKMARKLET') {
      executeBookmarklet(message.payload).then(result => {
        sendResponse(result);
      });
      return true;
    }
  });
}
