# Implementation Plan: 管理画面一覧の列幅固定・URL省略表示およびインライン編集化

**Branch**: `009-list-inline-editing` | **Date**: 2026-11-15 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/spec.md)

**Input**: Feature specification from `/specs/008-list-inline-editing/spec.md`

## Summary

ブックマーク管理画面（[List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue)）の一覧テーブルにおいて、(1) `table-layout: fixed` と各列の固定幅指定による列幅の安定化、(2) URL 列（通常 URL およびブックマークレット）の 1 行 `...` 省略表示とホバー全文表示、(3) 編集ダイアログ（モーダル）および編集ボタンの廃止とセルクリックによる PrimeVue `Textarea` インライン編集（フォーカスアウトまたは `Enter` 確定保存・`Escape` キャンセル）を実装する。

また、インライン編集化に伴う既存機能の整合性を保つため、操作列に通常 URL を新しいタブで開く専用アイコンボタン（`pi-external-link`）を配置し、動的 URL（`%s`）編集時は同一セル内の編集ラッパー内にデフォルト値（`default_value`）入力欄を併設して、ラッパー単位の `@focusout` 判定（`relatedTarget` チェック）により入力欄間のフォーカス移動で保存が暴発しない設計とする。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, `target: ES2022`), Vue 3 (`^3.5.34`, `<script setup lang="ts">`)
**Primary Dependencies**: PrimeVue (`^4.5.5` — `DataTable`, `Column`, `Textarea`, `InputText`, `Button`, `Toast`, `Tooltip` 等), `@primeuix/themes` (`^2.0.3`, Aura テーマ), `primeicons` (`^7.0.0`), Webpack 5 (`webpack.config.js`), `@types/chrome`
**Storage**: 既存のハイブリッドストレージ（[storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts) 経由の `chrome.storage.local` / `chrome.storage.sync`）をそのまま利用し、データスキーマは変更しない
**Testing**: TypeScript コンパイル・Webpack 本番ビルド検証（`npm run build`）および Chrome ブラウザ実機検証（[quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/quickstart.md) に沿った E2E 確認）
**Target Platform**: Google Chrome Manifest V3（`minimum_chrome_version: "135"`、macOS / Windows / Linux）
**Project Type**: Chrome 拡張機能（Service Worker + Popup + Options/List + Preferences）
**Performance Goals**: セルクリックからテキストエリア表示・自動フォーカスまでの切り替えが視覚的に遅延なく即時（1 フレーム以内）に完了し、ページング・データ長変化による列幅変動が 0px であること
**Constraints**: `package/js/` は直接編集せず `npm run build` で再生成すること。IME 変換確定時の `Enter` 誤保存、二重保存（`Enter` 確定直後の `focusout`）、`Escape` キャンセル後の誤保存、編集中のバックグラウンド再読み込みによる入力破棄を完全に防止すること
**Scale/Scope**: 主な変更対象は [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue)、日英ロケール（[ja/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/ja/messages.json), [en/messages.json](file:///Users/sawarame_yasushi/dev/Nickmark/package/_locales/en/messages.json)）、および [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/spec.md)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **原則 I: キーボードファースト・オムニボックス中心設計**
   - **判定: PASS（Pre-Design & Post-Design）**
   - オムニボックス（`nm`）およびポップアップランチャーの検索・ソート順・コマンド仕様には影響を与えない。管理画面のインライン編集においても、`Enter` による確定保存・`Escape` によるキャンセル・`Tab` によるセル内入力欄移動などキーボード主体の操作性を確保する。
2. **原則 II: Manifest V3 Service Worker とハイブリッドストレージの安全性**
   - **判定: PASS（Pre-Design & Post-Design）**
   - 既存の `saveBookmarksData` および [storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts) のキャッシュ・同期チャンク保存・容量エラー検知をそのまま利用する。保存前のスナップショット保持により、`QUOTA_EXCEEDED` 等で保存が失敗した場合もメモリ上の状態がストレージと乖離しないよう保護する。
3. **原則 III: Vue 3 Composition API と PrimeVue による一貫した UI 設計**
   - **判定: PASS（Pre-Design & Post-Design）**
   - `DESIGN.md` の規約（`InputText` および `Textarea` を使用する、`DataTable` / `Column` / `Button` / `Toast` を利用する、`<style scoped>` と PrimeVue CSS 変数を使用する）に完全に準拠する。編集ダイアログの廃止後も PrimeVue のコンポーネントと `primeicons`（`pi-external-link`, `pi-trash`）で統一する。
4. **原則 IV: 型安全性とモジュール間共有・日本語ドキュメンテーション**
   - **判定: PASS（Pre-Design & Post-Design）**
   - `InlineEditField`, `InlineEditState` を TypeScript で厳密に型定義し、既存の [types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts)・[url.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/url.ts)・[storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts) の共有ヘルパーを再利用する。追加・変更する関数・型・スタイルにはすべて日本語 JSDoc および日本語コメントを記載する。
5. **原則 V: 即時反映される多言語対応とセキュアなスクリプト実行**
   - **判定: PASS（Pre-Design & Post-Design）**
   - 新設する「新しいタブで開く」ボタンのツールチップやアクセシビリティラベル等の UI 文言は日英双方の `messages.json` に追加し、`t()` 経由で取得する。ブックマークレット行は安全のため「開く」ボタンを表示せず、既存の警告バナーおよびテキスト編集機能を維持する。
6. **品質ゲート・ドキュメント同期**
   - **判定: PASS（Pre-Design & Post-Design）**
   - 実装完了後に `npm run build` の成功確認、Chrome 実機検証（[quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/quickstart.md)）、および [.context/spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/.context/spec.md) の「G. ブックマーク一覧画面（管理画面）」節の同期更新を行う。

## Project Structure

### Documentation (this feature)

```text
specs/008-list-inline-editing/
├── plan.md                                      # 本実装計画書
├── research.md                                  # Phase 0 技術調査・設計選択肢比較と決定根拠
├── data-model.md                                # Phase 1 インライン編集状態モデル・状態遷移・バリデーション
├── quickstart.md                                # Phase 1 ビルド・実機 E2E 検証ガイド
├── checklists/
│   └── requirements.md                          # 仕様品質チェックリスト
└── contracts/
    └── list-inline-editing-contract.md          # Phase 1 テーブル列レイアウト・インライン編集・i18n 契約
```

### Source Code (repository root)

```text
src/
└── List.vue                      # DataTable 固定幅化、URL 1行「...」省略表示、編集ダイアログ廃止、
                                  # Textarea インライン編集（focusout/Enter 保存、Escape キャンセル、
                                  # 動的 URL デフォルト値複合編集）、操作列への外部リンクボタン追加

package/
└── _locales/
    ├── ja/messages.json          # openInNewTabTooltip 等の日本語メッセージ追加（不要キー整理）
    └── en/messages.json          # openInNewTabTooltip 等の英語メッセージ追加（不要キー整理）

.context/
└── spec.md                       # 管理画面のインライン編集・固定列幅・開くボタン仕様を同期更新
```

**Structure Decision**: 本機能は管理画面の UI・インタラクション刷新に閉じた変更であるため、共有ビジネスロジック（`src/shared/`）の分割構造を変更せず、[List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue) 内のプレゼンテーションとローカル編集状態管理の更新、および対応する多言語定義・ドキュメントの更新で完結させる。

## Phase 0 & Phase 1 Output Summary

- **Phase 0 ([research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/research.md))**: `DataTable` の `table-layout: fixed` による列幅固定と列幅配分（ニックネーム `180px`、タイトル `220px`、URL 残余幅、ピン留め `72px`、操作 `104px`）、Flexbox 内の 1 行 `...` 省略表示テクニック、PrimeVue `Textarea` + ラッパー `@focusout` による複合編集（URL + `default_value`）、IME / `Enter` / `Escape` 排他制御、操作列への「開く」ボタン配置を決定。
- **Phase 1 ([data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/data-model.md), [contracts/list-inline-editing-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/contracts/list-inline-editing-contract.md), [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/quickstart.md))**: `InlineEditState` の状態遷移・ロールバック付き保存契約・UI/キーボード/i18n 契約・E2E 検証手順を策定し、Post-Design Constitution Check をすべて PASS した。

## Complexity Tracking

Constitution Check において違反項目はないため、特記事項なし。
