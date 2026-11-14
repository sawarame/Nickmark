# Implementation Plan: ポップアップのコマンドパレット化とオムニボックス移行案内

**Branch**: `006-popup-command-palette` | **Date**: 2026-11-14 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/spec.md)

**Input**: Feature specification from `/specs/006-popup-command-palette/spec.md`

## Summary

拡張機能ポップアップ（[Popup.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Popup.vue) / [popup.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/popup.html)）の従来のブックマーク登録フォームを廃止し、アドレスバー（オムニボックス）で行っていた検索・ナビゲーション・動的 URL 展開・フォルダ一括オープン・ブックマークレット実行・全コマンド実行（`:add` 統一による登録を含む）を提供するコマンドパレット型ランチャーへ移行する。あわせて起動ショートカットを `Ctrl+Shift+U`（macOS では `Cmd+Shift+U`）へ変更し、`:add` 入力時のフォルダ補完・対象タブプレビューおよびポップアップ完結型の通知・確認 UI を実装する。現行のオムニボックス（`nm`）は移行期間として互換性を維持したまま存続させ、サジェスト内にポップアップ利用を促す移行案内候補を表示する。

技術面では、これまで [background.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/background.ts) にあったコマンド実行およびブックマークレット実行ロジックを `src/shared/commands.ts` へ抽出して共有化し、検索・候補構築ロジック（[search.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/search.ts)）にコマンドパレット向け候補生成（`buildPaletteSuggestions`）を追加することで、ポップアップとオムニボックス間の重複実装を防ぎつつ将来のオムニボックス廃止を容易にする。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, `target: ES2022`), Vue 3 (`^3.5.34`, `<script setup lang="ts">`)
**Primary Dependencies**: PrimeVue (`^4.5.5`), `@primeuix/themes` (`^2.0.3`, Aura テーマ), `primeicons` (`^7.0.0`), Webpack 5 (`webpack.config.js`), `@types/chrome`
**Storage**: Chrome Storage API（ハイブリッドストレージ: `chrome.storage.local` + `chrome.storage.sync` チャンク分割、既存 [storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts) を利用）
**Testing**: TypeScript コンパイル・Webpack 本番ビルド検証（`npm run build`）および Chrome ブラウザ実機検証（[quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/quickstart.md) に沿った E2E 確認）
**Target Platform**: Google Chrome Manifest V3（`minimum_chrome_version: "135"`、macOS / Windows / Linux）
**Project Type**: Chrome 拡張機能（Service Worker + Popup + Options/List + Preferences）
**Performance Goals**: ポップアップ起動後即座に入力フォーカスが当たり、ローカルキャッシュ済みデータに対して入力ごとに遅延感なく（1〜数ミリ秒レベルで）候補を更新・描画できること
**Constraints**: Chrome ポップアップの最大サイズ制約（幅 800px / 高さ 600px 以内、本機能では幅約 600px）、日本語 IME 変換確定時の `Enter` 誤爆防止、特殊ページ（`chrome://` 等）上での `list.html` 強制遷移回避、`package/js/` は直接編集せず `npm run build` で生成すること
**Scale/Scope**: 個人〜パワーユーザーの数百〜数千件のブックマークデータ、既存 4 エントリーポイント（`background`, `list`, `preferences`, `popup`）の連携および `.context/` ドキュメント・日英ロケールの同期更新

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **原則 I: キーボードファースト・オムニボックス中心設計**
   - **判定: PASS（注記あり）**
   - 移行期間中はアドレスバー（オムニボックス `nm`）の全機能を後方互換として維持するため、現時点で原則 I に違反しない。
   - *注記*: 将来的にオムニボックスを完全に廃止するフェーズでは、本憲章の原則 I を「キーボードファースト・コマンドパレット中心設計」へ改定するため `/speckit-constitution` を実施する必要がある。
2. **原則 II: Manifest V3 Service Worker とハイブリッドストレージの安全性**
   - **判定: PASS**
   - すべてのストレージ操作は既存の [storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts)（メモリキャッシュ・Promise 共有・チャンク分割・`async/await`）を利用し、権限変更は行わない。ブックマークレット実行は Service Worker 経由のメッセージ通信で行うためポップアップ終了タイミングによる取りこぼしを防げる。
3. **原則 III: Vue 3 Composition API と PrimeVue による一貫した UI 設計**
   - **判定: PASS**
   - [Popup.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Popup.vue) は `<script setup lang="ts">`、PrimeVue コンポーネント（`InputText`, `Button`, `Message` 等）、`primeicons`、`<style scoped>`、および PrimeVue CSS 変数（`var(--p-surface-*)`, `var(--p-text-color)` 等）を使用して統一感を保つ。
