# Implementation Plan: コマンド入力モード時のアイコン表示修正

**Branch**: `014-popup-command-icon` | **Date**: 2026-11-17 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/013-popup-command-icon/spec.md)

**Input**: Feature specification from `/specs/013-popup-command-icon/spec.md`

## Summary

コマンドパレット型ポップアップ（`src/Popup.vue`）で `:` を入力してコマンド入力モードになった際、存在しない PrimeIcons クラス `pi-terminal` を参照していたために検索欄左側アイコンおよびコマンド候補一覧アイコンが空白になっていた不具合を修正する。再利用可能なインライン SVG コンポーネント `src/components/CommandPromptIcon.vue`（`>_` 形状）を新設し、虫眼鏡アイコン（`pi-search`）と同じ枠サイズ（`1rem × 1rem`）かつアクセントカラー（`var(--p-primary-color, #10b981)`）で確実に切り替わるよう実装する。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, `target: ES2022`), Vue 3 (`^3.5.34`, `<script setup lang="ts">`)

**Primary Dependencies**: PrimeVue (`^4.5.5`, `@primeuix/themes` Aura), `primeicons` (`^7.0.0`), Webpack 5 (`^5.106.2`)

**Storage**: N/A（ストレージ構造・永続化データへの変更なし）

**Testing**: `npx tsc --noEmit` による型チェック、`npm run build` による本番バンドル・ZIP 生成検証、および生成成果物・DOM 構造の検証（本リポジトリに単体テストフレームワークは未導入のため `package.json` の `"test"` スクリプトは未設定）

**Target Platform**: Chrome Extension Manifest V3 (`minimum_chrome_version: "135"`), `package/popup.html`

**Project Type**: Chrome 拡張機能（TypeScript + Vue 3 SPA エントリーポイント群）

**Performance Goals**: 入力ごとのアイコン切り替えが同期算出プロパティ（`isCommandInput`）により遅延なく即時（1フレーム以内）反映されること

**Constraints**: 外部 npm 依存の追加禁止、`package/js/` の直接編集禁止、ライト／ダークモード双方での視認性維持、アイコン切り替え前後で入力欄の横ズレを発生させないこと

**Scale/Scope**: 対象ファイルは新規共通アイコンコンポーネント `src/components/CommandPromptIcon.vue` と `src/Popup.vue` のみ（小規模・局所的修正）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **原則 I (キーボードファースト・オムニボックス中心設計)**:
   - 既存のキーボード操作（`isCommandInput` 判定、IME ガード、`Enter`/`Tab`/`Esc`/矢印キー）やオムニボックス動作に一切の悪影響を与えず、コマンド入力モードの視覚フィードバックのみを改善する。 → **PASS**
2. **原則 II (Manifest V3 Service Worker とハイブリッドストレージの安全性)**:
   - `background.ts` やストレージ読み書きは変更しない。 → **PASS**
3. **原則 III (Vue 3 Composition API と PrimeVue による一貫した UI 設計)**:
   - `<script setup lang="ts">` と `<style scoped>` を使用し、カラーは `var(--p-primary-color, #10b981)` を維持する。
   - アイコンについて `DESIGN.md` は `primeicons` 使用を原則としているが、`primeicons` v7.0.0 に `>_`（`pi-terminal`）が存在しないため、Issue #26 の明示要件（添付画像通りの `>_` アイコン）を満たすために単一目的のインライン SVG コンポーネントを最小限の例外として採用する（下記 Complexity Tracking に記録）。 → **PASS（正当化済み例外）**
4. **原則 IV (型安全性とモジュール間共有・日本語ドキュメンテーション)**:
   - `src/components/CommandPromptIcon.vue` と `src/Popup.vue` に日本語コメントおよび JSDoc を記載する。2 箇所（検索欄左側・候補一覧）で同じアイコンを重複記述せずコンポーネント化して再利用する。 → **PASS**
5. **原則 V (即時反映される多言語対応とセキュアなスクリプト実行)**:
   - 新規のユーザー向け文字列・スクリプト実行処理の追加はない。 → **PASS**
6. **品質ゲート (ビルド・設計比較・ドキュメント同期)**:
   - 設計比較を `research.md` に記録済み。実装後に `npm run build` を必ず実行する。既存の `.context/spec.md` の記述（「コマンドはコマンドアイコン」等）と整合するため `.context/spec.md` の仕様変更は不要（ただし念のため記載内容に矛盾がないか最終確認する）。 → **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/013-popup-command-icon/
├── spec.md              # 機能仕様書
├── research.md          # Phase 0 調査・設計案比較
├── plan.md              # 本実装計画書（Phase 1）
├── quickstart.md        # 検証手順書（Phase 1）
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── tasks.md             # Phase 2 実装タスクリスト（/speckit-tasks で生成）
```

※ データモデル変更や新規外部 API / メッセージ契約の追加はないため、`data-model.md` および `contracts/` は作成しない。

### Source Code (repository root)

```text
src/
├── components/
│   └── CommandPromptIcon.vue   # [新規] >_ 形状のコマンド入力用インライン SVG アイコンコンポーネント
├── Popup.vue                   # [修正] 検索欄左側アイコンおよびコマンド候補行アイコンで CommandPromptIcon を使用し、固定枠スタイルを整備
└── (その他ファイルは変更なし)
```

**Structure Decision**: 同じ `>_` コマンド入力アイコンを検索入力欄の左側（`isCommandInput` 時）と候補一覧のコマンド・補完アイテム行（`item.kind === 'command' || item.kind === 'completion'`）の 2 箇所で再利用するため、`src/components/CommandPromptIcon.vue` として独立した小コンポーネントを切り出し、テンプレートの重複を防ぐ。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `DESIGN.md` 原則「アイコンは `primeicons` を使用する」に対する局所的例外（インライン SVG アイコンの導入） | `primeicons` v7.0.0 に `>_`（`pi-terminal`）が存在せず、現状クラス指定だけではアイコンが空白になっており、Issue #26 の添付画像通り `>_` アイコンを表示するために必要 | `primeicons` の `pi-code`（`</>`）等で代用すると Issue #26 の添付画像と異なり、既にブックマークレット用に使用中のアイコンと役割が衝突するため不採用。外部アイコンパッケージ追加も過剰依存のため不採用 |
