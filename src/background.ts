/**
 * ブックマークエントリの型定義
 */
export interface BookmarkEntry {
  url: string;
  title: string;
  score: number;
  last_used_at: number;
  created_at: number;
}

/**
 * 拡張機能全体のデータ構造
 */
export interface NickmarkData {
  bookmarks: Record<string, BookmarkEntry[]>;
}

// 入力中に何度もストレージを読み込むのを防ぐためのローカルキャッシュ
let bookmarksCache: Record<string, BookmarkEntry[]> | null = null;

/**
 * ストレージからブックマークデータを読み込みます。
 * キャッシュが存在する場合はキャッシュを返します。
 * @returns {Promise<Record<string, BookmarkEntry[]>>} 正規化されたブックマークデータのプロミス
 */
export async function loadBookmarksData(): Promise<Record<string, BookmarkEntry[]>> {
  if (bookmarksCache) return bookmarksCache;

  const data = await chrome.storage.local.get('bookmarks');
  const rawBookmarks = data.bookmarks || {};
  const normalizedBookmarks: Record<string, BookmarkEntry[]> = {};
  
  for (const [nickname, entries] of Object.entries(rawBookmarks)) {
    if (Array.isArray(entries)) {
      normalizedBookmarks[nickname] = entries;
    } else if (entries && typeof entries === 'object') {
      normalizedBookmarks[nickname] = Object.values(entries) as BookmarkEntry[];
    } else {
      normalizedBookmarks[nickname] = [];
    }
  }
  
  bookmarksCache = normalizedBookmarks;
  return normalizedBookmarks;
}

// ストレージの変更を監視し、キャッシュを常に最新の状態に保ちます
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.bookmarks) {
    const newVal = changes.bookmarks.newValue;
    if (newVal) {
      const normalized: Record<string, BookmarkEntry[]> = {};
      for (const [nickname, entries] of Object.entries(newVal)) {
        if (Array.isArray(entries)) {
          normalized[nickname] = entries;
        } else if (entries && typeof entries === 'object') {
          normalized[nickname] = Object.values(entries) as BookmarkEntry[];
        } else {
          normalized[nickname] = [];
        }
      }
      bookmarksCache = normalized;
    } else {
      bookmarksCache = {};
    }
  }
});

// 1日あたりのスコア減衰率
const DECAY_RATE = 0.95;

/**
 * 経過日数に基づいて新しいスコアを計算します。
 * @param {number} oldScore 古いスコア
 * @param {number} lastUsedAt 最後に使用された日時のタイムスタンプ
 * @returns {number} 計算された新しいスコア
 */
function calculateNewScore(oldScore: number, lastUsedAt: number): number {
  const now = Date.now();
  const elapsedMs = Math.max(0, now - lastUsedAt);
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return (oldScore * Math.pow(DECAY_RATE, elapsedDays)) + 1.0;
}

/**
 * オムニボックスの XML 記述用にテキストを安全にエスケープします。
 * @param {any} unsafe エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
function escapeXml(unsafe: any): string {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '＆'; // Chrome の XML パーサーのバグを回避するため、全角のアンパサンドを使用します
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * 2つの URL が同一のものか比較します。
 * @param {string} u1 URL 1
 * @param {string} u2 URL 2
 * @returns {boolean} 同一の URL であれば true
 */
function isSameUrl(u1: string, u2: string): boolean {
  if (u1 === u2) return true;
  try {
    if (decodeURI(u1) === decodeURI(u2)) return true;
  } catch (e) {}
  try {
    if (decodeURIComponent(u1) === decodeURIComponent(u2)) return true;
  } catch (e) {}
  return false;
}

/**
 * コマンド入力文字列を解析し、マッチするコマンドのリストを返します。
 * @param {string} text 入力されたコマンド文字列（例: ":add mynick"）
 * @param {Record<string, BookmarkEntry[]>} bookmarks 現在のブックマークデータ
 * @returns {{ content: string, description: string }[]} マッチしたコマンド候補の配列
 */
