# 技術スタック (Tech Stack)

Nickmark プロジェクトで使用されている主要な技術とツールの概要です。

## 1. コア技術

- **Chrome Extension Manifest V3**: 拡張機能のベース（`minimum_chrome_version: "135"`）。
- **TypeScript**: 静的型付け言語。全てのスクリプト（バックグラウンド、一覧画面、設定画面、ポップアップランチャー）で使用。
- **Vue.js (Vue 3)**: 一覧画面・設定画面・ポップアップランチャーの UI 構築のための Composition API ベースのフレームワーク。
- **PrimeVue (v4)**: Vue 3 向けの UI コンポーネントライブラリ（`@primeuix/themes/aura` および `primeicons` を使用）。
- **vue3-ts-jsoneditor**: 一覧画面での JSON 一括編集・エクスポート用の JSON エディタコンポーネント。

## 2. ビルド・バンドルツール

- **Webpack (v5)**: TypeScript および Vue コンポーネントをブラウザで実行可能な JavaScript にバンドルする。
- **ts-loader**: Webpack で TypeScript をトランスパイルする。
- **vue-loader**: Webpack で `.vue` シングルファイルコンポーネントを処理する。
- **style-loader / css-loader**: PrimeVue 等の CSS をバンドルに含める。
- **Sharp**: SVG から各種サイズ (16px, 48px, 128px) のアプリアイコン (.png) を生成するスクリプトで使用。

## 3. ディレクトリ構成

- `src/`: 開発用のソースコードディレクトリ。
  - `background.ts`: Service Worker として動くバックグラウンドスクリプト（ストレージ監視・キャッシュ管理、コンテキストメニュー制御、ブックマークレット実行メッセージ処理、共有モジュールの再エクスポート）。
  - `list.ts` / `List.vue`: ブックマーク一覧画面のエントリーポイントおよびメインコンポーネント。
  - `preferences.ts` / `Preferences.vue`: 設定画面のエントリーポイントおよびメインコンポーネント。
  - `popup.ts` / `Popup.vue`: コマンドパレット型ポップアップランチャーのエントリーポイントおよびメインコンポーネント。
  - `i18n.ts`: 多言語対応（`en` / `ja` / `zh_CN` / `zh_TW` / `ko`、およびブラウザ言語自動判定 `'auto'`）モジュール。
  - `components/`: 再利用可能な UI コンポーネント群。
    - `CommandPromptIcon.vue`: ポップアップのコマンド候補等で使用するコマンドプロンプト（`>_`）SVG アイコンコンポーネント。
  - `shared/`: モジュール間で共有するドメイン別内部モジュール群。
    - `types.ts`: データ構造（`BookmarkEntry`, `NickmarkData`, `FolderInfo`, `PaletteItem` 等）および定数定義。
    - `url.ts`: パス正規化、URL 同一性判定、動的 URL 展開、ブックマークレット解析、Favicon・ショートカット表記ユーティリティ。
    - `toast.ts`: アクティブタブおよび管理画面向けのトースト通知生成・フォールバック遷移処理。
    - `storage.ts`: Hybrid Storage（`local` / `sync` チャンク分割）、キャッシュ、スコア計算、フォルダ管理ロジック。
    - `search.ts`: AutoComplete 補完およびコマンドパレット向けの検索・コマンド候補解決ロジック。
    - `commands.ts`: コマンドパレットから呼び出されるコマンド実行エンジンおよびブックマークレット実行ロジック。
    - `history.ts`: 任意権限（`history`）の確認・要求、およびポップアップ向けのブラウザ履歴検索・重複除外・候補変換ロジック。
    - `tips.ts`: ポップアップ空白状態向けの活用ヒント（Tips）カタログ・重複回避ランダム選出・OS 別表記解決ロジック。
    - `pointerSelection.ts`: ポップアップ候補リストにおけるポインター座標変化検知およびマウス静止時のホバー選択・背景色抑止ステート管理ロジック。
    - `listSort.ts`: 管理画面一覧の「最終使用日時」「スコア」並び替えおよび設定値正規化の純粋ロジック。
    - `bookmarkImport.ts`: Nickmark JSON・Chrome ブックマーク HTML の解析、バリデーション、ニックネームサニタイズ、ベースフォルダ付与、マージ統合ロジック。
    - `presets.ts`: 定番検索サービス・ブックマークレットのプリセットカタログ定義、正規化、および通常検索時の仮想エントリ合成ロジック。
    - `theme.ts`: 選択可能な定番 6 色のテーマカラー定義カタログ、正規化、PrimeVue Aura パレット生成、グレー（`slate`）向け視認性調整を含むテーマ別ハイライトトークン生成、設定画面向け成功トースト用デザイントークン生成、`localStorage` 同期キャッシュ、および実行時プリセット（プライマリパレット＋ハイライトトークン）適用ロジック。
    - `appBootstrap.ts`: Vue 3 + PrimeVue アプリケーションの共通初期化ヘルパー（一覧・設定画面向けのフル構成）。
    - `primeVueBootstrap.ts`: テーマプリセット拡張（`createNickmarkPreset`）と PrimeVue マウントの共通コアヘルパー。
    - `popupBootstrap.ts`: ポップアップランチャー専用の軽量 Aura サブセット初期化ヘルパー。
