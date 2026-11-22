# Chrome Web Store Description (English)

### **Name**
Nickmark - Keyboard-first Bookmark Access

### **Short Description**
Access bookmarks via keyboard shortcuts and a command palette. Supports dynamic URLs, folder batch open, and presets.

### **Detailed Description**
Nickmark is a keyboard-centric Chrome extension built for engineers and power users to reduce mouse movement. By assigning short nicknames to frequently visited pages, search engines, and bookmarklets, you can launch and manage your workflow from the command palette popup.

[ 🚀 CORE FEATURES ]
- Command Palette Launcher
Launch the search and command palette from anywhere using Alt+Shift+D (Option+Shift+D on macOS). Navigate results with arrow keys or Ctrl+N / Ctrl+P, autocomplete with Tab, and choose how tabs open (Enter for current tab, Cmd/Ctrl/Alt+Enter for a new foreground tab, Shift+Enter for a background tab). Default tab behavior can also be customized in Preferences.

- Dynamic URLs (%s Placeholders)
Embed '%s' in any URL to build instant search shortcuts (for example, 'docs routing' in the popup). Optional default values are used when no query is provided, or the site's origin is opened when omitted.

- Folder Organization & Batch Open
Organize nicknames into hierarchical folders using slashes (such as 'work/dashboard'). Type 'work/' (or a nested folder segment such as 'dashboard/') in the popup or open folders from the management dashboard to launch all openable URLs at once in background tabs, protected by a configurable safety tab limit (1-100 tabs).

- Built-in Presets (Search Engines & Bookmarklets)
Enable 15 built-in presets for major search engines and developer reference sites ('%s' dynamic URLs) and 3 utility bookmarklets (copy Markdown link 'mdlink', copy HTML link 'htmllink', and open web archive 'wayback') via checkboxes in Preferences. Only enabled preset IDs are saved, consuming virtually no storage space.

- Bookmarklet Execution
Register 'javascript:' bookmarklets and execute them safely on the active tab via Chrome's userScripts API (Chrome 135+) without navigating away from the current page.

- Optional Browser History Search (Opt-in)
When explicitly enabled in Preferences, matching browser history entries appear below bookmark suggestions in the popup (with automatic duplicate URL filtering), without affecting bookmark ranking scores.

- Intelligent Auto-Sorting
Uses an exponential decay scoring algorithm combined with pinning support. Frequently and recently accessed bookmarks automatically rank higher in suggestions.

- Google Account Sync & Local Storage
Switch between fast unlimited local storage and Chrome account synchronization (up to 100KB with automatic chunk splitting and a conflict-resolution dialog). Enabled presets, tab behavior, and theme color preferences are also synchronized when sync is active.

- Theme Color Customization
Choose from 6 preset theme colors (Green, Blue, Gray, Indigo, Orange, and Rose) in Preferences. Changes apply immediately across the command palette, management dashboard, and preferences page, and synchronize across devices when account sync is enabled, while light and dark modes follow your OS or browser appearance settings.

[ COMMAND LIST (prefix with ':' or ';') ]
- :add [nickname] [url] [title] (alias: :a) : Register the current tab, a specific URL, or a bookmarklet. Notifies you if the current page is already bookmarked.
- :addall [nickname] (alias: :aa) : Register all open tabs in the current window.
- :rm [nickname] [url] : Remove a nickname or a specific URL entry.
- :ls : Open the bookmark management dashboard.
- :prefs : Open preferences (sync, language, theme color, tab behavior, history search, presets, batch open limit).
- :help : Open the online documentation.

[ 💡 HOW TO USE ]
1. Open a frequently visited site or web tool.
2. Press Alt+Shift+D (Option+Shift+D on macOS) to open the Nickmark command palette.
3. Type ':add docs' (or ';add docs') and press Enter to save the active tab under the nickname 'docs'.
4. Open the palette again, type 'docs', and press Enter to navigate.
5. For folder workflows, register entries like 'work/mail' and 'work/tasks', then type 'work/' and press Enter to launch the full workspace.

[ DEVELOPER & POWER USER FEATURES ]
- Inline Table Editing, Filtering & Sorting: Click any nickname, title, or URL cell directly in the management table to edit inline via textarea; changes save automatically on focus-out or Enter and cancel on Escape. Filter per column with space-separated AND matching, sort by default order, last used date, or decay score, and rename or delete folders in bulk.
- Import, JSON Editor & Backup Export: Import from Nickmark JSON or Chrome Bookmarks HTML (with preview, optional destination folder, and merge/overwrite modes), bulk edit in the built-in JSON editor, or export JSON backups at any time.
- Customizable Tab Behavior & Multi-Language UI: Optionally open items in a new tab by default (with an exception to reuse the current tab when on a New Tab page), choose a preferred theme color, and switch between English and Japanese instantly without reloading.
- Non-Intrusive Feedback & Contextual Tips: Operation results and duplicate-bookmark notices appear directly inside the popup without forced tab switching, alongside subtle in-page toast notifications and clickable usage tips when the search field is empty.