function resolveCommandMatches(text: string, bookmarks: Record<string, BookmarkEntry[]>): { content: string, description: string }[] {
  const firstSpaceIndex = text.indexOf(' ');
  const cmd = firstSpaceIndex === -1 ? text : text.substring(0, firstSpaceIndex);
  const restTrimmed = (firstSpaceIndex === -1 ? '' : text.substring(firstSpaceIndex + 1)).trim();
  const rawRest = firstSpaceIndex === -1 ? '' : text.substring(firstSpaceIndex + 1);

  const commandMatches: { content: string, description: string }[] = [];

  /**
   * ニックネームのサマリー（タイトルや URL 件数など）を HTML (XML) 形式で取得します。
   */
  const getNicknameSummary = (n: string): string => {
    const entries = bookmarks[n] || [];
    const escapedN = escapeXml(n);
    if (entries.length === 1) {
      const title = escapeXml(entries[0].title) || 'No title';
      const url = escapeXml(entries[0].url);
      return `<match>${escapedN}</match> ${title} - <url>${url}</url>`;
    } else if (entries.length > 1) {
      return `<match>${escapedN}</match> - Multiple URLs (${entries.length})`;
    }
    return `<match>${escapedN}</match>`;
  };

  // :add コマンド
  if (':add'.startsWith(cmd) || cmd === ':add') {
    commandMatches.push({
      content: ':add ' + restTrimmed,
      description: `<match>:add</match> ${escapeXml(rawRest) || '[nickname] [title(optional)]'} - Add current tab`
    });
  }

  // :list コマンド
  if (':list'.startsWith(cmd) || cmd === ':list') {
    commandMatches.push({
      content: ':list',
      description: `<match>:list</match> - Open Options / Manage Nickmarks`
    });
  }

  // :rm コマンド
  if (':rm'.startsWith(cmd) || cmd === ':rm') {
    const nicknames = Object.keys(bookmarks);
    
    if (!restTrimmed) {
      commandMatches.push({
        content: ':rm ',
        description: `<match>:rm</match> [nickname] - Remove Nickmark`
      });
      if (cmd === ':rm') {
        for (const n of nicknames.slice(0, 8)) {
          commandMatches.push({
            content: `:rm ${n}`,
            description: `<match>:rm</match> ${getNicknameSummary(n)}`
          });
        }
      }
    } else {
      const nicknameParts = restTrimmed.split(/\s+/);
      const nicknameInput = nicknameParts[0];
      const urlInput = nicknameParts.slice(1).join(' ').trim();

      const matches = nicknames.filter(n => n.startsWith(nicknameInput));
      
      if (matches.length === 0) {
        commandMatches.push({
          content: text,
          description: `<match>:rm</match> No nicknames match "${escapeXml(restTrimmed)}"`
        });
      } else {
        for (const n of matches) {
          const entries = bookmarks[n];
          if (n === nicknameInput && entries.length > 1) {
            // 複数の URL がある場合は、誤削除防止のために警告/案内を先頭に表示する
            if (!urlInput) {
              const msg = chrome.i18n.getMessage("errorMultipleUrlsFound") || "Multiple URLs found. Select one below or Enter to manage.";
              commandMatches.push({
                content: `:rm ${n}`,
                description: `⚠️ <match>${escapeXml(n)}</match> - ${msg}`
              });
            }

            for (const entry of entries) {
              if (!urlInput || entry.url.includes(urlInput)) {
                const title = escapeXml(entry.title) || 'No title';
                const url = escapeXml(entry.url);
                commandMatches.push({
                  content: `:rm ${n} ${entry.url}`,
                  description: `<match>:rm ${escapeXml(n)}</match> ${title} - <url>${url}</url>`
                });
              }
            }
          } else {
            commandMatches.push({
              content: `:rm ${n}`,
              description: `<match>:rm</match> ${getNicknameSummary(n)}`
            });
          }
        }
      }
    }
  }

  return commandMatches;
}

