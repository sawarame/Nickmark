# 実装計画書 (Implementation Plan): ブックマークのフォルダ分けと一括オープン機能

**機能ブランチ**: `002-folder-management` | **作成日**: 2026-11-08 | **仕様書**: [spec.md](./spec.md)

---

## 概要 (Summary)

ニックネームにスラッシュを含むパス風記法（例: `work/gh`, `work/jira`）を導入し、既存のデータ構造と完全な後方互換性を保ちながらフォルダ階層を動的に認識します。
オムニボックスからの通常検索（`nm work/`）やコマンドモード（`:open work`）により、対象フォルダ配下の全ブックマークを一瞬で一括オープン可能にします。
また、ブラウザのフリーズを防ぐ安全上限（デフォルト 20件、設定画面で変更可能）と超過時のユーザー確認機構、管理画面（`list.html`）でのフォルダ絞り込み・一括オープン・一括リネーム・一括削除機能、ポップアップでの既存フォルダ自動補完機能を提供します。

---

## 技術コンテキスト (Technical Context)

- **言語・バージョン**: TypeScript 6.0 (`target: ES2022`)
- **主要依存関係**: Vue 3 (`3.5.34`), PrimeVue (`4.5.5` Aura テーマ), `primeicons` (`7.0.0`)
- **ストレージ**: `chrome.storage.local` (全ブックマークおよびローカル設定 `maxBatchOpenTabs`), `chrome.storage.sync` (2,000文字チャンク分割同期)
- **テスト・検証**: ブラウザ実機検証（Chrome Extension Manifest V3）および `quickstart.md` に基づく手動 E2E シナリオ検証
- **対象プラットフォーム**: Google Chrome（`minimum_chrome_version: "135"`, Manifest V3 Service Worker）
- **プロジェクト種別**: Chrome 拡張機能 (オムニボックス・バックグラウンド・ポップアップ・Options UI)
- **パフォーマンス目標**: オムニボックス入力時のリアルタイムサジェスト遅延 < 50ms（インメモリキャッシュ活用）
- **制約事項**: 
  - Sync ストレージ合計 100KB 容量制限の厳守
  - Service Worker 上での同期 UI 禁止（非同期スクリプト注入または UI 連携による確認）
  - キーボード中心 UX の維持

---

## 憲章チェック (Constitution Check)

*GATE: Phase 0 調査前、および Phase 1 設計後に検証。違反なし。*

- [x] **原則 I (キーボードファースト・オムニボックス中心)**: `nm folder/` および `:open folder` によりアドレスバーからキーボードのみで完結。
- [x] **原則 II (MV3 Service Worker & ハイブリッドストレージ安全性)**: 既存のチャンク処理・100KB制限・Promise共有キャッシュを完全維持。
- [x] **原則 III (Vue 3 Composition API & PrimeVue)**: 管理画面・設定画面の UI に PrimeVue コンポーネント（Select, ConfirmDialog, InputNumber 等）を優先使用。
- [x] **原則 IV (型安全性・モジュール間共有・日本語ドキュメント)**: 型定義は `src/background.ts` で一元管理し、コードコメント・JSDoc・ドキュメントを完全日本語化。
- [x] **原則 V (即時反映多言語対応 & セキュア実行)**: すべての文言を `messages.json` (ja/en) に登録し、ブックマークレットは一括オープンから安全にスキップ。

---

## プロジェクト構造 (Project Structure)

### 本機能のドキュメント (Documentation)
```text
specs/002-folder-management/
├── spec.md              # 機能仕様書
├── plan.md              # 実装計画書（本ファイル）
├── research.md          # Phase 0: 技術調査と設計決定
├── data-model.md        # Phase 1: データモデル設計
├── quickstart.md        # Phase 1: クイックスタート検証ガイド
├── contracts/           # Phase 1: インターフェース契約群
│   ├── omnibox-contract.md
│   ├── messages-contract.md
│   └── storage-contract.md
└── tasks.md             # Phase 2: タスク一覧（/speckit-tasks で生成）
```

### ソースコード配置 (Source Code)
```text
src/
├── background.ts        # フォルダ抽出ロジック、オムニボックスサジェスト拡張、一括オープンハンドラ、安全上限管理
├── List.vue             # フォルダ絞り込みフィルタ、一括オープンボタン、一括リネーム・削除モーダル
├── Popup.vue            # 既存フォルダ名の自動補完サジェスト
├── Preferences.vue      # 一括オープン安全上限設定（maxBatchOpenTabs）
├── i18n.ts              # 多言語リソース取得ヘルパー
package/
├── _locales/
│   ├── ja/messages.json # 日本語メッセージリソース
│   └── en/messages.json # 英語メッセージリソース
└── manifest.json        # 拡張機能マニフェスト
```

---

## 複雑性追跡 (Complexity Tracking)

> 憲章違反や不要な複雑性はありません。プレフィックス方式を採用することでデータスキーマの変更を回避し、シンプルなアーキテクチャを実現しています。

| 項目 | 採用理由 | 却下された代替案とその理由 |
|---|---|---|
| パス風プレフィックス方式 | 既存スキーマ完全維持、Sync 100KB 制限への影響ゼロ | 独立したフォルダコレクション（移行や容量制限の管理が複雑化するため却下） |
| ページ内スクリプト注入による確認プロンプト | オムニボックスからの実行時にブラウザを切り替えずに即時承認可能 | 常時一覧画面へ強制遷移（ユーザーの閲覧コンテキストが分断されるためフォールバック限定に） |
