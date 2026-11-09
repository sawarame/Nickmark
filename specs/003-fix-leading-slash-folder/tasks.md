---
description: "Task list for Leading Slash Folder Normalization & Filtering Fix"
---

# Tasks: 先頭スラッシュ付きフォルダ指定の正規化と認識バグ修正

**Input**: Design documents from `/specs/003-fix-leading-slash-folder/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/normalization-contract.md

**Tests**: 本仕様では自動テストスイート追加の明示的要求はないため、`npm run build` による型検査・バンドル検証および `quickstart.md` に基づく実機動作確認を実施します。

**Organization**: 各ユーザーストーリー（US1, US2, US3）ごとに独立して実装・検証できるようフェーズを分割しています。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルを編集し、未完了タスクへの依存がないため並列実行可能
- **[Story]**: 対応するユーザーストーリー（US1, US2, US3）
- 各タスクには対象ファイルの正確なパスを記載

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存ビルド環境および作業ブランチの事前確認

- [ ] T001 変更前のベースラインとして `npm run build` がエラーなく成功することを `package/js/` 出力で確認する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのユーザーストーリーの基盤となる共通パス正規化関数とストレージ辞書マージ機構の実装

**⚠️ CRITICAL**: ユーザーストーリー（Phase 3 以降）の実装に着手する前に本フェーズを完了する必要があります。

- [ ] T002 `src/background.ts` にニックネームおよびフォルダパスの先頭・末尾スラッシュ除去、連続スラッシュの単一化、各セグメントの前後空白トリムを行う純粋関数 `normalizeNicknamePath(rawPath: string): string`（スラッシュのみの場合は空文字 `""` を返す）を日本語 JSDoc 付きで実装・エクスポートする
- [ ] T003 `src/background.ts` にブックマーク辞書 `Record<string, BookmarkEntry[]>` の各キーを `normalizeNicknamePath` で正規化し、空文字キーを除外しつつ、正規化後に同一キーへ衝突するエントリ配列を `isSameUrl` で重複排除・統合（高 `score`、最新 `last_used_at`、`is_pinned` の論理和、非空の `title` / `default_value` を優先）するヘルパー関数 `normalizeBookmarksDictionary` を実装する
- [ ] T004 `src/background.ts` の `loadBookmarksData`、`saveBookmarksData`、および `getStorageDataWithTimestamp` において `normalizeBookmarksDictionary` を適用し、既存の未正規化データ（例: `/work/gh`）が読み込み・保存時に常に正規化済みキー（`work/gh`）として扱われるようにする

**Checkpoint**: 共通正規化関数 `normalizeNicknamePath` とストレージ層の自動正規化・マージが完了し、各ユーザーストーリーの実装を開始可能

---

## Phase 3: User Story 1 - 先頭スラッシュを含むニックネームのフォルダ絞り込みと管理 (Priority: P1) 🎯 MVP

**Goal**: 先頭スラッシュや連続スラッシュを含むニックネームが存在する場合でも、空文字フォルダが生成されることなく正しいフォルダとして抽出され、管理画面（`list.html`）でのフォルダ絞り込み・一括オープン・リネーム・一括削除が完全に機能するようにする。

**Independent Test**: `/work/gh` のように先頭スラッシュを含むデータを保持または登録した状態で管理画面を開き、フォルダドロップダウンに空フォルダが表示されず `📁 work` が表示され、`work` で絞り込んだ際に該当ブックマークが表示され、一括オープン・リネーム・削除が正常に動作することを確認する。

### Implementation for User Story 1

- [ ] T005 [US1] `src/background.ts` の `extractFolders` を修正し、各ニックネームキーに `normalizeNicknamePath` を適用してから `/` で分割することで、空文字 `""` フォルダの生成を防ぎ正確な `path`, `name`, `depth` を導出するようにする
- [ ] T006 [US1] `src/background.ts` のフォルダ一括操作関数（`openFolderUrls`, `renameFolder`, `deleteFolder`）を修正し、引数パスおよび対象ニックネーム比較時に `normalizeNicknamePath` を用いるとともに、`renameFolder` で変更先キーが既存キーと衝突した際にも既存エントリを上書き消失せずマージするようにする
- [ ] T007 [US1] `src/List.vue` で `./background` から `normalizeNicknamePath` をインポートし、`filteredBookmarks`（`__ROOT__` 未分類判定および特定フォルダ選択時の前方一致・完全一致判定）と `executeRenameFolder` の入力正規化に適用する

**Checkpoint**: User Story 1 が完了し、管理画面のフォルダ絞り込みおよびフォルダ一括操作が先頭スラッシュの有無にかかわらず独立して動作可能

---

## Phase 4: User Story 2 - アドレスバー（オムニボックス）での先頭スラッシュ付きフォルダ検索・一括オープン (Priority: P1)

**Goal**: アドレスバー（オムニボックス）で `nm /work/`、`nm /work`、`nm /work/gh`、または `nm :open /work` のように先頭にスラッシュを入力した場合でも、`work/` や `work` と入力した際と全く同様にフォルダ一括オープンやブックマーク検索が認識・実行されるようにする。

**Independent Test**: `work/gh` が登録されている状態で、アドレスバーに `nm /work/`、`nm /work`、`nm :open /work` と入力し、フォルダ一括オープン候補および `work/gh` の候補が正しく表示され、Enter キーで遷移・一括オープンできることを確認する。

### Implementation for User Story 2

- [ ] T008 [US2] `src/background.ts` の `resolveRegularSearchMatches` を修正し、1語目トークン（`firstToken`）および検索トークン群の比較時に先頭・末尾・連続スラッシュを正規化（`normalizeNicknamePath`）してニックネームの完全一致（Tier 1）・前方一致（Tier 2）・部分一致（Tier 3）・横断検索（Tier 4）を判定するようにする。また、`/` や `///` のみ入力され正規化後のトークンが空文字 `""` となる場合は、`startsWith("")` 等による全件誤ヒットを防ぐため即座に空配列 `[]` を返すガード処理を入れる
- [ ] T009 [US2] `src/background.ts` の `handleRegularSearchSuggestions` および `chrome.omnibox.onInputEntered` の通常検索モード処理を修正し、`/work/` のように先頭スラッシュと末尾スラッシュの両方を含む入力でも `normalizeNicknamePath` でフォルダパス `"work"` を解決してフォルダ一括オープン候補の表示・実行が行われるようにする（`/` や `///` のみで正規化後が空文字 `""` の場合はフォルダ一括オープン対象外として安全にスキップする）
- [ ] T010 [US2] `src/background.ts` の `resolveCommandMatches` および `executeCommand` における `:open`（`:o`）と `:rm` コマンド処理を修正し、引数に `/work` や `/work/gh` のように先頭スラッシュが含まれていても `normalizeNicknamePath` で正規化してサジェスト候補提示およびコマンド実行が行われるようにする

