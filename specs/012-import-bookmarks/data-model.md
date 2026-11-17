# Data Model: ブックマークのインポート機能

**Feature**: `012-import-bookmarks` | **Date**: 2026-11-17

## 1. エンティティと型定義

既存の `BookmarkEntry` および `NickmarkData`（[types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts)）は変更せず、インポート処理用の型を新規追加する。

### 1.1 `ImportFileFormat`
インポート元ファイルの判別結果を表す列挙型。

```typescript
export type ImportFileFormat = 'json' | 'chrome_html';
```

### 1.2 `ImportApplyMode`
既存データに対するインポート適用方式を表す列挙型。

```typescript
export type ImportApplyMode = 'merge' | 'overwrite';
```

### 1.3 `ParsedImportResult`
ファイル解析・検証・正規化の結果を保持する構造体。

| フィールド | 型 | 説明 |
|---|---|---|
| `format` | `ImportFileFormat` | 検出されたファイル形式（`'json'` または `'chrome_html'`） |
| `bookmarks` | `Record<string, BookmarkEntry[]>` | 正規化・重複排除済みのインポート候補ブックマーク辞書 |
| `nicknameCount` | `number` | 抽出された一意なニックネーム数 |
| `bookmarkCount` | `number` | 抽出されたブックマークエントリ総数 |
| `skippedCount` | `number` | 無効スキームや空 URL 等によりスキップされた項目数（JSON 時は通常 `0`） |

---

## 2. フォーマット別パース・正規化ルール

### 2.1 Nickmark JSON 形式 (`format: 'json'`)
- **受け入れ構造**:
  1. 標準エクスポート形式: `{ "bookmarks": Record<string, BookmarkEntryLike[]> }`
  2. 辞書直書き形式（`bookmarks` ラッパーなし）: `Record<string, BookmarkEntryLike[]>`（ルートがプレーンオブジェクトであり、全値が配列である場合）
- **拒否対象（エラー送出）**:
  - JSON 構文エラー
  - ルートが `null`・配列・プリミティブ値
  - `{ "bookmarks": ... }` において `bookmarks` が非オブジェクトまたは配列
  - `Object.keys(bookmarks)` 内に `normalizeNicknamePath(key) === ''` となる空キーが存在する
  - いずれかのニックネーム値が配列でない、または配列要素がオブジェクトでない
  - 配列要素に非空文字列の `url` が存在しない
  - `default_value` が存在し、かつ `string` 型でない
- **欠損フィールドの補完（現在時刻 `now = Date.now()`）**:
  - `url`: `entry.url.trim()`
  - `title`: `typeof entry.title === 'string' ? entry.title : ''`
  - `score`: `typeof entry.score === 'number' && Number.isFinite(entry.score) && entry.score > 0 ? entry.score : 1.0`
  - `last_used_at`: `typeof entry.last_used_at === 'number' && Number.isFinite(entry.last_used_at) && entry.last_used_at >= 0 ? entry.last_used_at : now`
  - `created_at`: `typeof entry.created_at === 'number' && Number.isFinite(entry.created_at) && entry.created_at >= 0 ? entry.created_at : now`
  - `is_pinned`: `entry.is_pinned ? true : undefined`（`true` の場合のみ付与、または従来データ互換）
  - `default_value`: `typeof entry.default_value === 'string' && entry.default_value.trim() && isDynamicUrl(url) ? entry.default_value.trim() : undefined`（既存の `default_value` が文字列で設定されている場合は非空時保持）

### 2.2 Chrome ブックマーク HTML 形式 (`format: 'chrome_html'`)
- **検出条件**:
  - コンテンツが JSON としてパースされず、かつ `NETSCAPE-Bookmark-file-1` ヘッダまたは `<DL>` / `<A HREF=` タグを含む HTML である場合。
