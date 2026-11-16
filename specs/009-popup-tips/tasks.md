---

description: "Task list for popup initial blank-area tips display"
---

# Tasks: ポップアップ初期表示時の Tips 表示

**Input**: Design documents from `/specs/009-popup-tips/`
**Prerequisites**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/plan.md), [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/spec.md), [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/research.md), [data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/data-model.md), [popup-tips-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/contracts/popup-tips-contract.md), [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/quickstart.md)

**Tests**: 本機能仕様では新規自動テスト基盤の導入は要求されていないため、テストタスクは省略し、`npm run build`（TypeScript 型チェック・Webpack バンドル検証）および [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/quickstart.md) に沿った Chrome 実機 E2E 検証を実施する。

**Organization**: タスクは各ユーザーストーリーを独立して実装・検証できるよう、優先順位（P1 → P2）に沿ってフェーズ分割している。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルを対象とし、未完了タスクへの依存がないため並列実行可能
- **[Story]**: 対応する User Story（`[US1]`, `[US2]`, `[US3]`）
- すべてのタスク説明には対象ファイルパスを明記している

---

## Phase 1: Setup（多言語メッセージリソース準備）

**Purpose**: Tips 表示とクリック切替ガイドに必要な日本語・英語のメッセージキーを定義する。

- [X] T001 [P] Add Japanese i18n keys (`popupTipsBadge`, `popupTipsNextHint`, `popupTipAddCommand`, `popupTipAddallCommand`, `popupTipFolderOpen`, `popupTipDynamicUrl`, `popupTipTabDisposition` with `$1` placeholder, `popupTipKeyboardNav`, `popupTipBookmarklet`, `popupTipManagementCommands`) covering only existing Nickmark features in package/_locales/ja/messages.json
- [X] T002 [P] Add matching English i18n keys (`popupTipsBadge`, `popupTipsNextHint`, `popupTipAddCommand`, `popupTipAddallCommand`, `popupTipFolderOpen`, `popupTipDynamicUrl`, `popupTipTabDisposition` with `$1` placeholder, `popupTipKeyboardNav`, `popupTipBookmarklet`, `popupTipManagementCommands`) in package/_locales/en/messages.json

---

## Phase 2: Foundational（共有型・OS 修飾キー判定・Tips カタログ基盤）

**Purpose**: 全ユーザーストーリーの前提となる `TipEntry` 型定義、OS 別修飾キー判定の共通化、および Tips カタログ・ランダム選出モジュールを実装する。

**⚠️ CRITICAL**: Phase 3 以降のユーザーストーリー実装は本フェーズ完了後に開始すること。

- [X] T003 [P] Add `TipEntry` interface (`id: string`, `messageKey: string`, `icon?: string`, `usesPrimaryModifier?: boolean`) with Japanese JSDoc in src/shared/types.ts
- [X] T004 [P] Extract `isMacPlatform(): boolean` and add `getPrimaryModifierLabel(): 'Cmd' | 'Ctrl'` (sharing logic with existing `getShortcutLabel()`) with Japanese JSDoc and comments in src/shared/url.ts
- [X] T005 Create `src/shared/tips.ts` exporting `POPUP_TIPS: readonly TipEntry[]` (8 entries), O(1) `pickRandomTipIndex(totalCount: number, excludeIndex?: number): number` (returning `-1` when `totalCount <= 0`, `0` when `totalCount === 1`, and guaranteed `result !== excludeIndex` when `totalCount >= 2` and `0 <= excludeIndex < totalCount`), and `formatTipMessage(tip, translate)` (passing `[getPrimaryModifierLabel()]` when `tip.usesPrimaryModifier` is `true`) with Japanese JSDoc in src/shared/tips.ts (depends on T003, T004)

**Checkpoint**: 多言語リソース、型定義、OS 判定、Tips カタログおよび重複回避ランダム選出基盤が揃い、各ユーザーストーリーを実装可能な状態。

---

## Phase 3: User Story 1 - ポップアップ起動直後の空白領域でのランダム Tips 閲覧と切り替え (Priority: P1) 🎯 MVP

**Goal**: ポップアップ起動直後の空白箇所に 1 件の Tip をランダム表示し、クリックで別の Tip へ切り替えつつ検索入力欄のフォーカスを維持できるようにする。