- `package/`: 拡張機能としてブラウザに読み込ませる（配布する）ディレクトリ。
  - `manifest.json`: 拡張機能の定義ファイル。
  - `list.html` / `preferences.html` / `popup.html`: 各画面のベース HTML。
  - `js/`: Webpack によってビルドされた JavaScript ファイル群が出力される。
  - `icons/`: `generate_icons.js` によって生成されたアイコン画像。
  - `_locales/`: `en`、`ja`、`zh_CN`、`zh_TW`、`ko` の 5 言語国際化 (i18n) 用メッセージファイル。
- `scripts/`: プロモーション画像の自動生成など開発・ストア配布用補助スクリプト群。
  - `generate_promo_images.js`: HTML/CSS テンプレートと Headless Chrome を用いて `images/` 配下に多言語プロモーション画像（1280×800 PNG）を生成するスクリプト。
  - `promo_templates.js`: 5 種類のプロモーション画像スライド用 HTML/CSS テンプレート。
  - `promo_locales.js`: プロモーション画像向けの多言語テキスト辞書（`zh_CN` / `zh_TW` / `ko` / `ja` / `en`）。
- `docs/`: GitHub Pages（`/docs` ルート公開想定）向けのビルド不要な静的紹介ページ（ランディングページ）。
  - `index.html`: セマンティック HTML による単一紹介ページ本体（ライト／ダーク FOUC 抑止初期化スクリプト内蔵）。
  - `styles.css`: ライト／ダーク自動追従・手動切替および定番 6 色テーマカラープレビュー対応のレスポンシブスタイルシート。
  - `i18n.js`: 5 言語（`ja` / `en` / `zh-Hans` / `zh-Hant` / `ko`）の翻訳辞書・言語判定・`sawara.me` ドキュメント URL マッピング。
  - `app.js`: 多言語切替、テーマ・6 色アクセントプレビュー、コマンドパレット体験デモ（検索・動的 URL・フォルダ一括起動・コマンド・ブックマークレット・Tips）、コピーボタン、スクロールスパイ制御。
  - `assets/icon.svg`: ページ内表示・ファビコン用に同梱したアプリアイコン。
  - `.nojekyll`: GitHub Pages での Jekyll ビルドを無効化するマーカーファイル。

## 4. コマンド・使い方

- `npm install`: 依存関係のインストール。
- `npm run build`: ソースコードのビルド、`package/js/` への出力、および配布用の `package.zip` の生成を行う。
- `node generate_icons.js`: `src` やルートにあるスクリプトからアイコン画像を生成する（通常は手動、または必要に応じて実行）。
- `node scripts/generate_promo_images.js`: 中国語（簡体字・繁体字）・韓国語のプロモーション画像を `images/` に生成する（`--langs=zh_CN,ko` や `--all` で対象言語を指定可能）。
