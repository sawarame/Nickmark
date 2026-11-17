# Implementation Plan: ブックマーク一覧の列別フィルター機能

**Branch**: `016-list-column-filter` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-list-column-filter/spec.md`

## Summary

ブックマーク一覧画面（`src/List.vue`）の「ニックネーム」「タイトル」「URL」の各列ヘッダーにフィルターボタンを配置し、クリックすると列ヘッダー内に検索ワード入力用のテキストエリア（PrimeVue `Textarea`）を展開表示して一覧をリアルタイムに絞り込める機能を追加する。複数列およびフォルダ選択との AND 絞り込み、列ソートとのイベント分離、クリアボタン、および日本語・英語の多言語対応を実装する。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, Target: `ES2022`)  
**Primary Dependencies**: Vue 3 (`^3.5.34`), PrimeVue (`^4.5.5`), `@primeuix/themes` (`^2.0.3`), `primeicons` (`^7.0.0`)  
**Storage**: N/A（画面内の一時フィルター状態）  
**Testing**: TypeScript 型チェック・Webpack 本番ビルド検証（`npm run build`）およびフィルタリング純粋関数の単体テスト  
**Target Platform**: Chrome Extension Manifest V3 (`minimum_chrome_version: "135"`)  
**Project Type**: Browser Extension (Vue 3 Management Page `list.html`)  
**Performance Goals**: キー入力に対するリアルタイム絞り込み反映（遅延なし）  
**Constraints**: `DataTable` の固定列幅レイアウト（`table-layout: fixed`）および列ソート（`sortable`）・インライン編集と競合しないこと  
**Scale/Scope**: `src/shared/types.ts`, `src/shared/listSort.ts`, `src/List.vue`, `package/_locales/{ja,en}/messages.json`, `.context/spec.md` の更新

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. キーボードファースト・オムニボックス中心設計**: ✅ PASS — フィルターボタン押下時の自動フォーカス、`Enter` 改行抑止、`Escape` キーでのクリア／クローズに対応し、キーボード操作性を高める。
- **II. Manifest V3 Service Worker とハイブリッドストレージの安全性**: ✅ PASS — ストレージ構造への破壊的変更はなく、既存のインライン編集保存とも安全に共存する。
- **III. Vue 3 Composition API と PrimeVue による一貫した UI 設計**: ✅ PASS — PrimeVue の `DataTable`, `Column`, `Button`, `Textarea` と PrimeIcons（`pi-filter`, `pi-filter-fill`, `pi-times`）、およびセマンティック CSS 変数を使用して統一されたデザインを維持する。
- **IV. 型安全性とモジュール間共有・日本語ドキュメンテーション**: ✅ PASS — `FilterableColumnField`, `ColumnFilterQueries` 等の型とフィルタリング関数を `src/shared/` に定義し、日本語 JSDoc とコメントを記述する。
- **V. 即時反映される多言語対応とセキュアなスクリプト実行**: ✅ PASS — ツールチップやプレースホルダー等の全文言を `package/_locales/{ja,en}/messages.json` に定義する。

## Project Structure

### Documentation (this feature)

```text
specs/015-list-column-filter/
├── plan.md              # 実装計画（本ファイル）
├── research.md          # 設計判断と技術調査
├── data-model.md        # データ構造と状態遷移定義
├── quickstart.md        # ビルド・検証手順
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── tasks.md             # 実装タスクリスト（/speckit-tasks で生成）
```

### Source Code (repository root)

```text
src/
├── List.vue               # 「ニックネーム」「タイトル」「URL」列ヘッダーへのフィルターボタン・Textarea展開・クリア操作の追加
└── shared/
    ├── types.ts           # FilterableColumnField, ColumnFilterQueries 等の型定義追加
    └── listSort.ts        # 列別クエリによるブックマーク行フィルタリング純粋関数（matchesColumnFilter, filterBookmarkRowsByColumns）追加

package/
└── _locales/
    ├── ja/messages.json   # 列フィルター関連の日本語文言追加
    └── en/messages.json   # 列フィルター関連の英語文言追加
```

**Structure Decision**: 既存の `src/shared/listSort.ts` に一覧画面用の列フィルタリング純粋関数を追加し、`src/List.vue` で UI 状態とイベント制御を担う構成とする。

## Complexity Tracking

Constitution Check における違反事項なし。
