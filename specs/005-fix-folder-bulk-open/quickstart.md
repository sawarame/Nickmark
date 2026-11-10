# クイックスタート検証ガイド (Quickstart Validation Guide)

**Feature**: `005-fix-folder-bulk-open`  
**Date**: 2026-11-10  
**Status**: Ready for Verification  

---

## 1. 事前準備とビルド

### ソースコードのビルド
```bash
npm run build
```
※ `package/js/background.js` および `package/js/list.js` が正常に生成されることを確認します。

### Chrome への読み込み
1. Chrome で `chrome://extensions/` を開く。
2. 「デベロッパーモード」が ON であることを確認する。
3. 「パッケージ化されていない拡張機能を読み込む」から本プロジェクトの `package/` フォルダを読み込む（すでに読み込み済みの場合は再読み込みアイコンをクリック）。

---

## 2. 検証用テストデータの準備

管理画面（`list.html`）またはオムニボックス（`:add`）を用いて以下のテストブックマークを登録します：

| ニックネーム | URL | タイトル | 備考 |
|---|---|---|---|
| `work` | `https://example.com/standalone-work` | Work Standalone | **同名単体ブックマーク（未分類）** |
| `work/mail` | `https://example.com/work-mail` | Work Mail | フォルダ `work` 配下 |
| `work/jira` | `https://example.com/work-jira` | Work Jira | フォルダ `work` 配下 |
| `work/sub/repo`| `https://example.com/work-repo` | Work Repo | サブフォルダ配下 |
| `hobby` | `https://example.com/hobby` | Hobby | 単体のみ（配下なし） |

---

## 3. 検証シナリオ

### シナリオ 1: オムニボックスからの末尾スラッシュ一括オープン (`nm work/`)
1. Chrome のアドレスバーで `nm` と入力し、スペースまたは Tab を押す。
2. `work/` と入力する。
   - **確認**: 最上位のデフォルトサジェストに「フォルダ「work」の全ブックマークを一括オープン (3タブ)」と表示されること（単体 `work` はカウントされないこと）。
3. Enter キーを押下する。
   - **期待結果**:
     - `https://example.com/work-mail`、`https://example.com/work-jira`、`https://example.com/work-repo` の 3 つのタブのみが新規バックグラウンドタブで開く。
     - 単体ブックマーク `https://example.com/standalone-work` は **絶対に開かない** こと。

### シナリオ 2: オムニボックスからの `:open work/` 実行
1. アドレスバーで `nm :open work/` を実行する。
   - **期待結果**:
     - シナリオ 1 と同様に配下の 3 タブのみが開き、単体 `work` は開かないこと。

### シナリオ 3: オムニボックスからの単体アクセス (`nm work` および `nm :open work`)
1. アドレスバーで `nm work` と入力して Enter を押す。
   - **期待結果**:
     - 単体ブックマーク `https://example.com/standalone-work` が開くこと。
2. アドレスバーで `nm :open work` を実行する。
   - **期待結果**:
     - 単体ブックマーク `https://example.com/standalone-work` のみが別タブで開くこと。

### シナリオ 4: 管理画面におけるフォルダフィルタリング
1. 管理画面（`list.html`）を開く。
2. フォルダ絞り込みドロップダウンで「work」を選択する。
   - **期待結果**:
     - 一覧テーブルに `work/mail`, `work/jira`, `work/sub/repo` の 3 件のみが表示され、単体 `work` は表示されないこと。
3. フォルダ絞り込みドロップダウンで「未分類（ルート）」を選択する。
   - **期待結果**:
     - 単体 `work` および `hobby` が表示されること。

### シナリオ 5: 管理画面でのフォルダ一括オープンボタン
1. 管理画面でフォルダ「work」を選択した状態で、「一括オープン」ボタンをクリックする。
   - **期待結果**:
     - 配下の 3 タブのみが開き、単体 `work` は開かないこと。

### シナリオ 6: 管理画面でのフォルダ一括リネーム・削除
1. 管理画面でフォルダ「work」を選択し、「フォルダ名変更」から「office」に変更する。
   - **期待結果**:
     - 配下の 3 件が `office/mail`, `office/jira`, `office/sub/repo` にリネームされる。
     - 単体ブックマーク `work` はそのまま維持され、リネームされないこと。
2. 管理画面でフォルダ「office」を選択し、「削除」を実行する。
   - **期待結果**:
     - `office` 配下の 3 件のみが削除される。
     - 単体ブックマーク `work` は削除されずに未分類に残っていること。
