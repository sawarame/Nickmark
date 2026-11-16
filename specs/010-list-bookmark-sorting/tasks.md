---

description: "Task list for bookmark list sorting feature (Issue #18)"
---

# Tasks: ブックマーク一覧の並び替え機能

**Input**: Design documents from `/specs/010-list-bookmark-sorting/`
**Prerequisites**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/plan.md), [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/spec.md), [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/research.md), [data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/data-model.md), [list-sorting-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/contracts/list-sorting-contract.md), [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/quickstart.md)

**Tests**: 本機能仕様では自動テスト基盤の導入は要求されていないため、テストタスクは含めず、`npm run build`（TypeScript コンパイル・Webpack バンドル検証）および [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/quickstart.md) に沿った Chrome 実機 E2E 検証を実施する。

**Organization**: タスクは各ユーザーストーリーを独立して実装・検証できるよう、優先順位（P1 → P2）に沿ってフェーズ分割している。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルを対象とし、未完了タスクへの依存がないため並列実行可能
- **[Story]**: 対応する User Story（`[US1]`, `[US2]`, `[US3]`）
- すべてのタスク説明に正確な対象ファイルパスを明記している

---

## Phase 1: Setup（多言語メッセージリソース準備）

**Purpose**: 並び替えラベルおよび 5 種類の選択肢文言について、日本語・英語双方のロケール定義を整備する。

- [X] T001 [P] Add Japanese sort i18n keys (`sortOrderLabel`: `"並び替え"`, `sortOrderDefault`: `"デフォルト順"`, `sortOrderLastUsedDesc`: `"最終使用日時（新しい順）"`, `sortOrderLastUsedAsc`: `"最終使用日時（古い順）"`, `sortOrderScoreDesc`: `"スコア（高い順）"`, `sortOrderScoreAsc`: `"スコア（低い順）"`) in package/_locales/ja/messages.json
- [X] T002 [P] Add English sort i18n keys (`sortOrderLabel`: `"Sort"`, `sortOrderDefault`: `"Default"`, `sortOrderLastUsedDesc`: `"Last Used (Newest)"`, `sortOrderLastUsedAsc`: `"Last Used (Oldest)"`, `sortOrderScoreDesc`: `"Score (Highest)"`, `sortOrderScoreAsc`: `"Score (Lowest)"`) in package/_locales/en/messages.json

---

## Phase 2: Foundational（共有型・バリデーション・永続化基盤）

**Purpose**: 全ユーザーストーリーの土台となる `ListSortOption` 型、純粋ソート・バリデーションモジュール、および `chrome.storage.local` 永続化・キャッシュ同期機構を構築する。

**⚠️ CRITICAL**: Phase 3 以降のユーザーストーリー実装は本フェーズ完了後に開始すること。

- [X] T003 Add `ListSortOption` (`'default' | 'last_used_desc' | 'last_used_asc' | 'score_desc' | 'score_asc'`) and `DEFAULT_LIST_SORT_OPTION: ListSortOption = 'default'` with Japanese JSDoc in src/shared/types.ts
- [X] T004 Create `src/shared/listSort.ts` exporting `isValidListSortOption`, `parseValidListSortOption` (falling back to `DEFAULT_LIST_SORT_OPTION` on invalid/null/unknown input without throwing), and `sortBookmarkRows` base function (preserving original order for `'default'` without mutating input, ignoring `is_pinned`, and applying deterministic tie-breakers `nickname.localeCompare` then `url.localeCompare`) with Japanese JSDoc in src/shared/listSort.ts (depends on T003)
- [X] T005 Add `listSortOrderCache`, `getListSortOrder()`, `setListSortOrder()`, and `updateListSortOrderCache()` persisting under `chrome.storage.local` key `'listSortOrder'` with `parseValidListSortOption` normalization and Japanese JSDoc in src/shared/storage.ts (depends on T004)
- [X] T006 [P] Re-export `./shared/listSort` and sync `updateListSortOrderCache(changes.listSortOrder.newValue)` inside `chrome.storage.onChanged` (`area === 'local'`) in src/background.ts (depends on T004, T005)

**Checkpoint**: 多言語リソース、型定義、バリデーション・タイブレーカー基盤、ローカル設定永続化・キャッシュ同期が完了し、ユーザーストーリーを実装可能な状態。

---

## Phase 3: User Story 1 - 最終使用日時によるブックマーク一覧の並び替え (Priority: P1) 🎯 MVP

**Goal**: ツールバーの並び替えセレクトから一覧を「最終使用日時（新しい順／古い順）」で即座に並び替え、フォルダ絞り込み結果および全ページング対象に反映できるようにする。

