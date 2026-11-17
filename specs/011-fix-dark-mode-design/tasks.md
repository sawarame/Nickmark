---

description: "ダークモード時の設定画面・管理画面の配色と視認性修正に関する実装タスク一覧"
---

# Tasks: ダークモード時の設定画面・管理画面の配色と視認性修正

**Input**: Design documents from `/specs/011-fix-dark-mode-design/` (Related Issue: #22)
**Prerequisites**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/plan.md), [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/spec.md), [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/research.md), [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/quickstart.md)

**Tests**: 本機能は CSS トークン・テーマ設定の修正であり、TypeScript コンパイルおよび Webpack 本番ビルド検証（`npm run build`）と、ビルド成果物およびブラウザ検証シナリオ（`quickstart.md`）で検証を行う。

**Organization**: ユーザーストーリー（US1: 設定画面背景・ヘッダ視認性, US2: データ移行ダイアログ視認性, US3: 一覧画面背景・ヘッダ視認性）ごとにフェーズを分割し、段階的に検証可能な構成とする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルへの変更であり、未完了タスクへの依存がなく並列実行可能
- **[Story]**: 対応するユーザーストーリー（`[US1]`, `[US2]`, `[US3]`）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存実装とビルド環境のベースライン確認

- [x] T001 変更対象ファイル（`src/shared/appBootstrap.ts`, `src/Preferences.vue`, `src/List.vue`, `package/preferences.html`, `package/list.html`, `package/popup.html`）の現状と `npm run build` ベースラインを確認する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: PrimeVue テーマの共通プリセット拡張により、ライト／ダークモードに追従するページ背景セマンティックトークン `--p-page-background` を提供する

**⚠️ CRITICAL**: すべてのユーザーストーリーのページ背景修正はこのタスクに依存する

- [x] T002 `src/shared/appBootstrap.ts` で `@primeuix/themes` の `definePreset` を用いて `Aura` プリセットを拡張し、`semantic.colorScheme.light.page.background` に `'{surface.100}'`、`semantic.colorScheme.dark.page.background` に `'{surface.950}'` を定義した `NickmarkPreset` を PrimeVue に適用する（日本語 JSDoc・コメントを記載）

**Checkpoint**: `--p-page-background` トークンがライト／ダークモードで切り替わる基盤が完成

---

## Phase 3: User Story 1 - ダークモード時の設定画面における背景と文字の視認性確保 (Priority: P1) 🎯 MVP

**Goal**: 設定画面（`preferences.html` / `src/Preferences.vue`）のページ背景をダークモードに追従させ、ヘッダの見出し文字・戻るボタン・各設定カードが明瞭に視認でき、初期表示時の白いちらつきも防ぐ

**Independent Test**: ダークモードで `preferences.html` を開き、画面全体（余白含む）が暗い背景色であり、ヘッダタイトル・戻るボタン・カード内容が十分なコントラストで表示されることを単独で確認できる

### Implementation for User Story 1

- [x] T003 [P] [US1] `package/preferences.html` から `<body style="margin: 0; background-color: var(--p-surface-100);">` のインライン背景指定を削除し、`<head>` 内 `<style>` で `var(--p-page-background, #f1f5f9)` / `var(--p-text-color, #334155)` および `@media (prefers-color-scheme: dark)` 用フォールバック（`#09090b` / `#ffffff`）を設定する
- [x] T004 [P] [US1] `src/Preferences.vue` の `<style scoped>` 内の `.container` 背景色を `var(--p-surface-100)` から `var(--p-page-background)` へ変更する

**Checkpoint**: 設定画面のページ背景・ヘッダ文字視認性（US1）が単独で検証可能

---

## Phase 4: User Story 2 - 設定画面のデータ移行ダイアログにおける視認性確保 (Priority: P2)

**Goal**: 設定画面のデータ移行ダイアログ内にあるローカル／クラウドデータ比較領域（`.comparison-grid`）と最新データ強調枠（`.comparison-item.latest`）を、ライト／ダーク双方で高コントラストなセマンティックトークン配色へ修正する

**Independent Test**: ダークモードおよびライトモードの双方で `preferences.html` のデータ移行ダイアログを開き、比較パネルと強調側の文字・枠線・背景が判読できることを単独で確認できる

### Implementation for User Story 2

- [x] T005 [US2] `src/Preferences.vue` の `<style scoped>` 内の `.comparison-grid`（`var(--p-form-field-filled-background)`, `var(--p-content-border-color)`, `var(--p-text-color)`）および `.comparison-item.latest`（`var(--p-highlight-background)`, `color-mix(in srgb, var(--p-primary-color) 35%, transparent)`, `var(--p-highlight-color)`）をセマンティックトークンへ更新する

