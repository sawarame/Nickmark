# Quickstart & Validation Guide: 定番ブックマーク・ブックマークレットのプリセット機能

**Feature**: `014-preset-bookmarks`  
**Date**: 2026-11-18

## 1. ビルド手順

```bash
npm ci
npm run build
```

- `package/js/background.js`、`package/js/list.js`、`package/js/preferences.js`、`package/js/popup.js` および `package.zip` がエラーなく生成されることを確認する。

## 2. 動作確認シナリオ

1. **初期状態の確認**:
   - `chrome://extensions/` で `package/` ディレクトリを読み込む。
   - 設定画面（`preferences.html`）を開き、「定番プリセット（Presets）」カード内の全 12 件のチェックボックスがすべて OFF になっていることを確認する。
   - ポップアップ（`Option+Shift+D` / `Alt+Shift+D`）を開き、Tips をクリックして切り替えるとプリセット機能の紹介 Tip が表示されることを確認する。

2. **プリセットの有効化と検索・遷移**:
   - 設定画面で `g`（Google 検索）、`wiki`（Wikipedia 検索）、`mdlink`（Markdown リンクをコピー）、`wayback`（Wayback Machine で表示）にチェックを入れる。
   - ポップアップを開き、`g primevue` と入力すると `Google 検索 — https://www.google.com/search?q=primevue` が候補表示され、Enter で Google 検索結果が開くことを確認する。
   - 言語設定を「日本語」にした状態で `wiki ブラウザ` を検索すると `ja.wikipedia.org`、言語設定を「英語」に切り替えて `wiki browser` を検索すると `en.wikipedia.org` が候補になることを確認する。
   - 任意の Web ページ上で `mdlink` を実行し、クリップボードに `[ページタイトル](URL)` がコピーされることを確認する。

3. **ストレージ非消費・一覧非混入・優先度の確認**:
   - ブックマーク一覧画面（`list.html`）を開き、テーブルおよび JSON エディタにプリセットが含まれていないことを確認する。
   - 手動で `:add g https://example.com Example` を登録して 1 回遷移（スコア上昇）させた後、ポップアップで `g` を検索すると、手動登録した `Example` がプリセットの `Google 検索` より上位に表示されることを確認する。
   - `:rm` と入力した際、プリセットのみのニックネームは削除候補に現れないことを確認する。
