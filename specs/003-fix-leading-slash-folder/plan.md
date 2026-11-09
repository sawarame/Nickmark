# 実装計画書 (Implementation Plan): 先頭スラッシュ付きフォルダ指定の正規化と認識バグ修正

**Branch**: `003-fix-leading-slash-folder` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-fix-leading-slash-folder/spec.md`

---

## Summary

ニックネームの先頭にスラッシュ（例: `/work/gh`）を付けて登録した場合や、オムニボックス・管理画面・オートコンプリートで先頭にスラッシュ（例: `/work/`, `:open /work`, `/wo`）を入力した場合に、フォルダが正しく認識されなかったり空文字のフォルダが生成されたりするバグを修正します。

技術的アプローチとして、`src/background.ts` に共通パス正規化関数 `normalizeNicknamePath` を定義してモジュール間で共有し、(1) ストレージデータの読み込み・保存・登録・編集時のキー正規化と重複マージ、(2) `extractFolders` および管理画面 `List.vue` のフォルダ絞り込み・一括操作の正規化、(3) オムニボックス検索・コマンドモード・AutoComplete 補完クエリの正規化を一貫して行うハイブリッド正規化方式を採用します。

---

## Technical Context

**Language/Version**: TypeScript `^6.0.3` (`target: ES2022`)

**Primary Dependencies**: Vue 3 (`^3.5.34`), PrimeVue (`^4.5.5` Aura テーマ), `primeicons` (`^7.0.0`), `vue3-ts-jsoneditor` (`^3.4.0`)

**Storage**: `chrome.storage.local`（`unlimitedStorage`）および `chrome.storage.sync`（2,000文字チャンク分割、100KB 上限）のハイブリッド構成

**Testing**: `npm run build` による TypeScript 型検査・Webpack バンドル検証、および `quickstart.md` に基づく Chrome 拡張機能実機検証

**Target Platform**: Google Chrome（Manifest V3, `minimum_chrome_version: "135"`）

**Project Type**: Chrome Extension（Service Worker + Options Page + Popup UI）

**Performance Goals**: オムニボックス入力時のサジェスト応答 < 50ms（インメモリキャッシュ維持、文字列正規化は $O(N)$ でオーバーヘッド極小）

**Constraints**: 既存のデータ構造（`Record<string, BookmarkEntry[]>`）および Chrome Sync 100KB 制限・チャンク分割仕様を一切破壊しないこと

**Scale/Scope**: 対象ファイルは `src/background.ts`, `src/List.vue`, `src/Popup.vue`, `.context/spec.md` の 4 ファイル中心

---

## Constitution Check

*GATE: Phase 0 調査前、および Phase 1 設計後に検証。すべての原則に完全準拠（違反なし）。*

- [x] **原則 I (キーボードファースト・オムニボックス中心設計)**: `nm /work/`、`nm /work`、`nm :open /work` など先頭スラッシュ付きのキーボード入力でも、オムニボックスのみでシームレスに検索・一括オープン・登録・削除が完結する。既存の4段階ソート順（ティア＞ピン留め＞スコア＞URL昇順）も完全に維持。
- [x] **原則 II (Manifest V3 Service Worker & ハイブリッドストレージの安全性)**: `loadBookmarksData` / `saveBookmarksData` におけるメモリキャッシュ、Promise 共有機構、2,000文字チャンク分割、および未正規化キーと正規化キーが衝突した際の非破壊マージ（データ消失防止）を厳守。
- [x] **原則 III (Vue 3 Composition API & PrimeVue による一貫した UI 設計)**: `src/List.vue` や `src/Popup.vue` の PrimeVue コンポーネント構成（`Select`, `AutoComplete`, `DataTable` 等）を変更せず、内部のフィルタ・補完・保存ロジックのみを改善。
- [x] **原則 IV (型安全性とモジュール間共有・日本語ドキュメンテーション)**: パス正規化関数 `normalizeNicknamePath` を `src/background.ts` で明示的な型定義・日本語 JSDoc とともに一元定義し、`src/List.vue` および `src/Popup.vue` からインポートして再利用する。
- [x] **原則 V (即時反映される多言語対応とセキュアなスクリプト実行)**: 既存の多言語メッセージキー（`errorNicknameUrlRequired` 等）および `userScripts` のセキュア実行ロジックをそのまま活用。

---

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-leading-slash-folder/
├── spec.md              # 機能仕様書
├── plan.md              # 実装計画書（本ファイル）
├── research.md          # Phase 0: 原因分析と設計選択肢の比較・決定
├── data-model.md        # Phase 1: パス正規化とデータマージ規則
├── quickstart.md        # Phase 1: 検証シナリオと実行手順
├── contracts/           # Phase 1: 関数・オムニボックス・UI契約
│   └── normalization-contract.md
└── tasks.md             # Phase 2: 実装タスク一覧（/speckit-tasks で生成）
```

### Source Code (repository root)

```text
src/
├── background.ts        # normalizeNicknamePath 追加、データ読み書き正規化、extractFolders・オムニボックス検索・コマンド処理の先頭スラッシュ対応
├── List.vue             # フォルダ絞り込み (filteredBookmarks)、AutoComplete 補完、新規追加・編集・JSON保存時の正規化適用
├── Popup.vue            # AutoComplete 補完、クイック登録保存時の正規化適用
├── Preferences.vue      # 設定画面（変更なし）
└── i18n.ts              # 多言語対応ヘルパー（変更なし）

.context/
└── spec.md              # 基礎仕様書（パス正規化仕様の追記・同期）
```

**Structure Decision**: 既存の Chrome 拡張機能シングルプロジェクト構造（`src/` 配下のスクリプトと Vue コンポーネント）をそのまま維持し、共通ロジックを `src/background.ts` に配置して `src/List.vue`・`src/Popup.vue` からインポートする構成とします。

---

## Complexity Tracking

> Constitution Check における違反はなく、新たな外部ライブラリの追加やストレージスキーマの変更も伴いません。
