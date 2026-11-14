/**
 * 管理画面（list.html）を開くか、既存タブを再利用してメッセージを伝達します。
 * バックグラウンドタブのスリープによるメッセージ取りこぼしを防ぐため、`pendingToast` も併用します。
 * @param params - 管理画面へ渡す通知メッセージおよびフォーム初期値
 * @returns 処理完了を示す Promise
 */
export async function openOrReuseListTab(params?: {
  msg?: string;
  url?: string;
  title?: string;
}): Promise<void> {
  const listUrl = chrome.runtime.getURL('list.html');
  const tabs = await chrome.tabs.query({ url: listUrl + '*' });

  if (tabs.length > 0) {
    const tab = tabs[0];
    if (tab.id !== undefined) {
      // メッセージの取りこぼしを防ぐため、一時ストレージにも通知メッセージを保存する
      if (params?.msg) {
        await chrome.storage.local.set({ pendingToast: params.msg });
      }

      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }

      // ページの状態を更新するメッセージを送信（即時受け取れるタブ用）
      chrome.tabs.sendMessage(tab.id, { action: 'updatePage', ...params }, () => {
        // 復帰中などで届かない場合でも focus 時の pendingToast 復元で処理されるためエラーを無視する
        if (chrome.runtime.lastError) {
          // 意図的に無視
        }
      });
    }
    return;
  }

  // 既存タブがない場合は新規タブで開く
  let url = listUrl;
  if (params) {
    const query = new URLSearchParams();
    if (params.msg) query.append('msg', params.msg);
    if (params.url) query.append('url', params.url);
    if (params.title) query.append('title', params.title);
    const queryStr = query.toString();
    if (queryStr) {
      url += '?' + queryStr;
    }
  }
  chrome.tabs.create({ url });
}

/**
 * 現在のドキュメント（DOM）の上部中央にトースト通知要素を生成・アニメーション表示します。
 * `chrome.scripting.executeScript` に渡してページコンテキストでも直接実行できるよう、
 * 外部スコープに依存しない自己完結関数として実装しています。
 * @param msg - 表示するメッセージ文字列
 * @param duration - 表示継続時間（ミリ秒）
 * @param elementId - 付与する DOM 要素 ID（省略時は 'nickmark-toast'）
 * @param zIndex - CSS の z-index 値（省略時は '2147483647'）
 * @returns なし
 */
export function renderToastInDocument(
  msg: string,
  duration: number,
  elementId: string = 'nickmark-toast',
  zIndex: string = '2147483647'
): void {
  const existing = document.getElementById(elementId);
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = elementId;
  div.textContent = msg;
  Object.assign(div.style, {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex,
    maxWidth: '80vw',
    padding: '12px 24px',
    backgroundColor: '#323232',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '1.5',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: 'opacity 0.3s, transform 0.3s',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    pointerEvents: 'none',
    opacity: '0'
  });

  document.body.appendChild(div);
  // リフローを強制して初期 opacity: 0 からトランジションを開始させる
  void div.offsetHeight;
  div.style.opacity = '1';
  div.style.transform = 'translateX(-50%) translateY(8px)';

  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateX(-50%)';
    setTimeout(() => div.remove(), 300);
  }, duration);
}

/**
 * 指定されたタブに一時的なトースト通知を表示します。
 * スクリプト注入が許可されていない特殊ページ（chrome:// やウェブストア等）では、
 * 一覧画面（list.html）を開いて（または切り替えて）メッセージを表示します。
 * @param tabId - 対象となるタブの ID
 * @param message - 表示するメッセージ文字列
 * @param durationMs - トーストの表示時間（ミリ秒、デフォルト: 3000）
 * @returns 処理完了を示す Promise
 */
export async function showToast(
  tabId: number,
  message: string,
  durationMs: number = 3000
): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: renderToastInDocument,
      args: [message, durationMs, 'nickmark-toast', '2147483647']
    });
  } catch {
    // スクリプト実行権限がないページでは一覧画面で表示する
    await openOrReuseListTab({ msg: message });
  }
}
