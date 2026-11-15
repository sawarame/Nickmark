# Chrome Web Store Description / ウェブストア用説明文

---

## 🇺🇸 English

### **Name**
Nickmark - Keyboard-first Bookmark Access

### **Short Description**
Access bookmarks via keyboard shortcuts, command palette, or address bar. Built for engineers and power users.

### **Detailed Description**
Nickmark is a keyboard-centric Chrome extension built for engineers and power users to reduce mouse movement. By assigning short nicknames to frequently visited pages, search engines, and bookmarklets, you can launch and manage your workflow from the command palette popup or Chrome's address bar.

[ 🚀 CORE FEATURES ]
- Command Palette Launcher
Launch the search and command palette from anywhere using Alt+Shift+D (Option+Shift+D on macOS). Navigate results with arrow keys or Ctrl+N / Ctrl+P, autocomplete with Tab, and choose how tabs open (Enter for current tab, Cmd/Ctrl/Alt+Enter for a new foreground tab, Shift+Enter for a background tab).

- Omnibox Integration (Backward Compatible)
Type 'nm' followed by a space and your nickname directly in Chrome's address bar to search and navigate.

- Dynamic URLs (%s Placeholders)
Embed '%s' in any URL to build instant search shortcuts (for example, 'nm gh my-repo' or 'gh my-repo' in the popup). Optional default values are used when no query is provided, or the site's origin is opened when omitted.

- Folder Organization & Batch Open
Organize nicknames into hierarchical folders using slashes (such as 'work/dashboard'). Open all openable URLs under a folder at once with ':open work/' or from the management dashboard, protected by a configurable safety tab limit (1-100 tabs).

- Bookmarklet Execution
Register 'javascript:' bookmarklets and execute them safely on the active tab via Chrome's userScripts API without navigating away from the current page.

- Optional Browser History Search (Opt-in)
When explicitly enabled in Preferences, matching browser history entries appear below bookmark suggestions in the popup (with automatic duplicate URL filtering), without affecting bookmark ranking scores.

- Intelligent Auto-Sorting
Uses an exponential decay scoring algorithm combined with pinning support. Frequently and recently accessed bookmarks automatically rank higher in suggestions.

- Google Account Sync & Local Storage
Switch between fast unlimited local storage and Chrome account synchronization (up to 100KB with automatic chunk splitting and a conflict-resolution dialog).

[ COMMAND LIST ]
- :add [nickname] [url] [title] (alias: :a) : Register the current tab, a specific URL, or a bookmarklet.
- :addall [nickname] (alias: :aa) : Register all open tabs in the current window.
- :open [nickname or folder/] (alias: :o) : Open all associated URLs or folder entries in background tabs.
- :rm [nickname] [url] : Remove a nickname or a specific URL entry.
- :ls : Open the bookmark management dashboard.
- :prefs : Open preferences (sync, language, history search, batch open limit).
- :help : Open the online documentation.

[ 💡 HOW TO USE ]
1. Open a frequently visited site or web tool.
2. Press Alt+Shift+D (Option+Shift+D on macOS) to open the Nickmark command palette.
3. Type ':add gh' and press Enter to save the active tab under the nickname 'gh'.
4. Open the palette again, type 'gh', and press Enter to navigate.
5. For folder workflows, register entries like 'work/mail' and 'work/tasks', then run ':open work/' to launch the full workspace.

[ DEVELOPER & POWER USER FEATURES ]
- Inline Table Editing Dashboard: Click any nickname, title, or URL cell directly in the management table to edit inline via textarea; changes save automatically on focus-out or Enter and cancel on Escape. Fixed column widths and single-line URL truncation keep large lists readable.
- JSON Editor & Backup Export: Bulk edit all bookmarks in a built-in JSON editor or export backups as JSON files at any time.
- Multi-Language Interface: Switch between English and Japanese instantly in Preferences without reloading the extension.
- Non-Intrusive Feedback: Subtle in-page toast notifications confirm actions in the active tab or inside the popup without breaking focus.

[ 🔒 PRIVACY FIRST ]
- Local & Personal Sync Only: Bookmark data is stored exclusively in your browser's local storage or your personal Chrome sync storage. No external servers are used, and no telemetry or browsing data is collected.
- Opt-in History Access: Browser history permission is optional and is never requested unless you explicitly enable Browser History Search in Preferences.

---

## 🇯🇵 日本語

