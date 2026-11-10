# 実装計画書 (Implementation Plan): フォルダ一括オープン時における同名単体ブックマークの除外

**Branch**: `005-fix-folder-bulk-open` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-fix-folder-bulk-open/spec.md`

---

## 概要 (Summary)

フォルダを一括で開こうとした際に、フォルダ名と同じニックネームを持つ単体ブックマーク（未分類エントリ）が誤って同時に開かれてしまう不具合を修正します。
（例: 単体 `work` とフォルダ配下 `work/mail` がある場合、フォルダ `work` を開くと `work` 単体も開いてしまう問題）

技術的アプローチとして、`src/background.ts` の `openFolderUrls`、`renameFolder`、`deleteFolder`、および `src/List.vue` の `filteredBookmarks` において、対象判定式から「完全一致（`normNick === normalizedPath`）」を除去し、「フォルダプレフィックス前方一致（`normNick.startsWith(folderPrefix)`、ただし `folderPrefix = normalizedPath + '/'`）」のみを対象とする厳密な階層判定へ統一します。これにより、単体ブックマークが誤って一括オープン、絞り込み、リネーム、削除の対象に含まれることを完全に防止します。

---

## 技術コンテキスト (Technical Context)

**Language/Version**: TypeScript `^6.0.3` (`target: ES2022`)

**Primary Dependencies**: Vue 3 (`^3.5.34`), PrimeVue (`^4.5.5` Aura テーマ), `primeicons` (`^7.0.0`), `vue3-ts-jsoneditor` (`^3.4.0`)

**Storage**: `chrome.storage.local`（`unlimitedStorage`）および `chrome.storage.sync`（2,000文字チャンク分割、100KB 上限）のハイブリッド構成

**Testing**: `npm run build` による TypeScript 型検査・Webpack バンドル検証、および `quickstart.md` に基づく実機検証

**Target Platform**: Google Chrome（Manifest V3, `minimum_chrome_version: "135"`）

**Project Type**: Chrome Extension（Service Worker + Options Page + Popup UI）

**Performance Goals**: オムニボックス入力サジェスト応答 < 50ms（インメモリキャッシュ維持、文字列前方一致による極小オーバーヘッド）

**Constraints**: 既存のデータ構造（`Record<string, BookmarkEntry[]>`）および Chrome Sync 100KB 制限・チャンク分割仕様を一切破壊しないこと

**Scale/Scope**: 対象ファイルは `src/background.ts`、`src/List.vue`、`.context/spec.md` の 3 ファイル中心

---

## 憲章チェック (Constitution Check)

*GATE: Phase 0 調査前、および Phase 1 設計後に検証。すべての原則に完全準拠（違反なし）。*

- [x] **原則 I (キーボードファースト・オムニボックス中心設計)**: `nm work/` や `nm :open work/` でフォルダ配下のタブ群のみが正確に開き、同名単体ブックマークの誤起動を排除。単体 `nm work` や `nm :open work` での単体アクセス優先順位も既存仕様どおり完全に維持される。
- [x] **原則 II (Manifest V3 Service Worker & ハイブリッドストレージの安全性)**: データ構造を変更せず、不慮のリネームや削除による単体ニックネームのデータ巻き込み事故を防止して安全性を強化。
- [x] **原則 III (Vue 3 Composition API & PrimeVue による一貫した UI 設計)**: `src/List.vue` のコンポーネント構成やデザイン規約を変更せず、内部の `filteredBookmarks` 判定論理のみを正常化。
- [x] **原則 IV (型安全性とモジュール間共有・日本語ドキュメンテーション)**: すべての修正箇所に明示的な TypeScript 型注釈と日本語 JSDoc/インラインコメントを適用。
- [x] **原則 V (即時反映される多言語対応とセキュアなスクリプト実行)**: 既存の多言語メッセージキーおよびセキュアなスクリプト実行機構をそのまま維持。

---

## プロジェクト構造 (Project Structure)

### ドキュメント構成 (this feature)

```text
specs/005-fix-folder-bulk-open/
├── spec.md              # 機能仕様書
├── plan.md              # 実装計画書（本ファイル）
├── research.md          # Phase 0: 根本原因分析と設計決定
├── data-model.md        # Phase 1: 概念モデルと判定論理仕様
├── quickstart.md        # Phase 1: 実機検証シナリオと実行手順
├── contracts/           # Phase 1: インターフェース契約
│   └── bulk-open-contract.md
└── tasks.md             # Phase 2: 実装タスク一覧（/speckit-tasks で生成）
```

### ソースコード構成 (repository root)

```text
src/
├── background.ts        # openFolderUrls, renameFolder, deleteFolder における完全一致判定の除外
├── List.vue             # filteredBookmarks における完全一致判定の除外
├── Popup.vue            # （変更なし、AutoComplete 補完は正常動作）
├── Preferences.vue      # （変更なし）
└── i18n.ts              # （変更なし）

.context/
└── spec.md              # 基礎仕様書（フォルダ一括オープン・管理における単体ブックマーク除外仕様の同期）
```

**Structure Decision**: 既存の Chrome 拡張機能シングルプロジェクト構造を維持し、`src/background.ts` と `src/List.vue` の該当判定ロジックの改善を行います。

---

## 複雑度追跡 (Complexity Tracking)

> Constitution Check における違反はなく、新たな外部ライブラリの追加やデータモデルの複雑化も伴いません。
