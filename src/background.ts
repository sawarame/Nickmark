import { getCurrentLocale, initI18n, t } from './i18n';
import {
  BookmarkEntry,
  SuggestedMatchTarget,
  SYNC_KEY_PREFIX
} from './shared/types';
import {
  escapeXml,
  extractBookmarkletCode,
  formatUrlForOmniboxDisplay,
  getHelpUrl,
  isBookmarkletUrl,
  isRestrictedTabUrl,
  isSameUrl,
  isUserScriptsAvailable,
  normalizeNicknamePath,
  resolveNavigableUrl
} from './shared/url';
import { openOrReuseListTab, showToast } from './shared/toast';
import {
  clearBookmarksCache,
  createBookmarkEntry,
  extractFolders,
  getMaxBatchOpenTabs,
  getSaveErrorMessage,
  getSyncEnabled,
  loadBookmarksData,
  openFolderUrls,
  openTargetsAndUpdateScores,
  saveBookmarksData,
  updateScore,
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

// 共有型・定数・ユーティリティ・ストレージ操作関数をバックグラウンドモジュールからも再エクスポート
export * from './shared/types';
export * from './shared/url';
export * from './shared/toast';
export * from './shared/storage';
export * from './shared/search';

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
 * ブックマークを保存し、成功時は指定メッセージ、失敗時は適切なエラートーストを表示します。
 * @param tabId - トースト表示対象のタブ ID
 * @param bookmarks - 保存するブックマーク辞書
 * @param successMessage - 保存成功時に表示するメッセージ
 * @returns 保存に成功した場合は true、失敗した場合は false
 */
async function saveBookmarksWithToast(
  tabId: number,
  bookmarks: Record<string, BookmarkEntry[]>,
  successMessage: string
): Promise<boolean> {
  try {
    await saveBookmarksData(bookmarks);
    await showToast(tabId, successMessage);
    return true;
  } catch (err: unknown) {
    await showToast(tabId, getSaveErrorMessage(err));
    return false;
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
 * ブックマークレット実行時のエラー種別に応じた通知メッセージを返します。
 * @param kind - エラー種別（'restricted' | 'not_allowed' | 'empty' | 'failed'）
 * @param detail - 実行エラー詳細文字列（'failed' 時のみ使用）
 * @returns メッセージ文字列と表示時間（ミリ秒）
 */
function buildBookmarkletErrorNotice(
  kind: 'restricted' | 'not_allowed' | 'empty' | 'failed',
  detail?: string
): { message: string; duration: number } {
  switch (kind) {
    case 'restricted':
      return {
        message:
          t('errorBookmarkletRestrictedPage') ||
          'このページ（ブラウザ内部ページやストア等）ではブックマークレットを実行できません。',
        duration: 4500
      };
    case 'not_allowed':
      return {
        message:
          t('errorUserScriptsNotAllowed') ||
          'ブックマークレットを実行するには、拡張機能の詳細設定（chrome://extensions）で「ユーザー スクリプトを許可する」を有効にしてください。',
        duration: 5000
      };
    case 'empty':
      return {
        message: t('errorBookmarkletEmpty') || 'ブックマークレットのコードが空です。',
        duration: 4000
      };
    case 'failed':
      return {
        message:
          t('errorBookmarkletExecutionFailed', [detail || '']) ||
          `ブックマークレットの実行中にエラーが発生しました: ${detail || ''}`,
        duration: 5000
      };
  }
}

/**
 * `chrome.userScripts` API を使用して、現在アクティブなタブのメインワールド（MAIN）でブックマークレットを実行します。
 * 特殊ページや権限未有効時はエラートーストを表示します。
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
  const tabId = currentTab.id;

  if (isRestrictedTabUrl(currentTab.url)) {
    const notice = buildBookmarkletErrorNotice('restricted');
    await showToast(tabId, notice.message, notice.duration);
    return;
  }

  if (!isUserScriptsAvailable()) {
    const notice = buildBookmarkletErrorNotice('not_allowed');
    await showToast(tabId, notice.message, notice.duration);
    return;
  }

  const code = extractBookmarkletCode(bookmarkletUrl).trim();
  if (!code) {
    const notice = buildBookmarkletErrorNotice('empty');
    await showToast(tabId, notice.message, notice.duration);
    return;
  }

  try {
    const results = await chrome.userScripts.execute({
      target: { tabId },
      js: [{ code }],
      world: 'MAIN',
      injectImmediately: true
    });

    const failedResult = results?.find(res => 'error' in res && !!res.error);
    if (failedResult && 'error' in failedResult && failedResult.error) {
      const notice = buildBookmarkletErrorNotice('failed', failedResult.error);
      await showToast(tabId, notice.message, notice.duration);
      return;
    }

    await updateScore(bookmarkletUrl, matchedTemplateUrl, matchedNickname);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const kind = /Cannot access|extensions gallery cannot be scripted|scheme/i.test(errMsg)
      ? 'restricted'
      : /userScripts|User scripts/i.test(errMsg)
        ? 'not_allowed'
        : 'failed';
    const notice = buildBookmarkletErrorNotice(kind, errMsg);
    await showToast(tabId, notice.message, notice.duration);
  }
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

  lastSuggestedMatchMap = matchMap;
  suggest(suggestions);
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
    chrome.tabs.create({ url: chrome.runtime.getURL('preferences.html') });
    return;
  }

  if (cmd === ':help') {
    chrome.tabs.create({ url: getHelpUrl(getCurrentLocale()) });
    return;
  }

  if (!currentTab || !currentTab.id) return;
  const tabId = currentTab.id;

  if (cmd === ':addall' || cmd === ':aa') {
    const nickname = normalizeNicknamePath(parts[1]);
    if (!nickname) {
      await showToast(tabId, t('errorNicknameRequired') || 'ニックネームを指定してください。');
      return;
    }

    const tabs = await chrome.tabs.query({ currentWindow: true });
    const bookmarks = await loadBookmarksData();
    if (!bookmarks[nickname]) bookmarks[nickname] = [];

    let addedCount = 0;
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
        if (!bookmarks[nickname].some(b => isSameUrl(b.url, tab.url!))) {
          bookmarks[nickname].push(createBookmarkEntry(tab.url, tab.title || ''));
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      await saveBookmarksWithToast(
        tabId,
        bookmarks,
        t('bookmarkAllAddedMessage', [addedCount.toString(), nickname]) ||
          `${addedCount} 件のタブを '${nickname}' として登録しました！`
      );
    } else {
      await showToast(
        tabId,
        t('bookmarkAlreadyExistsMessage', [nickname]) ||
          `このURLはすでにニックネーム「${nickname}」に登録されています。`
      );
    }
    return;
  }

  if (cmd === ':add' || cmd === ':a') {
    const nickname = normalizeNicknamePath(parts[1]);
    if (!nickname) {
      await openOrReuseListTab({
        url: currentTab.url || '',
        title: currentTab.title || ''
      });
      return;
    }

    const secondArg = parts[2] || '';
    const isBookmarkletArg = isBookmarkletUrl(secondArg);
    const isDirectHttpUrl = /^https?:\/\/\S+$/i.test(secondArg);
    const isDirectUrl = isBookmarkletArg || isDirectHttpUrl;

    // ブックマークレットはコード内の空白を保持するためニックネーム以降の全文字列をコードとして取得する
    const rawAfterNicknameMatch = resolvedContent.match(/^:(?:add|a)\s+\S+\s+([\s\S]+)$/);
    const targetUrl = isBookmarkletArg
      ? (rawAfterNicknameMatch ? rawAfterNicknameMatch[1].trim() : secondArg)
      : isDirectHttpUrl
        ? secondArg
        : (currentTab.url || '');
    const customTitle = isBookmarkletArg
      ? ''
      : isDirectHttpUrl
        ? parts.slice(3).join(' ').trim()
        : parts.slice(2).join(' ').trim();
    const defaultTitle = isDirectUrl ? '' : (currentTab.title || '');

    if (!targetUrl) return;

    const bookmarks = await loadBookmarksData();
    if (!bookmarks[nickname]) bookmarks[nickname] = [];
    const existingEntry = bookmarks[nickname].find(b => isSameUrl(b.url, targetUrl));

    if (!existingEntry) {
      bookmarks[nickname].push(createBookmarkEntry(targetUrl, customTitle || defaultTitle));
      await saveBookmarksWithToast(
        tabId,
        bookmarks,
        t('bookmarkAddedMessage', [nickname]) || `'${nickname}' として登録しました！`
      );
    } else if (customTitle) {
      existingEntry.title = customTitle;
      await saveBookmarksWithToast(
        tabId,
        bookmarks,
        t('bookmarkTitleUpdatedMessage', [nickname]) || `ニックネーム「${nickname}」のタイトルを更新しました！`
      );
    } else {
      await showToast(
        tabId,
        t('bookmarkAlreadyExistsMessage', [nickname]) ||
          `このURLはすでにニックネーム「${nickname}」に登録されています。`
      );
    }
    return;
  }

  if (cmd === ':open' || cmd === ':o') {
    const rawTarget = parts[1];
    if (!rawTarget) {
      await showToast(tabId, t('errorNicknameRequired') || 'ニックネームを指定してください。');
      return;
    }

    const bookmarks = await loadBookmarksData();
    const isExplicitFolder = rawTarget.endsWith('/');
    const cleanTarget = normalizeNicknamePath(rawTarget);

    if (!cleanTarget) {
      await showToast(
        tabId,
        t('errorNicknameNotFound', [rawTarget]) ||
          `ニックネームまたはフォルダ「${rawTarget}」が見つかりませんでした。`
      );
      return;
    }

    // 1. 明示的なフォルダ指定でなく単一ニックネームが存在する場合は単一ニックネームを開く
    if (!isExplicitFolder && (bookmarks[cleanTarget] || bookmarks[rawTarget])) {
      const targetKey = bookmarks[cleanTarget] ? cleanTarget : rawTarget;
      const entries = bookmarks[targetKey];
      const openableTargets = entries
        .filter(entry => !isBookmarkletUrl(entry.url))
        .map(entry => ({
          urlToOpen: resolveNavigableUrl(entry),
          templateUrl: entry.url,
          nickname: targetKey
        }));
      const skippedBookmarkletCount = entries.length - openableTargets.length;
      const openedCount = await openTargetsAndUpdateScores(openableTargets);

      if (openedCount === 0 && skippedBookmarkletCount > 0) {
        await showToast(
          tabId,
          t('errorOpenSkippedAllBookmarklets', [targetKey]) ||
            `ニックネーム「${targetKey}」はブックマークレットのみのため、:open での別タブ起動をスキップしました。`,
          4000
        );
      }
      return;
    }

    // 2. フォルダとして一括オープン
    const folders = extractFolders(bookmarks);
    if (folders.has(cleanTarget) || isExplicitFolder) {
      const result = await openFolderUrls(cleanTarget, false, tabId);
      if (result.requiresConfirmation && result.folderPath && result.urls) {
        await handleBatchOpenConfirmationRequest(
          tabId,
          result.folderPath,
          result.urls,
          result.nicknames || []
        );
      }
      return;
    }

    // 3. いずれも見つからない場合
    await showToast(
      tabId,
      t('errorNicknameNotFound', [rawTarget]) ||
        `ニックネームまたはフォルダ「${rawTarget}」が見つかりませんでした。`
    );
    return;
  }

  if (cmd === ':rm') {
    const rawNickname = parts[1];
    const rawAfterRmMatch = resolvedContent.match(/^:rm\s+\S+\s+([\s\S]+)$/);
    const urlToDelete = rawAfterRmMatch ? rawAfterRmMatch[1].trim() : '';

    if (!rawNickname) {
      await showToast(tabId, t('errorNicknameRequired') || 'ニックネームを指定してください。');
      return;
    }

    const bookmarks = await loadBookmarksData();
    const normNickname = normalizeNicknamePath(rawNickname);
    const nickname = bookmarks[normNickname] ? normNickname : rawNickname;

    if (!bookmarks[nickname]) {
      await showToast(
        tabId,
        t('errorNicknameNotFound', [nickname]) || 'ニックネームが見つかりませんでした。'
      );
      return;
    }

    if (urlToDelete) {
      const initialLength = bookmarks[nickname].length;
      bookmarks[nickname] = bookmarks[nickname].filter(b => !isSameUrl(b.url, urlToDelete));
      if (bookmarks[nickname].length === 0) {
        delete bookmarks[nickname];
      }

      if (!bookmarks[nickname] || bookmarks[nickname].length < initialLength) {
        await saveBookmarksWithToast(
          tabId,
          bookmarks,
          t('bookmarkUrlRemovedMessage', [nickname]) || `'${nickname}' の URL を削除しました。`
        );
      } else {
        await showToast(tabId, t('errorUrlNotFound', [nickname]) || 'URL が見つかりませんでした。');
      }
    } else if (bookmarks[nickname].length > 1) {
      const message =
        t('errorMultipleUrlsFound') ||
        '複数の URL が登録されています。候補から選択するか、管理画面から削除してください。';
      await openOrReuseListTab({ msg: message });
    } else {
      delete bookmarks[nickname];
      await saveBookmarksWithToast(
        tabId,
        bookmarks,
        t('bookmarkRemovedMessage', [nickname]) || `'${nickname}' を削除しました。`
      );
    }
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
    chrome.omnibox.setDefaultSuggestion({ description: 'Search Nickmark' });
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
      chrome.omnibox.setDefaultSuggestion({ description: 'Search Nickmark' });
      suggest([]);
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

      await updateScore(targetUrl, matchedTemplateUrl, matchedNickname);
      switch (disposition) {
        case 'currentTab':
          chrome.tabs.update({ url: targetUrl });
          break;
        case 'newForegroundTab':
          chrome.tabs.create({ url: targetUrl, active: true });
          break;
        case 'newBackgroundTab':
          chrome.tabs.create({ url: targetUrl, active: false });
          break;
      }
    }
  );

  // ページ内に注入した確認プロンプトからの一括オープン実行メッセージを受信する
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== 'EXECUTE_BATCH_OPEN') return;
    const payload = message.payload;
    if (payload && payload.folderPath) {
      openFolderUrls(payload.folderPath, true).then(result => {
        sendResponse(result);
      });
      return true;
    }
  });
}