4. **原則 IV: 型安全性とモジュール間共有・日本語ドキュメンテーション**
   - **判定: PASS**
   - 候補モデル・コマンド実行結果型を [types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts) / `src/shared/commands.ts` で共有定義し、`background.ts` と `Popup.vue`・`List.vue` 間のロジック重複（`getFaviconUrl`, コマンド実行, ブックマークレット実行）を排除する。新規関数・型には日本語の JSDoc とコメントを記述する。
5. **原則 V: 即時反映される多言語対応とセキュアなスクリプト実行**
   - **判定: PASS**
   - すべての新規文言（ポップアップヒント、コマンド結果・確認文言、オムニボックス移行案内）は [ja/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/ja/messages.json) および [en/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/en/messages.json) に追加し、`src/i18n.ts` の `t()` 経由で参照する。ブックマークレットは引き続き `chrome.userScripts.execute`（`world: "MAIN"`、`%s` 非展開）で実行する。
6. **品質ゲート・ドキュメント同期**
   - **判定: PASS**
   - 実装後に `npm run build` の成功確認、実機検証、および [.context/spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/spec.md)（および関連する `.context/tech_stack.md` 等）の更新を実施する。

## Project Structure

### Documentation (this feature)

```text
specs/006-popup-command-palette/
├── plan.md              # 本実装計画書
├── research.md          # Phase 0 技術調査・設計判断
├── data-model.md        # Phase 1 データモデル・状態型定義
├── quickstart.md        # Phase 1 実機検証ガイド
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── contracts/
    └── popup-command-palette-contract.md  # Phase 1 モジュール・UI・メッセージ契約
```

### Source Code (repository root)

```text
package/
├── manifest.json                 # _execute_action ショートカットを Ctrl+Shift+U に変更
├── popup.html                    # body 幅を 600px へ拡張、レイアウト最適化
└── _locales/
    ├── ja/messages.json          # 日本語メッセージ追加・更新
    └── en/messages.json          # 英語メッセージ追加・更新

src/
├── background.ts                 # 共有コマンド利用への移行、EXECUTE_BOOKMARKLET リスナー追加、オムニボックス移行案内実装
├── Popup.vue                     # コマンドパレット UI 全面刷新（登録フォーム廃止、検索・コマンド・確認・通知を統合）
├── List.vue                      # getFaviconUrl を shared/url.ts からのインポートへ統合
├── popup.ts                      # 変更なし（Popup.vue エントリーポイント）
└── shared/
    ├── types.ts                  # PaletteItem, PaletteItemKind, CommandExecutionResult, RuntimeMessage 等を追加
    ├── url.ts                    # getFaviconUrl, getShortcutLabel（OS別ショートカット表記）を追加
    ├── search.ts                 # buildPaletteSuggestions（:add フォルダ補完・プレビュー含む）を追加
    └── commands.ts               # 【新規】executeNickmarkCommand, executeBookmarklet 等の共有実行エンジン

.context/
├── spec.md                       # ポップアップ仕様（H章）およびオムニボックス移行案内仕様を最新化
└── tech_stack.md                 # shared/commands.ts 等の構成情報を同期
```

**Structure Decision**: 既存の `src/` + `src/shared/` + `package/` 構成を踏襲し、新規ファイルは `src/shared/commands.ts` のみに留めることでモジュール境界を明快に保つ。

## Phase 0 & Phase 1 Output Summary

- **Phase 0 ([research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/research.md))**: ショートカットのクロスプラットフォーム仕様（`Ctrl+Shift+U`）、コマンド実行エンジンの共有分離、Service Worker 経由でのブックマークレット実行、オムニボックス移行案内の表示位置と安全なキャンセル処理、日本語 IME ガードおよびキーボード操作仕様を決定。
- **Phase 1 ([data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/data-model.md), [contracts/popup-command-palette-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/contracts/popup-command-palette-contract.md), [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/quickstart.md))**: `PaletteItem`, `CommandExecutionResult`, `RuntimeMessage` 等の型契約、ポップアップキーボード操作契約、オムニボックス移行案内契約、および実機 E2E 検証シナリオを策定し、Post-Design の Constitution Check もすべて PASS することを確認済み。

## Complexity Tracking

Constitution Check において違反項目はないため、特記事項なし。
