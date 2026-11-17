# Implementation Plan: ダークモード時の設定画面・管理画面の配色と視認性修正

**Branch**: `012-fix-dark-mode-design` | **Date**: 2026-11-17 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/spec.md)

**Input**: Feature specification from `/specs/011-fix-dark-mode-design/spec.md` (Related Issue: #22)

## Summary

PrimeVue (Aura テーマ) において `--p-surface-100` / `--p-surface-50` / `--p-primary-50` 等のスケールトークンがダークモード時にも明暗反転しないため、設定画面・一覧画面の背景が明るいまま白文字（`--p-text-color`）が描画されてヘッダ文字等が見づらくなる問題を修正する。

[appBootstrap.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/appBootstrap.ts) で `definePreset(Aura, ...)` を用いてライト時 `{surface.100}`・ダーク時 `{surface.950}` へ自動追従するページ背景トークン `--p-page-background` を定義し、[Preferences.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Preferences.vue) と [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue) の `.container` に適用する。あわせて [Preferences.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Preferences.vue) のデータ移行ダイアログ比較領域（`.comparison-grid` / `.comparison-item.latest`）を反転対応セマンティックトークンへ置き換え、[preferences.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/preferences.html)・[list.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/list.html)・[popup.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/popup.html) の初期 `<style>` をダークモード時のフォールバックに対応させる。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, `target: ES2022`), Vue 3 (`^3.5.34`, `<script setup lang="ts">`)
**Primary Dependencies**: PrimeVue (`^4.5.5`), `@primeuix/themes` (`^2.0.3`, `Aura` + `definePreset`), `primeicons` (`^7.0.0`), Webpack 5 (`webpack.config.js`)
**Storage**: 変更なし（既存のストレージ構造・同期処理には触れない）
**Testing**: TypeScript コンパイルおよび Webpack 本番ビルド検証（`npm run build`）、生成バンドル内のスタイル・CSS 変数検証、および [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/quickstart.md) に沿ったダークモード／ライトモード表示検証
**Target Platform**: Google Chrome Manifest V3（`minimum_chrome_version: "135"`、macOS / Windows / Linux）
**Project Type**: Chrome 拡張機能（Service Worker + Popup + Options/List + Preferences）
**Performance Goals**: テーマ切替時（`prefers-color-scheme` 変化時）に CSS 変数のみで即座に再描画され、初期表示時の FOUC（白いちらつき）が発生しないこと
**Constraints**: `package/js/` は直接編集せず `npm run build` で再生成すること。ライトモード時の既存デザイン（`slate.100` 背景＋白カード）を退行させないこと。新規権限追加や既存ストレージへの影響を与えないこと
**Scale/Scope**: [appBootstrap.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/appBootstrap.ts), [Preferences.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Preferences.vue), [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue), [preferences.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/preferences.html), [list.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/list.html), [popup.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/popup.html)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **原則 I: キーボードファースト・オムニボックス中心設計**
   - **判定: PASS（Pre-Design & Post-Design）**
   - オムニボックス検索・コマンド実行・ポップアップキーボード操作のロジックには変更を加えない。
2. **原則 II: Manifest V3 Service Worker とハイブリッドストレージの安全性**
   - **判定: PASS（Pre-Design & Post-Design）**
   - ストレージ読み書きや `chrome.storage.sync` チャンク処理、`package/manifest.json` の権限には一切変更を加えない。
3. **原則 III: Vue 3 Composition API と PrimeVue による一貫した UI 設計**
   - **判定: PASS（Pre-Design & Post-Design）**
   - `definePreset` を用いて PrimeVue (Aura テーマ) のセマンティックトークン（`--p-page-background`）を定義し、コンポーネント内では `<style scoped>` に閉じ込めて `--p-*` 変数（`--p-page-background`, `--p-form-field-filled-background`, `--p-content-border-color`, `--p-highlight-background`, `--p-highlight-color`, `--p-primary-color`, `--p-text-color`）を使用する（[DESIGN.md](file:///Users/sawarame_yasushi/dev/Nickmark/DESIGN.md) 準拠）。
4. **原則 IV: 型安全性とモジュール間共有・日本語ドキュメンテーション**
   - **判定: PASS（Pre-Design & Post-Design）**
   - テーマ設定の共通化は既存の共通モジュール [appBootstrap.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/appBootstrap.ts) に集約し、日本語コメントおよび JSDoc を適切に記述する。
5. **原則 V: 即時反映される多言語対応とセキュアなスクリプト実行**
   - **判定: PASS（Pre-Design & Post-Design）**
   - UI 文言の追加・変更はないため既存 `i18n` とメッセージファイルへの影響はなく、スクリプト実行制御にも触れない。
6. **品質ゲート・ドキュメント同期**
   - **判定: PASS（Pre-Design & Post-Design）**
   - [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/research.md) で設計選択肢を比較・記録済み。実装後は `npm run build` の成功とライト／ダーク両モードの動作確認を実施する（データモデル・権限・仕様機能追加はないため `.context/spec.md` の機能仕様変更は不要だが、必要に応じドキュメント整合性を最終確認する）。

## Project Structure

### Documentation (this feature)

```text
specs/011-fix-dark-mode-design/
├── spec.md                   # 仕様書（Issue #22）
├── plan.md                   # 本実装計画書
├── research.md               # Phase 0 原因調査・設計選択肢比較
├── quickstart.md             # Phase 1 ビルド・ダークモード検証ガイド
├── checklists/
│   └── requirements.md       # 仕様品質チェックリスト
└── tasks.md                  # Phase 2 タスク一覧（/speckit-tasks で生成）
```

> **Note**: 本機能は UI 配色トークンおよび CSS スタイルの修正のみであり、新規データエンティティ・永続化スキーマ変更・外部 API コントラクト変更を伴わないため、`data-model.md` および `contracts/` は作成しない。

### Source Code (repository root)

```text
src/
├── shared/
│   └── appBootstrap.ts       # definePreset(Aura, ...) による --p-page-background トークン定義
├── Preferences.vue           # .container 背景およびデータ移行ダイアログ配色のトークン更新
└── List.vue                  # body 文字色および .container 背景トークン更新

package/
├── preferences.html          # <body style="..."> 廃止と <head><style> によるライト/ダーク初期背景設定
├── list.html                 # <body style="..."> 廃止と <head><style> によるライト/ダーク初期背景設定
└── popup.html                # @media (prefers-color-scheme: dark) 初期フォールバック背景・文字色追加
```

**Structure Decision**: 既存の [appBootstrap.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/appBootstrap.ts)・各 `.vue` ファイル・`package/*.html` の構成をそのまま活かし、新規ファイルや不要なラッパーを増やさず最小限の箇所に集約して修正する。

## Complexity Tracking

> 該当なし（Constitution Check に違反なし）
