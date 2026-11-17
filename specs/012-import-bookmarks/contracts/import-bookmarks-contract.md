# Contracts: ブックマークのインポート機能

**Feature**: `012-import-bookmarks` | **Date**: 2026-11-17

## 1. モジュール契約 (`src/shared/bookmarkImport.ts`)

```typescript
export type ImportFileFormat = 'json' | 'chrome_html';
export type ImportApplyMode = 'merge' | 'overwrite';

export interface ParsedImportResult {
  format: ImportFileFormat;
  bookmarks: Record<string, BookmarkEntry[]>;
  nicknameCount: number;
  bookmarkCount: number;
  skippedCount: number;
}

export class BookmarkImportError extends Error {
  readonly code:
    | 'EMPTY_FILE'
    | 'INVALID_JSON_FORMAT'
    | 'INVALID_JSON_STRUCTURE'
    | 'INVALID_BOOKMARK_ENTRY'
    | 'INVALID_HTML_BOOKMARKS'
    | 'NO_VALID_BOOKMARKS';
  readonly detailParam?: string;
}
```

### エクスポート関数契約
1. `sanitizeBookmarkNicknameSegment(rawText: string): string`
   - `/` および連続空白を `-` に変換し、前後の `-` や空白を除去した単一セグメントを返す。
2. `parseNickmarkBookmarksJson(jsonText: string, now?: number): ParsedImportResult`
   - `{ bookmarks: ... }` または直接の辞書 JSON を検証・正規化・補完して返す。不正時は `BookmarkImportError` をスローする。
3. `parseChromeBookmarksHtml(htmlText: string, now?: number): ParsedImportResult`
   - Chrome ブックマーク HTML を解析してフォルダ階層付きの `ParsedImportResult` を返す。有効項目 0 件時は `BookmarkImportError('NO_VALID_BOOKMARKS')`（または非ブックマーク HTML 時は `'INVALID_HTML_BOOKMARKS'`）をスローする。
4. `parseImportFileContent(content: string, fileName?: string, now?: number): ParsedImportResult`
   - 内容およびファイル拡張子から JSON / Chrome HTML を自動判別して適切なパーサーへ委譲する。
5. `applyBaseFolderPrefix(bookmarks: Record<string, BookmarkEntry[]>, baseFolder: string): Record<string, BookmarkEntry[]>`
   - 空でない `baseFolder` が指定された場合、全ニックネームにプレフィックスを付与して正規化する。
6. `mergeBookmarksDictionaries(existing: Record<string, BookmarkEntry[]>, incoming: Record<string, BookmarkEntry[]>): Record<string, BookmarkEntry[]>`
   - 既存データとインポートデータを非破壊で統合し、`normalizeBookmarksDictionary` で重複排除する。
7. `countBookmarksSummary(bookmarks: Record<string, BookmarkEntry[]>): { nicknameCount: number; bookmarkCount: number }`
   - ニックネーム数とブックマーク総件数を集計する。

---

## 2. UI 契約 (`src/List.vue`)

- **インポートトリガーボタン**:
  - 配置: 「ニックネーム管理（Manage Nickmarks）」カードヘッダーの右端アクション群（`エクスポート` ボタンの左隣）。
  - PrimeVue `Button`: `icon="pi pi-upload"`, `severity="secondary"`, `size="small"`, `:label="t('importBtn') || 'Import'"`。
  - 隠し `<input type="file" accept=".json,.html,.htm,application/json,text/html">` と連動し、選択処理後（成功・失敗問わず）に `value = ''` をリセットする。
- **インポート確認ダイアログ (`PrimeVue Dialog`)**:
  - `showImportDialog` (`v-model:visible="showImportDialog"`, `modal`, `width: 560px`, `maxWidth: 92vw`)。
  - 表示内容:
    - ファイル名、検出形式ラベル（`Nickmark JSON` / `Chrome Bookmark HTML`）、ニックネーム数・ブックマーク件数（および `skippedCount > 0` 時のスキップ件数）。
    - ベースフォルダプレフィックス入力欄（`InputText`、任意入力、`placeholder` 付き）。入力時、実際に登録されるニックネーム数・ブックマーク件数のプレビューまたはプレフィックス例を維持する。
    - 適用方式選択（PrimeVue `RadioButton` 2 択）:
      - `merge`: 「マージ（既存データを保持して追加・統合）」［初期選択］
      - `overwrite`: 「上書き（現在のブックマークをすべて置換）」
    - `importMode === 'overwrite'` かつ既存ブックマークが 1 件以上ある場合、`Message severity="warn"` で警告を表示する。
  - フッターボタン:
    - キャンセル (`severity="secondary" text`)
    - インポート実行 (`:severity="importMode === 'overwrite' ? 'danger' : 'primary'"`)
- **フォーカス復帰ガード**:
  - `onWindowFocusOrVisible` では `showImportDialog.value === true` の場合も自動再読込をスキップする。

---

## 3. 多言語メッセージキー契約 (`package/_locales/{ja,en}/messages.json`)

| キー | 日本語 (`ja`) | 英語 (`en`) |
|---|---|---|
| `importBtn` | `インポート` | `Import` |
| `importDialogTitle` | `ブックマークのインポート` | `Import Bookmarks` |
| `importFileInfoLabel` | `対象ファイル` | `Source File` |
| `importFormatLabel` | `検出形式` | `Detected Format` |
| `importFormatJson` | `Nickmark JSON` | `Nickmark JSON` |
| `importFormatChromeHtml` | `Chrome ブックマーク HTML` | `Chrome Bookmarks HTML` |
| `importSummaryCount` | `$1 件のブックマーク（$2 ニックネーム）` | `$1 bookmarks ($2 nicknames)` |
| `importSkippedSummary` | `内部URL等 $1 件は対象外としてスキップされます` | `$1 non-navigable item(s) will be skipped` |
| `importBaseFolderLabel` | `取り込み先フォルダ（任意）` | `Destination Folder (Optional)` |
| `importBaseFolderPlaceholder` | `例: imported（空欄時は元の階層を使用）` | `e.g. imported (keep original hierarchy if empty)` |
| `importModeLabel` | `インポート方法` | `Import Mode` |
| `importModeMergeLabel` | `マージ（既存データを保持して追加・統合）` | `Merge (keep existing & add/combine)` |
| `importModeOverwriteLabel` | `上書き（現在のブックマークをすべて置換）` | `Overwrite (replace all existing bookmarks)` |
| `importOverwriteWarning` | `上書きを実行すると、現在登録されている $1 件のブックマークはすべて消去され、インポート内容に置き換わります。` | `Overwriting will replace all $1 existing bookmark(s) with the imported data.` |
| `importExecuteBtn` | `インポート実行` | `Run Import` |
| `successImported` | `インポート完了` | `Imported` |
| `successImportedDetail` | `$1 件のブックマークをインポートしました（合計 $2 件）。` | `Imported $1 bookmark(s) (Total: $2).` |
| `errorImportEmptyFile` | `選択されたファイルが空です。` | `The selected file is empty.` |
| `errorImportNoValidBookmarks` | `インポート可能なブックマークが見つかりませんでした。` | `No valid bookmarks found to import.` |
| `errorImportInvalidHtml` | `有効なブックマーク HTML ファイルとして読み込めませんでした。` | `Could not parse as a valid bookmark HTML file.` |
| `errorImportInvalidEntry` | `ブックマークデータの形式が不正です（$1）。` | `Invalid bookmark entry data ($1).` |
