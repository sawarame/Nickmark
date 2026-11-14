# Implementation Plan: ポップアップ検索でのブラウザ履歴表示（オプトイン権限）

**Branch**: `007-popup-history-search` | **Date**: 2026-11-14 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/spec.md)

**Input**: Feature specification from `/specs/007-popup-history-search/spec.md`

## Summary

コマンドパレット型ポップアップランチャー（[Popup.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Popup.vue)）において、通常検索時に上部のブックマーク候補の下へブラウザ閲覧履歴からの検索結果一覧を表示する機能を追加する。プライバシーと「権限は最小限の原則」に配慮し、[manifest.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/manifest.json) には必須権限ではなく `optional_permissions: ["history"]` を宣言し、設定画面（[Preferences.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Preferences.vue)）のトグル ON 操作時にユーザージェスチャー下で `chrome.permissions.request()` による許可を取得した場合のみ有効化するオプトイン方式を採用する。

技術面では、新規共有モジュール `src/shared/history.ts` を追加して権限確認・要求および `chrome.history.search({ text, startTime: 0, maxResults: 30 })` による履歴検索・URL 正規化重複除外・最大 10 件制限をカプセル化し、`Popup.vue` では既存の同期ブックマーク検索（`buildPaletteSuggestions`）と 80ms デバウンス＋リクエスト世代管理による非同期履歴検索を安全に統合する。また、[commands.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/commands.ts) にスコア非更新の純粋遷移ヘルパー `openUrlWithDisposition` を抽出して履歴遷移時にブックマークの指数減衰スコアを汚染しない設計とする。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, `target: ES2022`), Vue 3 (`^3.5.34`, `<script setup lang="ts">`)
**Primary Dependencies**: PrimeVue (`^4.5.5`), `@primeuix/themes` (`^2.0.3`, Aura テーマ), `primeicons` (`^7.0.0`), Webpack 5 (`webpack.config.js`), `@types/chrome`
**Storage**: `chrome.storage.local` にデバイス固有設定 `historySearchEnabled`（`boolean`、デフォルト `false`）を追加（既存の [storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts) を利用し、`chrome.storage.sync` は変更しない）
**Testing**: TypeScript コンパイル・Webpack 本番ビルド検証（`npm run build`）および Chrome ブラウザ実機検証（[quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/quickstart.md) に沿った E2E 確認）
**Target Platform**: Google Chrome Manifest V3（`minimum_chrome_version: "135"`、macOS / Windows / Linux）
**Project Type**: Chrome 拡張機能（Service Worker + Popup + Options/List + Preferences）
**Performance Goals**: ブックマーク候補は入力直後に同期描画し、履歴候補は 80ms デバウンス＋`chrome.history.search` により通常の入力体験を阻害しない応答時間（おおむね 300ms 以内）で追加表示すること
**Constraints**: Chrome ポップアップ最大高さ制約内でのスムーズなスクロール、連続入力時の非同期レスポンス競合（レースコンディション）完全防止、`chrome.permissions.request()` 呼び出し時のユーザージェスチャーコンテキスト保持、`package/js/` は直接編集せず `npm run build` で再生成すること
**Scale/Scope**: ブラウザ全期間の履歴からの最大 30 件取得・重複除外後最大 10 件表示、`Preferences.vue` / `Popup.vue` / `shared/` / `manifest.json` / 日英ロケール / `.context/` ドキュメントの更新

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **原則 I: キーボードファースト・オムニボックス中心設計**
   - **判定: PASS**
   - 既存のオムニボックス（`nm`）およびポップアップのブックマーク検索ソート順（マッチ度ティア ＞ `is_pinned` ＞ 指数減衰スコア ＞ URL 昇順）は一切変更しない。履歴候補は常にブックマーク候補の下に配置され、履歴遷移時にブックマークスコアも更新しないため既存優先度に干渉しない。
2. **原則 II: Manifest V3 Service Worker とハイブリッドストレージの安全性**
   - **判定: PASS**
   - `historySearchEnabled` はデバイスごとのブラウザ権限に紐づくローカル専用設定として `chrome.storage.local` に保存し、`chrome.storage.sync` の 100KB 制限を圧迫しない。権限についても `optional_permissions: ["history"]` を採用し、「権限は最小限の原則」を遵守する。
3. **原則 III: Vue 3 Composition API と PrimeVue による一貫した UI 設計**
   - **判定: PASS**
   - [Preferences.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Preferences.vue) では既存の `Card`・`ToggleSwitch`（＋ `.toggle-overlay`）・`Toast` パターンを踏襲し、[Popup.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Popup.vue) でも PrimeVue CSS 変数（`var(--p-content-*)`, `var(--p-text-*)`）と `primeicons`（`pi-history`）、`<style scoped>` を用いて統一感を保つ。
