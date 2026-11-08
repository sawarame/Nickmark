---
description: "タスク一覧: ブックマークのフォルダ分けと一括オープン機能"
---

# タスク一覧: ブックマークのフォルダ分けと一括オープン機能 (Folder Management & Batch Open)

**入力**: `/specs/002-folder-management/` の設計ドキュメント群（spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md）  
**前提条件**: plan.md（必須）、spec.md（ユーザーストーリー定義必須）、research.md、data-model.md、contracts/  
**組織化**: ユーザーストーリーごとに独立して実装・テスト可能なフェーズ構成。

## フォーマット: `[ID] [P?] [Story] 説明`

- **[P]**: 並列実行可能（異なるファイル、未完了タスクへの依存なし）
- **[Story]**: 関連するユーザーストーリー（US1, US2, US3, US4）
- すべてのタスクに対象ファイルパスを明記

---

## Phase 1: Setup（多言語リソースと基盤設定）

**目的**: 本機能で必要となる多言語辞書メッセージの追加

- [X] T001 [P] 多言語メッセージ定義（日本語）の追加 in package/_locales/ja/messages.json
  - フォルダ一括オープン（オムニボックス説明文）、安全上限設定項目名・説明文、確認ダイアログ文言、リネーム・削除トースト通知文言を定義
- [X] T002 [P] 多言語メッセージ定義（英語）の追加 in package/_locales/en/messages.json
  - T001 と同一キーで対応する英語文言を定義

---

## Phase 2: Foundational（フォルダ抽出とストレージアクセス基盤）

**目的**: 全ユーザーストーリーが依存する共通ロジックと設定管理の実装  
**⚠️ 重要**: 本フェーズ完了までユーザーストーリーの実装は開始できません。

- [X] T003 [P] フォルダメタ情報型 `FolderInfo` および設定型の定義とエクスポート in src/background.ts
  - `path`, `name`, `depth`, `nicknames`, `openableUrlCount` を定義
- [X] T004 フォルダ抽出ヘルパー関数 `extractFolders` の実装 in src/background.ts
  - ニックネームを `/` で分割し、親階層プレフィックスを抽出・重複排除してフォルダ情報マップを生成
- [X] T005 [P] 安全上限設定ヘルパー `getMaxBatchOpenTabs` および `setMaxBatchOpenTabs` の実装 in src/background.ts
  - `chrome.storage.local` から `maxBatchOpenTabs`（デフォルト: 20、許容範囲: 1〜100）を読み書きする関数を実装

**チェックポイント**: 基盤準備完了 - ユーザーストーリーの実装へ進むことが可能。

---

## Phase 3: User Story 1 - パス風ニックネームによるフォルダ一括オープン (Priority: P1) 🎯 MVP

**ゴール**: オムニボックス（`nm folder/` または `:open folder`）から、フォルダ配下の全ブックマークをバックグラウンドタブで一括オープンできる。  
**独立テスト基準**: `work/gh` と `work/jira` を登録し、`nm work/` または `nm :open work/` を実行して両方のタブが開き、スコアが更新されることを検証する。

### 実装 (User Story 1)

- [X] T006 [US1] フォルダ配下一括オープン共通関数 `openFolderUrls` の実装 in src/background.ts
  - 指定フォルダ配下の全ニックネームから重複URLを除外し、ブックマークレットはスキップ、動的URLはフォールバック展開し、バックグラウンドタブで開いて各ブックマークの `score` と `last_used_at` を更新
- [X] T007 [US1] オムニボックス入力サジェストにおけるフォルダ一括オープン候補生成の実装 in src/background.ts
  - `nm <folder>/`（末尾スラッシュ）入力時は最上位デフォルト候補を「📁 `<folder>/` の全ブックマークを一括オープン (Nタブ)」に設定
  - `nm <folder>` 入力時は個別候補を優先しつつサジェストリスト内にフォルダ一括オープン候補を提示
- [X] T008 [US1] オムニボックス確定実行ハンドラ（`onInputEntered`）でのフォルダ一括オープンの実装 in src/background.ts
  - フォルダ一括オープン候補が選択・確定された際に `openFolderUrls` を呼び出すハンドラを実装
- [X] T009 [US1] コマンドモード `:open` / `:o` のフォルダプレフィックス対応 in src/background.ts
  - `:open <folder>` または `:open <folder>/` で前方一致する配下の全ブックマークを一括オープンできるよう拡張

**チェックポイント**: User Story 1 (MVP) 単体で完全に動作し、オムニボックスからの一括オープンが可能。

---

## Phase 4: User Story 2 - 安全上限とユーザー確認機構 (Priority: P2)

**ゴール**: 一括オープン対象が設定上限件数（デフォルト: 20件）を超える場合、誤爆を防ぐためユーザーに確認を求め、設定画面から上限値を変更できる。  
**独立テスト基準**: 上限を小さく設定し、上限を超える件数のフォルダを開こうとした際に確認プロンプトが表示され、承認時のみ全タブが開くことを検証する。

### 実装 (User Story 2)

- [X] T010 [US2] オムニボックス実行時における上限判定とアクティブタブへの確認プロンプト注入の実装 in src/background.ts
  - 開く対象URL数が `maxBatchOpenTabs` を超える場合、自動オープンを中断し `chrome.scripting.executeScript` で確認プロンプトを注入（スクリプト禁止ページでは `list.html` へフォールバック遷移）
- [X] T011 [US2] 確認プロンプト承認後のメッセージハンドラ `EXECUTE_BATCH_OPEN` の実装 in src/background.ts
  - ページ内確認プロンプトで「開く」が押された際のランタイムメッセージを受信し、一括オープンを実行して結果を返却