**Checkpoint**: User Story 1 と User Story 2 の双方が完了し、管理画面とオムニボックスの両方で先頭スラッシュ付きフォルダ指定が完全に機能する

---

## Phase 5: User Story 3 - 登録・編集時のニックネームパス正規化と入力補完 (Priority: P2)

**Goal**: 管理画面、ポップアップ、オムニボックスコマンド（`:add`, `:addall`）、JSON エディタからの登録・編集時に先頭・末尾・連続スラッシュを自動的に正規化して保存し、入力欄のオートコンプリートでも先頭スラッシュ付き入力（例: `/wo`）に対してフォルダ・ニックネーム候補を補完表示できるようにする。

**Independent Test**: ポップアップまたは管理画面でニックネーム欄に `/wo` と入力して `work/` が補完候補に出ることを確認し、`/work/test/` として保存した際に `work/test` に正規化されて保存されること、および `/` のみの入力がバリデーションエラーになることを確認する。

### Implementation for User Story 3

- [ ] T011 [US3] `src/background.ts` の `resolveCommandMatches` および `executeCommand` における `:add`（`:a`）と `:addall`（`:aa`）コマンド処理を修正し、ニックネーム引数を `normalizeNicknamePath` で正規化して補完検索および保存を行う（スラッシュのみで正規化後に空文字となる場合は必須エラーまたは管理画面フォールバックとする）
- [ ] T012 [P] [US3] `src/List.vue` の `searchNewBookmarkNicknames` において、入力クエリの先頭スラッシュ除去・連続スラッシュ単一化を行いつつユーザーが末尾に `/` を入力している場合は末尾 `/` を維持して（例: `/work/` → `work/`、`work2/` 等との誤一致を防止）フォルダ・ニックネーム補完を行い、`addBookmark`、`saveEditBookmark`、および `validateBookmarksJson` / `saveJsonEdit` の保存時には `normalizeNicknamePath` を適用してスラッシュのみの入力（正規化後 `""`）を必須エラーとして弾くようにする
- [ ] T013 [P] [US3] `src/Popup.vue` で `./background` から `normalizeNicknamePath` をインポートし、`searchNicknames` では入力クエリの先頭スラッシュ除去・連続スラッシュ単一化を行いつつ末尾 `/` の有無を維持して（例: `/work/` → `work/`）フォルダ・ニックネーム補完を行い、`saveBookmark` の保存時には `normalizeNicknamePath` を適用して空文字バリデーションを行うようにする

