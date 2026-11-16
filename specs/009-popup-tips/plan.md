# Implementation Plan: ポップアップ初期表示時の Tips 表示

**Branch**: `010-popup-tips` | **Date**: 2026-11-17 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/spec.md)

**Input**: Feature specification from `/specs/009-popup-tips/spec.md`

## Summary

コマンドパレット型ポップアップランチャー（[Popup.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Popup.vue)）において、起動直後や入力欄が空（または空白文字のみ）の状態で生じる検索入力欄下部の空白領域に、Nickmark の便利な機能やショートカットを伝える Tips を 1 件ランダム表示する機能を追加する。設定画面への追加設定項目や非表示トグルは設けず、確認ダイアログ・フィードバック通知の非表示時かつ入力欄が空の間は常に控えめな案内として表示し、1 文字以上の入力で即座に非表示へ切り替わる。また、Tip 領域をクリックすると直前と異なる別の Tip に切り替わりつつ、検索入力欄へのフォーカスを維持する。

技術面では、[types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts) に `TipEntry` 型を追加し、新規共有モジュール `src/shared/tips.ts` に実在機能（`:add`, `:addall`, `フォルダ/`, `%s`, `Shift+Enter`, `Cmd/Ctrl+Enter`, `Tab`, ブックマークレット, `:ls`/`:prefs`/`:help`）に基づく 8 件の Tips カタログと $O(1)$ 重複回避ランダム選出関数 `pickRandomTipIndex`・文言解決関数 `formatTipMessage` を切り出す。OS 別の修飾キー表記（`Cmd` / `Ctrl`）は [url.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/url.ts) のプラットフォーム判定を共通化して再利用し、すべてのユーザー向け文言は日英の `messages.json`（[ja](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/ja/messages.json) / [en](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/en/messages.json)）へ定義する。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, `target: ES2022`), Vue 3 (`^3.5.34`, `<script setup lang="ts">`)
**Primary Dependencies**: PrimeVue (`^4.5.5`), `@primeuix/themes` (`^2.0.3`, Aura テーマ), `primeicons` (`^7.0.0`), Webpack 5 (`webpack.config.js`), `@types/chrome`
**Storage**: なし（永続化設定・クラウド同期データの追加・変更は行わない）
**Testing**: TypeScript コンパイル・Webpack 本番ビルド検証（`npm run build`）および Chrome ブラウザ実機検証（[quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/quickstart.md) に沿った E2E 確認）
**Target Platform**: Google Chrome Manifest V3（`minimum_chrome_version: "135"`、macOS / Windows / Linux）
**Project Type**: Chrome 拡張機能（Service Worker + Popup + Options/List + Preferences）
**Performance Goals**: ポップアップ起動時の検索入力欄フォーカス取得と初回文字入力を一切遅延させず（0 文字取りこぼし）、入力開始・クリア時の Tips ⇔ 候補リスト切り替えを 100ms 以内（同期リアクティブ描画）で完了すること
**Constraints**: ポップアップ横幅 `600px` 内での折り返し収容（横スクロール 0%）、`initI18n()` 完了前の一瞬の言語チラつき防止、Tips クリック時の `Tab` 移動除外・検索欄フォーカス維持、`package/js/` は直接編集せず `npm run build` で再生成すること
**Scale/Scope**: 8 件の多言語 Tips カタログ、`Popup.vue` / `shared/types.ts` / `shared/url.ts` / `shared/tips.ts` / 日英 `_locales/*/messages.json` / `.context/` ドキュメントの更新

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **原則 I: キーボードファースト・オムニボックス中心設計**
   - **判定: PASS（Pre-Design / Post-Design）**
   - オムニボックスおよび検索候補ソート順は一切変更しない。Tips 領域には `tabindex="-1"` と `@mousedown.prevent` を付与し、クリック後も `focusSearchInput()` で検索欄へフォーカスを維持するため、起動直後からの連続タイピングや `Tab` / `Esc` などのキーボード中心操作を阻害しない。
2. **原則 II: Manifest V3 Service Worker とハイブリッドストレージの安全性**
   - **判定: PASS（Pre-Design / Post-Design）**
   - `chrome.storage.local` / `chrome.storage.sync` への保存項目および `package/manifest.json` の権限は一切増やさず、既存のハイブリッドストレージ安全性・容量制限に影響を与えない。
