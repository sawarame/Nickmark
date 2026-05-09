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

export async function loadBookmarksData(): Promise<Record<string, BookmarkEntry[]>> {
  const data = await chrome.storage.local.get('bookmarks');
  const rawBookmarks = data.bookmarks || {};
  const normalizedBookmarks: Record<string, BookmarkEntry[]> = {};
  
  for (const [nickname, entries] of Object.entries(rawBookmarks)) {
    if (Array.isArray(entries)) {
      normalizedBookmarks[nickname] = entries;
    } else if (entries && typeof entries === 'object') {
      // Normalize malformed JSON objects back to arrays
      normalizedBookmarks[nickname] = Object.values(entries) as BookmarkEntry[];
    } else {
      normalizedBookmarks[nickname] = [];
    }
  }
  return normalizedBookmarks;
}

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
  if (!trimmed) return;

  const bookmarks = await loadBookmarksData();

  const suggestions: chrome.omnibox.SuggestResult[] = [];

  if (trimmed.startsWith(':')) {
    const cmd = trimmed.split(' ')[0];
    const rest = trimmed.slice(cmd.length).trim();

    if (':add'.startsWith(cmd)) {
      suggestions.push({
        content: `:add ${rest}`,
        description: `<match>:add</match> ${rest || '[nickname] [title(optional)]'} - Add current tab to Nickmark`
      });
    }
    if (':option'.startsWith(cmd)) {
      suggestions.push({
        content: ':option',
        description: `<match>:option</match> - Open Options / Manage Nickmarks`
      });
    }
    if (':rm'.startsWith(cmd)) {
      suggestions.push({
        content: `:rm ${rest}`,
        description: `<match>:rm</match> ${rest || '[nickname]'} - Remove Nickmark`
      });
    }
    suggest(suggestions);
    return;
  }
  
  for (const [nickname, entries] of Object.entries(bookmarks)) {
    if (nickname.includes(trimmed) || trimmed.includes(nickname)) {
      // Sort entries by score desc, url asc
      const sortedEntries = [...entries].sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.url.localeCompare(b.url);
      });

      for (const entry of sortedEntries) {
        suggestions.push({
          content: entry.url,
          description: `<match>${nickname}</match>: <url>${entry.url}</url> - ${entry.title || 'No title'}`
        });
      }
    }
  }

  suggest(suggestions);
});

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
      if (!nickname) return;
      const customTitle = parts.slice(2).join(' ').trim();
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentTab && currentTab.url) {
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

          chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon48.png',
            title: chrome.i18n.getMessage("bookmarkAddedTitle") || 'Registration Complete',
            message: chrome.i18n.getMessage("bookmarkAddedMessage", [nickname]) || `Registered as nickname '${nickname}'!`
          });
        }
      }
      return;
    } else if (cmd === ':rm') {
      if (!name) return;
      const bookmarks = await loadBookmarksData();
      if (bookmarks[name]) {
        delete bookmarks[name];
        await chrome.storage.local.set({ bookmarks });

        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon48.png',
          title: chrome.i18n.getMessage("bookmarkRemovedTitle") || 'Deletion Complete',
          message: chrome.i18n.getMessage("bookmarkRemovedMessage", [name]) || `Deleted nickname '${name}'.`
        });
      }
      return;
    }
  }

  let targetUrl = trimmed;

  // If text doesn't look like a URL, maybe it's just the nickname and they pressed enter
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const bookmarks = await loadBookmarksData();
    
    let bestMatch: BookmarkEntry | null = null;
    
    // Exact match first
    if (bookmarks[trimmed] && bookmarks[trimmed].length > 0) {
      const sorted = [...bookmarks[trimmed]].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.url.localeCompare(b.url);
      });
      bestMatch = sorted[0];
    } else {
      // Partial match
      let highestScore = -1;
      for (const [nickname, entries] of Object.entries(bookmarks)) {
        if (nickname.includes(trimmed) || trimmed.includes(nickname)) {
          for (const entry of entries) {
            if (entry.score > highestScore) {
              highestScore = entry.score;
              bestMatch = entry;
            }
          }
        }
      }
    }

    if (bestMatch) {
      targetUrl = bestMatch.url;
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