**Independent Test**: 異なる `last_used_at` を持つ 11 件以上のブックマーク登録状態で管理画面を開き、ツールバーから「最終使用日時（新しい順）」「最終使用日時（古い順）」および「デフォルト順」を切り替えて、全ページ・フォルダ絞り込み結果が正しく並び替わることを単独で検証できる。

### Implementation for User Story 1

- [X] T007 [US1] Implement `'last_used_desc'` and `'last_used_asc'` comparison branches in `sortBookmarkRows` (normalizing `last_used_at` with `Number.isFinite(Number(v)) ? Number(v) : 0`, ignoring `is_pinned`, and falling back to `nickname` then `url` tie-breakers) in src/shared/listSort.ts (depends on T004)
- [X] T008 [US1] Add `selectedSortOrder` (`ref<ListSortOption>(DEFAULT_LIST_SORT_OPTION)`), `sortOptions` computed (`'default'`, `'last_used_desc'`, `'last_used_asc'`), and `sortedFilteredBookmarks` computed (passing `filteredBookmarks.value` to `sortBookmarkRows`) in src/List.vue (depends on T001, T002, T007)
- [X] T009 [US1] Render toolbar sort `Select` (`#bookmark-sort`, `pi pi-sort-alt` label via `t('sortOrderLabel')`, `:options="sortOptions"`, `optionLabel="label"`, `optionValue="value"`) inside `.folder-toolbar` alongside `#folder-filter`, and bind `:value="sortedFilteredBookmarks"` on `DataTable` in src/List.vue (depends on T008)

**Checkpoint**: User Story 1（MVP）が完成し、ツールバーからの「最終使用日時（新しい順／古い順）」並び替えを単独で動作確認できる状態。

---

## Phase 4: User Story 2 - スコアによるブックマーク一覧の並び替え (Priority: P1)

**Goal**: ツールバーの並び替えセレクトから一覧を「スコア（高い順／低い順）」の数値大小順で並び替えられるようにする。

**Independent Test**: 小数を含む異なる `score`（例: `1.5`, `10.2`, `2.0`）を持つブックマーク登録状態で「スコア（高い順）」「スコア（低い順）」を選択し、文字列順ではなく数値の大小で正しく並び替わることを単独で検証できる。

### Implementation for User Story 2

- [X] T010 [US2] Implement `'score_desc'` and `'score_asc'` numeric comparison branches in `sortBookmarkRows` (normalizing `score` with `Number.isFinite(Number(v)) ? Number(v) : 0`, ignoring `is_pinned`, and applying `nickname` then `url` tie-breakers) in src/shared/listSort.ts (depends on T007)
- [X] T011 [US2] Add `'score_desc'` (`t('sortOrderScoreDesc')`) and `'score_asc'` (`t('sortOrderScoreAsc')`) options to `sortOptions` computed in src/List.vue (depends on T008, T010)

**Checkpoint**: User Story 1 と User Story 2 の双方が動作し、Issue #18 で求められた「最終使用日時」「スコア」両項目での並び替えが完結する状態。

---

## Phase 5: User Story 3 - 既存テーブルの視認性維持・選択状態の永続化・純粋値ソート (Priority: P2)

**Goal**: 固定幅 5 列レイアウトを維持したまま、ツールバーで選択した並び替え条件の端末ローカル永続化・起動時復元、および `DataTable` 列ヘッダーソートとの競合防止を完成させる。

**Independent Test**: 初回表示がデフォルト順であること、選択した並び替え条件がタブ再表示・リロード後も復元されること、列ヘッダークリック時はツールバー選択表示が「デフォルト順」へ切り替わりつつ永続値を壊さず再選択可能であること、および狭い画面幅やインライン編集・データ自動再読み込み時もレイアウトや編集状態が壊れないことを検証できる。

### Implementation for User Story 3

- [X] T012 [US3] Load persisted sort option via `await getListSortOrder()` inside `onMounted` before setting `isLoaded.value = true` (preventing initial unsorted flash) and persist user selection via `await setListSortOrder(value)` in `handleToolbarSortChange` in src/List.vue (depends on T005, T009)
- [X] T013 [US3] Bind `v-model:first="tableFirst"`, `v-model:sortField="tableSortField"`, `v-model:sortOrder="tableSortOrder"`, and `@sort="handleTableSort"` on `DataTable`; clear `tableSortField` / `tableSortOrder` and reset `tableFirst = 0` inside `handleToolbarSortChange`; and set `selectedSortOrder = DEFAULT_LIST_SORT_OPTION` in memory only (without calling `setListSortOrder`) when `handleTableSort` receives a truthy `sortField` in src/List.vue (depends on T012)
- [X] T014 [US3] Add `.toolbar-controls-group`, `.sort-select-group`, `.sort-filter-label`, and `.sort-select` `<style scoped>` rules for responsive wrapping alongside `.folder-select-group` while preserving the existing 5-column fixed-width `DataTable` (`min-width: 820px`) in src/List.vue (depends on T009, T013)

