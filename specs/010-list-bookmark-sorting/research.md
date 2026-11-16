# Phase 0 調査・設計判断: ブックマーク一覧の並び替え機能

**Feature**: `010-list-bookmark-sorting` | **Date**: 2026-11-17

本ドキュメントは、管理画面（[List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue)）への「最終使用日時」「スコア」並び替え機能追加にあたり、技術選定および設計選択肢の比較検討と採用根拠を記録する。

---

## 1. 並び替えロジックの配置とモジュール構成

### 検討した選択肢

- **案 A（採用）**: 型定義（`ListSortOption`, `DEFAULT_LIST_SORT_OPTION`）を [types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts) に追加し、純粋なソート・バリデーション関数を新規共有モジュール `src/shared/listSort.ts` に分離し、永続化関数を [storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts) に配置する。
- **案 B**: ソート関数・バリデーション・型定義をすべて [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue) 内に記述し、永続化だけ `chrome.storage.local` を直接呼び出す。
- **案 C**: ソート関数を [storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts) にすべて同居させる。

### 比較・採用根拠

- **案 B の問題点**: `List.vue`（現在 1,500 行超）の肥大化を招き、憲章 IV（モジュール間の型共有・単一責務）やテスト容易性に反する。また `chrome.storage.local` への直接アクセスをコンポーネントに散在させると、`storage.ts` で統一しているキャッシュ・検証パターンから逸脱する。
- **案 C の問題点**: `storage.ts` は永続化・キャッシュ・同期チャンク分割・スコア計算・フォルダ一括操作を担っており既に 660 行を超えているため、UI 向けの行配列比較ロジックまで混在させると凝集度が下がる。
- **案 A の利点**: 既存の `src/shared/tips.ts` や `src/shared/history.ts` と同じドメイン分離パターンに一致し、Chrome API 非依存の純粋関数として `listSort.ts` を独立検証できる。また [background.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/background.ts) からの再エクスポート方針とも整合する。

---

## 2. ソート選択状態の永続化先とスキーマ

### 検討した選択肢

- **案 A（採用）**: `chrome.storage.local` にデバイス固有設定キー `listSortOrder`（文字列 `'default' | 'last_used_desc' | 'last_used_asc' | 'score_desc' | 'score_asc'`）として保存し、[storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts) にキャッシュ付きアクセサ（`getListSortOrder`, `setListSortOrder`, `updateListSortOrderCache`）を設ける。
- **案 B**: `window.localStorage` に保存する。
- **案 C**: `chrome.storage.sync` に保存して他デバイスと同期する。

### 比較・採用根拠

- **案 B の問題点**: 拡張機能内の他の設定（`isSyncEnabled`, `language`, `maxBatchOpenTabs`, `historySearchEnabled`）がすべて `chrome.storage.local` に統一されており、憲章 II（`chrome.*` API による非同期統一）と不整合になる。
- **案 C の問題点**: 憲章 II に定められた `chrome.storage.sync` の 100KB 容量制限・チャンク構造に影響を与える可能性があり、仕様（Assumptions: 端末固有のローカル設定領域とし同期データに影響を与えない）に反する。
- **案 A の利点**: 既存のローカル設定（`maxBatchOpenTabs` 等）と完全に同一のキャッシュ＋`storage.onChanged` 更新パターンで実装でき、`parseValidListSortOption` によって破損・未知値に対しても安全に `'default'` へフォールバックできる。

---

## 3. ツールバー並び替えと DataTable 列ヘッダーソートの共存設計

### 検討した選択肢

- **案 A（採用）**: `DataTable` に `v-model:sortField="tableSortField"`・`v-model:sortOrder="tableSortOrder"`・`v-model:first="tableFirst"` と `@sort="handleTableSort"` をバインドし、`:value="sortedFilteredBookmarks"` を渡す。
  - ツールバー `Select` 変更時: `tableSortField` / `tableSortOrder` を `undefined` にクリアし、`tableFirst` を `0` に戻した上で `setListSortOrder` で永続化する。
  - 列ヘッダー（`nickname` / `title` / `url`）クリック時（`@sort`）: `event.sortField` が指定されていれば UI 上の `selectedSortOrder` をメモリ上のみ `'default'` に戻し（ストレージ上の保存値は上書きしない）、列ソートをそのまま機能させる。
