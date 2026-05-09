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

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const trimmed = text.trim();
  if (!trimmed) {
    chrome.omnibox.setDefaultSuggestion({
      description: 'Search Nickmark'
    });
    return;
  }

  const bookmarks = await loadBookmarksData();
  const suggestions: chrome.omnibox.SuggestResult[] = [];

  // Command mode handling
  if (trimmed.startsWith(':')) {
    chrome.omnibox.setDefaultSuggestion({
      description: 'Nickmark Command Mode'
    });
    const parts = trimmed.split(' ');
    const cmd = parts[0];
    const rest = parts.slice(1).join(' ').trim();

    // Show suggestions for all commands that start with the current input or follow a full match
    if (':add'.startsWith(cmd) || cmd === ':add') {
      suggestions.push({
        content: `:add ${rest} `, // Adding trailing space to keep it distinct from user input
        description: `<match>:add</match> ${rest || '[nickname] [title(optional)]'} - Add current tab to Nickmark`
      });
    }
    if (':option'.startsWith(cmd) || cmd === ':option') {
      suggestions.push({
        content: ':option ', // Adding trailing space to keep it distinct from user input
        description: `<match>:option</match> - Open Options / Manage Nickmarks`
      });
    }
    if (':rm'.startsWith(cmd) || cmd === ':rm') {
      suggestions.push({
        content: `:rm ${rest} `, // Adding trailing space to keep it distinct from user input
        description: `<match>:rm</match> ${rest || '[nickname]'} - Remove Nickmark`
      });
    }
    suggest(suggestions);
    return;
  }

  // Gather matching entries
  const allMatches: { nickname: string; entry: BookmarkEntry }[] = [];
  for (const [nickname, entries] of Object.entries(bookmarks)) {
    if (nickname.includes(trimmed) || trimmed.includes(nickname)) {
      for (const entry of entries) {
        allMatches.push({ nickname, entry });
      }
    }
  }

  // Sort by score desc, then url asc
  allMatches.sort((a, b) => {
    if (b.entry.score !== a.entry.score) {
      return b.entry.score - a.entry.score;
    }
    return a.entry.url.localeCompare(b.entry.url);
  });

  if (allMatches.length > 0) {
    const top = allMatches[0];
    // Set the first match as the default suggestion
    chrome.omnibox.setDefaultSuggestion({
      description: `<match>${top.nickname}</match>: <url>${top.entry.url}</url> - ${top.entry.title || 'No title'}`
    });

    // Provide the rest as suggestions (2nd through 10th)
    for (const match of allMatches.slice(1, 10)) {
      suggestions.push({
        content: match.entry.url,
        description: `<match>${match.nickname}</match>: <url>${match.entry.url}</url> - ${match.entry.title || 'No title'}`
      });
    }
  } else {
    chrome.omnibox.setDefaultSuggestion({
      description: `No matches found for: <match>${trimmed}</match>`
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
        
        // Force reflow
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
    // If injection fails (e.g. on special chrome:// pages), redirect to options page with message
    const optionsUrl = chrome.runtime.getURL(`options.html?msg=${encodeURIComponent(message)}`);
    chrome.tabs.update(tabId, { url: optionsUrl });
  }
}

chrome.omnibox.onInputEntered.addListener(async (text: string, disposition: "currentTab" | "newForegroundTab" | "newBackgroundTab") => {
  const trimmed = text.trim();

  // Command mode handling
  if (trimmed.startsWith(':')) {
    const parts = trimmed.split(' ');
    const cmd = parts[0];
    const name = parts.slice(1).join(' ').trim();

    if (cmd === ':option') {
      chrome.runtime.openOptionsPage();
      return;
    } else if (cmd === ':add') {
      const nickname = parts[1];
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab || !currentTab.id) return;

      if (!nickname) {
        const errorMsg = chrome.i18n.getMessage("errorNicknameRequired") || 'Please specify a nickname.';
        await showToast(currentTab.id, errorMsg);
        return;
      }
      const customTitle = parts.slice(2).join(' ').trim();
      if (currentTab.url) {
        const bookmarks = await loadBookmarksData();
        if (!bookmarks[nickname]) bookmarks[nickname] = [];
        
        // Ensure no duplicate URL for this nickname
        if (!bookmarks[nickname].some(b => b.url === currentTab.url)) {
          bookmarks[nickname].push({
            url: currentTab.url,
            title: customTitle || currentTab.title || '',
            score: 1.0,
            last_used_at: Date.now(),
            created_at: Date.now()
          });
          await chrome.storage.local.set({ bookmarks });

          const message = chrome.i18n.getMessage("bookmarkAddedMessage", [nickname]) || `Registered as nickname '${nickname}'!`;
          await showToast(currentTab.id, message);
        }
      }
      return;
    } else if (cmd === ':rm') {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab || !currentTab.id) return;

      if (!name) {
        const errorMsg = chrome.i18n.getMessage("errorNicknameRequired") || 'Please specify a nickname.';
        await showToast(currentTab.id, errorMsg);
        return;
      }
      const bookmarks = await loadBookmarksData();
      if (bookmarks[name]) {
        delete bookmarks[name];
        await chrome.storage.local.set({ bookmarks });

        const message = chrome.i18n.getMessage("bookmarkRemovedMessage", [name]) || `Deleted nickname '${name}'.`;
        await showToast(currentTab.id, message);
      } else {
        const errorMsg = chrome.i18n.getMessage("errorNicknameNotFound", [name]) || `Nickname '${name}' not found.`;
        await showToast(currentTab.id, errorMsg);
      }
      return;
    }
  }

  let targetUrl = trimmed;

  // If text doesn't look like a URL, maybe it's just the nickname or part of it
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const bookmarks = await loadBookmarksData();
    
    // Use the same matching/sorting logic as onInputChanged
    const allMatches: { nickname: string; entry: BookmarkEntry }[] = [];
    for (const [nickname, entries] of Object.entries(bookmarks)) {
      if (nickname.includes(trimmed) || trimmed.includes(nickname)) {
        for (const entry of entries) {
          allMatches.push({ nickname, entry });
        }
      }
    }

    allMatches.sort((a, b) => {
      if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
      return a.entry.url.localeCompare(b.entry.url);
    });

    if (allMatches.length > 0) {
      targetUrl = allMatches[0].entry.url;
    } else {
      return;
    }
  }

  // Update score
  await updateScore(targetUrl);

  // Navigate
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
});

async function updateScore(url: string) {
  const bookmarks = await loadBookmarksData();
  let updated = false;

  for (const [nickname, entries] of Object.entries(bookmarks)) {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].url === url) {
        entries[i].score = calculateNewScore(entries[i].score, entries[i].last_used_at);
        entries[i].last_used_at = Date.now();
        updated = true;
      }
    }
  }

  if (updated) {
    await chrome.storage.local.set({ bookmarks });
  }
}

// Open options page when the extension icon in the toolbar is clicked
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
