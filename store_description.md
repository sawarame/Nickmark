# Chrome Web Store Description / ウェブストア用説明文

---

## 🇺🇸 English

### **Name**
Nickmark - Keyboard-first Bookmark Access

### **Short Description**
Instantly access your bookmarks straight from the address bar using nicknames. Designed for keyboard-focused power users and engineers.

### **Detailed Description**
Nickmark is a lightning-fast, keyboard-centric Chrome extension designed for engineers and power users who want to minimize mouse movement. By assigning simple nicknames to your frequently visited URLs, you can jump to them directly from Chrome's address bar (omnibox).

[ 🚀 CORE FEATURES ]
- Omnibox Integration
Simply type 'nm' followed by a space and your nickname in the address bar. Press Enter to instantly navigate.

- Mass Opening
Use ':open [nickname]' (or ':o') to open all URLs associated with a nickname in new background tabs at once. Perfect for launching your daily workflow.

- Smart Auto-Sorting
Nickmark uses an exponential decay algorithm. The URLs you use most frequently and recently automatically bubble up to the top of your suggestions.

- Built-in Command Line
Manage your bookmarks without ever leaving the keyboard.

- Sleek Feedback
Non-intrusive, custom toast notifications provide instant feedback on your actions without breaking your flow.

- Developer Friendly
Easily import and export your entire configuration via JSON to sync across different environments.

- Privacy First
All data is stored locally on your machine using Chrome's secure storage. No external servers involved.

[ COMMAND LIST ]
* :add [nickname] [title] (alias: :a) : Save the current tab instantly.
* :addall [nickname] (alias: :aa) : Save all tabs in current window.
* :open [nickname] (alias: :o) : Open all URLs for the nickname.
* :rm [nickname] : Delete a nickname or select a URL to remove.
* :ls : Open management dashboard.
* :prefs : Customize experience and language settings.
* :help : Access documentation.

[ 💡 HOW TO USE ]
1. Navigate to your favorite website (e.g., your GitHub repo).
2. Focus the address bar (Cmd/Ctrl + L), type 'nm :add gh MyRepo' and press Enter.
3. Next time you want to go there, simply type 'nm gh' and press Enter!
4. Need to open your entire project suite? Type 'nm :o project-name'.

---

## 🇯🇵 日本語

### **拡張機能名**
Nickmark (ニックマーク) - アドレスバーから爆速ブックマーク

### **短い説明**
ニックネームを使ってアドレスバーからブックマークへ瞬時にアクセス。マウス移動を最小限にしたいエンジニア・パワーユーザー向けの拡張機能。

### **詳細な説明**
Nickmark は、キーボード操作を愛するエンジニアやパワーユーザーのために作られた、超高速ブックマークアクセスツールです。よく使うWebサイトに「ニックネーム（別名）」を割り当てることで、Chromeのアドレスバー（オムニボックス）から一発で目的のページへ遷移できます。

【 🚀 主な機能 】
■ アドレスバー（オムニボックス）連携
アドレスバーに 'nm' + スペース + ニックネームを入力してEnterを押すだけ。マウスに手を伸ばす必要はありません。

■ 一括展開機能
':open [ニックネーム]'（または ':o'）で、そのニックネームに紐づくすべてのURLをバックグラウンドタブで一斉に開きます。毎朝のルーチンワークを一瞬で開始できます。

■ 賢い自動ソート
指数減衰アルゴリズムを採用。「最近よく使っているURL」が自動的に学習され、常にサジェストの最上位に表示されます。

■ コマンドモード搭載
キーボードから手を離さずにブックマークを管理できます。

■ 洗練されたフィードバック
作業を邪魔しない独自のトースト通知により、操作結果をリアルタイムに確認できます。

■ エンジニアフレンドリー
設定データを JSON 形式で一括エクスポート／インポート可能。複数環境での同期も簡単です。

■ プライバシー重視
ブックマークのデータはすべてローカルストレージに安全に保存されます。外部サーバーへの送信は一切ありません。

【 コマンド一覧 】
・ :add [ニックネーム] [タイトル] (エイリアス: :a) : 現在開いているタブをその場で登録。
・ :addall [ニックネーム] (エイリアス: :aa) : 現在の全てのタブを一括登録。
・ :open [ニックネーム] (エイリアス: :o) : 紐づく全てのURLを一括で開く。
・ :rm [ニックネーム] : ニックネームまたは特定のURLを選択して削除。
・ :ls : ビジュアル管理画面（ブックマーク一覧）を開く。
・ :prefs : 言語設定などのカスタマイズが可能。
・ :help : 公式ドキュメントへ素早くアクセス。

【 💡 使い方 】
1. よく使うサイト（例：GitHubのリポジトリ）を開きます。
2. アドレスバーにフォーカス（Cmd/Ctrl + L）し、'nm :add gh マイリポジトリ' と入力してEnter。
3. 次からは、アドレスバーで 'nm gh' と打ってEnterを押すだけです！
4. 関連サイトを一度に開きたい時は 'nm :o gh' と入力しましょう。

---

## 🔒 Permissions Justification / 権限の使用理由

### **contextMenus**
- **EN**: Used to provide a "Help page" item in the extension's context menu (accessible via right-click on the icon), allowing users to quickly access documentation localized to their preferred language.
- **JP**: 拡張機能アイコンの右クリックメニューに「ヘルプページ」を追加し、ユーザーが使用言語に合わせた公式ドキュメントへ即座にアクセスできるようにするために使用します。
