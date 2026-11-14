# Data Model: ポップアップのコマンドパレット化とオムニボックス移行案内

**Feature**: `006-popup-command-palette`
**Created**: 2026-11-14

## 1. 既存永続データモデル（変更なし）

ストレージに永続化されるデータスキーマは既存の `src/shared/types.ts` をそのまま維持し、完全な後方互換性を保つ。

- **`BookmarkEntry`**: `url`, `title`, `score`, `last_used_at`, `created_at`, `is_pinned?`, `default_value?`
- **`NickmarkData`**: `{ bookmarks: Record<string, BookmarkEntry[]> }`
- **`FolderInfo`**: `path`, `name`, `depth`, `nicknames`, `openableUrlCount`
- **`BatchOpenResult`**: `success`, `openedCount`, `totalCount`, `requiresConfirmation?`, `folderPath?`, `urls?`, `nicknames?`, `error?`

---

## 2. コマンドパレット候補モデル (`src/shared/types.ts` / `src/shared/search.ts`)

### `PaletteItemKind`
ポップアップ候補リストの種別を識別する列挙型（文字列リテラルユニオン）。

```typescript
export type PaletteItemKind =
  | 'bookmark'      // 通常URLまたは動的URL(%s)のブックマーク
  | 'bookmarklet'   // javascript: ブックマークレット
  | 'folder'        // フォルダ一括オープン候補 (work/)
  | 'command'       // 実行可能なコマンド (:add, :addall, :open, :rm, :ls, :prefs, :help)
  | 'completion';   // 入力補完候補（:add のフォルダ/ニックネーム候補など、選択またはTab補完で続きを入力）
```

### `PaletteItem`
コマンドパレットのリスト 1 行を表す構造化データ。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | `string` | ○ | Vue リスト描画用の一意キー |
| `kind` | `PaletteItemKind` | ○ | 候補の種別 |
| `title` | `string` | ○ | 主見出し（ブックマークタイトル、コマンド説明、フォルダ名等） |
| `subtitle` | `string` | ○ | 補助テキスト（表示用 URL、対象タブのプレビュー URL、説明文等） |
| `badge` | `string` | - | ニックネームまたはコマンドラベル（例: `gh`, `work/`, `:add`） |
| `typeTag` | `string` | - | 種別タグ（例: `[JS]`, `[%s]`, `📁 5 tabs`） |
| `isPinned` | `boolean` | - | ピン留めアイコン表示フラグ |
| `faviconUrl` | `string` | - | 通常 URL の場合に `_favicon/` から生成した画像 URL |
| `fillText` | `string` | ○ | `Tab` キー押下時に検索入力欄へ補完される文字列 |
| `executeValue` | `string` | ○ | 確定実行時に渡されるコマンド文字列または解決済み URL |
| `matchTarget` | `SuggestedMatchTarget` | - | 通常ブックマーク / ブックマークレット実行時のスコア更新用情報 |
| `folderPath` | `string` | - | `kind === 'folder'` の場合の対象フォルダパス |
| `previewMeta` | `AddPreviewMeta` | - | `:add` プレビュー用の登録対象情報（対象タイトル・対象 URL・モード） |

### `AddPreviewMeta`
`:add` / `:a` コマンド入力中に表示する登録対象プレビュー情報。

| フィールド | 型 | 説明 |
|---|---|---|
| `mode` | `'currentTab' \| 'directUrl' \| 'bookmarklet'` | 登録種別 |
| `nickname` | `string` | 正規化後の入力ニックネーム（未入力時は空文字） |
| `targetUrl` | `string` | 登録予定の URL またはブックマークレットコード |
| `targetTitle` | `string` | 登録予定のタイトル（カスタムタイトルまたは現在タブのタイトル） |

---

## 3. コマンド実行結果・フィードバックモデル (`src/shared/commands.ts`)

### `TabDisposition`
ブックマークを開く際のタブ遷移方法。

```typescript
export type TabDisposition = 'currentTab' | 'newForegroundTab' | 'newBackgroundTab';
```

### `CommandExecutionOutcome`
共通コマンド実行関数が返す実行ステータス。

| 値 | 説明 | ポップアップ側の振る舞い | オムニボックス側の振る舞い |
|---|---|---|---|
| `'executed_close'` | 画面遷移や `:open` が完了し即時終了可能 | `window.close()` で即閉じる | 何もしない（エラー時のみトースト） |
| `'success_toast'` | 登録・更新・削除が成功しメッセージ表示が必要 | パレット内に成功通知を表示し、短時間後に自動クローズ | 対象タブへ `showToast()` |
| `'info_prompt'` | 引数不足（`:add` 空等）や `:rm` 複数 URL 選択待ち | ポップアップを維持し、インライン案内表示＋入力値調整（必要時） | 従来通り管理画面遷移または `showToast()` |
| `'needs_confirmation'` | フォルダ一括オープンが安全上限を超過 | ポップアップ内に確認ダイアログを表示 | ページ内モーダル注入または管理画面フォールバック |
| `'error'` | バリデーションエラーや対象未検出 | ポップアップを維持し、エラーバナーを表示 | 対象タブへ `showToast()` |

### `CommandExecutionResult`

| フィールド | 型 | 説明 |
|---|---|---|
| `outcome` | `CommandExecutionOutcome` | 実行ステータス |
| `message` | `string` | ユーザー向けロケール済みメッセージ |
| `suggestedInput` | `string` | `info_prompt` 時に検索欄へ補完・維持したい文字列（任意） |
| `confirmation` | `BatchOpenConfirmationData` | `needs_confirmation` 時のフォルダ・URL・件数情報 |
| `legacyFallbackAction` | `'open_list_with_tab' \| 'open_list_with_msg'` | オムニボックス互換用のフォールバック種別（任意） |

### `PopupFeedbackState` (UI 状態)
`src/Popup.vue` が保持するリアクティブ状態。

- `query: string` — 検索入力文字列
- `items: PaletteItem[]` — 現在の候補リスト（`query.trim()` が空なら常に空配列）
- `selectedIndex: number` — ハイライト中の候補インデックス（`-1` または `0..items.length-1`）
- `feedback: { severity: 'success' | 'info' | 'warn' | 'error'; message: string } | null` — ポップアップ内通知
- `pendingBatchConfirm: { folderPath: string; urls: string[]; nicknames: string[]; maxLimit: number } | null` — フォルダ大量オープン確認状態
- `isExecuting: boolean` — 二重送信防止フラグ

---

## 4. Service Worker - Popup 間メッセージモデル

```typescript
export type RuntimeMessage =
  | {
      action: 'EXECUTE_BATCH_OPEN';
      payload: { folderPath: string; urls: string[]; nicknames: string[] };
    }
  | {
      action: 'EXECUTE_BOOKMARKLET';
      payload: {
        tabId: number;
        tabUrl?: string;
        bookmarkletUrl: string;
        matchedTemplateUrl?: string;
        matchedNickname?: string;
      };
    };
```

`EXECUTE_BOOKMARKLET` のレスポンス型：

```typescript
export interface BookmarkletExecutionResult {
  success: boolean;
  errorKind?: 'restricted' | 'not_allowed' | 'empty' | 'failed';
  errorMessage?: string;
}
```
