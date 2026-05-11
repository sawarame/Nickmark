export interface BookmarkEntry {
  url: string;
  title: string;
  score: number;
  last_used_at: number;
  created_at: number;
}

export interface NickmarkData {
  bookmarks: Record<string, BookmarkEntry[]>;
}

// Local cache for bookmarks to avoid repeated storage reads during typing
let bookmarksCache: Record<string, BookmarkEntry[]> | null = null;

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

// Keep cache in sync with storage changes
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

// Decay rate per day
const DECAY_RATE = 0.95;

function calculateNewScore(oldScore: number, lastUsedAt: number): number {
  const now = Date.now();
  const elapsedMs = Math.max(0, now - lastUsedAt);
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return (oldScore * Math.pow(DECAY_RATE, elapsedDays)) + 1.0;
}

// Helper to safely encode text for omnibox XML descriptions
function escapeXml(unsafe: any): string {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '＆'; // Use fullwidth ampersand to bypass Chrome's XML parser bugs with URLs
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

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

// Only register omnibox listeners if running in the background service worker.
// This prevents the options page from executing them and throwing 'Invalid XML' or other errors.
if (typeof window === 'undefined') {
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const safeText = escapeXml(text);

  if (!text) {
    chrome.omnibox.setDefaultSuggestion({ 
      description: 'Search Nickmark' 
    });
    return;
  }

  const bookmarks = await loadBookmarksData();
  const suggestions: chrome.omnibox.SuggestResult[] = [];

  // Command mode handling
  if (text.startsWith(':')) {
    const firstSpaceIndex = text.indexOf(' ');
    const cmd = firstSpaceIndex === -1 ? text : text.substring(0, firstSpaceIndex);
    const rest = firstSpaceIndex === -1 ? '' : text.substring(firstSpaceIndex + 1);
    const restTrimmed = rest.trim();

    let hasSetDefault = false;

    const addCommandSuggestion = (content: string, description: string) => {
      if (!hasSetDefault) {
        chrome.omnibox.setDefaultSuggestion({ description });
        hasSetDefault = true;
      } else {
        // Ensure content starts with typed text so Chrome doesn't hide it
        let finalContent = content;
        if (!finalContent.startsWith(text) && text.startsWith(content)) {
          finalContent = text;
        }
        suggestions.push({ content: finalContent, description });
      }
    };

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


    // :add
    if (':add'.startsWith(cmd) || cmd === ':add') {
      addCommandSuggestion(
        ':add ',
        `<match>:add</match> ${escapeXml(rest) || '[nickname] [title(optional)]'} - Add current tab`
      );
    }

    // :option
    if (':option'.startsWith(cmd) || cmd === ':option') {
      addCommandSuggestion(
        ':option',
        `<match>:option</match> - Open Options / Manage Nickmarks`
      );
    }

    // :rm
    if (':rm'.startsWith(cmd) || cmd === ':rm') {
      const nicknames = Object.keys(bookmarks);
      
      if (!restTrimmed) {
        addCommandSuggestion(
          ':rm ',
          `<match>:rm</match> [nickname] - Remove Nickmark`
        );
        if (cmd === ':rm') {
          for (const n of nicknames.slice(0, 8)) {
            addCommandSuggestion(`:rm ${n}`, `<match>:rm</match> ${getNicknameSummary(n)}`);
          }
        }
      } else {
        const nicknameParts = restTrimmed.split(/\s+/);
        const nicknameInput = nicknameParts[0];
        const urlInput = nicknameParts.slice(1).join(' ').trim();

        const matches = nicknames.filter(n => n.startsWith(nicknameInput));
        
        if (matches.length === 0) {
          addCommandSuggestion(text, `<match>:rm</match> No nicknames match "${escapeXml(restTrimmed)}"`);
        } else {
          for (const n of matches) {
            const entries = bookmarks[n];
            // Exact nickname match AND multiple URLs exist -> show URL options
            if (n === nicknameInput && entries.length > 1) {
              if (!hasSetDefault) {
                chrome.omnibox.setDefaultSuggestion({
                  description: `<match>:rm</match> ${escapeXml(n)} - Select a specific URL below to delete`
                });
                hasSetDefault = true;
              }
              for (const entry of entries) {
                if (!urlInput || entry.url.includes(urlInput)) {
                  const title = escapeXml(entry.title) || 'No title';
                  const url = escapeXml(entry.url);
                  suggestions.push({
                    content: `:rm ${n} ${entry.url}`,
                    description: `<match>:rm ${escapeXml(n)}</match> ${title} - <url>${url}</url>`
                  });
                }
              }
            } else {
              // Partial match or single entry
              const targetContent = `:rm ${n}`;
              addCommandSuggestion(
                targetContent,
                `<match>:rm</match> ${getNicknameSummary(n)}`
              );
            }
          }
        }
      }
    }

    // If typing an invalid command like ":xyz"
    if (!hasSetDefault) {
      chrome.omnibox.setDefaultSuggestion({ description: `Invalid command: ${escapeXml(text)}` });
    }

    suggest(suggestions);
    return;
  }

  // Regular Search Mode
  const trimmed = text.trim();
  const allMatches: { nickname: string; entry: BookmarkEntry }[] = [];
  const nicknameCompletions = new Set<string>();

  for (const [nickname, entries] of Object.entries(bookmarks)) {
    if (nickname.includes(trimmed) || trimmed.includes(nickname)) {
      for (const entry of entries) {
        allMatches.push({ nickname, entry });
      }
      if (nickname.startsWith(trimmed) && nickname !== trimmed) {
        nicknameCompletions.add(nickname);
      }
    }
  }

  // Sort by score desc, then url asc
  allMatches.sort((a, b) => {
    if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
    return a.entry.url.localeCompare(b.entry.url);
  });

  let hasSetDefault = false;

  if (allMatches.length > 0) {
    const top = allMatches[0];
    const topTitle = escapeXml(top.entry.title) || 'No title';
    const topUrl = escapeXml(top.entry.url);
    chrome.omnibox.setDefaultSuggestion({
      description: `<match>${escapeXml(top.nickname)}</match>: ${topTitle} - <url>${topUrl}</url>`
    });
    hasSetDefault = true;

    for (const match of allMatches.slice(1, 10)) {
      const mTitle = escapeXml(match.entry.title) || 'No title';
      const mUrl = escapeXml(match.entry.url);
      suggestions.push({
        content: match.entry.url,
        description: `<match>${escapeXml(match.nickname)}</match>: ${mTitle} - <url>${mUrl}</url>`
      });
    }
  }


  for (const n of nicknameCompletions) {
    if (!hasSetDefault) {
      chrome.omnibox.setDefaultSuggestion({ description: `Complete nickname: <match>${escapeXml(n)}</match>` });
      hasSetDefault = true;
    } else {
      suggestions.push({
        content: n,
        description: `Complete nickname: <match>${escapeXml(n)}</match>`
      });
    }
  }

  if (!hasSetDefault) {
    chrome.omnibox.setDefaultSuggestion({
      description: `No matches found for: <match>${escapeXml(trimmed)}</match>`
    });
  }

  suggest(suggestions);
});

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
    const optionsUrl = chrome.runtime.getURL(`options.html?msg=${encodeURIComponent(message)}`);
    chrome.tabs.update(tabId, { url: optionsUrl });
  }
}

