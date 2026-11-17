---

description: "Task list for bookmark import feature (Issue #23)"
---

# Tasks: ブックマークのインポート機能

**Input**: Design documents from `/specs/012-import-bookmarks/`
**Prerequisites**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/plan.md), [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/spec.md), [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/research.md), [data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/data-model.md), [import-bookmarks-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/contracts/import-bookmarks-contract.md), [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/quickstart.md)

**Tests**: 本リポジトリには独立したテストフレームワークが導入されていないため、ビルド検証（`npm run build` による TypeScript コンパイル・Webpack バンドル検証）、共有純粋ロジックの Node.js 検証、および [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/quickstart.md) に基づく実機確認手順を実施する。

**Organization**: タスクは各ユーザーストーリーを独立して実装・検証できるよう、優先順位（P1 → P2）に沿ってフェーズ分割している。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルを対象とし、未完了タスクへの依存がないため並列実行可能
- **[Story]**: 対応する User Story（`[US1]`, `[US2]`, `[US3]`）
- すべてのタスク説明に正確な対象ファイルパスを明記している

---

## Phase 1: Setup（多言語メッセージリソース準備）

**Purpose**: インポートボタン、確認ダイアログ、オプション入力、適用方式、成功・エラー通知文言の日本語・英語リソースを整備する。

- [x] T001 [P] Add Japanese import UI, confirmation dialog, and error/success i18n keys (`importBtn`, `importDialogTitle`, `importFileInfoLabel`, `importFormatLabel`, `importFormatJson`, `importFormatChromeHtml`, `importSummaryCount`, `importSkippedSummary`, `importBaseFolderLabel`, `importBaseFolderPlaceholder`, `importModeLabel`, `importModeMergeLabel`, `importModeOverwriteLabel`, `importOverwriteWarning`, `importExecuteBtn`, `successImported`, `successImportedDetail`, `errorImportEmptyFile`, `errorImportNoValidBookmarks`, `errorImportInvalidHtml`, `errorImportInvalidEntry`) in package/_locales/ja/messages.json
- [x] T002 [P] Add English import UI, confirmation dialog, and error/success i18n keys matching `ja/messages.json` in package/_locales/en/messages.json

---

## Phase 2: Foundational（共有型・共通サマリー・マージ基盤）

**Purpose**: 全ユーザーストーリーで共有するインポート型定義、エラークラス、ベースフォルダ付与、およびマージ・サマリー集計関数を構築する。

**⚠️ CRITICAL**: Phase 3 以降のユーザーストーリー実装は本フェーズ完了後に開始すること。

- [x] T003 Add `ImportFileFormat` (`'json' | 'chrome_html'`), `ImportApplyMode` (`'merge' | 'overwrite'`), and `ParsedImportResult` (`format`, `bookmarks`, `nicknameCount`, `bookmarkCount`, `skippedCount`) with Japanese JSDoc in src/shared/types.ts
- [x] T004 Create `src/shared/bookmarkImport.ts` defining `BookmarkImportError` (`EMPTY_FILE`, `INVALID_JSON_FORMAT`, `INVALID_JSON_STRUCTURE`, `INVALID_BOOKMARK_ENTRY`, `INVALID_HTML_BOOKMARKS`, `NO_VALID_BOOKMARKS`), `countBookmarksSummary()`, `applyBaseFolderPrefix()`, and `mergeBookmarksDictionaries()` (leveraging `normalizeBookmarksDictionary` for deduplication and non-destructive metadata merge) with Japanese JSDoc in src/shared/bookmarkImport.ts (depends on T003)
- [x] T005 [P] Re-export `./shared/bookmarkImport` from src/background.ts (depends on T004)

**Checkpoint**: 多言語リソース、インポート関連型、サマリー集計・ベースフォルダ付与・マージ基盤が整い、各フォーマットおよび UI 実装に進める状態。

---

## Phase 3: User Story 1 - Nickmark エクスポート JSON ファイルからのインポート（マージ・上書き選択） (Priority: P1) 🎯 MVP

**Goal**: 管理画面の「インポート」ボタンから Nickmark エクスポート JSON（または辞書直書き JSON）を読み込み、プレビュー確認ダイアログで「マージ」または「上書き」を選択して安全にインポートできるようにする。

