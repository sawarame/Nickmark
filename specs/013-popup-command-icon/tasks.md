---

description: "Task list for popup command input icon fix"
---

# Tasks: コマンド入力モード時のアイコン表示修正

**Input**: Design documents from `/specs/013-popup-command-icon/`

**Prerequisites**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/013-popup-command-icon/plan.md), [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/013-popup-command-icon/spec.md), [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/013-popup-command-icon/research.md)

**Tests**: 本リポジトリには自動テストフレームワークが未導入のため、型チェック（`npx tsc --noEmit`）、ビルド検証（`npm run build`）、および `quickstart.md` に基づく検証タスクを含める。

**Organization**: ユーザーストーリー単位（US1: 検索欄左側アイコン切り替え / US2: 候補一覧アイコン表示）に整理し、各ストーリーを独立して検証可能にする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルを対象とし、未完了タスクに依存せず並列実行可能なタスク
- **[Story]**: 対応するユーザーストーリーラベル（US1, US2）

---

## Phase 1: Setup

**Purpose**: 本修正は既存 Chrome 拡張機能内の局所的 UI 修正であり、新規プロジェクト初期化は不要。

- [x] T001 既存の `src/` 配下における `pi-terminal` 参照箇所と関連スタイルを把握する（`research.md` で確認済み）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US1 および US2 の両方から共通利用する `>_` コマンド入力アイコンコンポーネントを作成する。

**⚠️ CRITICAL**: US1・US2 の `src/Popup.vue` 修正は本コンポーネント作成後に実施する。

- [x] T002 `>_` 形状の再利用可能なインライン SVG アイコンコンポーネントを `src/components/CommandPromptIcon.vue` に作成する（`stroke="currentColor"`, `width="1em"`, `height="1em"`, `aria-hidden="true"`, 日本語コメント付き）

**Checkpoint**: 共通アイコンコンポーネントが利用可能になり、US1・US2 の組み込みを開始できる。

---

## Phase 3: User Story 1 - コマンド入力モード切り替え時の検索欄左側アイコン表示 (Priority: P1) 🎯 MVP

**Goal**: 検索入力欄で先頭に `:` を入力してコマンド入力モードに入った際、左端のアイコンが虫眼鏡アイコン（`pi-search`）から緑色アクセントの `>_` コマンド入力アイコンへ即座に切り替わるようにする。

**Independent Test**: ポップアップの検索入力欄で空欄・通常検索語入力時は虫眼鏡アイコン、`:` や `:add dev` や `   :open` 入力時は `>_` コマンドアイコンが表示され、入力位置の横ズレがないことを確認できる。

### Implementation for User Story 1

- [x] T003 [US1] `src/Popup.vue` で `src/components/CommandPromptIcon.vue` をインポートし、検索欄左側アイコンを `isCommandInput` に応じて `CommandPromptIcon` と `i.pi.pi-search` に切り替えるよう更新する
- [x] T004 [US1] `src/Popup.vue` の `.search-leading-icon` スタイルを `width: 1rem; height: 1rem; display: inline-flex; align-items: center; justify-content: center;` に整え、切り替え前後で入力開始位置がズレないよう調整する

**Checkpoint**: US1 完了時点で、検索入力欄左側のコマンド入力アイコン切り替えが単体で機能・検証できる。

---

## Phase 4: User Story 2 - コマンド候補一覧における一貫したコマンドアイコン表示 (Priority: P2)

**Goal**: コマンド入力モード中に表示されるコマンド・補完候補一覧の各行左側アイコンにも、欠落（空白）ではなく同じ `>_` コマンド入力アイコンを表示する。

**Independent Test**: `:` や `:a` を入力して表示されるコマンド候補リストの左側アイコン領域に `>_` アイコンが緑色で描画されることを確認できる。

### Implementation for User Story 2

- [x] T005 [US2] `src/Popup.vue` の候補リストアイコン領域（`item.kind === 'command' || item.kind === 'completion'`）で未定義クラス `pi-terminal` を `CommandPromptIcon` コンポーネントへ置き換える

**Checkpoint**: US1・US2 の双方が一貫した `>_` アイコン表示で機能する。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: プロジェクト全体の整合性・型安全性・ビルド成果物更新・検証を実施する。

- [x] T006 `src/` 配下に未定義の `pi-terminal` 参照が残存していないことを検索確認する
- [x] T007 `npx tsc --noEmit` を実行し TypeScript 型エラーがゼロであることを確認する
- [x] T008 `npm run build` を実行し `package/js/` および `package.zip` がエラーなく最新化されることを確認する
- [x] T009 [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/013-popup-command-icon/quickstart.md) に基づく検証（可能であれば実レンダリング確認を含む）を実施する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 完了済み
- **Phase 2 (Foundational)**: T002 は T003〜T005 の前提条件
- **Phase 3 (US1)**: T002 完了後に実施（`src/Popup.vue` を編集）
- **Phase 4 (US2)**: T002 完了後に実施（T003〜T004 と同一ファイル `src/Popup.vue` のため順次実行）
- **Phase 5 (Polish)**: T003〜T005 完了後に順次実行（T006 → T007 → T008 → T009）

### Implementation Strategy

1. T002 で `src/components/CommandPromptIcon.vue` を作成する。
2. T003〜T005 で `src/Popup.vue` の検索入力欄左側アイコンおよびコマンド候補一覧アイコンを `CommandPromptIcon` に統合し、レイアウト固定サイズスタイルを適用する。
3. T006〜T009 で静的検索・型チェック・本番ビルド・動作確認を完了させる。
