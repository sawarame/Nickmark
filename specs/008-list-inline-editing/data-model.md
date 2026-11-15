# Data Model: 管理画面一覧の列幅固定・URL省略表示およびインライン編集化

**Feature**: `008-list-inline-editing` | **Date**: 2026-11-15 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/spec.md)

## 1. 永続化エンティティ（既存スキーマ・変更なし）

ストレージ層（[types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts) / [storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts)）のデータスキーマは変更しない。

### `BookmarkEntry`
| フィールド | 型 | 必須 | 説明 |
| ---------- | -- | ---- | ---- |
| `url` | `string` | 必須 | 遷移先 URL、動的 URL（`%s` 含む）、またはブックマークレット（`javascript:`） |
| `title` | `string` | 必須（空文字許容） | ブックマークのタイトル |
| `default_value` | `string \| undefined` | 任意 | 動的 URL（`%s`）で引数省略時に使用するデフォルト値（非動的 URL 保存時は削除） |
| `score` | `number` | 必須 | 指数減衰スコア |
| `last_used_at` | `number` | 必須 | 最終使用タイムスタンプ（ms） |
| `created_at` | `number` | 必須 | 作成タイムスタンプ（ms） |
| `is_pinned` | `boolean \| undefined` | 任意 | ピン留め状態 |

### `NickmarkData`
- `{ bookmarks: Record<string, BookmarkEntry[]> }` 形式（キーが正規化済みニックネーム）。

---

## 2. 管理画面（`List.vue`）インライン編集状態モデル

従来の編集ダイアログ用 `EditBookmarkForm` および `showEditDialog` を廃止し、以下の状態モデルに置き換える。

### `InlineEditField`
インライン編集可能な列の種別を表すユニオン型。
```typescript
type InlineEditField = 'nickname' | 'title' | 'url';
```

### `InlineEditState`
現在インライン編集中のセルおよび下書き入力値を保持する状態。同時に最大 1 つのセルのみがアクティブになる（`null` のときは非編集中）。

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| `originalNickname` | `string` | 編集開始時点の行が属するニックネームキー |
| `originalUrl` | `string` | 編集開始時点の行の URL（`originalNickname` と組み合わせて行を一意識別） |
| `field` | `InlineEditField` | 編集中のフィールド（`'nickname' \| 'title' \| 'url'`） |
| `originalTitle` | `string` | 編集開始時点のタイトル（変更有無判定用） |
| `originalDefaultValue` | `string` | 編集開始時点のデフォルト値（変更有無判定用） |
| `draftValue` | `string` | テキストエリアに入力中の値（対象 `field` に対応） |
| `draftDefaultValue` | `string` | `field === 'url'` 時にあわせて編集する `default_value` の入力値 |
| `score` | `number` | 対象エントリの既存スコア保持用 |
| `last_used_at` | `number` | 対象エントリの既存最終使用日時保持用 |
| `created_at` | `number` | 対象エントリの既存作成日時保持用 |
| `is_pinned` | `boolean` | 対象エントリの既存ピン留め状態保持用 |

---

## 3. 状態遷移とバリデーションルール

### 状態遷移図

```text
[通常表示]
   │  セルクリック（nickname / title / url）
   ▼
[インライン編集中 (inlineEdit !== null)]
   ├── Escape キー ──────────────────────────────► [通常表示]（変更破棄・保存なし）
   ├── 同一セル内フォーカス移動 (URL ↔ デフォルト値) ─► [インライン編集中]（継続）
   └── focusout（外部へ移動）または Enter（非 IME）
          │
          ├─ 変更なし判定 ───────────────────────► [通常表示]（保存・通知スキップ）
          │
          ├─ バリデーション NG（空値／URL重複） ───► [通常表示]（エラーToast表示・元の値を維持）
          │
          └─ バリデーション OK & ストレージ保存
                 ├─ 成功 ────────────────────────► [通常表示]（一覧反映・成功Toast表示）
                 └─ 保存エラー（容量超過等） ────► [通常表示]（スナップショット復元・エラーToast表示）
```

### バリデーションルール

1. **ニックネーム（`field === 'nickname'`）**:
   - `normalizeNicknamePath(draftValue)` が空文字 `""` の場合は拒否（`errorNicknameUrlRequired`）。
   - `newNickname !== normalizeNicknamePath(originalNickname)` のとき、移動先 `bookmarksData[newNickname]` に `isSameUrl(b.url, originalUrl)` なエントリが既に存在する場合は重複エラー（`errorUrlExists`）。
2. **タイトル（`field === 'title'`）**:
   - 空文字を許容（`draftValue.trim()` を保存）。改行が含まれていた場合は保存前に空白置換またはトリム対象として単一行相当に整える（仕様上 `Enter` による改行入力は不可）。
3. **URL（`field === 'url'`）**:
   - `draftValue.trim()` が空文字 `""` の場合は拒否（`errorNicknameUrlRequired`）。
   - `!isSameUrl(originalUrl, newUrl)` のとき、同一ニックネーム配下の他エントリと `isSameUrl` で重複する場合は拒否（`errorUrlExists`）。
   - `isDynamicUrl(newUrl)` が `true` の場合は `draftDefaultValue.trim()` を保持（空なら `default_value` プロパティを省略）、`false` の場合は `default_value` を削除して保存する。
4. **他画面イベントとの排他**:
   - `inlineEdit !== null` の間、`onWindowFocusOrVisible` による自動 `loadBookmarks(true)` をスキップし、編集中の入力保護を行う。
   - `hasAnyBookmarklet` 判定にも `inlineEdit?.field === 'url' && isBookmarkletUrl(inlineEdit.draftValue)` を含める。
