# Quickstart: コマンド入力モード時のアイコン表示修正の検証手順

**Feature**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/013-popup-command-icon/spec.md) | **Plan**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/013-popup-command-icon/plan.md)

## 1. ビルド・型チェック検証

ソースコード変更後、リポジトリルートで以下を実行しエラーなく完了することを確認する。

```bash
npx tsc --noEmit
npm run build
```

期待結果:
- TypeScript の型チェックが終了コード `0` で通過する。
- `package/js/popup.js` および `package.zip` がエラーなく再生成される。

## 2. Chrome 拡張機能実機（またはロード済みポップアップ）での動作確認

1. `chrome://extensions/` を開き、Nickmark（`package/` ディレクトリ）を再読み込みする。
2. ツールバーアイコンまたはショートカットキー（Mac: `Option + Shift + D` / Windows・Linux: `Alt + Shift + D`）でポップアップを開く。
3. **通常検索モードの確認**:
   - 検索欄が空の状態、および `dev` や `https://example.com` のような通常検索語を入力した状態で、検索欄の左端に**虫眼鏡アイコン**が表示されていることを確認する。
4. **コマンド入力モードへの切り替え確認**:
   - `:` や `:add dev`、`   :open` のように先頭（先頭空白を除く）にコロンを入力した瞬間、虫眼鏡アイコンが**緑色（`--p-primary-color`）の `>_` コマンド入力アイコン**へ切り替わることを確認する。
   - 切り替え前後で入力欄テキストの横位置がズレないことを確認する。
5. **コマンド候補リストの確認**:
   - `:` や `:a` を入力して表示されるコマンド候補行の左側アイコン枠にも、空白ではなく `>_` コマンドアイコンが表示されていることを確認する。
6. **通常モード復帰とテーマ確認**:
   - 先頭の `:` を Backspace 等で削除すると、即座に虫眼鏡アイコンへ戻ることを確認する。
   - OS / ブラウザのライトモードおよびダークモード双方でアイコンが明瞭に視認できることを確認する。
