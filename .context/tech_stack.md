# 技術スタック (Tech Stack)

Nickmark プロジェクトで使用されている主要な技術とツールの概要です。

## 1. コア技術

- **Chrome Extension Manifest V3**: 拡張機能のベース。
- **TypeScript**: 静的型付け言語。全てのスクリプト（バックグラウンド、ブックマーク一覧画面）で使用。
- **Vue.js (Vue 3)**: ブックマーク一覧画面の UI 構築のための Composition API ベースのフレームワーク。
- **PrimeVue (v4)**: Vue 3 向けの UI コンポーネントライブラリ。

## 2. ビルド・バンドルツール

- **Webpack (v5)**: TypeScript および Vue コンポーネントをブラウザで実行可能な JavaScript にバンドルする。
- **ts-loader**: Webpack で TypeScript をトランスパイルする。
- **vue-loader**: Webpack で `.vue` シングルファイルコンポーネントを処理する。
- **style-loader / css-loader**: PrimeVue 等の CSS をバンドルに含める。
- **Sharp**: SVG から各種サイズ (16px, 48px, 128px) のアプリアイコン (.png) を生成するスクリプトで使用。

## 3. ディレクトリ構成

- `src/`: 開発用のソースコードディレクトリ。
  - `background.ts`: Service Worker として動くバックグラウンドスクリプト（オムニボックス制御、コマンド実行、共有モジュールの再エクスポート）。
  - `list.ts` / `List.vue`: ブックマーク一覧画面のエントリーポイントおよびメインコンポーネント。
  - `preferences.ts` / `Preferences.vue`: 設定画面のエントリーポイントおよびメインコンポーネント。
  - `popup.ts` / `Popup.vue`: クイック登録ポップアップのエントリーポイントおよびメインコンポーネント。
  - `i18n.ts`: 多言語対応（`en` / `ja`）モジュール。
  - `shared/`: モジュール間で共有するドメイン別内部モジュール群。
    - `types.ts`: データ構造（`BookmarkEntry`, `NickmarkData`, `FolderInfo` 等）および定数定義。
    - `url.ts`: パス正規化、URL 同一性判定、動的 URL 展開、ブックマークレット解析ユーティリティ。
    - `toast.ts`: アクティブタブおよび管理画面向けのトースト通知生成・フォールバック遷移処理。
    - `storage.ts`: Hybrid Storage（`local` / `sync` チャンク分割）、キャッシュ、スコア計算、フォルダ管理ロジック。
    - `search.ts`: ゼロ幅文字マーカー制御、AutoComplete 補完、オムニボックス通常検索・コマンド候補解決ロジック。
    - `appBootstrap.ts`: Vue 3 + PrimeVue アプリケーションの共通初期化ヘルパー。
- `package/`: 拡張機能としてブラウザに読み込ませる（配布する）ディレクトリ。
  - `manifest.json`: 拡張機能の定義ファイル。
  - `list.html` / `preferences.html` / `popup.html`: 各画面のベース HTML。
  - `js/`: Webpack によってビルドされた JavaScript ファイル群が出力される。
  - `icons/`: `generate_icons.js` によって生成されたアイコン画像。
  - `_locales/`: `en` と `ja` の国際化 (i18n) 用メッセージファイル。

## 4. コマンド・使い方

- `npm install`: 依存関係のインストール。
- `npm run build`: ソースコードのビルド、`package/js/` への出力、および配布用の `package.zip` の生成を行う。
- `node generate_icons.js`: `src` やルートにあるスクリプトからアイコン画像を生成する（通常は手動、または必要に応じて実行）。
