---

description: "Task list for 管理画面一覧の列幅固定・URL省略表示およびインライン編集化"
---

# Tasks: 管理画面一覧の列幅固定・URL省略表示およびインライン編集化

**Input**: Design documents from `/specs/008-list-inline-editing/`
**Prerequisites**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/plan.md), [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/spec.md), [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/research.md), [data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/data-model.md), [list-inline-editing-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/contracts/list-inline-editing-contract.md)

**Tests**: 本機能の仕様書では自動テストの追加は要求されていないため、テストタスクは省略し、`npm run build` によるコンパイル・バンドル検証および [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/quickstart.md) に基づく実機検証を行う。

**Organization**: ユーザーストーリー（US1, US2, US3）単位で独立して実装・検証できるようフェーズを分割している。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルへの独立した変更であり並列実行可能
- **[Story]**: 対応するユーザーストーリー（`[US1]`, `[US2]`, `[US3]`）

---

## Phase 1: Setup（多言語リソースの準備）

**Purpose**: インライン編集および操作列の「新しいタブで開く」ボタンに必要な日英ロケール文言を準備する。

- [ ] T001 [P] Add `openInNewTabTooltip` ("新しいタブで開く") and `deleteBookmarkTooltip` ("削除") keys in `package/_locales/ja/messages.json`
- [ ] T002 [P] Add `openInNewTabTooltip` ("Open in new tab") and `deleteBookmarkTooltip` ("Delete") keys in `package/_locales/en/messages.json`

---

## Phase 2: Foundational（インライン編集状態モデル・既存ダイアログ廃止基盤）

**Purpose**: 従来の編集ポップアップ（ダイアログ）を撤去し、全ユーザーストーリーの土台となる単一アクティブなインライン編集状態管理を `src/List.vue` に構築する。

**⚠️ CRITICAL**: 本フェーズ完了後に US1〜US3 の UI・操作実装を進める。

- [ ] T003 Import PrimeVue `Textarea` (`primevue/textarea`) and Vue `nextTick`, and remove `EditBookmarkForm`, `showEditDialog`, `editBookmarkData`, `openEditDialog`, `saveEditBookmark`, and the edit `Dialog` markup in `src/List.vue`
- [ ] T004 Define `InlineEditField` (`'nickname' | 'title' | 'url'`), `InlineEditState` (`originalNickname`, `originalUrl`, `field`, `originalTitle`, `originalDefaultValue`, `draftValue`, `draftDefaultValue`, `score`, `last_used_at`, `created_at`, `is_pinned`), reactive `inlineEdit` / `inlineEditWrapperRef` / `isClosingInlineEdit`, and update `onWindowFocusOrVisible` (skip reload when `inlineEdit !== null`) and `hasAnyBookmarklet` (check `inlineEdit?.field === 'url' && isBookmarkletUrl(inlineEdit.draftValue)`) in `src/List.vue`

**Checkpoint**: 編集モーダルが撤去され、インライン編集状態モデルの基盤が整った状態。

---

## Phase 3: User Story 1 - 一覧テーブルの固定幅レイアウトと長い URL の省略表示 (Priority: P1) 🎯 MVP

**Goal**: 一覧テーブルの各列幅をデータ内容に依存せず固定化し、幅を超える URL（通常 URL およびブックマークレット）を 1 行で「...」省略表示＋ホバー全文表示する。

**Independent Test**: 短い文字列から 200 文字超の長大な URL・ブックマークレットまで混在するデータを表示し、ページングやフォルダ絞り込み切り替え時に列幅が 0px 変動せず、URL 列が 1 行 `...` で省略されホバー時に `:title` で全文確認できることを検証する。

### Implementation for User Story 1

