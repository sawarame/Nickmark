# Implementation Plan: ブックマーク一覧の並び替え機能

**Branch**: `011-list-bookmark-sorting` | **Date**: 2026-11-17 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/spec.md)

**Input**: Feature specification from `/specs/010-list-bookmark-sorting/spec.md`

## Summary

ブックマーク管理画面（[List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue)）において、既存の固定幅 5 列テーブルレイアウト（ニックネーム、タイトル、URL、ピン留め、操作）を維持したまま、一覧上部ツールバー（フォルダ絞り込みバー内）に「並び替え」用の PrimeVue `Select` を追加し、「デフォルト順」「最終使用日時（新しい順／古い順）」「スコア（高い順／低い順）」による並び替え機能を提供する。

最終使用日時およびスコアでの並び替え時は `is_pinned` によるグループ優先を行わず純粋に各項目の数値で比較し、同値時はニックネーム昇順・URL 昇順の決定的タイブレーカーにより安定した順序を保証する。ユーザーがツールバーで選択した並び替え条件は `chrome.storage.local`（`listSortOrder` キー）へデバイス固有設定として保存して次回以降も引き継ぎ、既存の列ヘッダークリックによるソートとも競合しないよう双方向の状態整合制御（ツールバー変更時は列ソート解除＋1ページ目リセット、列ヘッダーソート時はメモリ上のツールバー表示のみデフォルトへ戻し永続値は維持）を組み込む。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, `target: ES2022`), Vue 3 (`^3.5.34`, `<script setup lang="ts">`)
**Primary Dependencies**: PrimeVue (`^4.5.5` — `Select`, `DataTable`, `Column`, `Card`, `Toast`, `ConfirmDialog` 等), `@primeuix/themes` (`^2.0.3`, Aura テーマ), `primeicons` (`^7.0.0`, `pi-sort-alt`), Webpack 5 (`webpack.config.js`), `@types/chrome`
**Storage**: 端末固有のローカル設定として `chrome.storage.local`（キー: `listSortOrder`）に保存。ブックマーク本体データ（`chrome.storage.local` / `chrome.storage.sync`）のスキーマおよび Google アカウント同期の 100KB チャンク領域には影響しない
**Testing**: TypeScript コンパイル・Webpack 本番ビルド検証（`npm run build`）、純粋関数（`sortBookmarkRows`, `parseValidListSortOption`）の動作確認、および Chrome ブラウザ実機検証（[quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/quickstart.md) に沿った E2E 確認）
**Target Platform**: Google Chrome Manifest V3（`minimum_chrome_version: "135"`、macOS / Windows / Linux）
**Project Type**: Chrome 拡張機能（Service Worker + Popup + Options/List + Preferences）
**Performance Goals**: 100 件以上のブックマーク登録環境でも、並び替え切替・フォルダ絞り込み・再描画が 1 秒以内（メモリ上ソート数ミリ秒）で完了し、画面初期表示時に未ソート状態からのチラつきが発生しないこと
**Constraints**: `package/js/` は直接編集せず `npm run build` で再生成すること。既存の 5 列固定幅レイアウト・インライン編集・列ヘッダーソート・フォルダ一括操作と競合しないこと。破損・未知の保存値でも例外なく `'default'` へフォールバックすること
**Scale/Scope**: [types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts), 新規共有モジュール `src/shared/listSort.ts`, [storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts), [background.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/background.ts), [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue), 日英ロケール（[ja/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/ja/messages.json), [en/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/en/messages.json)）, [.context/spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/spec.md), [.context/tech_stack.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/tech_stack.md)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **原則 I: キーボードファースト・オムニボックス中心設計**
   - **判定: PASS（Pre-Design & Post-Design）**
   - オムニボックス（`nm`）およびコマンドパレット型ポップアップ（`Popup.vue`）の検索アルゴリズム・ソート順（マッチ度ティア ＞ ピン留め ＞ スコア ＞ URL）には一切手を加えず、本機能は管理画面（`List.vue`）の一覧表示に閉じて実装する。