/**
 * コマンドモード入力時のサジェストを処理します。
 * @param {string} text 入力されたテキスト
 * @param {function} suggest サジェスト結果を返すためのコールバック関数
 * @param {Record<string, BookmarkEntry[]>} bookmarks 現在のブックマークデータ
 */
function handleCommandModeSuggestions(
  text: string, 
  suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void, 
  bookmarks: Record<string, BookmarkEntry[]>
) {
  const commandMatches = resolveCommandMatches(text, bookmarks);
  const suggestions: chrome.omnibox.SuggestResult[] = [];

  if (commandMatches.length === 1) {
    chrome.omnibox.setDefaultSuggestion({ description: `Run command: ${commandMatches[0].description}` });
  } else if (commandMatches.length > 1) {
    chrome.omnibox.setDefaultSuggestion({ description: `Search commands for: <match>${escapeXml(text)}</match>` });
  } else {
    chrome.omnibox.setDefaultSuggestion({ description: `Invalid command: <match>${escapeXml(text)}</match>` });
  }

  for (const match of commandMatches) {
    let finalContent = match.content;
    // Chrome が候補を非表示にするのを防ぐため、入力テキストで始まるように調整します
    if (!finalContent.startsWith(text) && text.startsWith(match.content)) {
      finalContent = text;
    }
    suggestions.push({ content: finalContent, description: match.description });
  }

  suggest(suggestions);
}

/**
 * 通常検索モード入力時のサジェストを処理します。
 * @param {string} text 入力されたテキスト
 * @param {function} suggest サジェスト結果を返すためのコールバック関数
 * @param {Record<string, BookmarkEntry[]>} bookmarks 現在のブックマークデータ
 */
function handleRegularSearchSuggestions(
  text: string, 
  suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void, 
  bookmarks: Record<string, BookmarkEntry[]>
) {
  const trimmed = text.trim();
  const allMatches: { nickname: string; entry: BookmarkEntry }[] = [];

  for (const [nickname, entries] of Object.entries(bookmarks)) {
    if (nickname.includes(trimmed) || trimmed.includes(nickname)) {
      for (const entry of entries) {
        allMatches.push({ nickname, entry });
      }
    }
  }

  // スコアの降順、次に URL の昇順でソートします
  allMatches.sort((a, b) => {
    if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
    return a.entry.url.localeCompare(b.entry.url);
  });

  if (allMatches.length === 1) {
    const top = allMatches[0];
    const topTitle = escapeXml(top.entry.title) || 'No title';
    const topUrl = escapeXml(top.entry.url);
    chrome.omnibox.setDefaultSuggestion({
      description: `Go to <match>${escapeXml(top.nickname)}</match>: ${topTitle} - <url>${topUrl}</url>`
    });
  } else if (allMatches.length > 0) {
    chrome.omnibox.setDefaultSuggestion({
      description: `Search for: <match>${escapeXml(trimmed)}</match>`
    });
  } else {
    chrome.omnibox.setDefaultSuggestion({
      description: `No matches found for: <match>${escapeXml(trimmed)}</match>`
    });
  }

  const suggestions: chrome.omnibox.SuggestResult[] = [];
  for (const match of allMatches.slice(0, 10)) {
    const mTitle = escapeXml(match.entry.title) || 'No title';
    const mUrl = escapeXml(match.entry.url);
    suggestions.push({
      content: match.entry.url,
      description: `<match>${escapeXml(match.nickname)}</match>: ${mTitle} - <url>${mUrl}</url>`
    });
  }

  suggest(suggestions);
}

/**
 * 現在のタブに一時的なトースト通知を表示します。
 * @param {number} tabId 対象となるタブの ID
 * @param {string} message 表示するメッセージ
 */