- **抽出・変換ルール**:
  1. `<DL>` / `<DT>` / `<H3>` / `<A>` を再帰走査してフォルダパススタック `folderStack: string[]` を維持する。
  2. `<A HREF="..." ADD_DATE="...">タイトル</A>` に対し、`HREF` のスキームを検証：
     - 許可スキーム: `^(?:https?|file|javascript):`（大文字・小文字不問）。
     - 不許可スキーム（`place:`, `about:`, `chrome:`, 空文字など）は `skippedCount++` してスキップする。
  3. ニックネームセグメント生成（`sanitizeBookmarkNicknameSegment(rawText)`）：
     - 前後空白を除去し、`/` を `-` に置換し、連続する空白文字（`\s+`）を `-` に置換し、連続ハイフン・先頭末尾ハイフンを整理する（ただし日本語などの非 ASCII 文字はそのまま保持する）。
     - タイトルが空白・空文字の場合は URL からホスト名を抽出（例: `https://github.com/user` → `github.com`）、ホスト名も取得できない場合（例: `javascript:...`）は `'bookmark'` を使用する。
  4. 結合パス: `[...folderStack, itemSegment].join('/')` を `normalizeNicknamePath` で正規化する。
  5. `BookmarkEntry` 生成：
     - `url`: デコード・trim 済みの `href`
     - `title`: `<A>` の生テキストを `.trim()` した文字列
     - `score`: `1.0`
     - `created_at` / `last_used_at`: `ADD_DATE` 属性が正の整数文字列であれば `num < 1e12 ? num * 1000 : num`、それ以外は `now`
- **拒否対象**:
  - 有効なブックマーク項目が 1 件も抽出できなかった場合（HTML として無関係なファイルや空ファイル）

---

## 3. ベースフォルダ付与とマージロジック

### 3.1 `applyBaseFolderPrefix(bookmarks, baseFolder)`
- `baseFolder` を `normalizeNicknamePath(baseFolder)` で正規化する。
- 空文字の場合は変更せず元の辞書（ディープコピー相当）を返す。
- 非空（例: `'chrome'`）の場合は、各ニックネームキー `key` を `${normalizedBase}/${key}` に変換し、`normalizeBookmarksDictionary` で再正規化・重複統合する。

### 3.2 `mergeBookmarksDictionaries(existing, incoming)`
1. `existing` の全キー・エントリをベース辞書にコピーする。
2. `incoming` の全キー・エントリを順次追加し、結合済み辞書を `normalizeBookmarksDictionary` に通す。
3. 同一ニックネーム・同一 URL（`isSameUrl`）が衝突した場合は `normalizeBookmarksDictionary` の既存ルールに従って統合する：
   - `score`: `Math.max(existing, incoming)`
   - `last_used_at`: `Math.max(existing, incoming)`
   - `created_at`: `Math.min(existing, incoming)`
   - `is_pinned`: どちらかが `true` なら `true`
   - `title` / `default_value`: 既存が空文字・未設定の場合にインポート側で補完

---

## 4. 状態遷移（`List.vue` インポートフロー）

1. **Idle**: 通常の一覧表示状態。
2. **File Selected → Parsing**: ユーザーがファイルを選択。`FileReader` / `file.text()` で読み込み、`parseImportFileContent(text, file.name)` を実行。
   - 解析失敗時 → エラー種別に応じた多言語 `Toast` を表示して Idle へ戻る（`input.value = ''`）。
3. **Preview & Confirmation (`showImportDialog = true`)**:
   - 解析結果（形式、ファイル名、件数、スキップ件数）を表示。
   - `importMode`: `'merge'`（デフォルト）または `'overwrite'` を選択。
   - `importBaseFolder`: 任意のベースフォルダプレフィックス入力（主に HTML 時、または任意で利用可能）。
4. **Executing & Saving**:
   - `applyBaseFolderPrefix` を適用。
   - `importMode === 'merge'` なら `mergeBookmarksDictionaries(bookmarksData.value, prefixedBookmarks)`、`'overwrite'` なら `prefixedBookmarks` を作成。
   - `await saveBookmarksData(nextBookmarks)` を実行。
     - 成功時: `bookmarksData.value`（`loadBookmarks(true)` 等）と `selectedFolder`（存在しないフォルダを選択中なら `'__ALL__'` へリセット）を更新し、ダイアログを閉じ、完了 `Toast` を表示。
     - 失敗時（例: `QUOTA_EXCEEDED`）: `getSaveErrorMessage(err)` でエラー `Toast` を表示し、ストレージおよびメモリ上の `bookmarksData.value` は一切変更しない。
