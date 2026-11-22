# 🔒 Chrome Web Store Permissions Justification / 権限の使用理由

### **storage & unlimitedStorage**
- **EN**: Stores user bookmarks, exponential decay usage scores, and preferences (language, theme color, sync toggle, enabled presets, tab behavior, batch open limit, history search toggle) locally in `chrome.storage.local` or synced via `chrome.storage.sync`. `unlimitedStorage` prevents capacity limits when managing large bookmark collections locally.
- **JP**: ブックマークデータ、使用スコア、および各種設定（言語、テーマカラー、同期設定、有効プリセット、タブ動作、一括オープン上限、履歴検索設定）をローカルまたは Chrome 同期ストレージに保存するために使用します。`unlimitedStorage` はローカル環境で大量のブックマークを制限なく保持するために使用します。

### **tabs**
- **EN**: Reads the active tab's URL/title for ':add' and ':addall' registration, opens target URLs in new foreground or background tabs, and focuses or reloads open Nickmark management tabs when bookmarks are updated.
- **JP**: `:add` / `:addall` 実行時に現在のタブ情報を取得する処理、新規／バックグラウンドタブへのページ展開、および更新時に管理画面タブへフォーカス・最新反映を行うために使用します。

### **activeTab & scripting**
- **EN**: Injects lightweight, non-intrusive toast notification banners into the currently active webpage when running actions such as link-copy presets (`mdlink` / `htmllink`) or folder operations, providing immediate feedback without switching tabs.
- **JP**: プリセットのリンクコピー（`mdlink` / `htmllink`）等を実行した際、タブを切り替えずに現在のページ上へ控えめなトースト通知を表示するために使用します。

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
