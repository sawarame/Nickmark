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