**Independent Test**: ポップアップを起動して未入力状態で検索欄下部に 1 件の Tip が表示されること、複数回起動すると異なる Tip が選ばれること、および Tip 領域をクリックすると直前とは別の Tip に切り替わり、そのまま文字入力を続けられることを単独で検証できる。

### Implementation for User Story 1

- [X] T006 [US1] Add `currentTipIndex` (initialized via `pickRandomTipIndex(POPUP_TIPS.length)`), `currentTip`, `currentTipText`, and `cycleTip()` (updating `currentTipIndex` via `pickRandomTipIndex(POPUP_TIPS.length, currentTipIndex.value)` and calling `await focusSearchInput()`) in src/Popup.vue (depends on T005)
- [X] T007 [US1] Render `.palette-tips` interactive area (`role="button"`, `tabindex="-1"`, `@mousedown.prevent`, `@click="cycleTip"`, `:aria-label="tr('popupTipsNextHint')"`, `v-tooltip.bottom="tr('popupTipsNextHint')"`, lightbulb icon, `TIP` badge, wrapped tip body, and `pi-refresh` icon) with PrimeVue CSS variable-compliant `<style scoped>` rules fitting within `600px` width without horizontal overflow in src/Popup.vue (depends on T006)

**Checkpoint**: User Story 1（MVP）が動作し、起動直後の空白領域でのランダム Tip 表示およびクリック切り替え＋フォーカス維持を単独で検証可能な状態。

---

## Phase 4: User Story 2 - 検索・コマンド入力開始時のスムーズな切り替えと空白復帰 (Priority: P1)

**Goal**: 1 文字以上の検索語・コマンド入力時に即座に Tips を非表示にして候補リストへ切り替え、入力全消去（または空白のみ）で再び Tips を表示し、さらにフィードバック通知や確認ダイアログと競合しないようにする。

**Independent Test**: Tips 表示中に 1 文字入力して候補リストへ即座に切り替わること、入力を全消去またはスペースのみにすると Tips へ復帰すること、`:add` 後のフィードバック通知表示中および大量タブ確認ダイアログ表示中は Tips が隠れ通知消去後に復帰すること、および `Tab` / `Esc` キーが既存通り動作することを検証できる。

### Implementation for User Story 2

- [X] T008 [US2] Implement `shouldShowTips` computed (`query.value.trim().length === 0 && !pendingBatchConfirm.value && !feedback.value && i18nVersion.value > 0 && currentTip.value !== null`) and bind `v-else-if="shouldShowTips"` in exclusive chain with `.batch-confirm-box` and `.palette-list` (keeping `.palette-feedback` non-conflicting and restoring Tips after `feedback` auto-dismisses) in src/Popup.vue (depends on T007)

**Checkpoint**: User Story 1 と User Story 2 が連携し、入力切り替え・空白復帰・通知/確認ダイアログとの排他制御が完結する状態。

---

## Phase 5: User Story 3 - 多言語対応とシンプルで一貫した常時案内 (Priority: P2)

**Goal**: 日英の言語設定に応じた言語チラつきのない Tips 表示と、設定不要な常時空白表示および両言語でのレイアウト収容性を仕上げる。

**Independent Test**: 設定画面で日本語⇔英語を切り替えてポップアップを開いた際、起動直後の言語チラつきなく選択言語の Tip・バッジ・ツールチップが表示され、いずれの Tip 文言でも 600px 幅内へ自然に折り返されて横スクロールが発生しないことを検証できる。

### Implementation for User Story 3

- [X] T009 [US3] Verify `currentTipText` evaluates `formatTipMessage(currentTip.value, tr)` reactively only after `i18nVersion > 0` (preventing pre-i18n language flash), confirm no unnecessary settings UI or toggle is added, and tune `.palette-tips` typography/spacing for both Japanese and English tip lengths in src/Popup.vue (depends on T008)

**Checkpoint**: すべての User Story（US1〜US3）が仕様通りに競合なく安定動作する状態。

---

## Phase 6: Polish & Cross-Cutting Concerns（ドキュメント同期・ビルド・最終検証）

**Purpose**: プロジェクト基盤ドキュメントの同期、本番ビルド確認、および実機 E2E 検証を完了する。

