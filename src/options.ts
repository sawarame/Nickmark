import { BookmarkEntry } from './background';

async function loadBookmarks() {
  const data = await chrome.storage.local.get('bookmarks');
  const bookmarks = (data.bookmarks || {}) as Record<string, BookmarkEntry[]>;
  return bookmarks;
}

async function renderList() {
  const bookmarks = await loadBookmarks();
  const tbody = document.getElementById('bookmarkList');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const [nickname, entries] of Object.entries(bookmarks)) {
    for (const entry of entries) {
      const tr = document.createElement('tr');
      
      const tdNick = document.createElement('td');
      tdNick.textContent = nickname;
      
      const tdUrl = document.createElement('td');
      tdUrl.textContent = entry.url;
      tdUrl.title = entry.title;
      
      const tdScore = document.createElement('td');
      tdScore.textContent = entry.score.toFixed(2);
      
      const tdAction = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'danger';
      delBtn.onclick = async () => {
        await deleteBookmark(nickname, entry.url);
      };
      tdAction.appendChild(delBtn);

      tr.appendChild(tdNick);
      tr.appendChild(tdUrl);
      tr.appendChild(tdScore);
      tr.appendChild(tdAction);
      
      tbody.appendChild(tr);
    }
  }
}

async function deleteBookmark(nickname: string, url: string) {
  const bookmarks = await loadBookmarks();
  if (bookmarks[nickname]) {
    bookmarks[nickname] = bookmarks[nickname].filter(b => b.url !== url);
    if (bookmarks[nickname].length === 0) {
      delete bookmarks[nickname];
    }
    await chrome.storage.local.set({ bookmarks });
    renderList();
    showStatus('Deleted successfully.');
  }
}

function showStatus(msg: string, isError = false) {
  const el = document.getElementById('statusMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'red' : 'green';
  setTimeout(() => {
    if (el.textContent === msg) el.textContent = '';
  }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  renderList();

  const titleEl = document.getElementById('title');
  if (titleEl) {
    titleEl.textContent = chrome.i18n.getMessage('extensionName') + ' Options';
  }

  document.getElementById('addButton')?.addEventListener('click', async () => {
    const nicknameInput = document.getElementById('nicknameInput') as HTMLInputElement;
    const urlInput = document.getElementById('urlInput') as HTMLInputElement;
    const titleInput = document.getElementById('titleInput') as HTMLInputElement;

    const nickname = nicknameInput.value.trim();
    const url = urlInput.value.trim();
    const title = titleInput.value.trim();

    if (!nickname || !url) {
      showStatus('Nickname and URL are required.', true);
      return;
    }

    const bookmarks = await loadBookmarks();
    if (!bookmarks[nickname]) {
      bookmarks[nickname] = [];
    }

    // Check if url already exists for this nickname
    if (bookmarks[nickname].some(b => b.url === url)) {
      showStatus('This URL already exists for this nickname.', true);
      return;
    }

    const now = Date.now();
    bookmarks[nickname].push({
      url,
      title,
      score: 1.0,
      last_used_at: now,
      created_at: now
    });

    await chrome.storage.local.set({ bookmarks });
    
    nicknameInput.value = '';
    urlInput.value = '';
    titleInput.value = '';
    
    renderList();
    showStatus('Added successfully.');
  });

  document.getElementById('exportButton')?.addEventListener('click', async () => {
    const data = await chrome.storage.local.get('bookmarks');
    const jsonArea = document.getElementById('jsonArea') as HTMLTextAreaElement;
    jsonArea.value = JSON.stringify(data, null, 2);
    showStatus('Exported to text area.');
  });

  document.getElementById('importButton')?.addEventListener('click', async () => {
    const jsonArea = document.getElementById('jsonArea') as HTMLTextAreaElement;
    try {
      const data = JSON.parse(jsonArea.value);
      if (data && typeof data === 'object' && 'bookmarks' in data) {
        await chrome.storage.local.set({ bookmarks: data.bookmarks });
        renderList();
        showStatus('Imported successfully.');
      } else {
        showStatus('Invalid JSON structure. Missing "bookmarks" root key.', true);
      }
    } catch (e) {
      showStatus('Invalid JSON format.', true);
    }
  });

  document.getElementById('clearButton')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all data?')) {
      await chrome.storage.local.remove('bookmarks');
      renderList();
      showStatus('All data cleared.');
    }
  });
});