### **拡張機能名**
Nickmark (ニックマーク) - キーボード操作特化型ブックマークランチャー

### **短い説明**
ニックネームで素早く遷移できるキーボード特化型ブックマークランチャー。コマンドパレット、動的URL、フォルダ一括起動に対応。

### **詳細な説明**
Nickmark は、マウス移動を最小限にしたいエンジニアやパワーユーザーのために設計された、キーボード操作中心の Chrome 拡張機能です。よく使う Web ページや検索 URL、ブックマークレットに短いニックネームを割り当てることで、コマンドパレット型のポップアップやアドレスバーから効率的にアクセス・管理できます。

【 🚀 主な機能 】
■ コマンドパレット型ポップアップランチャー
キーボードショートカット（Windows/Linux: Alt+Shift+D、macOS: Option+Shift+D）でどこからでもランチャーを起動できます。上下キーや Ctrl+N / Ctrl+P で候補を選択し、Tab で補完できます。Enter で現在のタブに遷移し、Cmd/Ctrl/Alt+Enter で新規フォアグラウンドタブ、Shift+Enter でバックグラウンドタブとして開きます。

■ アドレスバー（オムニボックス）連携
後方互換機能として、アドレスバーに 'nm' + スペース + ニックネームを入力して直接検索・遷移することも可能です。

■ 動的 URL（%s プレースホルダー）とデフォルト値
URL に '%s' を含めることで、検索クエリを引数として渡せる動的ショートカットを作成できます（例: 'gh 検索語'）。引数省略時に使用するデフォルト値の指定や、未設定時のトップページ遷移にも対応しています。

■ フォルダ階層管理と一括オープン
スラッシュ区切り（例: 'work/dashboard'）でニックネームをフォルダ分類できます。':open work/' で配下のブックマークをバックグラウンドタブに一括展開でき、設定可能な安全上限件数（1〜100件）を超える場合は確認プロンプトが表示されます。

■ ブックマークレット実行対応
'javascript:' で始まるブックマークレットを登録し、ページ遷移を行わずに現在のアクティブタブ上で直接スクリプトを実行できます（Chrome 135 以降の userScripts API を利用）。

■ ブラウザ履歴検索（オプトイン）
設定画面で有効化・許可した場合にのみ、ポップアップ検索時にブックマーク候補の下へ一致するブラウザ閲覧履歴を表示します。ブックマーク候補と重複する URL は自動除外され、学習スコアにも影響しません。

■ 指数減衰アルゴリズムによる自動ソート
使用頻度と最近の使用日時に基づく指数減衰スコアとピン留め機能を組み合わせ、よく使うブックマークを上位に表示します。

■ Google アカウント同期と大容量ローカル保存
デバイス固有の高速・大容量ローカルストレージと、複数デバイス間で共有できる Chrome 同期ストレージ（100KB 上限・自動チャンク分割・移行時の競合解決ダイアログ付き）を切り替えて利用できます。

【 コマンド一覧 】
・ :add [ニックネーム] [URL] [タイトル] (エイリアス: :a) : 現在のタブ、指定 URL、またはブックマークレットを登録。
・ :addall [ニックネーム] (エイリアス: :aa) : 現在のウィンドウで開いている全タブを一括登録。
・ :open [ニックネーム または フォルダ/] (エイリアス: :o) : 紐づく URL やフォルダ配下をバックグラウンドタブで一括オープン。
・ :rm [ニックネーム] [URL] : ニックネームまたは特定の URL を削除。
・ :ls : ブックマーク一覧（管理画面）を開く。
・ :prefs : 設定画面（同期・言語・履歴検索・一括オープン上限）を開く。
・ :help : 公式ドキュメントを開く。

【 💡 使い方 】
1. よく利用する Web ページを開きます。
2. ショートカット（Alt+Shift+D / Option+Shift+D）でコマンドパレットを開きます。
3. ':add gh' と入力して Enter を押すと、現在のタブが 'gh' として登録されます。
4. 次回からはパレットを開いて 'gh' と入力し、Enter を押すことで目的のページへ遷移します。
5. 'work/mail' や 'work/tasks' のようにスラッシュ付きで登録しておくと、':open work/' でまとめて開くことができます。