**Checkpoint**: すべての User Story（US1〜US3）が仕様・契約通りに統合され、既存機能との競合なく動作する状態。

---

## Phase 6: Polish & Cross-Cutting Concerns（ドキュメント同期・ビルド・最終検証）

**Purpose**: プロジェクト基盤ドキュメントの同期、本番ビルド確認、および Chrome 実機での全シナリオ検証を完了する。

- [X] T015 [P] Synchronize `.context/spec.md` (document toolbar sorting by last used time and score, pure value ordering, and local persistence under Section G) and `.context/tech_stack.md` (document `src/shared/listSort.ts`)
- [X] T016 Run `npm run build` to verify TypeScript compilation, regenerated `package/js/` bundles, and `package.zip` generation (depends on T006, T011, T014, T015)
- [ ] T017 Validate Scenarios 1–5 in Chrome (default state, last used sorting + focus reload, decimal score + unprioritized pin ordering, persistence across reload + column sort switching, i18n ja/en + responsive wrapping + inline edit regression check) per specs/010-list-bookmark-sorting/quickstart.md (depends on T016)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即時開始可能（`T001`, `T002` は並列実行可能）
- **Foundational (Phase 2)**: `T003` → `T004` → `T005` の順で実施し、`T006` は `T005` 完了後に実行（`T001`, `T002` とは並列可能） — Phase 3〜5 をブロック
- **User Story 1 (Phase 3 - P1)**: `T001`, `T002`, `T004` 完了後に `T007` → `T008` → `T009` の順で実施
- **User Story 2 (Phase 4 - P1)**: `T007` 完了後に `T010`、および `T008`・`T010` 完了後に `T011` を実施
- **User Story 3 (Phase 5 - P2)**: `T005`・`T009` 完了後に `T012` → `T013` → `T014` の順で実施
- **Polish (Phase 6)**: `T015` は仕様確定・モジュール構成確定後に並列実施可能、その後 `T016` → `T017` の順で完了検証

### User Story Dependencies

- **User Story 1 (P1 - 最終使用日時での並び替え)**: Foundational（`T003`〜`T004`）と Setup（`T001`〜`T002`）のみに依存し、MVP として単独検証可能。
- **User Story 2 (P1 - スコアでの並び替え)**: `T007`（`listSort.ts` の比較分岐拡張）および `T008`（`sortOptions` 拡張）に続けて実装し、数値ソートを独立検証可能。
- **User Story 3 (P2 - 永続化・列ソート調停・レイアウト仕上げ)**: `T005`（`storage.ts` 永続化）と `T009`（ツールバー・テーブル接続）に続けて実装し、再表示復元・列ソート切替・レスポンシブ表示を独立検証可能。

### Parallel Opportunities

- `T001`（`ja/messages.json`）と `T002`（`en/messages.json`）は異なるファイルのため並列実行可能（さらに `T003` とも並列可能）。
- `T006`（`src/background.ts`）は `T005` 完了後、`T007`（`src/shared/listSort.ts`）と並列実行可能。
- `T015`（`.context/spec.md`, `.context/tech_stack.md`）は実装ファイル編集（`T014` 等）に影響しないため並列実行可能。

---

## Parallel Example: Setup & Foundational

```bash
# Phase 1 + Phase 2 初期の並列実行例:
Task: "T001 [P] Add Japanese sort i18n keys in package/_locales/ja/messages.json"
Task: "T002 [P] Add English sort i18n keys in package/_locales/en/messages.json"
Task: "T003 Add ListSortOption and DEFAULT_LIST_SORT_OPTION in src/shared/types.ts"

# T005 完了後の並列実行例:
Task: "T006 [P] Re-export ./shared/listSort and sync listSortOrder cache in src/background.ts"
Task: "T007 [US1] Implement last_used_desc/asc sorting in src/shared/listSort.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`T001`, `T002`)
2. Complete Phase 2: Foundational (`T003`–`T006`)
3. Complete Phase 3: User Story 1 (`T007`–`T009`)
4. **STOP and VALIDATE**: 最終使用日時（新しい順／古い順）での並び替えとフォルダ絞り込み・ページング動作を検証

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. User Story 1 → 最終使用日時並び替え（MVP）
3. User Story 2 → スコア並び替え追加（Issue #18 の 2 項目達成）
4. User Story 3 → 選択状態永続化・列ヘッダーソート調停・レスポンシブ仕上げ
5. Polish → ドキュメント同期・`npm run build`・[quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/quickstart.md) 全シナリオ検証
