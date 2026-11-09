---
description: "Task list for Exclude Standalone Bookmarks from Folder Bulk Open"
---

# Tasks: フォルダ一括オープン時における同名単体ブックマークの除外

**Input**: Design documents from `/specs/005-fix-folder-bulk-open/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/bulk-open-contract.md, quickstart.md

**Tests**: 本仕様では自動テストスイート追加の明示的要求はないため、`npm run build` による型検査・バンドル検証および `quickstart.md` に基づく実機動作確認を実施します。

**Organization**: 各ユーザーストーリー（US1, US2）ごとに独立して実装・検証できるようフェーズを分割しています。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルを編集し、未完了タスクへの依存がないため並列実行可能
- **[Story]**: 対応するユーザーストーリー（US1, US2）
- 各タスクには対象ファイルの正確なパスを記載

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存ビルド環境および作業ブランチの事前確認

- [X] T001 変更前のベースラインとして `npm run build` がエラーなく成功することを `package/js/` 出力で確認する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのユーザーストーリーの前提となる判定論理の整合性確認

**⚠️ CRITICAL**: ユーザーストーリー（Phase 3 以降）の実装に着手する前に本フェーズを完了する必要があります。

- [X] T002 `src/background.ts` において、フォルダ配下判定から完全一致（`normNick === normalizedPath`）を除外しフォルダプレフィックス前方一致（`normNick.startsWith(folderPrefix)`）のみを対象とする共通方針を確認・検証する

**Checkpoint**: 判定論理の共通方針が確立し、各ユーザーストーリーの実装を開始可能

---

## Phase 3: User Story 1 - フォルダ一括オープン時に同名単体ブックマークを除外 (Priority: P1) 🎯 MVP

**Goal**: オムニボックス（`nm work/`, `:open work/` 等）および管理画面からフォルダ一括オープンを実行した際、フォルダ名と同名の単体ブックマークが開かず、指定フォルダ配下のブックマークのみが開くようにする。

**Independent Test**: 単体 `work` と配下 `work/mail` を登録した状態で、オムニボックスで `nm work/` や `:open work/`、または管理画面で `work` フォルダの一括オープンを実行し、`work/mail` のみが新規タブで開き、単体 `work` が開かないことを確認する。

### Implementation for User Story 1

- [X] T003 [US1] `src/background.ts` の `openFolderUrls` 関数を修正し、`matchingNicknames` のフィルタリング条件から `normNick === normalizedPath` を除去して `normNick.startsWith(folderPrefix)` のみに限定することで、同名単体ブックマークを一括オープンの収集対象から完全に除外する
- [X] T004 [US1] `src/background.ts` のオムニボックスコマンド処理（`cmd === ':open' || cmd === ':o'`）および `onInputEntered` の一括オープン実行ロジックを検証し、末尾スラッシュ付き指定（`:open work/` やデフォルトサジェスト選択）時に単体 `work` が開かず、単体指定（`:open work`）時には単体 `work` が優先起動される既存の優先順位仕様が維持されていることを確認する

**Checkpoint**: User Story 1 が完了し、フォルダ一括オープン時に同名単体ブックマークが確実に除外される

---

## Phase 4: User Story 2 - 管理画面におけるフォルダ管理の整合性確保 (Priority: P2)

**Goal**: 管理画面で特定フォルダを選択した際、フォルダ配下に登録されたブックマークのみが表示され、同名単体ブックマークが一覧に混入したり、フォルダのリネームや一括削除に巻き込まれたりしないようにする。

**Independent Test**: 単体 `work` と配下 `work/mail` が登録されている状態で、管理画面のフォルダフィルタで「work」を選択した際に `work/mail` のみが表示されること、「未分類（ルート）」を選択した際に単体 `work` が表示されること、および「work」フォルダのリネームや削除を実行しても単体 `work` が保護され変更・削除されないことを確認する。

### Implementation for User Story 2

- [X] T005 [P] [US2] `src/List.vue` の `filteredBookmarks` 算出プロパティを修正し、特定フォルダ選択時のフィルタ条件から `normNick === folderPath` を除去して `normNick.startsWith(prefix)` のみに限定することで、フォルダ名と同名の単体ブックマークがフォルダ一覧に混入せず「未分類（ルート）」にのみ表示されるようにする
- [X] T006 [P] [US2] `src/background.ts` の `renameFolder` 関数を修正し、`normKey === normOld` のキー（同名単体ブックマーク）を置換対象外としてそのまま維持し、`normKey.startsWith(oldPrefix)` を満たすフォルダ配下キーのみをリネームするようにする
- [X] T007 [US2] `src/background.ts` の `deleteFolder` 関数を修正し、`normKey === normPath` のキー（同名単体ブックマーク）を削除対象外としてそのまま維持し、`normKey.startsWith(prefix)` を満たすフォルダ配下キーのみを一括削除するようにする

**Checkpoint**: User Story 1 と User Story 2 の双方が完了し、一括オープン・表示絞り込み・リネーム・削除の全操作において単体ブックマークの安全性が保証される

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: ドキュメント同期と最終ビルド・実機動作検証

- [X] T008 [P] `.context/spec.md` を更新し、フォルダ一括オープンおよびフォルダ管理における同名単体ブックマーク（未分類エントリ）の除外・保護仕様を同期・反映する
- [X] T009 `npm run build` を実行し、TypeScript のコンパイル、`package/js/` バンドル生成、および `package.zip` の作成がエラーなく完了することを検証する
- [X] T010 `specs/005-fix-folder-bulk-open/quickstart.md` の検証シナリオ（シナリオ 1〜6）に従って実機動作確認を実施する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし（即時開始可能）
- **Foundational (Phase 2)**: Phase 1 完了後に開始 — **すべてのユーザーストーリーの前提条件**
- **User Stories (Phase 3〜4)**: Phase 2 完了後に開始
  - User Story 1 (P1 🎯 MVP) → User Story 2 (P2) の優先順位順に進行
  - User Story 2 内の `src/List.vue` (T005) と `src/background.ts` のリネーム修正 (T006) は異なるファイル・機能のため並列実行可能 `[P]`
- **Polish (Phase 5)**: 全ユーザーストーリー完了後に実行

### User Story Dependencies

- **User Story 1 (P1)**: Phase 2 に依存。他ストーリーへの依存なし（MVP として単独リリース可能）。
- **User Story 2 (P2)**: Phase 2 に依存。US1 と同一のプレフィックス前方一致ルールを管理画面・リネーム・削除に拡張適用。

---

## Parallel Opportunities

- **Phase 4**: `T005`（`src/List.vue` のフィルタ修正）と `T006`（`src/background.ts` の `renameFolder` 修正）は異なるファイルを対象とするため並列実行可能。
- **Phase 5**: `T008`（`.context/spec.md` のドキュメント更新）はコード変更タスク完了後、ビルドや実機検証と並行して進めることが可能。

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup（ビルド確認）
2. Phase 2: Foundational（判定論理方針の確認）
3. Phase 3: User Story 1（`openFolderUrls` の修正とオムニボックス優先順位検証）
4. **ここで単独検証**: オムニボックスで `nm work/` や `:open work/` を実行し、単体 `work` が開かないことを確認（MVP 達成！）

### Incremental Delivery

1. MVP 達成後、Phase 4: User Story 2（管理画面フィルタ、リネーム、削除の単体保護）を実装
2. Phase 5: ドキュメント同期と最終ビルド・実機検証を行い完了
