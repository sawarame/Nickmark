# Research: ブックマーク一覧の列別フィルター機能

**Feature**: `015-list-column-filter`  
**Date**: 2026-11-18  
**Related Issue**: #29

## 1. 列ヘッダーにおけるフィルターボタンとテキストエリアの配置方式

- **Decision**:
  - `src/List.vue` の `DataTable` 内の「ニックネーム (`nickname`)」「タイトル (`title`)」「URL (`url`)」各 `Column` において、`<template #header>` スロット（Fragment）と `:pt="{ columnHeaderContent: { class: 'filterable-header-content' } }"` を組み合わせる。
  - ヘッダーの 1 段目左側に列タイトル（`data-pc-section="columntitle"`）と PrimeVue 標準のソートアイコンを配置し、1 段目右端（`order: 2; margin-left: auto;`）にフィルターボタン（PrimeVue `Button`、アイコン `pi pi-filter` / 絞り込み中は `pi pi-filter-fill`）を配置する。
  - フィルターボタンがクリックされた列では、ヘッダーの 2 段目（`order: 3; flex: 0 0 100%; width: 100%;`）に検索ワード入力用の PrimeVue `Textarea`（`rows="1" autoResize`）およびクリアボタン（`×`）を展開表示し、`nextTick` で自動フォーカスを当てる。
- **Rationale**:
  - Issue #29 の要件「ブックマーク一覧の『ニックネーム』『タイトル』『URL』の項目にフィルターボタンをつけて、フィルターボタンをクリックするとテキストエリアが表示され、検索ワードが入力でき、入力したワードで一覧を絞り込むことができる」をそのまま直感的に実現できる。
  - ポップオーバー方式と異なり、複数列のフィルターを同時に開いて比較・入力しやすく、また既存の `table-layout: fixed` による固定列幅レイアウトを一切崩さない。
- **Alternatives considered**:
  - 案 A: PrimeVue DataTable 標準の `filterDisplay="menu"` ポップオーバーを使用する方式。
    - 却下理由: 演算子選択ドロップダウンなど過剰な UI が含まれる上、外クリックで閉じてしまい複数列の検索語を同時に確認しづらく、「テキストエリアが表示され」という要件とも異なるため。
  - 案 B: テーブル上部のツールバーに単一の横断検索バーを置く方式。
    - 却下理由: Issue #29 で明示的に「『ニックネーム』『タイトル』『URL』の項目にフィルターボタンをつけて」と列単位のフィルターが指定されているため。

## 2. ソート機能（`sortable`）とのイベント分離

- **Decision**:
  - PrimeVue v4 の `DTHeaderCell` は `<th>` 要素上で `onColumnHeaderClick` および `onColumnHeaderKeyDown` をリッスンしている。
  - そのため、フィルターボタンに `@click.stop`、`@mousedown.stop`、`@keydown.stop` を付与し、展開されるフィルター入力ボックス全体にも `@click.stop`、`@mousedown.stop`、`@keydown.stop` を付与することで、ボタン操作やテキスト入力中のキー操作（`Enter`, `Space`, 矢印キー等）がソートを発火させないようにする。
  - 一方、列タイトル（`data-pc-section="columntitle"`）やソートアイコンをクリックした場合は従来通り列ソートが機能する。
- **Rationale**:
  - PrimeVue `DataTable` の実装（`node_modules/primevue/datatable/index.mjs`）を直接確認し、`stopPropagation` によってソートとフィルター操作が完全に分離できることを検証済み。

## 3. 絞り込みロジックのモジュール化と複合条件

- **Decision**:
  - 絞り込み判定ロジックを `src/shared/listSort.ts`（または純粋関数 `matchesColumnFilter` / `filterBookmarkRowsByColumns`）として定義・エクスポートし、単体テストでも検証可能にする。
  - 各列の検索クエリは前後の空白をトリムし、スペース（半角・全角空白）で分割した各トークンがすべて対象列の文字列（小文字化後）に含まれる場合（AND 部分一致）にマッチと判定する。
  - 複数列（`nickname`, `title`, `url`）にクエリが入力されている場合は全列の AND 条件とし、さらに上部ツールバーのフォルダ選択（`selectedFolder`）とも AND 条件で絞り込んだ結果を `sortBookmarkRows` に渡す。
- **Rationale**:
  - 大文字・小文字の違いを意識せず直感的に絞り込め、複数キーワード入力時にも柔軟に目的の行を特定できる。
