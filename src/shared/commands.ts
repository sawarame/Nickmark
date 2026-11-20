import { getCurrentLocale, t } from '../i18n';
import {
  BookmarkEntry,
  BookmarkletExecutionResult,
  CommandExecutionResult,
  TabDisposition
} from './types';
import {
  extractBookmarkletCode,
  getHelpUrl,
  hasForbiddenNicknameChars,
  isBookmarkletUrl,
  isRestrictedTabUrl,
  isSameUrl,
  isUserScriptsAvailable,
  normalizeCommandPrefix,
  normalizeNicknamePath
} from './url';
import {
  createBookmarkEntry,
  getSaveErrorMessage,
  loadBookmarksData,
  saveBookmarksData,
  updateScore
} from './storage';

/**
 * ブックマークレット実行時のエラー種別に応じた通知メッセージを返します。
 * @param kind - エラー種別（'restricted' | 'not_allowed' | 'empty' | 'failed'）
 * @param detail - 実行エラー詳細文字列（'failed' 時のみ使用）
 * @returns ローカライズ済みメッセージ文字列と推奨表示時間（ミリ秒）
 */
export function buildBookmarkletErrorNotice(
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
 * `chrome.userScripts` API を使用して指定タブのメインワールド（MAIN）上でブックマークレットを実行します。
 * 特殊ページや権限未有効時・実行エラー時は例外を投げず、エラー種別とメッセージを返します。
 * @param params - 実行対象のタブ情報およびブックマークレット情報
 * @returns 実行成否およびエラー詳細を含む結果オブジェクト
 */
export async function executeBookmarklet(params: {
  tabId: number;
  tabUrl?: string;
  bookmarkletUrl: string;
  matchedTemplateUrl?: string;
  matchedNickname?: string;
}): Promise<BookmarkletExecutionResult> {
  const { tabId, tabUrl, bookmarkletUrl, matchedTemplateUrl, matchedNickname } = params;

  if (isRestrictedTabUrl(tabUrl)) {
    const notice = buildBookmarkletErrorNotice('restricted');
    return { success: false, errorKind: 'restricted', errorMessage: notice.message };
  }

  if (!isUserScriptsAvailable()) {
    const notice = buildBookmarkletErrorNotice('not_allowed');
    return { success: false, errorKind: 'not_allowed', errorMessage: notice.message };
  }

  const code = extractBookmarkletCode(bookmarkletUrl).trim();
  if (!code) {
    const notice = buildBookmarkletErrorNotice('empty');
    return { success: false, errorKind: 'empty', errorMessage: notice.message };
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
      return { success: false, errorKind: 'failed', errorMessage: notice.message };
    }

    await updateScore(bookmarkletUrl, matchedTemplateUrl, matchedNickname);
    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const kind = /Cannot access|extensions gallery cannot be scripted|scheme/i.test(errMsg)
      ? 'restricted'
      : /userScripts|User scripts/i.test(errMsg)
        ? 'not_allowed'
        : 'failed';
    const notice = buildBookmarkletErrorNotice(kind, errMsg);
    return { success: false, errorKind: kind, errorMessage: notice.message };
  }
}

/**
 * 修飾キーの押下状態および設定値・現在タブ状態から、ポップアップ遷移時のタブの開き方を決定します。
 * - Shift キー併用時: 設定や現在タブにかかわらず新しいバックグラウンドタブで開きます。
 * - Cmd/Ctrl/Alt キー併用時: 設定や現在タブにかかわらず新しいフォアグラウンドタブで開きます。
 * - 修飾キーなし: 「デフォルトで別タブで開く」が有効でも、「“新しいタブ”のときはそのタブで開く」が有効かつ
 *   現在のタブが新しいタブである場合は現在のタブ（currentTab）で開きます。
 * @param modifiers - キーボードまたはマウスイベントの修飾キー押下状態
 * @param openInNewTabByDefault - デフォルトで別タブで開く設定が有効かどうか
 * @param openInCurrentIfNewTab - 新しいタブのときはそのタブで開く設定が有効かどうか（省略時は false）
 * @param isCurrentTabNewTab - 現在のアクティブタブが新しいタブページかどうか（省略時は false）
 * @returns 決定されたタブの開き方（TabDisposition）
 */
export function resolvePopupTabDisposition(
  modifiers: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
  openInNewTabByDefault: boolean,
  openInCurrentIfNewTab: boolean = false,
  isCurrentTabNewTab: boolean = false
): TabDisposition {
  if (modifiers.shiftKey) return 'newBackgroundTab';
  if (modifiers.metaKey || modifiers.ctrlKey || modifiers.altKey) return 'newForegroundTab';
  if (!openInNewTabByDefault) return 'currentTab';
  if (openInCurrentIfNewTab && isCurrentTabNewTab) return 'currentTab';
  return 'newForegroundTab';
}