3. **原則 III: Vue 3 Composition API と PrimeVue による一貫した UI 設計**
   - **判定: PASS（Pre-Design / Post-Design）**
   - [Popup.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Popup.vue) 内で `<script setup lang="ts">` と `<style scoped>` を維持し、PrimeVue の CSS 変数（`var(--p-content-*)`, `var(--p-text-muted-color)`, `var(--p-primary-color)` 等）および `primeicons`（`pi-lightbulb`, `pi-refresh`）を用いて既存デザインと調和させる。
4. **原則 IV: 型安全性とモジュール間共有・日本語ドキュメンテーション**
   - **判定: PASS（Pre-Design / Post-Design）**
   - `TipEntry` 型を [types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts) で定義し、Tips データと純粋関数群を新規モジュール `src/shared/tips.ts` へ切り出す。OS 修飾キー判定は [url.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/url.ts) の既存ロジックを共通化して重複を排除し、すべての新規型・関数に日本語 JSDoc と日本語コメントを記述する。
5. **原則 V: 即時反映される多言語対応とセキュアなスクリプト実行**
   - **判定: PASS（Pre-Design / Post-Design）**
   - すべての Tip 文言・バッジ・ツールチップは [ja/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/ja/messages.json) および [en/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/en/messages.json) に定義し、`src/i18n.ts` の `t()`（`tr()` ラッパー経由）で解決する。さらに `i18nVersion > 0` 後に描画することで言語チラつきを防止する。
6. **品質ゲート・ドキュメント同期**
   - **判定: PASS（Pre-Design / Post-Design）**
   - 実装時は設計比較・根拠を明確にした上で、`npm run build` の成功確認、Chrome 実機検証、および [.context/spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/spec.md)・[.context/tech_stack.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/tech_stack.md) の同期更新を行う。

## Project Structure

### Documentation (this feature)

```text
specs/009-popup-tips/
├── plan.md                                 # 本実装計画書
├── research.md                             # Phase 0 技術調査・設計判断
├── data-model.md                           # Phase 1 データモデル・状態設計
├── quickstart.md                           # Phase 1 実機検証ガイド
├── checklists/
│   └── requirements.md                     # 仕様品質チェックリスト
└── contracts/
    └── popup-tips-contract.md              # Phase 1 モジュール・UI・多言語契約
```

### Source Code (repository root)

```text
package/
└── _locales/
    ├── ja/messages.json          # Tips ラベル・切替案内・8 件の日本語 Tip 文言を追加
    └── en/messages.json          # 同英語文言を追加

src/
├── Popup.vue                     # shouldShowTips 算出、Tips 領域描画、クリック切替とフォーカス維持
└── shared/
    ├── types.ts                  # TipEntry インターフェースを追加
    ├── url.ts                    # isMacPlatform / getPrimaryModifierLabel を抽出し getShortcutLabel と共有
    └── tips.ts                   # 【新規】POPUP_TIPS カタログ、pickRandomTipIndex、formatTipMessage

.context/
├── spec.md                       # ポップアップ初期表示時の Tips 表示仕様を同期更新
└── tech_stack.md                 # shared/tips.ts の構成情報を同期更新
```

**Structure Decision**: 既存の `src/shared/` ドメイン分割構造に沿い、Tips カタログと選出ロジックを `src/shared/tips.ts` に分離し、`Popup.vue` は表示条件の制御とクリックインタラクションのみを担う構成とする。また、[url.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/url.ts) のプラットフォーム判定を再利用することでロジック重複を防止する。

## Phase 0 & Phase 1 Output Summary

- **Phase 0 ([research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/research.md))**: Tips のモジュール分離（`src/shared/tips.ts`）、$O(1)$ 除外インデックス方式による連続重複回避、`_locales/*/messages.json`＋`i18nVersion > 0` による言語チラつき防止、`shouldShowTips` による通知/確認ダイアログとの競合回避、およびプラットフォーム判定の共通化を決定。
- **Phase 1 ([data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/data-model.md), [contracts/popup-tips-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/contracts/popup-tips-contract.md), [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/009-popup-tips/quickstart.md))**: `TipEntry` モデル・8 件の Tips カタログ・状態遷移図、各関数・UI フォーカス・多言語メッセージキーの契約、および Chrome 実機検証手順を策定し、Post-Design の Constitution Check もすべて PASS することを確認済み。

## Complexity Tracking

Constitution Check において違反項目はないため、特記事項なし。
