# Implementation Plan: ブックマーク一覧タブの自動更新 (Refresh Bookmark List on Add)

**Branch**: `004-refresh-list-on-add` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-refresh-list-on-add/spec.md`

## Summary

通知を表示できない特殊ページ（`chrome://` など）からブックマークを追加した際に、既に開かれているブックマーク一覧画面（`list.html`）へ切り替わっても新規追加された項目が表示されない不具合を解決します。
具体的には、プロセス固有のメモリキャッシュを安全に破棄する `clearBookmarksCache` 関数を導入し、一覧画面がアクティブ化された際（`updatePage` メッセージ受信時およびフォーカス復帰時）に最新のブックマークデータを再取得して画面へリアクティブに反映します。

## Technical Context

**Language/Version**: TypeScript 5.x / ES2022  
**Primary Dependencies**: Vue 3 (`^3.5.34`), PrimeVue v4 (`^4.5.5`), Chrome Extension Manifest V3 (`minimum_chrome_version: "135"`)  
**Storage**: `chrome.storage.local` / `chrome.storage.sync` (ハイブリッドストレージ)  
**Testing**: 手動シナリオ検証（Chrome 拡張機能実機、オムニボックス `:add` 操作、タブ切り替え）  
**Target Platform**: Chrome Extension (Desktop)  
**Project Type**: Chrome Extension (Browser Extension / Vue SPA)  
**Performance Goals**: タブ切り替え後のデータ再描画完了時間 < 300ms（SC-001 の 1 秒以内を余裕を持って達成）  
**Constraints**: 画面全体のフルリロードを禁止し、トースト通知やスクロール位置を維持した滑らかなデータ更新を行うこと  
**Scale/Scope**: 主に `src/background.ts`（キャッシュクリア関数追加）および `src/List.vue`（メッセージリスナー・フォーカスイベント更新）の 2 ファイルに対するピンポイントな改善

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 憲章の原則 | 適合性確認 | 判定 |
|---|---|:---:|
| **I. キーボードファースト・オムニボックス中心設計** | オムニボックスからの `:add` 操作に伴う一覧タブへのフォールバック遷移と通知表示を阻害せず、即座に最新状態を表示してUXを向上させる | **PASS** |
| **II. MV3 Service Worker とハイブリッドストレージの安全性** | ストレージ操作はすべて `async/await` で非同期実行され、保存データの一貫性を損なわない | **PASS** |
| **III. Vue 3 Composition API と PrimeVue の一貫した UI 設計** | `List.vue` の Composition API によるリアクティブな状態更新（`bookmarksData.value` の更新）により、PrimeVue `DataTable` に滑らかに反映する | **PASS** |
| **IV. 型安全性とモジュール間共有・日本語ドキュメンテーション** | キャッシュ制御関数は `src/background.ts` で一元定義・エクスポートし、型定義を徹底。JSDoc・コメントはすべて日本語で記述する | **PASS** |
| **V. 即時反映される多言語対応とセキュアなスクリプト実行** | 既存の多言語メッセージ定義を維持し、追加・変更される文言もルールに従う | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/004-refresh-list-on-add/
├── spec.md              # 仕様書（/speckit-specify 出力）
├── plan.md              # 実装計画書（本ファイル）
├── research.md          # Phase 0 出力：技術調査・設計判断
├── data-model.md        # Phase 1 出力：データ構造と状態遷移
├── quickstart.md        # Phase 1 出力：動作検証手順
├── contracts/           # Phase 1 出力：内部インターフェース仕様
│   └── messaging.md     # 拡張機能内メッセージング規約
└── checklists/
    └── requirements.md  # 仕様品質検証チェックリスト
```

### Source Code (repository root)

```text
src/
├── background.ts        # Service Worker & 共通ストレージ・キャッシュ関数（clearBookmarksCache 追加）
├── List.vue             # ブックマーク一覧画面コンポーネント（updatePage 処理での再読み込み呼び出し）
├── Preferences.vue      # 設定画面コンポーネント
├── Popup.vue            # ポップアップ画面コンポーネント
└── i18n.ts              # 多言語対応モジュール

package/                 # 拡張機能成果物（ビルド出力・manifest.json）
webpack.config.js        # ビルド設定
```

**Structure Decision**:
既存のディレクトリ構造を維持し、データアクセス・キャッシュ管理を担う `src/background.ts` と、表示を担う `src/List.vue` の連携を強化します。`package/js/` は直接編集せず、必ず `src/` 配下を変更して `npm run build` を実行します。

## Complexity Tracking

*Constitution Check において違反（Violations）はないため、複雑性の例外申請は不要です。*