4. **原則 IV: 型安全性とモジュール間共有・日本語ドキュメンテーション**
   - **判定: PASS**
   - `PaletteItemKind`（`'history'` 追加）や `MAX_HISTORY_SUGGESTIONS` を [types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts) で一元定義し、履歴検索・URL 重複比較・純粋タブ遷移をそれぞれ `src/shared/history.ts`・[url.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/url.ts)・[commands.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/commands.ts) へ切り出す。すべての新規関数・型に日本語 JSDoc と日本語コメントを記述する。
5. **原則 V: 即時反映される多言語対応とセキュアなスクリプト実行**
   - **判定: PASS**
   - 設定項目・通知文言・ポップアップセクション見出し・タグはすべて [ja/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/ja/messages.json) および [en/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/en/messages.json) に追加し、`t()`（およびリアクティブ再描画用の `tr()` / `renderKey`）経由で即時反映させる。スクリプト実行仕様は変更しない。
6. **品質ゲート・ドキュメント同期**
   - **判定: PASS**
   - 実装後に `npm run build` の成功確認、Chrome 実機検証、および [.context/spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/spec.md)・[.context/tech_stack.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/tech_stack.md) の同期更新を行う。

## Project Structure

### Documentation (this feature)

```text
specs/007-popup-history-search/
├── plan.md                                      # 本実装計画書
├── research.md                                  # Phase 0 技術調査・設計判断
├── data-model.md                                # Phase 1 データモデル・状態型定義
├── quickstart.md                                # Phase 1 実機検証ガイド
├── checklists/
│   └── requirements.md                          # 仕様品質チェックリスト
└── contracts/
    └── popup-history-search-contract.md         # Phase 1 モジュール・UI・権限契約
```

### Source Code (repository root)

```text
package/
├── manifest.json                 # optional_permissions: ["history"] を追加
└── _locales/
    ├── ja/messages.json          # 履歴検索設定・セクション見出し等の日本語文言を追加
    └── en/messages.json          # 同英語文言を追加

src/
├── Popup.vue                     # 非同期履歴検索統合、セクション見出し描画、選択状態安定化、履歴遷移・Tab挙動分岐
├── Preferences.vue               # 「ブラウザ履歴検索」設定カードおよび権限リクエストフロー追加
└── shared/
    ├── types.ts                  # PaletteItemKind に 'history' を追加、MAX_HISTORY_SUGGESTIONS 定数追加
    ├── url.ts                    # 重複判定用正規化ヘルパー normalizeUrlForComparison を追加
    ├── storage.ts                # historySearchEnabled のキャッシュ・読み書き関数を追加
    ├── commands.ts               # スコア非更新の openUrlWithDisposition を抽出し navigateWithDisposition と共有
    └── history.ts                # 【新規】権限確認・要求、クエリ判定、chrome.history.search・重複除外・PaletteItem 変換

.context/
├── spec.md                       # 設定画面・ポップアップ検索・任意権限（optional_permissions）仕様を同期更新
└── tech_stack.md                 # shared/history.ts 等の構成情報を同期更新
```

**Structure Decision**: 既存の `src/shared/` ドメイン分割構造に沿い、履歴権限と `chrome.history` 検索の責務を新規モジュール `src/shared/history.ts` に分離することで、`Popup.vue` と `Preferences.vue` からの再利用性と見通しを確保する。

## Phase 0 & Phase 1 Output Summary

- **Phase 0 ([research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/research.md))**: `optional_permissions: ["history"]` のユーザージェスチャー要件対応、`chrome.history.search` の `startTime: 0`（全期間検索）と `maxResults: 30` バッファ取得、重複除外専用の `normalizeUrlForComparison` 分離、80ms デバウンス＋世代番号による競合防止と非同期到着時のハイライト維持ロジック、`Tab` 補完・スコア非更新方針を決定。
- **Phase 1 ([data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/data-model.md), [contracts/popup-history-search-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/contracts/popup-history-search-contract.md), [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/quickstart.md))**: `historySearchEnabled` ローカル設定、`PaletteItem`（`kind: 'history'`）変換規約、各共有モジュールの関数契約、UI・キーボード契約、多言語キー契約、および実機検証手順を策定し、Post-Design の Constitution Check もすべて PASS することを確認済み。

## Complexity Tracking

Constitution Check において違反項目はないため、特記事項なし。
