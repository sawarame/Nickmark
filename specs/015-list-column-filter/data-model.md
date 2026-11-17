# Data Model: ブックマーク一覧の列別フィルター機能

**Feature**: `015-list-column-filter`  
**Date**: 2026-11-18

## 1. 列フィルター対象フィールドと状態型 (`src/shared/types.ts` / `src/List.vue`)

```typescript
/**
 * ブックマーク一覧テーブルで列別フィルターが可能なフィールド種別
 */
export type FilterableColumnField = 'nickname' | 'title' | 'url';

/**
 * 単一列のフィルター UI 開閉および検索クエリ状態
 */
export interface ColumnFilterItemState {
  /** フィルター入力欄（テキストエリア）が展開表示されているか */
  open: boolean;
  /** 入力されている検索ワード文字列 */
  query: string;
}

/**
 * 一覧テーブル全 3 列のフィルター状態マップ
 */
export type ColumnFiltersState = Record<FilterableColumnField, ColumnFilterItemState>;

/**
 * 絞り込み判定関数へ渡す列別クエリ文字列マップ
 */
export interface ColumnFilterQueries {
  nickname?: string;
  title?: string;
  url?: string;
}
```

## 2. 状態遷移とバリデーションルール

| 操作 | 状態遷移 | 副作用 |
| :--- | :--- | :--- |
| 初期表示 | 全列とも `{ open: false, query: '' }` | フィルター未適用 |
| フィルターボタンをクリック（`open === false` のとき） | 対象列の `open` を `true` に変更 | `nextTick` で対象列の `Textarea` にフォーカスを当てる |
| フィルターボタンをクリック（`open === true` のとき） | 対象列の `open` を `false` に変更し、`query` を `''` にクリア | 対象列の絞り込みを解除し、`tableFirst = 0`（1 ページ目）にリセット |
| テキストエリアへの文字入力 | 対象列の `query` を更新（改行文字は除去） | `tableFirst = 0`（1 ページ目）にリセットし、リアルタイムに一覧を再絞り込み |
| クリアボタン（`×`）をクリック | 対象列の `query` を `''` にクリア（`open` は維持） | `tableFirst = 0` にリセットし、対象列の `Textarea` にフォーカスを戻す |
| テキストエリア上で `Escape` キー押下 | `query` が空でない場合は `query = ''` にクリア、空の場合は `open = false` に閉じる | 段階的にクリア・クローズが可能 |
| テキストエリア上で `Enter` キー押下（IME 変換中を除く） | 改行挿入を防止（`event.preventDefault()`） | 1 行の検索ワードとして維持 |