async function showToast(tabId: number, message: string) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg) => {
        const id = 'nickmark-toast';
        const existing = document.getElementById(id);
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = id;
        div.textContent = msg;
        Object.assign(div.style, {
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: '2147483647',
          padding: '12px 24px',
          backgroundColor: '#323232',
          color: '#ffffff',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: 'opacity 0.3s, transform 0.3s',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          pointerEvents: 'none',
          opacity: '0'
        });

        document.body.appendChild(div);
        div.offsetHeight;
        div.style.opacity = '1';
        div.style.transform = 'translateX(-50%) translateY(8px)';

        setTimeout(() => {
          div.style.opacity = '0';
          div.style.transform = 'translateX(-50%)';
          setTimeout(() => div.remove(), 300);
        }, 3000);
      },
      args: [message]
    });
  } catch (e) {
    // スクリプト実行権限がないページの場合はブックマーク一覧画面を開いてエラーメッセージを表示
    const optionsUrl = chrome.runtime.getURL(`list.html?msg=${encodeURIComponent(message)}`);
    chrome.tabs.update(tabId, { url: optionsUrl });
  }
}

/**
 * 対象の URL が使用された際に、スコアと最終使用日時を更新します。
 * @param {string} url 使用された URL
 */
async function updateScore(url: string) {
  const bookmarks = await loadBookmarksData();
  let updated = false;
  for (const entries of Object.values(bookmarks)) {
    for (const entry of entries) {
      if (entry.url === url) {
        entry.score = calculateNewScore(entry.score, entry.last_used_at);
        entry.last_used_at = Date.now();
        updated = true;
      }
    }
  }
  if (updated) await chrome.storage.local.set({ bookmarks });
}

/**
 * 確定したコマンド（:add, :list, :rm）を実行します。
 * @param {string} resolvedContent 補完済みのコマンド文字列
 * @param {chrome.tabs.Tab} currentTab 現在アクティブなタブ
 */
