# Nickmark

Keyboard-centric Chrome extension for lightning-fast bookmark access via the address bar.

[English](#english) | [日本語](#japanese)

---

<a name="english"></a>
## 🇺🇸 English

### **Overview**
Nickmark is a lightning-fast, keyboard-centric Chrome extension designed for engineers and power users who want to minimize mouse movement. By assigning simple "nicknames" to your frequently visited URLs, you can jump to them directly from Chrome's address bar (omnibox).

### 🚀 Core Features
*   **Omnibox Integration**: Simply type `nm` followed by a space and your nickname in the address bar. Press Enter to instantly navigate.
*   **Smart Auto-Sorting**: Uses an exponential decay algorithm. The URLs you use most frequently and recently will automatically bubble up to the top of your suggestions.
*   **Built-in Command Line**: Manage your bookmarks without ever leaving the keyboard.
    *   `:add [nickname] [optional title]` - Save the current tab instantly.
    *   `:rm [nickname]` - Delete a nickname.
    *   `:ls` - Open the visual management dashboard.
*   **Developer Friendly**: Easily import and export your entire configuration via JSON.
*   **Privacy First**: All data is stored locally on your machine.

### 💡 How to Use
1.  Navigate to your favorite website (e.g., your GitHub repo).
2.  Focus the address bar (`Cmd/Ctrl + L`), type `nm :add gh MyRepo` and press Enter.
3.  Next time you want to go there, simply type `nm gh` and press Enter!

### 🛠 Development

#### Setup
```bash
npm install
```

#### Build
```bash
npm run build
```
The build artifacts will be in the `Nickmark/` directory.

---

<a name="japanese"></a>
## 🇯🇵 日本語

### **概要**
Nickmark は、キーボード操作を愛するエンジニアやパワーユーザーのために作られた、超高速ブックマークアクセスツールです。よく使うWebサイトに「ニックネーム（別名）」を割り当てることで、Chromeのアドレスバー（オムニボックス）から一発で目的のページへ遷移できます。

### 🚀 主な機能
*   **アドレスバー（オムニボックス）連携**: アドレスバーに `nm` + `スペース` + `ニックネーム` を入力してEnterを押すだけ。
*   **賢い自動ソート**: 指数減衰アルゴリズムを採用。「最近よく使っているURL」が自動的に学習され、常にサジェストの最上位に表示されます。
*   **コマンドモード搭載**: キーボードから手を離さずにブックマークを管理できます。
    *   `:add [ニックネーム] [タイトル(任意)]` (エイリアス: `:a`) - 現在開いているタブをその場で登録。
    *   `:addall [ニックネーム]` (エイリアス: `:aa`) - 現在のウィンドウで開いている全てのタブを登録。
    *   `:rm [ニックネーム]` - 指定したニックネームを削除。
    *   `:ls` - 管理画面（ブックマーク一覧）を開く。
*   **エンジニアフレンドリー**: JSON形式で設定データを一括エクスポート／インポート可能。
*   **プライバシー重視**: データはすべてローカルに保存されます。

### 💡 使い方
1.  よく使うサイト（例：GitHubのリポジトリ）を開きます。
2.  アドレスバーにフォーカス（`Cmd/Ctrl + L`）し、`nm :add gh マイリポジトリ` と入力してEnter。
3.  次回アクセスする時は、アドレスバーで `nm gh` と打ってEnterを押すだけです！

### 🛠 開発方法

#### セットアップ
```bash
npm install
```

#### ビルド
```bash
npm run build
```
ビルドされたファイルは `Nickmark/` ディレクトリに出力されます。
