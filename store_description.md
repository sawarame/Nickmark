# Chrome Web Store Description / ウェブストア用説明文

---

## 🇺🇸 English

### **Name**
Nickmark - Keyboard-first Bookmark Access

### **Short Description**
Instantly access your bookmarks straight from the address bar using nicknames. Designed for keyboard-focused power users and engineers.

### **Detailed Description**
Nickmark is an efficient, keyboard-centric Chrome extension designed for engineers and power users who want to minimize mouse movement. By assigning simple nicknames to your frequently visited URLs, you can jump to them directly from Chrome's address bar (omnibox).

[ 🚀 CORE FEATURES ]
- Omnibox Integration
Simply type 'nm' followed by a space and your nickname in the address bar. Press Enter to instantly navigate.

- Multi-Open Capability
Use ':open [nickname]' (or ':o') to launch all URLs associated with a nickname in background tabs simultaneously. Ideal for starting your daily development environment.

- Intelligent Auto-Sorting
Leverages an exponential decay algorithm. The URLs you access most frequently and recently automatically rise to the top of your suggestions.

- Command Line Management
Add, remove, and organize your bookmarks without ever leaving your home row.

- Seamless Feedback
Custom toast notifications provide immediate status updates without interrupting your workflow.

- Sync Support
Optionally sync your data across different devices using Chrome's built-in synchronization, with automatic data chunking for stability.

- Privacy Focused
Your bookmark data is stored locally or in your own Chrome sync storage. No external servers are involved.

[ COMMAND LIST ]
* :add [nickname] [title] (alias: :a) : Save the current tab.
* :addall [nickname] (alias: :aa) : Save all open tabs in the current window.
* :open [nickname] (alias: :o) : Open all URLs associated with the nickname.
* :rm [nickname] : Delete a nickname or specific URL.
* :ls : Open the visual management dashboard.
* :prefs : Access customization and language settings.
* :help : View the official documentation.

[ 💡 HOW TO USE ]
1. Open a website you visit frequently.
2. Focus the address bar (Cmd/Ctrl + L), type 'nm :add gh MyRepo' and press Enter.
3. To return later, just type 'nm gh' in the address bar and press Enter!
4. To open a set of related pages, use 'nm :o project-name'.

---

## 🇯🇵 日本語

### **拡張機能名**
Nickmark (ニックマーク) - キーボード操作を加速するブックマーク管理

### **短い説明**
ニックネームを使ってアドレスバーからブックマークへ即座にアクセス。エンジニアやパワーユーザーのためのキーボード操作に特化したツール。

### **詳細な説明**
Nickmark は、キーボード操作を重視するエンジニアやパワーユーザーのために開発された、効率的なブックマークアクセスツールです。よく使うWebサイトに「ニックネーム（別名）」を割り当てることで、Chromeのアドレスバー（オムニボックス）から一発で目的のページへ遷移できます。

【 🚀 主な機能 】
■ アドレスバー（オムニボックス）連携
アドレスバーに 'nm' + スペース + ニックネームを入力してEnterを押すだけ。マウスに手を伸ばす必要はありません。

■ 一括展開機能
':open [ニックネーム]'（または ':o'）で、そのニックネームに紐づくすべてのURLをバックグラウンドタブで一斉に開きます。開発環境やプロジェクトに必要なページを一度に準備できます。

■ 賢い自動ソート
指数減衰アルゴリズムを採用。「最近よく使っているURL」を自動的に学習し、サジェストの最上位に優先して表示します。

■ コマンドモード搭載
ブックマークの登録、削除、整理をすべてキーボードから完結できます。

■ 洗練されたフィードバック
作業を妨げないカスタムトースト通知により、操作結果をリアルタイムかつ控えめに確認できます。

■ 同期サポート
Chrome標準の同期機能を利用して、複数のデバイス間でデータを共有可能です。データ量に応じた自動チャンク分割処理により、安定した同期を実現しています。

■ プライバシー重視
ブックマークデータはすべてローカル、またはご自身のChrome同期ストレージに保存されます。外部サーバーへデータを送信することはありません。

【 コマンド一覧 】
・ :add [ニックネーム] [タイトル] (エイリアス: :a) : 現在のタブを登録。
・ :addall [ニックネーム] (エイリアス: :aa) : 現在のウィンドウで開いている全タブを一括登録。
・ :open [ニックネーム] (エイリアス: :o) : 紐づく全URLを一括で開く。
・ :rm [ニックネーム] : ニックネームまたは特定のURLを削除。
・ :ls : ブックマーク一覧（管理画面）を表示。
・ :prefs : 言語設定や同期設定の変更。
・ :help : 公式ドキュメントを表示。

【 💡 使い方 】
1. よく使うサイト（例：GitHubのリポジトリ）を開きます。
2. アドレスバーにフォーカス（Cmd/Ctrl + L）し、'nm :add gh マイリポジトリ' と入力してEnter。
3. 次回からは、アドレスバーで 'nm gh' と打ってEnterを押すだけです！
4. 複数のページを一度に開きたい時は 'nm :o gh' と入力します。

---

## 🔒 Permissions Justification / 権限の使用理由

### **contextMenus**
- **EN**: Used to provide a "Help page" item in the extension's context menu (accessible via right-click on the icon), allowing users to quickly access documentation localized to their preferred language.
- **JP**: 拡張機能アイコンの右クリックメニューに「ヘルプページ」を追加し、ユーザーが使用言語に合わせた公式ドキュメントへ即座にアクセスできるようにするために使用します。