/**
 * ブックマークの学習スコアを更新せずに、指定された URL をタブの開き方に応じて開きます。
 * ブラウザ履歴候補などスコア更新対象外の遷移で使用します。
 * @param targetUrl - 遷移先の解決済み URL
 * @param disposition - タブの開き方（現在タブ / 新規フォアグラウンド / 新規バックグラウンド）
 * @param tabId - 現在タブ更新時に使用するタブ ID（省略時は現在のアクティブタブ）
 * @returns 処理完了を示す Promise
 */
export async function openUrlWithDisposition(
  targetUrl: string,
  disposition: TabDisposition,
  tabId?: number
): Promise<void> {
  switch (disposition) {
    case 'currentTab':
      if (tabId !== undefined) {
        await chrome.tabs.update(tabId, { url: targetUrl });
      } else {
        await chrome.tabs.update({ url: targetUrl });
      }
      break;
    case 'newForegroundTab':
      await chrome.tabs.create({ url: targetUrl, active: true });
      break;
    case 'newBackgroundTab':
      await chrome.tabs.create({ url: targetUrl, active: false });
      break;
  }
}

/**
 * 指定された URL へ遷移し、あわせて使用スコアを更新します。
 * @param targetUrl - 遷移先の解決済み URL
 * @param disposition - タブの開き方（現在タブ / 新規フォアグラウンド / 新規バックグラウンド）
 * @param tabId - 現在タブ更新時に使用するタブ ID（省略時は現在のアクティブタブ）
 * @param matchedTemplateUrl - スコア更新用のテンプレート URL（任意）
 * @param matchedNickname - スコア更新用のニックネーム（任意）
 * @returns 処理完了を示す Promise
 */
export async function navigateWithDisposition(
  targetUrl: string,
  disposition: TabDisposition,
  tabId?: number,
  matchedTemplateUrl?: string,
  matchedNickname?: string
): Promise<void> {
  await updateScore(targetUrl, matchedTemplateUrl, matchedNickname);
  await openUrlWithDisposition(targetUrl, disposition, tabId);
}

/**
 * ブックマーク辞書を保存し、成功時は `success_toast`、失敗時は `error` の実行結果を返します。
 * @param bookmarks - 保存対象のブックマーク辞書
 * @param successMessage - 保存成功時のメッセージ
 * @returns 保存結果を格納した `CommandExecutionResult`
 */
async function saveBookmarksResult(
  bookmarks: Record<string, BookmarkEntry[]>,
  successMessage: string
): Promise<CommandExecutionResult> {
  try {
    await saveBookmarksData(bookmarks);
    return { outcome: 'success_toast', message: successMessage };
  } catch (err: unknown) {
    return { outcome: 'error', message: getSaveErrorMessage(err) };
  }
}

/**
 * ニックネーム使用不可文字エラー用のローカライズ済みメッセージを返します。
 * @returns エラーメッセージ文字列
 */
function getForbiddenNicknameMessage(): string {
  return (
    t('errorNicknameForbiddenChars') ||
    'ニックネームに使用できない文字（空白、: ; \\ % ? # & = * " \' ` < > | など）が含まれています。'
  );
}

/**
 * Nickmark のコマンド（`:add`, `:addall`, `:rm`, `:ls`, `:prefs`, `:help`、および `;` 起動）を実行します。
 * UI への副作用（ポップアップ内フィードバック、確認ダイアログ等）は直接行わず、
 * 呼び出し元が解釈できる `CommandExecutionResult` を返します。
 * @param resolvedContent - 実行するコマンド文字列
 * @param currentTab - 現在アクティブなタブ情報
 * @returns コマンドの実行結果オブジェクト
 */