- **案 B**: 既存列ヘッダーの `sortable` を削除し、ツールバーの `Select` にニックネーム・タイトル・URL を統合する。
- **案 C**: 列ヘッダークリック時も `selectedSortOrder` を変更せず、ツールバー上は直前の選択（例: 「最終使用日時（新しい順）」）を表示したままにする。

### 比較・採用根拠

- **案 B の問題点**: 既存の列ヘッダークリックによる昇順／降順切り替え（FR-007）を奪うことになり、既存ユーザーの操作習慣に対する退行となる。
- **案 C の問題点**: テーブルが「ニックネーム順」で並んでいるのにツールバーに「最終使用日時（新しい順）」が表示され続ける矛盾が生じる。さらに、PrimeVue `Select` の `v-model` が `'last_used_desc'` のままだと、ユーザーがもう一度「最終使用日時（新しい順）」をクリックしても値変化イベントが発火せず戻せなくなる。
- **案 A の利点**: PrimeVue v4 の `DataTable.vue`（`d_sortField` / `d_sortOrder` ウォッチャー）が `sortField`/`sortOrder` の `undefined` 代入で即座に列ソート表示・適用を解除する仕様を活用できる。UI 表示と実ソート状態が常に一致し、再選択も可能で、かつページ再読み込み時はツールバーで最後に選んだ永続化設定が復元される。

---

## 4. 同値タイブレーカーと数値・欠損値の安全性

### 検討した選択肢

- **案 A（採用）**: `last_used_at` と `score` を有限数値へ正規化（`Number.isFinite(Number(v)) ? Number(v) : 0`）した上で数値差分により比較し、同値の場合は `(a.nickname.localeCompare(b.nickname))` → `(a.url.localeCompare(b.url))` の順で決定的タイブレークを行う。
- **案 B**: `b.score - a.score` のみを比較し、同値時は入力配列の元順序（ストレージ走査順）に委ねる。

### 比較・採用根拠

- **案 B の問題点**: `bookmarksData` のキー追加・編集・JSON インポート等でオブジェクトキー順が変わると、同じスコア・同じ日時の行（例: 新規一括登録 `:addall` で同時刻・初期スコア `1.0` になった複数行）の順序が不安定になり、FR-008（同一値行の安定した決定的順序）を満たしにくい。
- **案 A の利点**: `last_used_at` や `score` が欠損・不正値（`NaN`, `undefined` 等）を含むインポートデータでも例外を出さず `0` として安全に比較でき、同値行も常に一意かつ安定な順序で並ぶ。なお、仕様 Q3（A）に従い `is_pinned` は比較条件に含めず、純粋に指定項目の値のみで並び替える。

---

## 5. UI レイアウトと多言語・初期化タイミング

### 検討した選択肢

- **案 A（採用）**: `.folder-toolbar` 内に `.toolbar-controls-group`（`display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;`）を設け、フォルダ絞り込み `Select` と並べて並び替え `Select`（`pi-sort-alt` アイコン付きラベル）を配置する。また `onMounted` で `isLoaded.value = true` とする前に `await getListSortOrder()` を完了させる。
- **案 B**: ツールバーの上下に追加の専用行を設けて並び替え `Select` を配置する。

### 比較・採用根拠

- **案 B の問題点**: 一覧テーブルまでの縦方向余白が増え、既存画面の一覧性が低下する。
- **案 A の利点**: 既存の `.folder-toolbar` の `flex-wrap: wrap` 構造に自然に統合され、通常幅では 1 行に収まり、狭い画面幅では自動的に折り返される。また `isLoaded.value = true` 前に `getListSortOrder()` を読み込むことで、初期描画時の一瞬の並び順チラつき（未ソート表示→ソート済み表示へのジャンプ）を完全に防止できる。