async function executeCommand(resolvedContent: string, currentTab: chrome.tabs.Tab) {
  const parts = resolvedContent.split(/\s+/);
  const cmd = parts[0];
  const rest = resolvedContent.substring(cmd.length).trim();

  if (cmd === ':list') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (!currentTab || !currentTab.id) return;

  if (cmd === ':add') {
    const nickname = parts[1];
    if (!nickname) {
      const url = currentTab.url || '';
      const title = currentTab.title || '';
      const listUrl = chrome.runtime.getURL(`list.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
      chrome.tabs.create({ url: listUrl });
      return;
    }
    
    const customTitle = parts.slice(2).join(' ').trim();
    if (currentTab.url) {
      const bookmarks = await loadBookmarksData();
      if (!bookmarks[nickname]) bookmarks[nickname] = [];
      
      // まだ登録されていない場合のみ追加
      if (!bookmarks[nickname].some(b => b.url === currentTab.url)) {
        bookmarks[nickname].push({
          url: currentTab.url,
          title: customTitle || currentTab.title || '',
          score: 1.0,
          last_used_at: Date.now(),
          created_at: Date.now()
        });
        await chrome.storage.local.set({ bookmarks });
        await showToast(currentTab.id, chrome.i18n.getMessage("bookmarkAddedMessage", [nickname]) || `'${nickname}' として登録しました！`);
      }
    }
    return;
  } 

  if (cmd === ':rm') {
    const nickname = parts[1];
    const urlToDelete = parts.slice(2).join(' ').trim();

    if (!nickname) {
      await showToast(currentTab.id, chrome.i18n.getMessage("errorNicknameRequired") || 'ニックネームを指定してください。');
      return;
    }

    const bookmarks = await loadBookmarksData();
    if (bookmarks[nickname]) {
      if (urlToDelete) {
        const initialLength = bookmarks[nickname].length;
        bookmarks[nickname] = bookmarks[nickname].filter(b => !isSameUrl(b.url, urlToDelete));
        if (bookmarks[nickname].length === 0) delete bookmarks[nickname];
        
        if (bookmarks[nickname]?.length < initialLength || !bookmarks[nickname]) {
          await chrome.storage.local.set({ bookmarks });
          await showToast(currentTab.id, chrome.i18n.getMessage("bookmarkUrlRemovedMessage", [nickname]) || `'${nickname}' の URL を削除しました。`);
        } else {
          await showToast(currentTab.id, chrome.i18n.getMessage("errorUrlNotFound", [nickname]) || `URL が見つかりませんでした。`);
        }
      } else {
        if (bookmarks[nickname].length > 1) {
          const message = chrome.i18n.getMessage("errorMultipleUrlsFound") || "複数の URL が登録されています。候補から選択するか、管理画面から削除してください。";
          const optionsUrl = chrome.runtime.getURL(`list.html?msg=${encodeURIComponent(message)}`);
          chrome.tabs.create({ url: optionsUrl });
        } else {
          delete bookmarks[nickname];
          await chrome.storage.local.set({ bookmarks });
          await showToast(currentTab.id, chrome.i18n.getMessage("bookmarkRemovedMessage", [nickname]) || `'${nickname}' を削除しました。`);
        }
      }
    } else {
      await showToast(currentTab.id, chrome.i18n.getMessage("errorNicknameNotFound", [nickname]) || `ニックネームが見つかりませんでした。`);
    }
    return;
  }
}


// バックグラウンドの Service Worker 環境でのみオムニボックスのリスナーを登録します。
// （ブックマーク一覧画面で読み込まれた際にエラーが発生するのを防ぎます）
if (typeof window === 'undefined') {

  // オムニボックスで入力が変更されるたびに発火します
  chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    if (!text) {
      chrome.omnibox.setDefaultSuggestion({ 
        description: 'Search Nickmark' 
      });
      return;
    }

    const bookmarks = await loadBookmarksData();

    if (text.startsWith(':')) {
      handleCommandModeSuggestions(text, suggest, bookmarks);
    } else {
      handleRegularSearchSuggestions(text, suggest, bookmarks);
    }
  });

  // オムニボックスでエンターキーが押された時に発火します
  chrome.omnibox.onInputEntered.addListener(async (text: string, disposition: "currentTab" | "newForegroundTab" | "newBackgroundTab") => {
    const trimmed = text.trim();

    // コマンドモードの処理
    if (trimmed.startsWith(':')) {
      const bookmarks = await loadBookmarksData();
      const commandMatches = resolveCommandMatches(trimmed, bookmarks);
      
      let resolvedContent = trimmed;
      // 提案がある場合は解決を試みる。
      // ただし、:rm コマンドで複数の候補がある場合は、誤削除防止のため自動解決せずに入力値をそのまま使用する。
      if (commandMatches.length > 0) {
        const isRm = trimmed.startsWith(':rm');
        if (commandMatches.length === 1 || !isRm) {
          resolvedContent = commandMatches[0].content;
        }
      }

      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await executeCommand(resolvedContent, currentTab);
      return;
    }

    // 通常検索モードの処理
    let targetUrl = trimmed;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const bookmarks = await loadBookmarksData();
      const allMatches: { nickname: string; entry: BookmarkEntry }[] = [];
      for (const [nickname, entries] of Object.entries(bookmarks)) {
        if (nickname.includes(trimmed) || trimmed.includes(nickname)) {
          for (const entry of entries) allMatches.push({ nickname, entry });
        }
      }
      // スコアでソートし、一番高いものを選択
      allMatches.sort((a, b) => (b.entry.score - a.entry.score) || a.entry.url.localeCompare(b.entry.url));
      
      if (allMatches.length > 0) {
        targetUrl = allMatches[0].entry.url;
      } else {
        return; // 一致するものがなければ何もしない
      }
    }

    // スコアを更新して遷移
    await updateScore(targetUrl);
    switch (disposition) {
      case 'currentTab': chrome.tabs.update({ url: targetUrl }); break;
      case 'newForegroundTab': chrome.tabs.create({ url: targetUrl, active: true }); break;
      case 'newBackgroundTab': chrome.tabs.create({ url: targetUrl, active: false }); break;
    }
  });

  // 拡張機能アイコンがクリックされた時にブックマーク一覧画面を開きます
  chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
  });
}