export async function executeNickmarkCommand(
  resolvedContent: string,
  currentTab: chrome.tabs.Tab | undefined
): Promise<CommandExecutionResult> {
  const trimmed = normalizeCommandPrefix(resolvedContent.trim());
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];

  if (cmd === ':ls') {
    if (chrome.runtime.openOptionsPage) {
      await chrome.runtime.openOptionsPage();
    } else {
      await chrome.tabs.create({ url: chrome.runtime.getURL('list.html') });
    }
    return { outcome: 'executed_close' };
  }

  if (cmd === ':prefs') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('preferences.html') });
    return { outcome: 'executed_close' };
  }

  if (cmd === ':help') {
    await chrome.tabs.create({ url: getHelpUrl(getCurrentLocale()) });
    return { outcome: 'executed_close' };
  }

  if (cmd === ':addall' || cmd === ':aa') {
    const nickname = normalizeNicknamePath(parts[1] || '');
    if (!nickname) {
      return {
        outcome: 'error',
        message: t('errorNicknameRequired') || 'ニックネームを指定してください。'
      };
    }
    if (hasForbiddenNicknameChars(nickname)) {
      return {
        outcome: 'error',
        message: getForbiddenNicknameMessage()
      };
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
      return saveBookmarksResult(
        bookmarks,
        t('bookmarkAllAddedMessage', [addedCount.toString(), nickname]) ||
          `${addedCount} 件のタブを '${nickname}' として登録しました！`
      );
    }

    return {
      outcome: 'success_toast',
      message:
        t('bookmarkAlreadyExistsMessage', [nickname]) ||
        `このURLはすでにニックネーム「${nickname}」に登録されています。`
    };
  }

  if (cmd === ':add' || cmd === ':a') {
    const nickname = normalizeNicknamePath(parts[1] || '');
    if (!nickname) {
      return {
        outcome: 'info_prompt',
        message:
          t('popupAddEnterPrompt') ||
          'ニックネームを入力して Enter で登録してください（例: :add gh）',
        suggestedInput: ':add '
      };
    }
    if (hasForbiddenNicknameChars(nickname)) {
      return {
        outcome: 'error',
        message: getForbiddenNicknameMessage()
      };
    }

    const secondArg = parts[2] || '';
    const isBookmarkletArg = isBookmarkletUrl(secondArg);
    const isDirectHttpUrl = /^https?:\/\/\S+$/i.test(secondArg);
    const isDirectUrl = isBookmarkletArg || isDirectHttpUrl;

    // ブックマークレットはコード内の空白を保持するためニックネーム以降の全文字列をコードとして取得する
    const rawAfterNicknameMatch = trimmed.match(/^:(?:add|a)\s+\S+\s+([\s\S]+)$/);
    const targetUrl = isBookmarkletArg
      ? (rawAfterNicknameMatch ? rawAfterNicknameMatch[1].trim() : secondArg)
      : isDirectHttpUrl
        ? secondArg
        : (currentTab?.url || '');
    const customTitle = isBookmarkletArg
      ? ''
      : isDirectHttpUrl
        ? parts.slice(3).join(' ').trim()
        : parts.slice(2).join(' ').trim();
    const defaultTitle = isDirectUrl ? '' : (currentTab?.title || '');

    if (!targetUrl) {
      return {
        outcome: 'error',
        message:
          t('popupNoOpenableTabUrl') ||
          '現在のタブから登録可能な URL を取得できませんでした。'
      };
    }

    const bookmarks = await loadBookmarksData();
    if (!bookmarks[nickname]) bookmarks[nickname] = [];
    const existingEntry = bookmarks[nickname].find(b => isSameUrl(b.url, targetUrl));

    if (!existingEntry) {
      bookmarks[nickname].push(createBookmarkEntry(targetUrl, customTitle || defaultTitle));
      return saveBookmarksResult(
        bookmarks,
        t('bookmarkAddedMessage', [nickname]) || `'${nickname}' として登録しました！`
      );
    }

    if (customTitle) {
      existingEntry.title = customTitle;
      return saveBookmarksResult(
        bookmarks,
        t('bookmarkTitleUpdatedMessage', [nickname]) ||
          `ニックネーム「${nickname}」のタイトルを更新しました！`
      );
    }

    return {
      outcome: 'success_toast',
      message:
        t('bookmarkAlreadyExistsMessage', [nickname]) ||
        `このURLはすでにニックネーム「${nickname}」に登録されています。`
    };
  }

  if (cmd === ':rm') {
    const rawNickname = parts[1];
    const rawAfterRmMatch = trimmed.match(/^:rm\s+\S+\s+([\s\S]+)$/);
    const urlToDelete = rawAfterRmMatch ? rawAfterRmMatch[1].trim() : '';

    if (!rawNickname) {
      return {
        outcome: 'error',
        message: t('errorNicknameRequired') || 'ニックネームを指定してください。'
      };
    }

    const bookmarks = await loadBookmarksData();
    const normNickname = normalizeNicknamePath(rawNickname);
    const nickname = bookmarks[normNickname] ? normNickname : rawNickname;

    if (!bookmarks[nickname]) {
      return {
        outcome: 'error',
        message: t('errorNicknameNotFound', [nickname]) || 'ニックネームが見つかりませんでした。'
      };
    }

    if (urlToDelete) {
      const initialLength = bookmarks[nickname].length;
      bookmarks[nickname] = bookmarks[nickname].filter(b => !isSameUrl(b.url, urlToDelete));
      if (bookmarks[nickname].length === 0) {
        delete bookmarks[nickname];
      }

      if (!bookmarks[nickname] || bookmarks[nickname].length < initialLength) {
        return saveBookmarksResult(
          bookmarks,
          t('bookmarkUrlRemovedMessage', [nickname]) || `'${nickname}' の URL を削除しました。`
        );
      }
      return {
        outcome: 'error',
        message: t('errorUrlNotFound', [nickname]) || 'URL が見つかりませんでした。'
      };
    }

    if (bookmarks[nickname].length > 1) {
      const message =
        t('errorMultipleUrlsFound') ||
        '複数の URL が登録されています。候補から選択してください。';
      return {
        outcome: 'info_prompt',
        message,
        suggestedInput: `:rm ${nickname} `
      };
    }

    delete bookmarks[nickname];
    return saveBookmarksResult(
      bookmarks,
      t('bookmarkRemovedMessage', [nickname]) || `'${nickname}' を削除しました。`
    );
  }

  return {
    outcome: 'error',
    message: t('popupNoMatches') || '一致する候補が見つかりませんでした。'
  };
}
