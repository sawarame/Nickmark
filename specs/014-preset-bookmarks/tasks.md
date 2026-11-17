# Tasks: 定番ブックマーク・ブックマークレットのプリセット機能

**Input**: Design documents from `/specs/014-preset-bookmarks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 共有型定義および多言語リソース基盤の準備

- [x] T001 `src/shared/types.ts` に `PresetCategory`（`'dynamic_url' | 'bookmarklet'`）、`PresetId`（全12種リテラル型）、`PresetDefinition` インターフェース、および `ENABLED_PRESETS_STORAGE_KEY = 'enabledPresets'` 定数を追加する
- [x] T002 [P] `package/_locales/ja/messages.json` にプリセット設定セクションの見出し・説明、全12件のプリセットタイトル・補足説明、一括選択/解除ボタン、およびプリセット案内 Tip（`popupTipPresets`）の日本語メッセージを追加する
- [x] T003 [P] `package/_locales/en/messages.json` にプリセット設定セクションの見出し・説明、全12件のプリセットタイトル・補足説明、一括選択/解除ボタン、およびプリセット案内 Tip（`popupTipPresets`）の英語メッセージを追加する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: プリセットカタログ定義・合成ロジックおよびハイブリッドストレージ管理の構築

- [x] T004 `src/shared/presets.ts` を新規作成し、全12件の `PRESET_DEFINITIONS`（`g`, `yt`, `gh`, `map`, `tr`, `wiki`, `amz`, `x`, `npm`, `mdn`, `mdlink`, `wayback`）、ID 検証・正規化関数 `isValidPresetId` / `normalizeEnabledPresetIds`（定義済み12種のみ許可・重複除外・定義順ソート）、ロケール別 URL 解決関数 `resolvePresetUrl`（`wiki` の日英ドメイン切り替え対応）、および仮想エントリ合成関数 `mergeBookmarksWithPresets`（固定 `score: 1.0`, `is_pinned: false`、同一ニックネーム＋同一 URL のユーザー登録エントリがある場合は重複除外）を実装する
- [x] T005 `src/shared/storage.ts` に `enabledPresets` の読み込み・保存・キャッシュ管理関数（`getEnabledPresetIds`, `setEnabledPresetIds`, `loadEnabledPresetsFromStorage`, `saveEnabledPresetsToStorage`, `updateEnabledPresetsCache`, `clearEnabledPresetsCache`, `loadSearchableBookmarksData`）を実装し、あわせて `saveToStorage('sync', bookmarks)` で `chrome.storage.sync.clear()` の代わりに `sync_data_*` チャンクキーのみを削除するよう修正する

**Checkpoint**: プリセット定義・合成およびストレージ永続化基盤が完了

---

## Phase 3: User Story 1 - 設定画面でのプリセット有効化と検索・遷移・実行 (Priority: P1) 🎯 MVP

**Goal**: 設定画面のチェックボックスでプリセットを ON/OFF でき、ポップアップおよびオムニボックスから動的 URL 検索やブックマークレット実行を行えるようにする

**Independent Test**: 設定画面でプリセットを有効化し、ポップアップおよびオムニボックスで `g query` や `mdlink` が動作し、一覧画面や JSON エクスポートには含まれないことを確認する

### Implementation for User Story 1

- [x] T006 [US1] `src/Preferences.vue` に PrimeVue `Checkbox` を用いた「定番プリセット（Presets）」カードを追加し、全12件のプリセット（動的 URL 10件・ブックマークレット 2件）のチェックボックス切り替え、すべて選択／すべて解除ボタン、および変更時の即時保存とトースト通知を実装する
- [x] T007 [US1] `src/Popup.vue` で起動時および `chrome.storage.onChanged` 時に `enabledPresetIds` を読み込み、通常検索時は `mergeBookmarksWithPresets` で合成した辞書を検索対象とし、`:` コマンド入力時はユーザー登録ブックマークのみを対象とするよう更新する
- [x] T008 [US1] `src/background.ts` で `src/shared/presets.ts` を再エクスポートするとともに、オムニボックスの通常検索サジェスト・確定遷移時に `loadSearchableBookmarksData`（プリセット合成済み辞書）を使用するよう更新する
- [x] T009 [US1] `src/shared/commands.ts` の `:open` 単一ニックネーム指定時に、ユーザー登録ブックマークに該当がない場合は有効化されたプリセットからも解決して開けるように更新する（`:rm` や `:add` は対象外を維持）

**Checkpoint**: User Story 1 の全機能が単独で動作・検証可能

---

## Phase 4: User Story 2 - ユーザー登録ブックマークとの優先度制御と Google アカウント同期連携 (Priority: P1)

**Goal**: Google アカウント同期の ON/OFF 移行時やマルチデバイス同期変更時に `enabledPresets` が確実に同期・移行され、ユーザー登録ブックマークとの優先度・スコア非消費が保証されるようにする

**Independent Test**: 同期 ON/OFF 移行時に `enabledPresets` がクラウド／ローカル間で適切に引き継がれ、プリセット実行時に `bookmarks` ストレージへの書き込みが発生しないことを確認する

### Implementation for User Story 2

- [x] T010 [US2] `src/Preferences.vue` の Google アカウント同期 ON/OFF 切り替えおよびデータ移行処理（`handleSyncToggle`, `performMigration`, `useExistingSyncData`, `keepExistingLocalData`）において、`bookmarks` とあわせて `enabledPresets` も選択された移行方向（ローカル→クラウド上書き、クラウドデータ採用、クラウド→ローカル上書き、ローカル保持）に従って同期・再読み込みするよう更新する
- [x] T011 [US2] `src/background.ts` および `src/shared/storage.ts` の `chrome.storage.onChanged` リスナーで `local` / `sync` 双方の `enabledPresets` 変更を検知してメモリキャッシュを即時更新するよう統合する

**Checkpoint**: User Story 1 および User Story 2 が統合動作

---

## Phase 5: User Story 3 - ポップアップ Tips によるプリセット機能の発見と多言語対応 (Priority: P2)

**Goal**: 初期状態がすべて OFF でもユーザーがプリセット機能に気づけるようポップアップ Tips に案内を追加し、言語切り替え時にプリセット表示や `wiki` ドメインが即座に切り替わるようにする

**Independent Test**: ポップアップの Tips にプリセット案内が表示され、日英切り替えで設定画面・検索候補・Tips がすべて選択言語に追従することを確認する

### Implementation for User Story 3

- [x] T012 [P] [US3] `src/shared/tips.ts` の `POPUP_TIPS` 配列にプリセット案内エントリ（`id: 'presets'`, `messageKey: 'popupTipPresets'`）を追加する
- [x] T013 [US3] `src/Popup.vue` で言語設定やプリセット設定の変更時にプリセットのローカライズタイトル・URL（`wiki` の日英ドメイン等）がリアクティブに再評価されることを確認・調整する

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: ドキュメント同期・ビルド検証・セルフレビュー

- [x] T014 [P] `.context/spec.md` に定番プリセット機能（全12件のラインナップ、初期状態 OFF、設定画面でのチェックボックス管理、Google アカウント同期連携、固定スコア・重複排除仕様）の記述を同期更新する
- [x] T015 `npm run build` を実行して TypeScript コンパイルおよび Webpack バンドル（`package/js/*` および `package.zip`）がエラーなく生成されることを検証し、プリセット合成・正規化・重複排除ロジックの単体動作テストを実行して全項目パスを確認する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001〜T003 は即時開始可能
- **Foundational (Phase 2)**: T004〜T005 は Phase 1 完了後に実行し、以降のユーザーストーリーの前提となる
- **User Stories (Phase 3〜5)**: Phase 2 完了後に順次または並行して実装可能
- **Polish (Phase 6)**: 全ストーリー実装完了後にドキュメント同期とビルド・テスト検証を実施

### Parallel Opportunities

- T002 (`ja/messages.json`) と T003 (`en/messages.json`) は並列実行可能
- T012 (`src/shared/tips.ts`) と T006 (`src/Preferences.vue`) は別ファイルのため並列実行可能

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1（型定義・多言語辞書）と Phase 2（プリセット定義・ストレージ基盤）を完成させる
2. Phase 3（設定画面 UI・ポップアップ／オムニボックス検索統合）を実装し、プリセットの有効化と検索・遷移を完成させる
3. Phase 4（Google アカウント同期移行連携）および Phase 5（ポップアップ Tips 追加）を実装する
4. Phase 6 で仕様ドキュメント更新と `npm run build` 検証を完了する