**Checkpoint**: データ移行ダイアログの視認性（US2）が設定画面全体と整合した状態で検証可能

---

## Phase 5: User Story 3 - ダークモード時のブックマーク一覧画面（管理画面）における視認性確保 (Priority: P2)

**Goal**: ブックマーク一覧画面（`list.html` / `src/List.vue`）も設定画面と同様にページ背景を `--p-page-background` へ追従させ、ダークモード時のヘッダ文字・設定アイコンボタンの視認性を確保し、あわせて `popup.html` の初期ダークフォールバックも整える

**Independent Test**: ダークモードおよびライトモードで `list.html` を開き、ページ全体の背景・ヘッダ・歯車ボタン・カード・テーブルの視認性が保たれ、OS カラースキーム切替時に即座に追従することを単独で確認できる

### Implementation for User Story 3

- [x] T006 [P] [US3] `package/list.html` から `<body style="margin: 0; background-color: var(--p-surface-100);">` のインライン背景指定を削除し、`<head>` 内 `<style>` で `var(--p-page-background, #f1f5f9)` / `var(--p-text-color, #334155)` および `@media (prefers-color-scheme: dark)` 用フォールバック（`#09090b` / `#ffffff`）を設定する
- [x] T007 [P] [US3] `src/List.vue` のグローバル `body` スタイルに `color: var(--p-text-color);` を補完し、`<style scoped>` 内の `.container` 背景色を `var(--p-surface-100)` から `var(--p-page-background)` へ変更する
- [x] T008 [P] [US3] `package/popup.html` の `<head><style>` に `@media (prefers-color-scheme: dark)` 用の初期フォールバック（`var(--p-content-background, #18181b)`, `var(--p-text-color, #ffffff)`）を追加する

**Checkpoint**: 設定画面・一覧画面・ポップアップの全画面がダークモード・ライトモード双方で整合した状態で動作可能

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: ビルド成果物生成、CSS 出力・コード品質検証、および `quickstart.md` に基づく最終確認

- [x] T009 `npm run build` を実行し、TypeScript コンパイルおよび Webpack バンドル（`package/js/*` および `package.zip`）がエラーなく完了することを確認する
- [x] T010 ソースコード・HTML 内に非反転トークン（`var(--p-surface-100)` や `var(--p-surface-50)` / `var(--p-primary-50)` の背景・枠線用途）の残存がないこと、および日本語 JSDoc・コメント規約と `DESIGN.md` / `Constitution` 準拠（`DESIGN.md` の変数例更新含む）を検査する
- [x] T011 `specs/011-fix-dark-mode-design/quickstart.md` の検証手順に従って生成バンドル内の `--p-page-background` 出力とライト／ダーク両モードの CSS 変数の生成を確認する（実 Chrome 拡張機能画面での目視確認は PR レビュー／手動検証項目として明記）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - 即座に開始可能
- **Foundational (Phase 2)**: Phase 1 完了後 - すべての画面での `--p-page-background` 利用をブロック
- **User Story 1 (Phase 3)**: Phase 2 完了後に開始可能（`T003` と `T004` は別ファイルのため並列可）
- **User Story 2 (Phase 4)**: `src/Preferences.vue` を編集するため `T004` 完了後に実行（`T005`）
- **User Story 3 (Phase 5)**: Phase 2 完了後に US1/US2 と並列で開始可能（`T006`, `T007`, `T008` はそれぞれ別ファイルのため並列可）
- **Polish (Phase 6)**: Phase 3〜5 完了後に実行（`T009` → `T010`, `T011`）

### Parallel Opportunities

- `T003` (`package/preferences.html`), `T004` (`src/Preferences.vue`), `T006` (`package/list.html`), `T007` (`src/List.vue`), `T008` (`package/popup.html`) は Foundational (`T002`) 完了後に並列実行可能（`T004` と `T005` は同一ファイル `src/Preferences.vue` のため順次実行）。

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (`T001`) + Phase 2 (`T002`) を完了する
2. Phase 3 (`T003`, `T004`) を実装し、設定画面（Issue #22 の主訴）のダークモード視認性を解消する
3. Phase 4 (`T005`)・Phase 5 (`T006`〜`T008`) を順次適用し、データ移行ダイアログ・一覧画面・ポップアップを含めて一貫したダークモード対応を完成させる
4. Phase 6 (`T009`〜`T011`) でビルドと最終検証を完了する