**Independent Test**: 管理画面からエクスポートした JSON ファイル（および一部フィールド省略 JSON）を選択し、プレビュー確認ダイアログで「マージ」と「上書き」それぞれを実行して、一覧テーブルとストレージに正しく反映されることを単独で検証できる。

### Implementation for User Story 1

- [x] T006 [US1] Implement `parseNickmarkBookmarksJson()` (validating `{ bookmarks: ... }` or direct dictionary structure, rejecting invalid root/non-array/empty nickname/missing non-empty `url`/non-string `default_value`, defaulting missing `title`/`score`/`created_at`/`last_used_at`, and normalizing via `normalizeBookmarksDictionary`) and `parseImportFileContent()` JSON branch in src/shared/bookmarkImport.ts (depends on T004)
- [x] T007 [US1] Add import state (`showImportDialog`, `importPreview`, `importMode`, `importBaseFolder`, `isImporting`, `importFileInputRef`), file selection trigger/handler (`triggerImportFile`, `handleImportFileSelected`), and confirmation/apply handler (`executeImport`, updating `selectedFolder` when needed and skipping `onWindowFocusOrVisible` reload while `showImportDialog` is open) in src/List.vue (depends on T001, T002, T006)
- [x] T008 [US1] Render the `Import` `Button` (`pi-upload`) next to `Export` in the Manage Nickmarks card header, hidden `<input type="file" accept=".json,.html,.htm,application/json,text/html">`, and PrimeVue `Dialog` with file/format/count summary, `RadioButton` mode selector (`merge` / `overwrite`), optional base folder `InputText`, overwrite `Message` warning, and `Run Import` `Button` in src/List.vue (depends on T007)

**Checkpoint**: User Story 1（MVP）が完成し、JSON ファイルのインポート（マージ・上書き選択）を単独で検証できる状態。

---

## Phase 4: User Story 2 - Chrome 標準ブックマーク HTML ファイルからのインポート (Priority: P1)

**Goal**: Chrome 標準ブックマーク HTML ファイルを読み込み、フォルダ階層（`<H3>`）とリンクタイトル（`<A HREF>`）から `/` 区切りのサニタイズ済みニックネームとブックマークエントリを自動生成してインポートできるようにする。

**Independent Test**: 複数階層のフォルダ、通常 URL、ブックマークレット、空白入りタイトル、空タイトル、HTML エンティティ、および `place:` 等のスキップ対象スキームを含む Chrome ブックマーク HTML ファイルを選択し、プレビュー件数・スキップ件数表示と取り込み結果（任意ベースフォルダ指定含む）を単独で検証できる。

### Implementation for User Story 2

- [x] T009 [US2] Implement `sanitizeBookmarkNicknameSegment()` (replacing `/` and whitespace sequences with `-`, trimming leading/trailing hyphens) and helper functions (URL hostname fallback, `'bookmark'` fallback, `ADD_DATE` conversion to milliseconds, allowed scheme check `http://` / `https://` / `file://` / `javascript:`) in src/shared/bookmarkImport.ts (depends on T004)
- [x] T010 [US2] Implement `parseChromeBookmarksHtml()` using `DOMParser` (`text/html`) with container-agnostic `<DL>` / `<DT>` / `<H3>` / `<A>` recursive traversal (`pendingFolderName` propagation), throwing `BookmarkImportError('INVALID_HTML_BOOKMARKS')` or `BookmarkImportError('NO_VALID_BOOKMARKS')` when invalid/empty, and integrate HTML detection into `parseImportFileContent()` in src/shared/bookmarkImport.ts (depends on T009)
- [x] T011 [US2] Wire HTML format label (`importFormatChromeHtml`), skipped count notice (`importSkippedSummary`), and real-time base folder preview summary in the import confirmation dialog of src/List.vue (depends on T008, T010)

**Checkpoint**: JSON と Chrome ブックマーク HTML の双方をインポート可能となり、すべての主要インポート機能が完結した状態。

---

## Phase 5: User Story 3 - 不正データの検証・同期容量ガードおよび多言語・操作保護 (Priority: P2)