- [X] T012 [US2] 設定画面における安全上限タブ数の設定 UI の追加 in src/Preferences.vue
  - PrimeVue の `InputNumber`（min: 1, max: 100, デフォルト: 20）を用いて「一括オープンの安全上限件数」の入力・保存・即時反映処理を実装

**チェックポイント**: User Story 1 と 2 が連携し、大量タブオープン時の安全性が保証される。

---

## Phase 5: User Story 3 - 管理画面（list.html）でのフォルダ絞り込みと一括管理 (Priority: P2)

**ゴール**: 管理画面でフォルダごとのフィルタリング、フォルダ一括オープン、一括リネーム、一括削除が行える。  
**独立テスト基準**: 管理画面で「work」を選択すると `work/*` のみが一覧表示され、一括オープンボタンで全タブが開き、リネームで全対象ニックネームが書き換わり、削除で一括削除されることを検証する。

### 実装 (User Story 3)

- [X] T013 [US3] 管理画面におけるフォルダ一覧のリアクティブ算出と絞り込みフィルタ UI の実装 in src/List.vue
  - 登録ニックネームから `extractFolders` でフォルダ一覧を算出し、PrimeVue の `Select` でテーブルの絞り込み表示を実装
- [X] T014 [US3] 管理画面からのフォルダ一括オープン機能の実装 in src/List.vue
  - 選択中フォルダの一括オープンボタン（上限超過時は PrimeVue `ConfirmDialog` で事前確認）を配置し実行
- [X] T015 [US3] フォルダ一括リネーム機能およびメッセージハンドラ `RENAME_FOLDER` の実装 in src/List.vue および src/background.ts
  - フォルダ名変更ダイアログで新名称を入力し、該当フォルダの全ニックネームプレフィックスを一括置換して保存
- [X] T016 [US3] フォルダ一括削除機能およびメッセージハンドラ `DELETE_FOLDER` の実装 in src/List.vue および src/background.ts
  - PrimeVue `ConfirmDialog` による警告確認後、該当フォルダ配下の全ブックマークを一括削除して保存

**チェックポイント**: 管理画面上でフォルダ単位の完全な CRUD・一括操作が動作する。

---

## Phase 6: User Story 4 - クイック登録時のフォルダ補完と入力支援 (Priority: P3)

**ゴール**: ポップアップダイアログや新規登録フォームで、既存のフォルダ名が自動補完され、素早くフォルダ配下に登録できる。  
**独立テスト基準**: ポップアップでニックネーム欄に `w` と入力した際、既存フォルダ `work/` がサジェストされ、補完入力できることを検証する。

### 実装 (User Story 4)

- [X] T017 [P] [US4] ポップアップ登録ダイアログにおける既存フォルダ名の自動サジェスト補完の実装 in src/Popup.vue
  - ニックネーム入力時（PrimeVue `AutoComplete`）に、既存のフォルダ名プレフィックス（`folder/`）をサジェスト候補に含めて表示
- [X] T018 [P] [US4] 管理画面の新規登録フォームにおけるフォルダ名自動サジェスト補完の実装 in src/List.vue
  - 管理画面のニックネーム入力欄でも同様に既存フォルダ名をサジェスト補完

**チェックポイント**: 登録フローでのフォルダ入力支援が完了。

---

## Phase 7: Polish & Cross-Cutting Concerns

**目的**: 全体最適化、ドキュメント同期、ビルド成果物の更新、実機検証

- [X] T019 [P] プロジェクト仕様書（.context/spec.md）の同期更新 in .context/spec.md
  - フォルダ分け、オムニボックス一括オープン構文、安全上限設定を追記
- [X] T020 ビルドコマンド `npm run build` の実行とバンドル成果物（package/js/）のエラー検証
  - TypeScript コンパイルエラー、Webpack バンドルエラーがないことを検証
- [X] T021 quickstart.md に基づく全検証シナリオ（シナリオ1〜5）の手動動作検証の実施

---

## 依存関係と実行順序 (Dependencies & Execution Order)

### フェーズ間の依存関係
```text
Phase 1: Setup (T001, T002)
   │
   ▼
Phase 2: Foundational (T003, T004, T005)
   │
   ├──────────────────────────────┐
   ▼                              ▼
Phase 3: User Story 1 (MVP)    Phase 6: User Story 4 (T017, T018)
(T006, T007, T008, T009)
   │
   ├──────────────────────────────┐
   ▼                              ▼
Phase 4: User Story 2          Phase 5: User Story 3
(T010, T011, T012)             (T013, T014, T015, T016)
   │                              │
   └──────────────┬───────────────┘
                  ▼
Phase 7: Polish & Verification (T019, T020, T021)
```

### 並列実行の機会
- **Phase 1**: T001（ja）と T002（en）は完全並列可能。
- **Phase 2**: T003（型定義）と T005（上限設定）は並列可能。
- **Phase 6**: T017（Popup.vue）と T018（List.vue）は並列可能。
- **Phase 7**: T019（ドキュメント更新）は実装と並行可能。

---

## 実装戦略 (Implementation Strategy)

### MVPファースト (User Story 1 のみで動作可能)
1. Phase 1 (Setup) 完了
2. Phase 2 (Foundational) 完了
3. Phase 3 (User Story 1: オムニボックス一括オープン) 完了
4. **ここで MVP 検証**: `npm run build` 後、`nm work/` での一括オープンを即時確認可能。
5. 順次 Phase 4（安全上限）、Phase 5（管理画面）、Phase 6（補完）をインクリメンタルに実装・追加。