- [ ] T005 [US1] Apply `table-layout: fixed; width: 100%; min-width: 820px;` to `DataTable` and set fixed column widths (`nickname`: `180px`, `title`: `220px`, `url`: remaining fluid width >= `244px`, `is_pinned`: `72px`, `actions`: `104px`) in `src/List.vue`
- [ ] T006 [US1] Style `nickname` and `title` cells with `overflow-wrap: anywhere`, and enforce single-line ellipsis truncation (`min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`) with `:title="slotProps.data.url"` tooltip on both regular URLs and bookmarklets in `src/List.vue`

**Checkpoint**: User Story 1 が単独で機能し、固定列幅と URL の 1 行省略表示が確認できる状態。

---

## Phase 4: User Story 2 - ポップアップ廃止とクリックによるインライン編集・フォーカスアウト保存 (Priority: P1)

**Goal**: ニックネーム・タイトル・URL の各セルクリックで PrimeVue `Textarea` に切り替わり、フォーカスアウトまたは `Enter` キーで検証・保存（変更なし時はスキップ）、`Escape` キーでキャンセルできるようになる。

**Independent Test**: 一覧から編集ボタンと編集ポップアップが存在しないことを確認し、各セルをクリックして自動フォーカスされた `Textarea` で編集し、フォーカスアウト・`Enter`（IME 変換確定中は除外）・`Escape`・空値／重複 URL バリデーション・ロールバックが期待通り動作することを検証する。

### Implementation for User Story 2

- [ ] T007 [US2] Render clickable cell containers (`.inline-editable-cell` with `min-height: 2rem` so empty `title` cells remain clickable, plus hover visual feedback) for `nickname`, `title`, and `url` columns, and implement `isEditingCell(row, field)` and `startInlineEdit(row, field)` with `nextTick()` auto-focus on the active `textarea` in `src/List.vue`
- [ ] T008 [US2] Render PrimeVue `Textarea` inside `.inline-edit-wrapper` when `isEditingCell(slotProps.data, field)` is true, wiring `@focusout` (ignore if `relatedTarget` stays inside wrapper), `@keydown.enter` (ignore IME `isComposing || keyCode === 229`; call `preventDefault()` to forbid newlines including `Shift+Enter`, then commit), and `@keydown.escape` (cancel without saving) in `src/List.vue`
- [ ] T009 [US2] Implement `cancelInlineEdit()` and `commitInlineEdit()` with no-op change detection, field validation (`normalizeNicknamePath(nickname) === ''` or `url.trim() === ''` -> `errorNicknameUrlRequired` toast & revert; duplicate `isSameUrl` in target nickname -> `errorUrlExists` toast & revert), snapshot rollback on `saveBookmarksData` error (`getSaveErrorMessage`), `successUpdated` toast on save, and `isClosingInlineEdit` re-entrancy guard in `src/List.vue`

**Checkpoint**: User Story 1 および User Story 2 がともに動作し、ポップアップなしのクリック編集・保存・キャンセルが完結する状態。

---

## Phase 5: User Story 3 - ページを開く操作と動的 URL デフォルト値編集の両立 (Priority: P2)

**Goal**: URL セルの文字列クリックをインライン編集に統一しつつ、操作列の「新しいタブで開く」ボタンによるページ遷移と、動的 URL（`%s`）編集時の同一セル内デフォルト値編集を両立させる。

**Independent Test**: 通常 URL 行で操作列の外部リンクボタンから新規タブ遷移できること（ブックマークレット行では非表示）、および `%s` を含む URL のセル編集時にデフォルト値入力欄が同一セル内に表示され入力欄間のフォーカス移動で保存が暴発せずまとめて保存されることを検証する。

### Implementation for User Story 3

- [ ] T010 [US3] Remove the `<a class="url-link">` wrapper from the URL column so the entire URL cell triggers inline editing, remove the legacy `pi-pencil` edit button from the actions column, and add `openBookmarkInNewTab(row)` with a `pi pi-external-link` button (rendered only when `!isBookmarkletUrl(slotProps.data.url)`, using `openInNewTabTooltip`) in `src/List.vue`
- [ ] T011 [US3] Render the `default_value` `InputText` (`v-model="inlineEdit.draftDefaultValue"`, labeled with `t('defaultValueLabel')`) inside `.inline-edit-wrapper` beneath the URL `Textarea` whenever `inlineEdit.field === 'url' && isDynamicUrl(inlineEdit.draftValue)`, wiring `Enter`/`Escape` handlers and ensuring `commitInlineEdit()` preserves or clears `default_value` based on `isDynamicUrl(newUrl)` in `src/List.vue`