**Checkpoint**: すべてのユーザーストーリー（US1, US2, US3）が完了し、登録・補完・検索・絞り込みの全経路でパス正規化が一貫して機能する

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: ドキュメントの同期と最終ビルド・パッケージ検証

- [ ] T014 [P] `.context/spec.md` を更新し、ニックネームおよびフォルダ指定における先頭・末尾・連続スラッシュの自動正規化仕様を反映する
- [ ] T015 `npm run build` を実行し、TypeScript のコンパイル、`package/js/` バンドル生成、および `package.zip` の作成がエラーなく完了することを検証する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし（即時開始可能）
- **Foundational (Phase 2)**: Phase 1 完了後に開始 — **すべてのユーザーストーリーの前提条件**
- **User Stories (Phase 3〜5)**: Phase 2 完了後に開始
  - User Story 1 (P1) → User Story 2 (P1) → User Story 3 (P2) の優先順位順に進行
  - User Story 3 内の `src/List.vue` (T012) と `src/Popup.vue` (T013) は異なるファイルのため並列実行可能 `[P]`
- **Polish (Phase 6)**: 全ユーザーストーリー完了後に実行

### User Story Dependencies

- **User Story 1 (P1)**: Phase 2 (`normalizeNicknamePath`, `normalizeBookmarksDictionary`) に依存。他ストーリーへの依存なし。
- **User Story 2 (P1)**: Phase 2 および T005 (`extractFolders` の正規化) に依存。
- **User Story 3 (P2)**: Phase 2 に依存。管理画面 (`src/List.vue`)・ポップアップ (`src/Popup.vue`)・オムニボックス (`src/background.ts`) の各登録経路を独立してテスト可能。

---

## Parallel Example: User Story 3

```bash
# User Story 3 において異なる UI コンポーネントの正規化タスクを並列実行可能:
Task T012: "src/List.vue の AutoComplete 補完および新規追加・編集・JSON保存時の正規化実装"
Task T013: "src/Popup.vue の AutoComplete 補完およびクイック登録保存時の正規化実装"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Phase 1（Setup）および Phase 2（Foundational: `normalizeNicknamePath` と辞書正規化）を完了する
2. Phase 3（User Story 1: フォルダ抽出と管理画面のフォルダ絞り込み・一括操作）を完了し、管理画面での認識バグ解消を確認する
3. Phase 4（User Story 2: オムニボックスでの先頭スラッシュ検索・一括オープン）を完了する
4. Phase 5（User Story 3: 全登録経路・オートコンプリートの正規化）および Phase 6（ドキュメント同期とビルド検証）を完了する
