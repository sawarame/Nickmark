# Quickstart & Verification Guide: ダークモード時の設定画面・管理画面の配色と視認性修正

**Feature**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/spec.md) | **Plan**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/plan.md)

## 1. ビルド手順

ソースコードおよび HTML ファイルを更新した後、リポジトリルートで本番ビルドを実行し、`package/js/` および `package.zip` を再生成する。

```bash
npm run build
```

**期待結果**:
- TypeScript コンパイルおよび Webpack バンドルがエラー 0 件で完了すること。
- `package/js/list.js`, `package/js/preferences.js`, `package/js/popup.js`, `package/js/background.js`, `package.zip` が生成されること。

## 2. ビルド成果物およびスタイル検証

1. 生成された `package/js/preferences.js` / `package/js/list.js` にカスタムプリセット（`page` セマンティックトークンによる `--p-page-background`）が含まれていること。
2. `package/preferences.html`・`package/list.html` に旧来のインライン指定 `background-color: var(--p-surface-100)` が残存していないこと。

## 3. ブラウザ検証シナリオ

Chrome の `chrome://extensions/` で `package/` ディレクトリを読み込み（または再読み込み）した上で、ライトモード・ダークモード双方で確認する（DevTools の Rendering パネル `Emulate CSS media feature prefers-color-scheme` による切り替えでも可）。

### シナリオ 1: 設定画面（`preferences.html`）のダークモード表示
1. カラースキームを **Dark** に設定し、`preferences.html` を開く。
2. **期待結果**:
   - ページ全体の背景（横幅 1200px 外側の余白および画面下部まで）が暗い背景色（`#09090b` 相当）で表示される。
   - ページ読み込み直後に白い背景が一瞬ちらつかない。
   - ヘッダの戻るアイコンボタン（`←`）およびタイトル文字が明瞭に視認できる。
   - 各設定カードが背景より一段明るい暗い面（`#18181b` 相当）として浮かび上がり、枠線・テキストが読める。

### シナリオ 2: データ移行ダイアログ（`preferences.html`）の表示
1. ローカル・クラウド双方にブックマークが存在する状態で Google アカウント同期のトグルを切り替え、データ移行ダイアログを表示する。
2. **期待結果**:
   - **Dark**: 比較パネル枠が暗い背景（`zinc.800`）＋明るい文字となり、新しいデータ側（`.latest`）も視認可能なハイライト配色（透過プライマリ背景＋白文字）で表示される。
   - **Light**: 従来どおり明るい比較パネルとプライマリハイライトが表示される。

### シナリオ 3: 管理画面（`list.html`）のダーク／ライトモード表示
1. **Dark** で `list.html` を開き、ページ全体背景・ヘッダ見出し・歯車ボタン・Card・DataTable が明瞭に視認できることを確認する。
2. 表示したままカラースキームを **Light** ⇔ **Dark** へ切り替える。
3. **期待結果**: リロードなしで即座に背景色と文字色が追従し、Light 時は従来の薄いグレー背景（`slate.100`）＋白カードが維持される。

### シナリオ 4: ポップアップ（`popup.html`）のダークモード初期表示
1. **Dark** でツールバーアイコンまたはショートカットから `popup.html` を開く。
2. **期待結果**: 起動直後から暗い背景色（`#18181b`）＋白文字で表示され、初期白フラッシュが発生しない。