- [X] T010 [P] Update `.context/spec.md` (document blank-area Tips display, click-to-cycle behavior, and hide conditions under Section H) and `.context/tech_stack.md` (add `src/shared/tips.ts`)
- [X] T011 Run `npm run build` to verify clean TypeScript compilation, regenerated `package/js/popup.js`, and updated `package.zip` artifact
- [ ] T012 Validate all end-to-end scenarios (random display, non-repeating click cycle with immediate typing, input/clear/feedback/dialog transitions, `Tab`/`Esc` non-interference, and Japanese/English switching) in Chrome against specs/009-popup-tips/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即時開始可能（`T001`, `T002` は並列実行可能）
- **Foundational (Phase 2)**: `T003`, `T004` は並列実行可能、`T005` は `T003`・`T004` 完了後に実行 — Phase 3〜5 をブロック
- **User Story 1 (Phase 3 - P1)**: Foundational（`T005`）および Setup（`T001`, `T002`）完了後に実施（`T006` → `T007`）
- **User Story 2 (Phase 4 - P1)**: User Story 1（`T007`）完了後に実施（`T008`）
- **User Story 3 (Phase 5 - P2)**: User Story 2（`T008`）完了後に仕上げ（`T009`）
- **Polish (Phase 6)**: Phase 3〜5 完了後に実施（`T010` はコード完了直後に並列可能、その後 `T011` → `T012`）

### User Story Dependencies

- **User Story 1 (P1 - ランダム表示・クリック切替)**: Foundational（`T005`）のみに依存し、MVP として単独検証可能。
- **User Story 2 (P1 - 入力切り替え・通知排他)**: US1 のテンプレート（`T007`）を条件制御するため US1 に続けて実装し、入力/通知切り替えを独立検証可能。
- **User Story 3 (P2 - 多言語・レイアウト仕上げ)**: US2 の条件制御（`T008`）を含めた状態で日英表示と余白・折り返しを最終検証する。

### Parallel Opportunities

- Phase 1 の `T001`（`ja/messages.json`）と `T002`（`en/messages.json`）は異なるファイルのため並列実行可能。
- Phase 2 の `T003`（`src/shared/types.ts`）と `T004`（`src/shared/url.ts`）は異なるファイルのため並列実行可能（さらに Phase 1 の `T001`, `T002` とも並列可能）。
- Phase 6 の `T010`（`.context/spec.md`, `.context/tech_stack.md`）は `src/Popup.vue` 実装完了直後から並列で着手可能。

---

## Parallel Example: Setup & Foundational

```bash
# Phase 1 & Phase 2 の独立タスクを同時実行:
Task: "T001 Add Japanese i18n keys in package/_locales/ja/messages.json"
Task: "T002 Add English i18n keys in package/_locales/en/messages.json"
Task: "T003 Add TipEntry interface in src/shared/types.ts"
Task: "T004 Extract isMacPlatform and add getPrimaryModifierLabel in src/shared/url.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`T001`, `T002`)
2. Complete Phase 2: Foundational (`T003`, `T004` → `T005`)
3. Complete Phase 3: User Story 1 (`T006` → `T007`)
4. **STOP and VALIDATE**: ポップアップ起動時の空白エリアへのランダム Tip 表示、クリックでの別 Tip 切り替え、および検索欄フォーカス維持を検証する

### Incremental Delivery

1. Setup + Foundational → Tips カタログ・型・多言語キー基盤が完成
2. User Story 1 → 空白領域での Tip 表示とクリック切り替え（MVP）
3. User Story 2 → 入力・クリア・フィードバック通知・確認ダイアログとの完全な排他切り替え
4. User Story 3 → 日英言語チラつきゼロ・折り返しレイアウト調整の仕上げ
5. Polish → ドキュメント同期・`npm run build`・`quickstart.md` 実機検証

---

## Notes

- `[P]` タスクは対象ファイルが分離しており、他タスクの未完了成果物に依存しない。
- `Popup.vue` を対象とする `T006`〜`T009` は同一ファイル編集のため、コンフリクトを防ぐ目的で順次実行とする。
- 各タスク完了時は `src/` 配下への変更のみを行い、`package/js/` は直接編集せず `T011` の `npm run build` で生成すること。
