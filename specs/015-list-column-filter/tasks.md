# Tasks: ブックマーク一覧の列別フィルター機能

**Input**: Design documents from `/specs/015-list-column-filter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 共有型定義および多言語リソースの準備

- [x] T001 `src/shared/types.ts` に `FilterableColumnField`（`'nickname' | 'title' | 'url'`）および `ColumnFilterQueries` インターフェースを追加する
- [x] T002 [P] `package/_locales/ja/messages.json` に列フィルターボタンのツールチップ、テキストエリアのプレースホルダー、およびクリアボタンの日本語メッセージを追加する
- [x] T003 [P] `package/_locales/en/messages.json` に列フィルターボタンのツールチップ、テキストエリアのプレースホルダー、およびクリアボタンの英語メッセージを追加する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 列別フィルタリング純粋関数の実装

- [x] T004 `src/shared/listSort.ts` に単一フィールドの大文字小文字非区別・スペース区切り AND 部分一致判定関数 `matchesColumnFilter` および複数列（`nickname`, `title`, `url`）の AND 絞り込み純粋関数 `filterBookmarkRowsByColumns` を実装する

**Checkpoint**: フィルタリング基盤ロジックが完了

---

## Phase 3: User Story 1 & 2 - 列ヘッダーのフィルターボタン表示と単一・複数列絞り込み連携 (Priority: P1) 🎯 MVP

**Goal**: 「ニックネーム」「タイトル」「URL」の各列ヘッダーにフィルターボタンを配置し、クリックでテキストエリアを表示・フォーカスして単一／複数列・フォルダ連携のリアルタイム絞り込みを行えるようにする

**Independent Test**: 各列のフィルターボタンをクリックしてテキストエリアに検索語を入力し、列ソートを誤発火させずに単一・複数列およびフォルダ選択との AND 条件で一覧が絞り込まれ、クリア操作で解除できることを確認する

### Implementation for User Story 1 & 2

- [x] T005 [US1] `src/List.vue` に 3 列（`nickname`, `title`, `url`）のフィルター状態（`columnFilters`）および DOM 参照・開閉トグル・自動フォーカス・入力正規化（改行除去・`tableFirst = 0` リセット）・クリア・キーハンドラ（`Enter` 改行防止、`Escape` クリア／クローズ）を実装する
- [x] T006 [US2] `src/List.vue` の `filteredBookmarks` 算出プロパティを更新し、フォルダ絞り込み結果に対して `filterBookmarkRowsByColumns` による列別フィルターを AND 適用して `sortedFilteredBookmarks` へ渡すよう統合する
- [x] T007 [US1] `src/List.vue` の `DataTable` 内「ニックネーム」「タイトル」「URL」各 `Column` の `<template #header>` に列タイトル・フィルターボタン（適用中は `pi-filter-fill` で強調表示）・展開時の `Textarea`＋クリアボタンを実装し、イベント伝播抑止（`@click.stop`, `@mousedown.stop`, `@keydown.stop`）で列ソートと分離する

---

## Phase 4: User Story 3 & Polish - スタイリング・ドキュメント同期・検証 (Priority: P2)

**Purpose**: 固定列幅レイアウトと調和するスタイリング、ドキュメント更新、およびビルド・単体テスト検証

- [x] T008 [US3] `src/List.vue` の `<style scoped>` に列ヘッダーフィルターボタンおよび展開テキストエリア・クリアボタンのスタイルを追加し、ライト／ダークモードのセマンティック CSS 変数と固定列幅に適合させる
- [x] T009 [P] `.context/spec.md` の「G. ブックマーク一覧画面（管理画面）」にニックネーム・タイトル・URL の列別フィルター機能の仕様を追記する
- [x] T010 `npm run build` を実行して TypeScript コンパイルおよび Webpack バンドルがエラーなく完了することを検証し、`matchesColumnFilter` / `filterBookmarkRowsByColumns` の単体テストを実行して全項目パスを確認する