**Goal**: 不正ファイル・同期 100KB 容量超過・連続ファイル再選択・フォーカス復帰やインライン編集中との競合において既存データを確実に保護し、日英多言語メッセージを一貫して提供する。

**Independent Test**: 構文エラー JSON・空ファイル・無効 HTML・100KB 超同期インポート・ダイアログキャンセル後の同一ファイル再選択を実行し、エラー通知の正確さ、既存データの不変性、および日英切り替え時の UI 追従を検証できる。

### Implementation for User Story 3

- [x] T012 [US3] Implement localized `BookmarkImportError` message mapping in `src/List.vue`, ensure `input.value = ''` reset in `finally` for re-selecting the same file, commit or cancel active `inlineEdit` before applying import, and wrap `saveBookmarksData` in `try/catch` using `getSaveErrorMessage` so `QUOTA_EXCEEDED` leaves existing data untouched in src/List.vue (depends on T008, T011)
- [x] T013 [US3] Add `<style scoped>` styling for the import confirmation dialog layout (summary panel, radio group, base folder field, overwrite warning spacing) using PrimeVue semantic CSS variables (`var(--p-text-color)`, `var(--p-text-muted-color)`, `var(--p-content-border-color)` 等) supporting both light and dark modes in src/List.vue (depends on T008)

**Checkpoint**: すべてのユーザーストーリー（US1〜US3）について安全性・UI 統一性・多言語対応が揃った状態。

---

## Phase 6: Polish & Cross-Cutting Concerns（ドキュメント同期・ビルド・検証）

**Purpose**: プロジェクト基盤ドキュメントの同期、ビルドチェック、およびロジック検証を完了する。

- [x] T014 [P] Synchronize `.context/spec.md` (update Section E/G to document JSON & Chrome Bookmark HTML import with merge/overwrite dialog and base folder option) and `.context/tech_stack.md` (document `src/shared/bookmarkImport.ts`)
- [x] T015 Run `npm run build` and verify TypeScript compilation, `package/js/` bundle output, and `package.zip` generation without errors (depends on T005, T012, T013, T014)
- [x] T016 Run verification script against compiled/TS logic in `src/shared/bookmarkImport.ts` covering JSON round-trip, partial JSON field defaults, Chrome HTML `<DL>`/`<DT>`/`<H3>`/`<A>` nested folder parsing (both `<DL>` inside `<DT>` and sibling `<DL>`), scheme filtering, base folder prefixing, merge deduplication, and error cases, plus verify `package/_locales/{ja,en}/messages.json` JSON validity (depends on T015)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — `T001`, `T002` は並列実行可能
- **Foundational (Phase 2)**: `T003` → `T004` → `T005` の順に完了させる（`T001`, `T002` と並列進行可能）
- **User Story 1 (Phase 3 - P1)**: `T001`, `T002`, `T004` 完了後に `T006` → `T007` → `T008`
- **User Story 2 (Phase 4 - P1)**: `T004` 完了後に `T009` → `T010`、および `T008`・`T010` 完了後に `T011`
- **User Story 3 (Phase 5 - P2)**: `T008`・`T011` 完了後に `T012`, `T013`
- **Polish (Phase 6)**: `T014` → `T015` → `T016`

### Parallel Opportunities

- `T001` と `T002`（日英ロケールファイル）は並列編集可能
- `T005`（`src/background.ts`）と `T006`・`T009`（`src/shared/bookmarkImport.ts` のパーサー追加）は役割が分離されているが、`bookmarkImport.ts` 内の編集順序は順次実行する
- `T014`（`.context/` ドキュメント同期）は実装完了後いつでも並列実施可能

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1（多言語キー）+ Phase 2（共有型・`bookmarkImport.ts` 基盤）を完了
2. Phase 3（JSON インポート + 確認ダイアログ + マージ/上書き）を実装して JSON ラウンドトリップを確認
3. Phase 4（Chrome ブックマーク HTML パーサー + ダイアログ連携）を追加
4. Phase 5（エラーハンドリング・100KB クォータ保護・ダーク/ライトモード対応スタイル）を仕上げ
5. Phase 6（ドキュメント同期・`npm run build`・検証スクリプト実行）で完了
