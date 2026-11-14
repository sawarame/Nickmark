# Contracts: ポップアップ・コマンドパレットおよびオムニボックス移行案内

**Feature**: `006-popup-command-palette`
**Created**: 2026-11-14

## 1. 共有コマンド実行契約 (`src/shared/commands.ts`)

### `executeNickmarkCommand(resolvedCommand, currentTab, options)`

オムニボックス（移行期間中）とポップアップコマンドパレットの双方から呼び出される統一コマンド実行インターフェース。

- **入力**:
  - `resolvedCommand: string` — 正規化前のコマンド文字列（`:add ...`, `:a ...`, `:addall ...`, `:aa ...`, `:open ...`, `:o ...`, `:rm ...`, `:ls`, `:prefs`, `:help`）
  - `currentTab: chrome.tabs.Tab | undefined` — コマンド実行元のアクティブタブ情報
  - `options?: { source: 'popup' | 'omnibox' }` — 呼び出し元コンテキスト
- **出力**: `Promise<CommandExecutionResult>`
  - `:ls` / `:prefs` / `:help` 実行成功時 → `{ outcome: 'executed_close' }`
  - `:add` 引数なし →
    - `source === 'popup'`: `{ outcome: 'info_prompt', message: t('errorNicknameRequired'), suggestedInput: ':add ' }`
    - `source === 'omnibox'`: `{ outcome: 'info_prompt', legacyFallbackAction: 'open_list_with_tab' }`
  - `:add <nick> ...` / `:addall <nick>` 成功時 → `{ outcome: 'success_toast', message }`
  - `:open <target>` 成功時 → `{ outcome: 'executed_close' }`（ブックマークレットのみの場合は `error`）
  - `:open <folder>` 上限超過時 → `{ outcome: 'needs_confirmation', confirmation: { folderPath, urls, nicknames, maxLimit } }`
  - `:rm <nick>` で複数 URL 存在（URL 未指定）時 →
    - `source === 'popup'`: `{ outcome: 'info_prompt', message: t('errorMultipleUrlsFound'), suggestedInput: ':rm <nick> ' }`
    - `source === 'omnibox'`: `{ outcome: 'info_prompt', message: t('errorMultipleUrlsFound'), legacyFallbackAction: 'open_list_with_msg' }`
  - `:rm` 削除成功時 → `{ outcome: 'success_toast', message }`
  - バリデーションエラー / 対象未検出 / 保存失敗時 → `{ outcome: 'error', message }`

### `executeBookmarklet(params)`

`chrome.userScripts.execute` を安全に実行し、結果を返す共有関数。

- **入力**: `{ tabId: number; tabUrl?: string; bookmarkletUrl: string; matchedTemplateUrl?: string; matchedNickname?: string }`
- **出力**: `Promise<BookmarkletExecutionResult>`
  - 禁止ページ / `userScripts` API 未許可 / コード空 / 実行エラー時は `success: false` と `errorKind`, `errorMessage` を返す。
  - 成功時はスコア更新を行い `{ success: true }` を返す。

---

## 2. コマンドパレット候補解決契約 (`src/shared/search.ts`)

### `buildPaletteSuggestions(rawQuery, bookmarks, currentTab)`

- **入力**:
  - `rawQuery: string` — 検索欄の入力文字列
  - `bookmarks: Record<string, BookmarkEntry[]>` — 現在のブックマーク辞書
  - `currentTab?: { url?: string; title?: string }` — 登録プレビュー用の現在タブ情報
- **出力**: `PaletteItem[]`
  - `rawQuery.trim()` が空の場合: 必ず `[]`（空配列）を返す。
  - `rawQuery.trimStart().startsWith(':')` の場合:
    - コマンドモードとして候補を生成する。
    - `:add ` / `:a ` 入力時、第 1 引数（ニックネーム）の補完中は既存ニックネームに加えて `extractFolders(bookmarks)` 由来の `folder/` プレフィックス候補を `kind: 'completion'` として含める（`fillText: ':add folder/'`）。
    - `:add` の実行候補（先頭行）には、第 2 引数で直接 URL が指定されている場合はその URL（タイトルは第 3 引数以降）、そうでない場合は `currentTab.url` / `currentTab.title` を用いた `previewMeta` を設定する。
  - それ以外の場合:
    - 通常検索モードとして `resolveRegularSearchMatches` およびフォルダ一致から `PaletteItem[]` を構築する。
    - 先頭スラッシュ・末尾スラッシュの正規化およびスラッシュのみ入力時の空配列ガードは既存仕様を踏襲する。

---

## 3. ポップアップキーボード・クリック操作契約 (`src/Popup.vue`)

