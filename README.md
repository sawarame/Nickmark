# Nickmark

![Version](https://img.shields.io/github/package-json/v/sawarame/Nickmark?color=blue)
![Chrome Web Store](https://img.shields.io/chrome-web-store/v/bicojpjoabhecikokcohbjgaiojggpno.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A keyboard-first Chrome extension for lightning-fast bookmark, dynamic search, folder, and bookmarklet access via a command palette.

[English](#english) | [日本語](#japanese)

---

<a name="english"></a>

## 🇺🇸 English

### Overview

**Nickmark** is designed for engineers and power users who want to minimize mouse movement. By assigning short nicknames to frequently visited pages, search templates (`%s`), folder groups, and `javascript:` bookmarklets, you can launch and manage your workflow in seconds directly from the keyboard.

### 🚀 Key Features

#### Command Palette Launcher
- Open the palette anywhere with **`Option + Shift + D`** (macOS) or **`Alt + Shift + D`** (Windows / Linux) — customizable in `chrome://extensions/shortcuts`.
- Navigate candidates with `↑` / `↓` or `Ctrl + N` / `Ctrl + P`, autocomplete with `Tab`, and dismiss with `Esc` (with IME composition protection).
- Flexible tab actions:
  - **`Enter`**: Open in the current tab
  - **`Cmd / Ctrl / Alt + Enter`**: Open in a new foreground tab
  - **`Shift + Enter`**: Open in a background tab while keeping the palette open

#### Smart Search, Dynamic URLs & Bookmarklets
- **Fuzzy & Cross-field Search**: Matches nicknames (exact, prefix, substring) as well as bookmark titles and URLs.
- **Dynamic URLs (`%s` placeholders)**: Embed `%s` in any URL to pass arguments directly (e.g., `gh sawarame/Nickmark`). Supports an optional default value when arguments are omitted, or falls back to the site origin.
- **Bookmarklet Execution**: Register `javascript:...` URLs and execute them safely on the active tab via Chrome's `userScripts` API (`MAIN` world) without navigating away. *(Requires enabling "Allow User Scripts" on the extension details page in Chrome 135+.)*
- **Optional Browser History Search (Opt-in)**: When enabled in Preferences, matching browser history entries appear below bookmark suggestions in the popup (with automatic deduplication and zero impact on bookmark ranking).

#### Folder Organization & Batch Open
- Organize bookmarks into folders using slash-separated nicknames (e.g., `work/mail`, `work/docs`).
- Open all openable URLs under a folder at once by typing `work/` (protected by a configurable safety limit of 1–100 tabs, default `20`).
- Filter, batch-open, rename, or delete entire folders from the management dashboard.

#### Built-in Command Line
Manage everything without leaving the keyboard (`:` prefix):

| Command | Alias | Description |
| :--- | :--- | :--- |
| `:add [nickname] [url] [title]` | `:a` | Save the active tab, a custom URL, or a bookmarklet |
| `:addall [nickname]` | `:aa` | Save all open tabs in the current window |
| `:rm [nickname] [url]` | — | Remove a nickname or a specific URL entry |
| `:ls` | — | Open the bookmark management dashboard |
| `:prefs` | — | Open Preferences (sync, language, history search, batch limit) |
| `:help` | — | Open the documentation page |

#### Intelligent Ranking & Management Dashboard
- **Exponential Decay Ranking**: Frequently and recently used bookmarks automatically rank higher (`Score_new = Score_old * 0.95^elapsedDays + 1.0`), alongside manual pinning.
- **Inline Table Editing**: Click any nickname, title, or URL cell in the dashboard (`list.html`) to edit inline — save on `Enter` or blur, cancel with `Esc`.
- **Flexible Sorting**: Sort the dashboard by Default order, Last Used (Newest/Oldest), Score (Highest/Lowest), or table column headers.
- **JSON Editor & Backup**: Bulk-edit all bookmarks in a built-in JSON editor or export JSON backups anytime.

#### Storage, Sync & Privacy
- **Local & Google Account Sync**: Use unlimited local storage (`chrome.storage.local`) or enable Chrome Sync (`chrome.storage.sync`, up to 100KB with automatic 8KB chunking and a conflict-resolution migration dialog).
- **Privacy First**: No external servers, telemetry, or tracking. Browser history permission is optional and requested only if you explicitly enable Browser History Search.
- **Bilingual UI**: Instant switching between English and Japanese without reloading.

### 💡 Quick Start

1. Open any page you visit often.
2. Press **`Option + Shift + D`** (macOS) or **`Alt + Shift + D`** (Windows/Linux).
3. Type `:add gh` and press `Enter` to bookmark the current tab as `gh`.
4. Open the palette again, type `gh`, and press `Enter` to jump straight there.

### 🛠 Development

#### Prerequisites
- Node.js & npm
- Google Chrome 135 or later

#### Setup & Build

```bash
# Install dependencies
npm install

# Build extension into package/js/ and generate package.zip
npm run build
```

To load the extension locally in Chrome:
1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `package/` directory.

### 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<a name="japanese"></a>

## 🇯🇵 日本語

### 概要

**Nickmark** は、マウス移動を最小限にしたいエンジニアやパワーユーザーのために設計された、キーボード操作特化型の Chrome 拡張機能です。よく使う Web ページや検索テンプレート（`%s`）、フォルダグループ、`javascript:` ブックマークレットに短いニックネームを割り当てることで、コマンドパレットから素早くアクセス・管理できます。

### 🚀 主な機能

#### コマンドパレット型ランチャー
- **`Option + Shift + D`**（macOS）または **`Alt + Shift + D`**（Windows / Linux）でどこからでもランチャーを起動できます（`chrome://extensions/shortcuts` で変更可能）。
- `↑` / `↓` や `Ctrl + N` / `Ctrl + P` で候補を選択、`Tab` で補完、`Esc` で閉じることができます（IME 変換確定中の誤操作も防止）。
- 用途に応じた柔軟なタブ遷移に対応しています：
  - **`Enter`**: 現在のタブで開く
  - **`Cmd / Ctrl / Alt + Enter`**: 新しいフォアグラウンドタブで開く
  - **`Shift + Enter`**: ポップアップを開いたままバックグラウンドタブで開く

#### スマート検索・動的 URL・ブックマークレット
- **横断検索**: ニックネーム（完全一致／前方一致／部分一致）だけでなく、ブックマークのタイトルや URL 全体から検索できます。
- **動的 URL（`%s` プレースホルダー）**: URL に `%s` を埋め込むことで検索語などの引数を展開できます（例: `gh sawarame/Nickmark`）。引数省略時に使うデフォルト値の指定や、未設定時のサイトトップページへの遷移にも対応しています。
- **ブックマークレット実行**: `javascript:...` 形式の URL を登録し、Chrome の `userScripts` API（`MAIN` world）を用いてページ遷移せずにアクティブタブ上で直接実行できます。（※ Chrome 135 以降、拡張機能詳細画面で「ユーザー スクリプトを許可する」の有効化が必要です）
- **ブラウザ履歴検索（オプトイン）**: 設定画面で有効化・許可した場合にのみ、ポップアップのブックマーク候補の下に一致するブラウザ履歴を表示します（重複 URL は自動除外され、学習スコアには影響しません）。

#### フォルダ管理と一括オープン
- `work/mail`、`work/docs` のようにスラッシュ区切りでニックネームを登録すると、自動的にフォルダとして整理されます。
- `work/` と入力して実行すると、配下の開ける URL をバックグラウンドタブで一括オープンできます（1〜100件で変更可能な安全上限付き、デフォルト `20` 件）。
- 管理画面からフォルダ単位での絞り込み、一括オープン、フォルダ名のリネーム、一括削除が可能です。

#### 組み込みコマンドライン（`:` プレフィックス）
キーボードから手を離さずに登録・削除・画面移動が行えます。

| コマンド | エイリアス | 説明 |
| :--- | :--- | :--- |
| `:add [ニックネーム] [URL] [タイトル]` | `:a` | 現在のタブ、指定 URL、またはブックマークレットを登録 |
| `:addall [ニックネーム]` | `:aa` | 現在のウィンドウで開いているすべてのタブを一括登録 |
| `:rm [ニックネーム] [URL]` | — | ニックネームまたは特定の URL エントリを削除 |
| `:ls` | — | ブックマーク管理画面を開く |
| `:prefs` | — | 設定画面（同期・言語・履歴検索・一括オープン上限）を開く |
| `:help` | — | ヘルプ／ドキュメントページを開く |

#### 指数減衰ランキングと管理画面
- **指数減衰アルゴリズム**: 使用頻度と最終使用日時に基づくスコア（`Score_new = Score_old * 0.95^elapsedDays + 1.0`）とピン留め機能により、よく使うブックマークが常に上位に表示されます。
- **インライン編集**: 管理画面（`list.html`）のニックネーム・タイトル・URL の各セルをクリックするだけでその場編集が可能（`Enter` またはフォーカスアウトで保存、`Esc` でキャンセル）。
- **柔軟な並び替え**: デフォルト順、最終使用日時（新しい順／古い順）、スコア（高い順／低い順）、および各列ヘッダーでのソートに対応しています。
- **JSON エディタ＆バックアップ**: 組み込みの JSON エディタによる一括編集や、JSON ファイルでのバックアップエクスポートが可能です。

#### ストレージ・同期・プライバシー
- **ローカル保存と Google アカウント同期**: 大容量ローカルストレージ（`chrome.storage.local`）と、デバイス間で共有できる Chrome 同期ストレージ（`chrome.storage.sync`、上限 100KB・自動チャンク分割・移行時の競合解決ダイアログ付き）を切り替えて利用できます。
- **プライバシー重視**: 外部サーバーへのデータ送信やトラッキングは一切行いません。ブラウザ履歴権限もユーザーが明示的に有効化しない限り要求されません。
- **日英多言語対応**: 設定画面から英語・日本語を即座に切り替えられます。

### 💡 クイックスタート

1. よく使う Web ページを開きます。
2. **`Option + Shift + D`**（macOS）または **`Alt + Shift + D`**（Windows / Linux）を押します。
3. `:add gh` と入力して `Enter` を押すと、現在のタブが `gh` として登録されます。
4. 次回からはパレットを開いて `gh` と入力し、`Enter` を押すだけで目的のページへジャンプできます。

### 🛠 開発方法

#### 動作要件
- Node.js & npm
- Google Chrome 135 以降

#### セットアップ＆ビルド

```bash
# 依存パッケージのインストール
npm install

# ビルド（package/js/ への出力と package.zip の生成）
npm run build
```

ローカルの Chrome に読み込む手順:
1. `chrome://extensions` を開き、右上の **デベロッパー モード** を有効にします。
2. **パッケージ化されていない拡張機能を読み込む** をクリックし、`package/` ディレクトリを選択します。

### 📄 ライセンス

本プロジェクトは MIT License のもとで公開されています。詳細は [LICENSE](LICENSE) ファイルをご覧ください。
