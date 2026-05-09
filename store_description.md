# Chrome Web Store Description / ウェブストア用説明文

---

## 🇺🇸 English

### **Name**
Nickmark - Keyboard-first Bookmark Access

### **Short Description**
Instantly access your bookmarks straight from the address bar using nicknames. Designed for keyboard-focused power users.

### **Detailed Description**
Nickmark is a lightning-fast, keyboard-centric Chrome extension designed for engineers and power users who want to minimize mouse movement. By assigning simple "nicknames" to your frequently visited URLs, you can jump to them directly from Chrome's address bar (omnibox).

🚀 Core Features
*   Omnibox Integration: Simply type `nm` followed by a space and your nickname in the address bar. Press Enter to instantly navigate.
*   Smart Auto-Sorting: Nickmark uses an exponential decay algorithm. The URLs you use most frequently and recently will automatically bubble up to the top of your suggestions.
*   Built-in Command Line: Manage your bookmarks without ever leaving the keyboard.
    *   `:add [nickname] [optional title]` - Save the current tab instantly.
    *   `:rm [nickname]` - Delete a nickname.
    *   `:option` - Open the visual management dashboard.
*   Developer Friendly: Easily import and export your entire configuration via JSON in the options page to sync across different environments.
*   Privacy First: All data is stored locally on your machine using Chrome's secure local storage.

💡 How to Use
1.  Navigate to your favorite website (e.g., your GitHub repo).
2.  Focus the address bar (`Cmd/Ctrl + L`), type `nm :add gh MyRepo` and press Enter.
3.  Next time you want to go there, simply type `nm gh` and press Enter!

---

## 🇯🇵 日本語

### **拡張機能名**
Nickmark (ニックマーク) - アドレスバーから爆速ブックマーク

### **短い説明**
ニックネームを使ってアドレスバーからブックマークへ瞬時にアクセス。マウス移動を最小限にしたいパワーユーザー向けの拡張機能。

### **詳細な説明**
Nickmark は、キーボード操作を愛するエンジニアやパワーユーザーのために作られた、超高速ブックマークアクセスツールです。よく使うWebサイトに「ニックネーム（別名）」を割り当てることで、Chromeのアドレスバー（オムニボックス）から一発で目的のページへ遷移できます。

🚀 主な機能
*   アドレスバー（オムニボックス）連携: アドレスバーに `nm` + `スペース` + `ニックネーム` を入力してEnterを押すだけ。マウスに手を伸ばす必要はありません。
*   賢い自動ソート: 指数減衰アルゴリズムを採用。「最近よく使っているURL」が自動的に学習され、常にサジェストの最上位に表示されます。
*   コマンドモード搭載: キーボードから手を離さずにブックマークを管理できます。
    *   `:add [ニックネーム] [タイトル(任意)]` - 現在開いているタブをその場で登録。
    *   `:rm [ニックネーム]` - 指定したニックネームを削除。
    *   `:option` - 管理画面（オプションページ）を開く。
*   エンジニアフレンドリー: オプション画面からJSON形式で設定データを一括エクスポート／インポート可能。複数環境でのセットアップも一瞬です。
*   プライバシー重視: ブックマークのデータはすべてお使いのブラウザのローカルストレージに安全に保存されます。

💡 使い方
1.  よく使うサイト（例：GitHubのリポジトリ）を開きます。
2.  アドレスバーにフォーカス（`Cmd/Ctrl + L`）し、`nm :add gh マイリポジトリ` と入力してEnter。
3.  次回アクセスする時は、アドレスバーで `nm gh` と打ってEnterを押すだけです！