2. **原則 II: Manifest V3 Service Worker とハイブリッドストレージの安全性**
   - **判定: PASS（Pre-Design & Post-Design）**
   - 並び替え設定 `listSortOrder` はデバイス固有設定として `chrome.storage.local` にのみ保存し、`chrome.storage.sync` の 100KB 上限・チャンク保存構造や既存ブックマークデータの整合性に影響を与えない。またすべての `chrome.storage.local` 読み書きは `async/await` で実装し、`parseValidListSortOption` により不正値に対して安全にフォールバックする。`package/manifest.json` への権限追加も不要。
3. **原則 III: Vue 3 Composition API と PrimeVue による一貫した UI 設計**
   - **判定: PASS（Pre-Design & Post-Design）**
   - [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue) 内で `<script setup lang="ts">` と PrimeVue `Select`・`DataTable`・`primeicons`（`pi-sort-alt`）を使用し、レイアウト調整は `<style scoped>` 内の Flexbox 折り返しで完結させる。
4. **原則 IV: 型安全性とモジュール間共有・日本語ドキュメンテーション**
   - **判定: PASS（Pre-Design & Post-Design）**
   - `ListSortOption` 型と `DEFAULT_LIST_SORT_OPTION` を [types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts) で定義し、ソート・検証ロジックを `src/shared/listSort.ts` へ切り出して [background.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/background.ts) からも再エクスポートする。すべての新規型・関数・定数・コメントに日本語 JSDoc（概要・`@param`・`@returns`）および日本語インラインコメントを記述する。
5. **原則 V: 即時反映される多言語対応とセキュアなスクリプト実行**
   - **判定: PASS（Pre-Design & Post-Design）**
   - 並び替えラベルと 5 種の選択肢文言を日英双方の `messages.json` へ追加し、`List.vue` の `computed` 内で `t()` を通じて取得する。
6. **品質ゲート・ドキュメント同期**
   - **判定: PASS（Pre-Design & Post-Design）**
   - 実装前に設計選択肢の比較根拠（[research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/research.md)）を整理し、実装後に `npm run build` の成功確認、Chrome 実機検証（[quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/010-list-bookmark-sorting/quickstart.md)）、および [.context/spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/spec.md)・[.context/tech_stack.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/tech_stack.md) の同期更新を行う。

## Project Structure

### Documentation (this feature)

```text
specs/010-list-bookmark-sorting/
├── plan.md                                 # 本実装計画書
├── research.md                             # Phase 0 技術調査・設計判断
├── data-model.md                           # Phase 1 データモデル・状態遷移設計
├── quickstart.md                           # Phase 1 ビルド・実機検証ガイド
├── checklists/
│   └── requirements.md                     # 仕様品質チェックリスト
└── contracts/
    └── list-sorting-contract.md            # Phase 1 モジュール・UI・i18n 契約
```

### Source Code (repository root)

```text
src/
├── background.ts                           # listSort.ts の再エクスポート、storage.onChanged でのキャッシュ同期
├── List.vue                                # ツールバー並び替え Select 追加、sortedFilteredBookmarks、DataTable 状態連携
└── shared/
    ├── types.ts                            # ListSortOption 型・DEFAULT_LIST_SORT_OPTION 定数を追加
    ├── listSort.ts                         # 【新規】isValidListSortOption, parseValidListSortOption, sortBookmarkRows
    └── storage.ts                          # getListSortOrder, setListSortOrder, updateListSortOrderCache を追加

package/
└── _locales/
    ├── ja/messages.json                    # 並び替えラベル・選択肢 5 件の日本語メッセージ追加
    └── en/messages.json                    # 並び替えラベル・選択肢 5 件の英語メッセージ追加

.context/
├── spec.md                                 # 「G. ブックマーク一覧画面（管理画面）」へ並び替え機能仕様を同期更新
└── tech_stack.md                           # shared/listSort.ts のモジュール説明を追加
```

**Structure Decision**: 既存の `src/shared/` ドメイン分割（`types.ts`, `storage.ts`, `tips.ts`, `history.ts` 等）に倣い、ソート・検証の純粋ロジックを `src/shared/listSort.ts` に分離し、永続化は `src/shared/storage.ts` のローカル設定アクセサ群と同じキャッシュパターンで管理し、`src/List.vue` は UI 制御と `DataTable` との状態調停に専念させる。

## Complexity Tracking

Constitution Check において違反項目はないため、特記事項なし。