【 開発者・パワーユーザー向け機能 】
■ 一覧画面でのインライン編集と固定列幅レイアウト
管理画面の一覧テーブルは各列の幅が固定されており、長い URL も 1 行で「...」省略表示（ホバーで全文表示）されます。各セルをクリックするとその場でテキストエリアに切り替わり、フォーカスアウトまたは Enter で即座に保存、Escape でキャンセルできます。
■ JSON エディタとバックアップ出力
内蔵の JSON エディタによる一括編集や、JSON ファイルとしてのバックアップエクスポートに対応しています。
■ 即時反映される日英多言語対応
設定画面から日本語・英語を切り替えられ、画面を再読み込みせずに即座に反映されます。

【 🔒 プライバシーとデータ管理 】
■ 外部サーバーへの送信なし
ブックマークデータはすべてブラウザのローカルストレージ、またはユーザー自身の Chrome 同期ストレージ内にのみ保存されます。外部サーバーへのデータ送信や行動トラッキングは一切行いません。
■ 任意権限によるプライバシー保護
ブラウザ履歴へのアクセス権限はオプトイン方式であり、ユーザーが設定画面で「ブラウザ履歴検索」を明示的に有効化しない限り許可を要求することはありません。

---

## 🔒 Permissions Justification / 権限の使用理由

### **omnibox**
- **EN**: Enables the 'nm' keyword in Chrome's address bar so users can search nicknames, expand dynamic URLs, and run Nickmark commands directly from the omnibox.
- **JP**: Chrome のアドレスバーでキーワード 'nm' を使ったニックネーム検索、動的 URL 展開、およびコマンド実行を提供するために使用します。

### **storage & unlimitedStorage**
- **EN**: Stores user bookmarks, exponential decay usage scores, and device preferences (language, sync toggle, batch open limit, history search toggle) locally in `chrome.storage.local` or synced via `chrome.storage.sync`. `unlimitedStorage` prevents capacity limits when managing large bookmark collections locally.
- **JP**: ブックマークデータ、使用スコア、および各種設定（言語、同期設定、一括オープン上限、履歴検索設定）をローカルまたは Chrome 同期ストレージに保存するために使用します。`unlimitedStorage` はローカル環境で大量のブックマークを制限なく保持するために使用します。

### **tabs**
- **EN**: Reads the active tab's URL/title for ':add' and ':addall' registration, opens target URLs in new foreground or background tabs, and focuses or reloads open Nickmark management tabs when bookmarks are updated.
- **JP**: `:add` / `:addall` 実行時に現在のタブ情報を取得する処理、新規／バックグラウンドタブへのページ展開、および更新時に管理画面タブへフォーカス・最新反映を行うために使用します。

### **activeTab & scripting**
- **EN**: Injects lightweight, non-intrusive toast notification banners into the currently active webpage when running omnibox commands (such as ':add' or ':rm') so users receive feedback without switching tabs.
- **JP**: オムニボックスから `:add` や `:rm` 等を実行した際、タブを切り替えずに現在のページ上へ控えめなトースト通知を表示するために使用します。

### **userScripts**
- **EN**: Executes user-registered 'javascript:' bookmarklets in the MAIN world of the active tab (Chrome 135+), providing safe script execution without page navigation.
- **JP**: ユーザーが登録した `javascript:` ブックマークレットを現在のアクティブタブ（MAIN ワールド）上でページ遷移なしに安全に実行するために使用します（Chrome 135 以降）。

### **contextMenus**
- **EN**: Adds a localized "Help page" item to the extension icon's right-click context menu for quick access to documentation.
- **JP**: 拡張機能アイコンの右クリックメニューに「ヘルプページ」を追加し、使用言語に合わせた公式ドキュメントへ即座にアクセスできるようにするために使用します。

### **favicon**
- **EN**: Displays site favicons next to bookmark and history suggestions in the popup launcher and management dashboard via Chrome's internal `_favicon` endpoint.
- **JP**: コマンドパレットおよび管理画面の一覧において、各ブックマークや履歴候補のサイトアイコン（favicon）を表示するために使用します。

### **optional_permissions: history**
- **EN**: Requested only when the user explicitly opts in to "Browser History Search" in Preferences, allowing matching browsing history items to be displayed beneath bookmark suggestions in the popup.
- **JP**: 設定画面でユーザーが「ブラウザ履歴検索」を明示的に有効化した際にのみ許可を要求し、ポップアップ検索時のブックマーク候補の下へ一致する閲覧履歴を表示するために使用します。