chrome.omnibox.onInputEntered.addListener(async (text: string, disposition: "currentTab" | "newForegroundTab" | "newBackgroundTab") => {
  const trimmed = text.trim();

  if (trimmed.startsWith(':')) {
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const rest = trimmed.substring(cmd.length).trim();

    if (cmd === ':option') {
      chrome.runtime.openOptionsPage();
      return;
    } else if (cmd === ':add') {
      const nickname = parts[1];
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab || !currentTab.id) return;

      if (!nickname) {
        await showToast(currentTab.id, chrome.i18n.getMessage("errorNicknameRequired") || 'Please specify a nickname.');
        return;
      }
      const customTitle = parts.slice(2).join(' ').trim();
      if (currentTab.url) {
        const bookmarks = await loadBookmarksData();
        if (!bookmarks[nickname]) bookmarks[nickname] = [];
        if (!bookmarks[nickname].some(b => b.url === currentTab.url)) {
          bookmarks[nickname].push({
            url: currentTab.url,
            title: customTitle || currentTab.title || '',
            score: 1.0,
            last_used_at: Date.now(),
            created_at: Date.now()
          });
          await chrome.storage.local.set({ bookmarks });
          await showToast(currentTab.id, chrome.i18n.getMessage("bookmarkAddedMessage", [nickname]) || `Registered as '${nickname}'!`);
        }
      }
      return;
    } else if (cmd === ':rm') {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab || !currentTab.id) return;

      const restParts = rest.split(/\s+/);
      const nickname = restParts[0];
      const urlToDelete = restParts.slice(1).join(' ').trim();

      if (!nickname) {
        await showToast(currentTab.id, chrome.i18n.getMessage("errorNicknameRequired") || 'Please specify a nickname.');
        return;
      }

      const bookmarks = await loadBookmarksData();
      if (bookmarks[nickname]) {
        if (urlToDelete) {
          const initialLength = bookmarks[nickname].length;
          bookmarks[nickname] = bookmarks[nickname].filter(b => !isSameUrl(b.url, urlToDelete));
          if (bookmarks[nickname].length === 0) delete bookmarks[nickname];
          if (bookmarks[nickname].length < initialLength) {
            await chrome.storage.local.set({ bookmarks });
            await showToast(currentTab.id, chrome.i18n.getMessage("bookmarkUrlRemovedMessage", [nickname]) || `Deleted URL for '${nickname}'.`);
          } else {
            await showToast(currentTab.id, chrome.i18n.getMessage("errorUrlNotFound", [nickname]) || `URL not found.`);
          }
        } else {
          if (bookmarks[nickname].length > 1) {
            await showToast(currentTab.id, chrome.i18n.getMessage("errorMultipleUrlsFound") || "Multiple URLs found. Select from suggestions.");
          } else {
            delete bookmarks[nickname];
            await chrome.storage.local.set({ bookmarks });
            await showToast(currentTab.id, chrome.i18n.getMessage("bookmarkRemovedMessage", [nickname]) || `Deleted '${nickname}'.`);
          }
        }
      } else {
        await showToast(currentTab.id, chrome.i18n.getMessage("errorNicknameNotFound", [nickname]) || `Nickname not found.`);
      }
      return;
    }
  }

  let targetUrl = trimmed;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const bookmarks = await loadBookmarksData();
    const allMatches: { nickname: string; entry: BookmarkEntry }[] = [];
    for (const [nickname, entries] of Object.entries(bookmarks)) {
      if (nickname.includes(trimmed) || trimmed.includes(nickname)) {
        for (const entry of entries) allMatches.push({ nickname, entry });
      }
    }
    allMatches.sort((a, b) => (b.entry.score - a.entry.score) || a.entry.url.localeCompare(b.entry.url));
    if (allMatches.length > 0) targetUrl = allMatches[0].entry.url;
    else return;
  }

  await updateScore(targetUrl);
  switch (disposition) {
    case 'currentTab': chrome.tabs.update({ url: targetUrl }); break;
    case 'newForegroundTab': chrome.tabs.create({ url: targetUrl, active: true }); break;
    case 'newBackgroundTab': chrome.tabs.create({ url: targetUrl, active: false }); break;
  }
});

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

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
} // End of if (typeof window === 'undefined')
