# Implementation Plan: ブックマークのインポート機能

**Branch**: `013-import-bookmarks` | **Date**: 2026-11-17 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/spec.md)

**Input**: Feature specification from `/specs/012-import-bookmarks/spec.md` (Related Issue: #23)

## Summary

ブックマーク管理画面（[List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue)）にインポートボタンおよび確認ダイアログを追加し、**Nickmark エクスポート JSON 形式**（`{ "bookmarks": ... }` および辞書直書き JSON）と **Chrome 標準ブックマーク HTML 形式**（Netscape Bookmark File Format）の両方からのインポートに対応する。

ファイル解析・検証・サニタイズ・ベースフォルダ付与・マージ処理は新規の共有モジュール `src/shared/bookmarkImport.ts` に純粋関数群として分離し、ブラウザ標準の `DOMParser` を用いた堅牢な `<DL>` / `<DT>` / `<H3>` / `<A>` 再帰走査で HTML フォルダ階層とニックネームを自動生成する。インポート実行前にプレビュー確認ダイアログを表示して「マージ（デフォルト）」と「上書き（破壊的操作警告付き）」の選択および任意の取り込み先ベースフォルダ指定を可能にし、保存時は既存の `saveBookmarksData` による正規化・Google アカウント同期（100KB 上限）チェックで既存データの安全性を保護する。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, `target: ES2022`), Vue 3 (`^3.5.34`, `<script setup lang="ts">`)
**Primary Dependencies**: PrimeVue (`^4.5.5` — `Button`, `Dialog`, `RadioButton`, `InputText`, `Message`, `Toast`, `Card` 等), `@primeuix/themes` (`^2.0.3`, Aura テーマ), `primeicons` (`^7.0.0`, `pi-upload` 等), ブラウザ標準 `DOMParser`, Webpack 5 (`webpack.config.js`), `@types/chrome`
**Storage**: 既存のブックマークストレージ機構（`saveBookmarksData`, `loadBookmarksData`, `getSaveErrorMessage`）を利用し、`chrome.storage.local` または `chrome.storage.sync`（100KB チャンク分割）へ安全に保存する。新規ストレージキー・権限追加は不要。
**Testing**: `npm run build`（TypeScript コンパイルおよび Webpack 本番バンドル検証）、`src/shared/bookmarkImport.ts` の境界値・パース・マージ検証スクリプト、および [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/quickstart.md) に沿った Chrome 実機検証
**Target Platform**: Google Chrome Manifest V3（`minimum_chrome_version: "135"`、macOS / Windows / Linux）
**Project Type**: Chrome 拡張機能（Service Worker + Popup + Options/List + Preferences）
**Performance Goals**: 100 件以上のブックマークを含む JSON / Chrome ブックマーク HTML の解析・プレビュー表示・保存・一覧再描画が 1 秒以内に完了すること
**Constraints**: `package/js/` は直接編集せず `npm run build` で再生成すること。`package/manifest.json` への不要な権限追加を行わないこと。不正入力や同期 100KB 超過時に既存データを破壊しないこと。Chrome の標準 HTML5 `DOMParser` の差異（`<DL>` が `<DT>` の子か兄弟か）を吸収して階層を正確に復元すること
**Scale/Scope**: `src/shared/bookmarkImport.ts`（新規）, `src/shared/types.ts`, `src/background.ts`, `src/List.vue`, `package/_locales/ja/messages.json`, `package/_locales/en/messages.json`, `.context/spec.md`, `.context/tech_stack.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **原則 I: キーボードファースト・オムニボックス中心設計**
   - **判定: PASS（Pre-Design & Post-Design）**
   - オムニボックスおよびポップアップの検索・コマンド仕様は変更せず、インポートされたブックマークが即座に検索・呼び出ししやすいよう、Chrome HTML 由来のニックネームの `/` や連続空白を `-` へサニタイズし、`normalizeNicknamePath` で正規化する。
2. **原則 II: Manifest V3 Service Worker とハイブリッドストレージの安全性**
   - **判定: PASS（Pre-Design & Post-Design）**
   - インポート後の保存はすべて `saveBookmarksData` 経由の `async/await` で実行し、`chrome.storage.sync` 有効時の 100KB 容量チェック（`QUOTA_EXCEEDED`）および `normalizeBookmarksDictionary` による重複排除を通す。保存失敗時はメモリおよびストレージの既存データを変更せずエラー通知のみを表示する。
3. **原則 III: Vue 3 Composition API と PrimeVue による一貫した UI 設計**
   - **判定: PASS（Pre-Design & Post-Design）**
   - [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue) で `<script setup lang="ts">` と PrimeVue コンポーネント（`Button`, `Dialog`, `RadioButton`, `InputText`, `Message`, `Toast`）および Aura セマンティック CSS 変数を使用し、上書きモード時は警告メッセージと `severity="danger"` ボタンで破壊的操作を明示する。
4. **原則 IV: 型安全性とモジュール間共有・日本語ドキュメンテーション**
   - **判定: PASS（Pre-Design & Post-Design）**
   - インポート関連型（`ImportFileFormat`, `ImportApplyMode`, `ParsedImportResult`）を [types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts) で定義し、純粋ロジックを `src/shared/bookmarkImport.ts` に切り出して [background.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/background.ts) からも再エクスポートする。すべての新規型・クラス・関数・コメントを日本語 JSDoc（`@param`, `@returns` 必須）および日本語コメントで記述する。
5. **原則 V: 即時反映される多言語対応とセキュアなスクリプト実行**
   - **判定: PASS（Pre-Design & Post-Design）**
   - すべての追加 UI 文言・エラー文言を `package/_locales/{ja,en}/messages.json` に定義し、`t()` 経由で参照する。HTML から取り込んだ `javascript:` ブックマークレットも既存の安全な `userScripts.execute` パイプラインで実行可能となる。
6. **品質ゲート・ドキュメント同期**
   - **判定: PASS（Pre-Design & Post-Design）**
   - 設計選択肢を [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/012-import-bookmarks/research.md) に記録済み。実装後に `npm run build`、純粋ロジック検証、および `.context/spec.md` / `.context/tech_stack.md` の同期を行う。

## Project Structure

### Documentation (this feature)

```text
specs/012-import-bookmarks/
├── plan.md                                 # 本実装計画書
├── research.md                             # Phase 0 技術調査・設計選択肢比較
├── data-model.md                           # Phase 1 データモデル・パース/マージ仕様
├── quickstart.md                           # Phase 1 ビルド・実機検証ガイド
├── checklists/
│   └── requirements.md                     # 仕様品質チェックリスト
└── contracts/
    └── import-bookmarks-contract.md        # Phase 1 モジュール・UI・i18n 契約
