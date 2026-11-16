# Phase 1 インターフェース契約: ブックマーク一覧の並び替え機能

**Feature**: `010-list-bookmark-sorting` | **Date**: 2026-11-17

## 1. 共有モジュール契約

### 1.1 `src/shared/types.ts`

```typescript
/**
 * 管理画面一覧のツールバーで選択可能な並び替え基準の型定義
 */
export type ListSortOption =
  | 'default'
  | 'last_used_desc'
  | 'last_used_asc'
  | 'score_desc'
  | 'score_asc';

/**
 * 管理画面一覧のデフォルト並び替え設定
 */
export const DEFAULT_LIST_SORT_OPTION: ListSortOption = 'default';
```

### 1.2 `src/shared/listSort.ts`（新規モジュール）

- `isValidListSortOption(value: unknown): value is ListSortOption`
  - **契約**: `value` が許可された 5 つの `ListSortOption` 文字列のいずれかである場合のみ `true` を返す。
- `parseValidListSortOption(value: unknown): ListSortOption`
  - **契約**: `isValidListSortOption(value)` が `true` ならその値を返し、それ以外（`undefined`, `null`, 不正文字列、別型）なら `DEFAULT_LIST_SORT_OPTION` (`'default'`) を返す。例外を送出しない。
- `sortBookmarkRows<T extends { nickname: string; url: string; score: number; last_used_at: number }>(rows: readonly T[], sortOption: ListSortOption): T[]`
  - **契約**:
    - 入力配列 `rows` を破壊的に変更せず、新しい配列（または `'default'` 時は浅いコピー）を返す。
    - `sortOption === 'default'` の場合、`rows` の元の順序をそのまま保持した配列を返す。
    - `last_used_desc` / `last_used_asc` の場合、各行の `last_used_at`（有限数値でない場合は `0`）の数値大小で降順／昇順に並べる。`is_pinned` は考慮しない。
    - `score_desc` / `score_asc` の場合、各行の `score`（有限数値でない場合は `0`）の数値大小で降順／昇順に並べる。`is_pinned` は考慮しない。
    - 主比較値が同値の場合、`a.nickname.localeCompare(b.nickname)` → `a.url.localeCompare(b.url)` の順で決定的タイブレークを行う。

### 1.3 `src/shared/storage.ts` & `src/background.ts`

- `getListSortOrder(): Promise<ListSortOption>`
  - **契約**: メモリキャッシュがあれば即返し、未キャッシュ時は `chrome.storage.local.get('listSortOrder')` から取得し、`parseValidListSortOption` で正規化してキャッシュ・返却する。
- `setListSortOrder(sortOrder: ListSortOption): Promise<void>`
  - **契約**: `parseValidListSortOption(sortOrder)` で正規化した値をキャッシュへ保存し、`chrome.storage.local.set({ listSortOrder: normalized })` を実行する。
- `updateListSortOrderCache(value: unknown): void`
  - **契約**: 外部（`chrome.storage.onChanged`）からの変更通知を受けてキャッシュを `parseValidListSortOption(value)` に更新する。
- `src/background.ts`:
  - `export * from './shared/listSort';` を追加し、他共有モジュールと同じく再エクスポートする。
  - `chrome.storage.onChanged` リスナーの `area === 'local'` 分岐に `changes.listSortOrder` ハンドリングを追加し、`updateListSortOrderCache` を呼び出す。

---

## 2. UI・インタラクション契約（`src/List.vue`）

### 2.1 ツールバー構成

- `.folder-toolbar` 内に既存のフォルダ絞り込み `Select`（`#folder-filter`）と並べて並び替え `Select`（`#bookmark-sort`）を配置する。
- ラベルには `pi pi-sort-alt` アイコンと `t('sortOrderLabel')` を表示し、`for="bookmark-sort"` で `Select` と関連付ける。
- `DataTable` の既存 5 列（`nickname`, `title`, `url`, `Pinned`, `Actions`）および固定幅レイアウト（`table-layout: fixed`, `min-width: 820px`）は変更しない。

### 2.2 PrimeVue `DataTable` バインディング

- `:value="sortedFilteredBookmarks"`
- `v-model:first="tableFirst"`
- `v-model:sortField="tableSortField"`
- `v-model:sortOrder="tableSortOrder"`
- `@sort="handleTableSort"`

---

## 3. 多言語メッセージキー契約（`package/_locales/{ja,en}/messages.json`）

| キー | 日本語 (`ja`) | 英語 (`en`) |
| :--- | :--- | :--- |
| `sortOrderLabel` | `並び替え` | `Sort` |
| `sortOrderDefault` | `デフォルト順` | `Default` |
| `sortOrderLastUsedDesc` | `最終使用日時（新しい順）` | `Last Used (Newest)` |
| `sortOrderLastUsedAsc` | `最終使用日時（古い順）` | `Last Used (Oldest)` |
| `sortOrderScoreDesc` | `スコア（高い順）` | `Score (Highest)` |
| `sortOrderScoreAsc` | `スコア（低い順）` | `Score (Lowest)` |
