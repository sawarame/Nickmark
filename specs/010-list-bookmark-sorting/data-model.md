# Phase 1 データモデル設計: ブックマーク一覧の並び替え機能

**Feature**: `010-list-bookmark-sorting` | **Date**: 2026-11-17

## 1. 型・エンティティ定義

### 1.1 `ListSortOption`（[types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts)）

管理画面のツールバーで選択・永続化される並び替えプリセットを表す文字列リテラルユニオン型。

| 値 | 表示名（ja） | 表示名（en） | 比較対象 | 方向 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `'default'` | デフォルト順 | Default | なし（元の格納順） | - | 初回未設定時および無効値フォールバック時の既定値 |
| `'last_used_desc'` | 最終使用日時（新しい順） | Last Used (Newest) | `last_used_at` | 降順 | 最近使ったものを先頭に表示 |
| `'last_used_asc'` | 最終使用日時（古い順） | Last Used (Oldest) | `last_used_at` | 昇順 | 長期間未使用のものを先頭に表示 |
| `'score_desc'` | スコア（高い順） | Score (Highest) | `score` | 降順 | 高スコアのものを先頭に表示 |
| `'score_asc'` | スコア（低い順） | Score (Lowest) | `score` | 昇順 | 低スコアのものを先頭に表示 |

- 定数: `DEFAULT_LIST_SORT_OPTION: ListSortOption = 'default'`

### 1.2 `FlatBookmarkRow`（[List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue) 既存型）

一覧テーブルの各行データ型（`BookmarkEntry` を継承）。変更は不要で、既存の以下のフィールドを並び替えに使用する。

| フィールド | 型 | 役割 | 欠損／不正値時の扱い |
| :--- | :--- | :--- | :--- |
| `nickname` | `string` | 同値時の第 1 タイブレーカー（昇順） | 空文字として比較 |
| `url` | `string` | 同値時の第 2 タイブレーカー（昇順） | 空文字として比較 |
| `last_used_at` | `number` | 最終使用日時（Epoch ms） | 有限数でない場合は `0` として扱う |
| `score` | `number` | 指数減衰スコア（浮動小数点数） | 有限数でない場合は `0` として扱う |
| `is_pinned` | `boolean \| undefined` | 参照しない（純粋値ソートのため優先しない） | - |

### 1.3 ローカル永続化設定（`chrome.storage.local`）

| ストレージキー | 型 | デフォルト値 | 同期対象 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `listSortOrder` | `ListSortOption` | `'default'` | 非対象（ローカル専用） | ユーザーがツールバーから最後に選択・保存した並び替え基準 |

- **バリデーション規則**: ストレージから取得した値が 5 種の有効値（`'default'`, `'last_used_desc'`, `'last_used_asc'`, `'score_desc'`, `'score_asc'`）に完全一致しない場合、`parseValidListSortOption` により安全に `'default'` へフォールバックする。

---

## 2. 並び替え・状態遷移モデル

### 2.1 一覧表示パイプライン

```text
bookmarksData (Record<string, BookmarkEntry[]>)
  │
  ▼ flatBookmarks (computed)
FlatBookmarkRow[]
  │
  ▼ filteredBookmarks (computed: selectedFolder に応じた絞り込み)
FlatBookmarkRow[]
  │
  ▼ sortedFilteredBookmarks (computed: selectedSortOrder に応じた並び替え)
FlatBookmarkRow[]
  │
  ▼ PrimeVue DataTable (:value="sortedFilteredBookmarks", v-model:sortField, v-model:sortOrder, v-model:first)
画面描画（ページング・列ヘッダーソート適用）
```

### 2.2 状態遷移ルール

1. **初期読み込み (`onMounted`)**:
   - `getListSortOrder()` を呼び出して保存済み `ListSortOption` を取得し、`selectedSortOrder` へ設定する。
   - `tableSortField` / `tableSortOrder` は `undefined` のまま開始し、`isLoaded = true` とすることで初期描画から保存済み並び順を適用する。
2. **ツールバー `Select` 変更 (`handleToolbarSortChange`)**:
   - `tableSortField.value = undefined`、`tableSortOrder.value = undefined` とし、列ヘッダーソートを解除する。
   - `tableFirst.value = 0` とし、ページングを 1 ページ目へ戻す。
   - `setListSortOrder(selectedSortOrder.value)` で `chrome.storage.local` へ永続化する。
3. **テーブル列ヘッダークリック (`handleTableSort`)**:
   - 列ヘッダー（`nickname` / `title` / `url`）のソートが有効になった場合（`event.sortField` が truthy）、`selectedSortOrder.value = 'default'` を**メモリ上のみ**で設定する（`setListSortOrder` は呼ばない）。
   - これにより、列ヘッダーソートが二重ソートや表示矛盾なく機能しつつ、ユーザーが再度ツールバーから同じオプションを選び直すことも可能となり、かつ次回リロード時は最後にツールバーで保存した設定が維持される。
4. **データ更新時（追加・インライン編集・ピン留め・削除・フォーカス復帰再読み込み）**:
   - `selectedSortOrder` および `tableSortField` / `tableSortOrder` はリセットせず維持し、`sortedFilteredBookmarks` のリアクティブ再計算により最新の並び順を即時反映する。