| 操作 | 条件 | 挙動 |
|---|---|---|
| 初期起動 | ポップアップ表示時 | 検索欄へ自動フォーカス。入力空・候補リスト非表示。 |
| IME 変換確定 `Enter` | `event.isComposing \|\| event.keyCode === 229` | イベントを処理せず IME 確定のみ行う。 |
| `ArrowDown` / `Ctrl+N` | 候補が 1 件以上 | `selectedIndex` を次項目へ移動（入力欄テキストは不変）。 |
| `ArrowUp` / `Ctrl+P` | 候補が 1 件以上 | `selectedIndex` を前項目へ移動（入力欄テキストは不変）。 |
| `Tab` | 選択中候補に `fillText` あり | 検索欄の値を `fillText` に補完し、再検索する（アイコンボタンへはフォーカスしない）。 |
| `Enter` / クリック | `kind === 'completion'` | 検索欄へ `fillText` を補完して入力継続する（ただし `:add` / `:rm` の確定可能行はコマンド実行）。 |
| `Enter` / クリック | `kind === 'bookmark'` | `currentTab` 遷移＋スコア更新＋ポップアップ終了。 |
| `Cmd/Ctrl/Alt + Enter` or 同クリック | `kind === 'bookmark'` | 新規フォアグラウンドタブ（`Shift` 併用時はバックグラウンドタブ）＋スコア更新＋ポップアップ終了。 |
| `Enter` / クリック | `kind === 'bookmarklet'` | `EXECUTE_BOOKMARKLET` 実行。成功時は即クローズ、失敗時はポップアップ内エラー表示。 |
| `Enter` / クリック | `kind === 'folder'` | `openFolderUrls` 実行。上限超過時はポップアップ内確認 UI 表示、それ以外はタブを開きクローズ。 |
| `Enter` / クリック | `kind === 'command'` | `executeNickmarkCommand(..., { source: 'popup' })` を実行し、`CommandExecutionResult` に応じてフィードバック表示またはクローズ。 |
| `Esc` | 任意の状態 | 大量オープン確認中なら確認キャンセル、それ以外はポップアップを即閉じる。 |

---

## 4. Service Worker ランタイムメッセージ契約 (`src/background.ts`)

- `chrome.runtime.onMessage`:
  - `action === 'EXECUTE_BATCH_OPEN'`: 既存のフォルダ一括オープン強制実行を維持。
  - `action === 'EXECUTE_BOOKMARKLET'`: `executeBookmarklet` を呼び出し、`sendResponse(result)` で非同期応答（`return true`）。

---

## 5. オムニボックス移行案内契約 (`src/background.ts` / `package/_locales/*/messages.json`)

- **ショートカット表記関数 (`getShortcutLabel()`)**:
  - macOS 環境では `"Cmd+Shift+U"`、それ以外では `"Ctrl+Shift+U"` を返す。
- **`chrome.omnibox.onInputStarted`**:
  - デフォルトサジェストに現行検索案内とあわせてショートカット版ポップアップの利用を促す文言を設定する。
- **`chrome.omnibox.onInputChanged`**:
  - 入力が空でない場合、生成されたサジェスト配列の先頭に以下の移行案内候補を 1 件追加する（`setDefaultSuggestion` は従来の最上位マッチまたはコマンドを維持する）:
    - `content`: `OMNIBOX_MIGRATION_HINT_CONTENT`（例: `'__nickmark_popup_migration__'` ではなくオムニボックス上でユーザーが矢印移動した際に文字化け・謎コードに見えない安全な案内表現、または入力テキストの末尾ゼロ幅マーカー等、Chrome のフィルタリングで消されない値。検証により確実な値を採用する）
    - ※注意: Chrome の `omnibox` API では、`content` が `text` を含んでいなくても表示される仕様だが、ユーザーが矢印キーで移行候補にフォーカスした時にアドレスバーに不自然な文字列が出ないよう、`content` は `"Nickmark Popup (Cmd+Shift+U)"` 等の人間が読める定数トークンとし、`onInputEntered` 側で定数一致判定を行う。
    - `description`: 多言語メッセージ `omniboxMigrationSuggestion`（例: `💡 ポップアップ版（Cmd+Shift+U）をご利用ください — アドレスバー機能は将来廃止予定です`）
- **`chrome.omnibox.onInputEntered`**:
  - `text` が移行案内候補の `content` と一致した場合、URL 遷移やブックマーク操作を一切行わず、アクティブタブがスクリプト注入可能な場合のみ案内トーストを表示し、不可ページでは強制遷移せず安全に終了する。