**Checkpoint**: 全 3 つのユーザーストーリーが独立かつ統合的に動作する状態。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 未使用文言の整理、仕様ドキュメント同期、コード規約（日本語 JSDoc/コメント）確認、本番ビルドおよび実機検証を行う。

- [ ] T012 [P] Review unused `editBookmarkTitle` key in `package/_locales/ja/messages.json` and `package/_locales/en/messages.json` and verify ja/en locale key parity
- [ ] T013 [P] Synchronize section "G. ブックマーク一覧画面（管理画面）" in `.context/spec.md` with fixed column widths, single-line URL ellipsis, inline `Textarea` editing, dynamic URL default value editing, and actions-column open button
- [ ] T014 Verify Japanese JSDoc and inline comments on all new/modified types and functions in `src/List.vue` and run `npm run build` to confirm clean TypeScript compilation and `package/js/` + `package.zip` generation
- [ ] T015 Execute manual validation scenarios defined in `specs/008-list-inline-editing/quickstart.md` in Chrome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 依存なし — 即時開始可能（`T001` と `T002` は並列実行可能）
- **Phase 2 (Foundational)**: Phase 1 に続いて実施（`T003` → `T004` の順に `src/List.vue` の基盤を整備）— US1〜US3 の実装前提
- **Phase 3 (US1)**: Phase 2 完了後に開始（`T005` → `T006`）
- **Phase 4 (US2)**: Phase 3 完了後に開始（`T007` → `T008` → `T009`、すべて `src/List.vue` 内のため順次実行）
- **Phase 5 (US3)**: Phase 4 完了後に開始（`T010` → `T011`、同一ファイル `src/List.vue` のため順次実行）
- **Phase 6 (Polish)**: Phase 5 完了後に開始（`T012`, `T013` は `[P]` で並列実行可能、その後 `T014` ビルド確認 → `T015` 実機確認）

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 完了後に独立して実装・テスト可能（MVP としてレイアウト安定化を提供）
- **User Story 2 (P1)**: Foundational（および `List.vue` 上は US1 の列定義）に続けて実装し、インライン編集の基本体験を完結
- **User Story 3 (P2)**: US2 のインライン編集基盤（`.inline-edit-wrapper` と `commitInlineEdit`）の上に「開く」ボタンと `default_value` 複合入力を統合

---

## Parallel Example

```bash
# Phase 1: 日英ロケール定義は異なるファイルのため並列実行可能
Task: "T001 [P] Add openInNewTabTooltip and deleteBookmarkTooltip keys in package/_locales/ja/messages.json"
Task: "T002 [P] Add openInNewTabTooltip and deleteBookmarkTooltip keys in package/_locales/en/messages.json"

# Phase 6: ロケール整理とドキュメント同期は並列実行可能
Task: "T012 [P] Review unused editBookmarkTitle key in package/_locales/{ja,en}/messages.json"
Task: "T013 [P] Synchronize section G in .context/spec.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Phase 1（多言語キー追加）と Phase 2（編集ダイアログ廃止・状態型定義）を完了する。
2. Phase 3（US1: 固定列幅＋URL 1 行省略表示）を実装し、テーブルレイアウトの安定性を確認する。
3. Phase 4（US2: セルクリックによる `Textarea` インライン編集・保存・キャンセル）を実装して主要な編集体験を完成させる。
4. Phase 5（US3: 操作列「開く」ボタンと動的 URL `default_value` 複合編集）を統合し、既存機能との互換性を 100% 回復する。
5. Phase 6 で `.context/spec.md` 同期、`npm run build`、および Chrome 実機 E2E 検証を完了する。
