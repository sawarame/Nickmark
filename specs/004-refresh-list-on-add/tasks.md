# Tasks: ブックマーク一覧タブの自動更新 (Refresh Bookmark List on Add)

**Input**: Design documents from `specs/004-refresh-list-on-add/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/messaging.md`, `quickstart.md`)  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messaging.md  
**Branch**: `004-refresh-list-on-add`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3])
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 開発環境の確認とビルド準備

- [X] T001 既存コードベースのビルド状態確認と TypeScript コンパイル検証 (`package.json`, `webpack.config.js`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのユーザーストーリーで必要となる基盤（キャッシュ制御機能）の実装

**⚠️ CRITICAL**: 本フェーズのキャッシュクリア機能が完成するまで、一覧画面側の同期処理は開始できません

- [X] T002 メモリキャッシュ破棄関数 `clearBookmarksCache` の実装とエクスポート (`src/background.ts`)
- [X] T003 `loadBookmarksData` におけるキャッシュ参照ロジックと `clearBookmarksCache` の連携確認 (`src/background.ts`)

**Checkpoint**: 基盤実装完了 — ユーザーストーリーの実装へ進みます

---

## Phase 3: User Story 1 - 特殊ページでのブックマーク追加時に既存一覧が最新化される (Priority: P1) 🎯 MVP

**Goal**: 特殊ページからブックマークを追加し既存の一覧タブがアクティブ化された際、トースト通知とともに最新のブックマーク一覧を自動描画する

**Independent Test**: 特殊ページ（例: `chrome://extensions/`）からオムニボックスで `:add` を実行し、既存の一覧タブが前面に出てトーストが表示され、追加した項目が即座に一覧テーブルに反映されることを確認する

### Implementation for User Story 1

- [X] T004 [US1] `src/List.vue` に `clearBookmarksCache` をインポートし、`updatePage` メッセージ受信時にキャッシュ破棄と `loadBookmarks()` の非同期呼び出しを実装 (`src/List.vue`)
- [X] T005 [US1] 一覧更新処理とトースト通知表示（`showCustomToast`）および URL 入力補完処理が競合しないよう非同期順序を整理 (`src/List.vue`)

**Checkpoint**: User Story 1 が単体で動作し、特殊ページからの追加時に一覧が即時反映される（MVP 達成）

---

## Phase 4: User Story 2 - 新規タブで一覧を開いた場合の一貫した表示 (Priority: P2)

**Goal**: 一覧タブが存在せず新規タブとして一覧が開かれた場合でも、追加した項目とトースト通知が確実に表示される既存動作を維持・保証する

**Independent Test**: 一覧タブを閉じた状態で特殊ページからブックマークを追加し、新規に開いたタブで追加したブックマークとトースト通知が正常に表示されることを確認する

### Implementation for User Story 2

- [X] T006 [US2] 新規タブ生成時の URL クエリパラメータ（`?msg=...`）処理および初回 `loadBookmarks()` において最新データが欠落しないことを検証・ガード (`src/List.vue`)

**Checkpoint**: 既存タブ再利用時（US1）と新規タブ生成時（US2）の双方が一貫して最新データを表示できる

---

## Phase 5: User Story 3 - 手動で一覧タブに戻った際の一貫性 (Priority: P3)

**Goal**: ユーザーが手動で一覧タブへフォーカスを復帰させた際にも、安全に最新のブックマークデータを同期する

**Independent Test**: 一覧タブを開いたまま通常タブでブックマークを追加し、一覧タブを手動で選択してフォーカスした際に、最新データが反映されることを確認する

### Implementation for User Story 3

- [X] T007 [US3] タブのフォーカス復帰時（`window.focus` / `visibilitychange`）に、編集ダイアログ表示中などの操作中状態を保護しつつ `clearBookmarksCache()` と `loadBookmarks()` を呼び出す安全な同期処理を実装 (`src/List.vue`)

**Checkpoint**: 自動誘導時・手動タブ復帰時の全経路において、常に最新のブックマーク一覧が表示される

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: プロジェクト全体のビルド確認、実機検証、およびドキュメント同期

- [X] T008 [P] `npm run build` を実行し、Webpack による拡張機能バンドル（`package/js/background.js`, `package/js/list.js`）の生成とエラーの有無を検証 (`webpack.config.js`)
- [X] T009 [P] `specs/004-refresh-list-on-add/quickstart.md` の全テストシナリオ（シナリオ 1〜3）を手動実機で検証
- [X] T010 変更内容に基づきプロジェクト仕様ドキュメントを同期・更新 (`.context/spec.md`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存関係なし。直ちに開始可能。
- **Foundational (Phase 2)**: Phase 1 完了後に実行。全ユーザーストーリーの前提条件（ブロック対象）。
- **User Story 1 (Phase 3)**: Phase 2 完了後に実行。最優先 MVP。
- **User Story 2 (Phase 4)**: Phase 3 完了後に実行。新規タブオープン時の整合性確認。
- **User Story 3 (Phase 5)**: Phase 3/4 完了後に実行。タブフォーカス復帰時の追加強化。
- **Polish (Phase 6)**: 全ユーザーストーリー完了後に実行。

### User Story Dependencies

- **US1 (P1)**: Foundational（T002, T003）完了後に着手可能。他ストーリーへの依存なし。
- **US2 (P2)**: US1 の実装後に確認可能（同一の `List.vue` ロジックを共有）。
- **US3 (P3)**: US1 のメッセージハンドラ実装完了後にフォーカスイベントへ拡張。

---

## Parallel Opportunities

- **Phase 6**: T008（ビルド検証）と T009（シナリオ検証準備）は並行して実施可能。

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup（T001）を実行。
2. Phase 2: Foundational（T002, T003）で `src/background.ts` に `clearBookmarksCache` を実装。
3. Phase 3: User Story 1（T004, T005）で `src/List.vue` にメッセージ受信時のキャッシュクリアと再読み込みを接続。
4. **MVP 検証**: 特殊ページからブックマークを追加し、既存一覧タブが即時更新されることを確認（課題の根本解決）。

### Incremental Delivery

1. MVP 完成後、Phase 4（US2: 新規タブ時の一貫性）を検証。
2. Phase 5（US3: 手動フォーカス復帰時の一覧同期）を追加実装。
3. Phase 6 で最終ビルド・実機テスト・ドキュメント更新を実施。