```

### Source Code (repository root)

```text
src/
├── background.ts                           # shared/bookmarkImport.ts の再エクスポートを追加
├── List.vue                                # インポートボタン・隠し file input・確認ダイアログ・適用処理を追加
└── shared/
    ├── types.ts                            # ImportFileFormat, ImportApplyMode, ParsedImportResult 型を追加
    └── bookmarkImport.ts                   # 【新規】JSON/Chrome HTML パーサー・サニタイズ・ベースフォルダ付与・マージ処理

package/
└── _locales/
    ├── ja/messages.json                    # インポート UI・確認ダイアログ・エラー/成功通知の日本語メッセージ追加
    └── en/messages.json                    # インポート UI・確認ダイアログ・エラー/成功通知の英語メッセージ追加

.context/
├── spec.md                                 # 「G. ブックマーク一覧画面（管理画面）」へ JSON/HTML インポート仕様を同期更新
└── tech_stack.md                           # src/shared/bookmarkImport.ts の説明を追加
```

**Structure Decision**: 既存の `src/shared/` ドメイン分割パターンに従い、フォーマット解析・バリデーション・ニックネーム生成・マージの純粋ロジックを `src/shared/bookmarkImport.ts` に集約し、`src/List.vue` はファイル読み込みと PrimeVue `Dialog` を用いた確認・保存オーケストレーションに専念させる。

## Complexity Tracking

Constitution Check において違反項目はないため、特記事項なし。
