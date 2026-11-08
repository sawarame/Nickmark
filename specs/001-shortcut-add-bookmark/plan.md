# 実装計画書: ショートカットによるブックマーク登録機能 (Shortcut Bookmark Registration)

**ブランチ**: `001-shortcut-add-bookmark` | **作成日**: 2026-11-08 | **仕様書**: [spec.md](./spec.md)

**入力**: 機能仕様書 (`/specs/001-shortcut-add-bookmark/spec.md`)

---

## 概要 (Summary)

ユーザーが閲覧中のWebページからマウスに持ち替えることなく、キーボードショートカット（Mac: `Command + Shift + D`、Windows/Linux: `Alt + Shift + D`）またはツールバーアイコンクリックによって即座にブックマーク登録ダイアログ（Chrome Action Popup）を呼び出し、ニックネームを入力して Enter を押すだけでブックマーク登録を完了できる機能を実装します。

### 技術アプローチ
1. **Manifest V3 統合**: `manifest.json` の `commands` に `_execute_action`（ショートカット定義）を追加し、`action.default_popup` に `popup.html` を指定。
2. **UI & フロントエンド**: Vue 3 `<script setup lang="ts">` と PrimeVue v4（Aura テーマ）を用いた `src/Popup.vue`、`src/popup.ts`、`package/popup.html` の新設。
3. **データ & ストレージ連携**: 既存の `loadBookmarksData()` / `saveBookmarksData()` を再利用し、既存ニックネームの補完（AutoComplete）と複数URL登録（グループ化）に対応。
4. **フィードバック**: 登録完了時にポップアップを即座に閉じ、既存の `showToast()` をアクティブタブ上で実行して視覚的通知を提供。

---

## 技術コンテキスト (Technical Context)

- **言語 / バージョン**: TypeScript (`^6.0.3`, `target: ES2022`), Node.js (v20+)
- **主要依存関係**: Vue 3 (`^3.5.34`), PrimeVue (`^4.5.5`), `@primeuix/themes` (`^2.0.3`), `primeicons` (`^7.0.0`)
- **ストレージ**: `chrome.storage.local` および `chrome.storage.sync`（ハイブリッド同期ストレージ機構）
- **テスト**: Chrome 実機検証（`quickstart.md` の検証シナリオに基づく）
- **ターゲット環境**: Chrome Extension Manifest V3（`minimum_chrome_version: "135"`, macOS / Windows / Linux）
- **プロジェクト種別**: ブラウザ拡張機能 (Chrome Extension UI / Background)
- **パフォーマンス目標**:
  - ショートカット押下からポップアップ表示・入力可能まで: **200ms 以内**
  - ニックネーム補完候補の描画: **50ms 以内**
  - キーボード操作のみでの登録完了: **3秒以内**
- **制約事項**:
  - Manifest V3 セキュリティ制約に完全準拠
  - `package/js/` 配下のビルド成果物は直接編集せず、必ず `src/` 配下のソースコードを変更後に `npm run build` を実行
  - 日英両対応の多言語リソース定義（`package/_locales/{en,ja}/messages.json`）
  - ソースコード内のコメント・JSDoc は日本語で記述

---

## 憲章チェック (Constitution Check)

*GATE: Phase 0 リサーチ前および Phase 1 設計後に適合性を検証済み。*

| 憲章原則 | 適合性評価 | 備考・準拠方針 |
| :--- | :---: | :--- |
| **I. キーボードファースト・オムニボックス中心設計** | **適合 (PASS)** | ショートカットキーからの瞬時起動、ニックネーム自動フォーカス、Enter保存、Escクローズ、作業を中断させないトースト通知を実装。 |
| **II. Manifest V3 Service Worker とストレージの安全性** | **適合 (PASS)** | 既存のハイブリッドストレージ（ローカル/同期）関数（`loadBookmarksData`, `saveBookmarksData`）を共通利用し、データの破損や同期制限違反を防止。 |
| **III. Vue 3 と PrimeVue による一貫した UI 設計** | **適合 (PASS)** | Vue 3 Composition API、PrimeVue Aura テーマ、CSS 変数（`--p-surface-*`）を使用し、既存の管理・設定画面と完全なデザイン統一を図る。 |
| **IV. 型安全性とモジュール間共有・日本語ドキュメント** | **適合 (PASS)** | 全ファイル TypeScript 化、`BookmarkEntry` 等の共有型定義の利用、日本語 JSDoc の徹底。 |
| **V. 即時反映される多言語対応とセキュア実行** | **適合 (PASS)** | `messages.json` へのメッセージ追加と `src/i18n.ts` による日英対応。 |

---

## プロジェクト構造 (Project Structure)

### 本機能のドキュメント (Documentation)

```text
specs/001-shortcut-add-bookmark/
├── plan.md              # 実装計画書（本ファイル）
├── research.md          # Phase 0 リサーチ成果物（決定事項と根拠）
├── data-model.md        # Phase 1 データモデル仕様（エンティティと状態定義）
├── contracts/           # Phase 1 インターフェース契約
│   ├── manifest-commands.md  # Manifest & Commands 契約
│   └── ui-actions.md         # UI 操作・ライフサイクル契約
├── quickstart.md        # Phase 1 実機検証ガイド
├── checklists/
│   └── requirements.md  # 仕様品質検証チェックリスト
└── spec.md              # 機能仕様書
```

### ソースコード変更構造 (Source Code Layout)

```text
package/
├── manifest.json              # [変更] commands (_execute_action) と action.default_popup 追加
├── popup.html                 # [新規] ポップアップウィンドウ用 HTML
└── _locales/
    ├── en/messages.json       # [変更] 英語メッセージ定義追加
    └── ja/messages.json       # [変更] 日本語メッセージ定義追加

src/
├── popup.ts                   # [新規] ポップアップ画面のエントリーポイント
├── Popup.vue                  # [新規] ブックマーク登録ポップアップ UI コンポーネント
├── background.ts              # [変更] showToast 関数の export 化など共通連携処理
├── list.ts                    # [既存]
├── List.vue                   # [既存]
├── preferences.ts             # [既存]
└── Preferences.vue            # [既存]

webpack.config.js              # [変更] entry に popup を追加
```

**構成方針**:
既存の `list` / `preferences` と全く同一のアーキテクチャ構成とし、`package/popup.html` + `src/popup.ts` + `src/Popup.vue` を追加して Webpack でバンドルします。

---

## 複雑性追跡 (Complexity Tracking)

> 憲章違反や不当な複雑性はありません。すべての要件は既存のアーキテクチャとライブラリの範囲内で完結します。

| 項目 | 採用理由 | 却下された代替案とその理由 |
| :--- | :--- | :--- |
| `_execute_action` による Action Popup | ブラウザ標準のショートカット連携であり、保護ページを含め確実に動作するため | Content Script によるモーダル注入: 保護ページでの制約や CSS 汚染があるため却下 |
| 既存 `showToast` の再利用 | コードの重複を防ぎ、オムニボックス登録時と完全に同一の UX を提供するため | ポップアップ内での独自トースト表示: ポップアップを即座に閉じる要件（作業中断最小化）に反するため却下 |
