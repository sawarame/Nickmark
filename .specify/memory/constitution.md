<!--
Sync Impact Report
- Version change: N/A (template) → 1.0.0
- Modified principles:
  - [PRINCIPLE_1_NAME] → I. キーボードファースト・オムニボックス中心設計 (Keyboard-First & Omnibox-Centric UX)
  - [PRINCIPLE_2_NAME] → II. Manifest V3 Service Worker とハイブリッドストレージの安全性 (Manifest V3 & Hybrid Storage Integrity)
  - [PRINCIPLE_3_NAME] → III. Vue 3 Composition API と PrimeVue による一貫した UI 設計 (Unified UI with Vue 3 & PrimeVue v4)
  - [PRINCIPLE_4_NAME] → IV. 型安全性とモジュール間共有・日本語ドキュメンテーション (Type Safety, Shared Schemas & Japanese Documentation)
  - [PRINCIPLE_5_NAME] → V. 即時反映される多言語対応とセキュアなスクリプト実行 (Reactive i18n & Secure Execution)
- Added sections:
  - 技術スタックとアーキテクチャ制約 (Technology Stack & Architecture Constraints)
  - 開発ワークフローと品質ゲート (Development Workflow & Quality Gates)
- Removed sections: None
- Templates requiring updates:
  - ✅ .specify/memory/constitution.md (updated)
  - ✅ .specify/templates/plan-template.md (reads constitution dynamically at runtime)
  - ✅ .specify/templates/spec-template.md (aligned with requirements structure)
  - ✅ .specify/templates/tasks-template.md (aligned with task phases)
- Follow-up TODOs: None
-->

# Nickmark Constitution

## Core Principles


### I. キーボードファースト・オムニボックス中心設計 (Keyboard-First & Omnibox-Centric UX)

- すべての主要操作（ニックネーム検索・遷移、`%s` を用いた動的 URL 展開、ブックマークレット実行、登録 `:add` / `:addall`、一括起動 `:open`、削除 `:rm`、画面遷移 `:ls` / `:prefs` / `:help`）は、Chrome のアドレスバー（オムニボックスのキーワード `nm`）からキーボード操作のみで完結できなければならない（MUST）。
- 候補のソート順は「1. マッチ度ティア（完全一致 ＞ 前方一致 ＞ 部分一致 ＞ タイトル・URL 横断一致） ＞ 2. ピン留め（`is_pinned`） ＞ 3. 指数減衰スコア（`score`） ＞ 4. 解決後 URL の昇順」を厳수しなければならない（MUST）。
- ユーザーへのフィードバックは作業を妨げないよう配慮し、`:open` 成功時は通知を省略し、登録・削除・エラー時は `activeTab` と `scripting` API を用いたページ内トースト通知（`chrome://` 等のスクリプト注入禁止ページでは `list.html` へのフォールバック遷移）で表示しなければならない（MUST）。
- **根拠**: マウス移動を最小限にしたいエンジニアやパワーユーザーが、アドレスバーから瞬時に目的の操作を完了できるという Nickmark の基本コンセプト（`.context/spec.md`）を維持するため。


### II. Manifest V3 Service Worker とハイブリッドストレージの安全性 (Manifest V3 & Hybrid Storage Integrity)

- バックグラウンド処理は Manifest V3 の Service Worker（`src/background.ts`）として実装し、`chrome.*` API の呼び出しはすべて `async/await` 構文による非同期処理で統一しなければならない（MUST）。
- ブックマークデータの永続化は、高速かつ大容量な `chrome.storage.local`（`unlimitedStorage`）とデバイス間同期用の `chrome.storage.sync`（合計 100KB 制限）を切り替えるハイブリッド方式とし、入力中の重複読み込みを防ぐためメモリキャッシュと Promise 共有機構を維持しなければならない（MUST）。
- `chrome.storage.sync` への保存時は、日本語などのマルチバイト文字（UTF-8）が 1 項目 8KB の上限を超えないよう 2,000 文字単位（`sync_data_N` キー）でチャンク分割して保存し、読み込み時のパース失敗（`CORRUPTED_SYNC_DATA`）や容量超過（`QUOTA_EXCEEDED`）時は既存データを空で上書きせずエラーを送出しなければならない（MUST）。
- 同期の ON/OFF 切り替え時は UI トグルの直接変更を遮断し、必ずデータ移行・競合解決ダイアログを表示してユーザーの承認を得なければならない（MUST）。また、`isSyncEnabled` と `language` はデバイス固有設定として常に `chrome.storage.local` に保存しなければならない（MUST）。
- **根拠**: Service Worker の再起動特性や `chrome.storage.sync` の厳しい容量制限下においても、ユーザーのブックマークデータの破損・消失・意図しない上書きを確実に防ぐため。


### III. Vue 3 Composition API と PrimeVue による一貫した UI 設計 (Unified UI with Vue 3 & PrimeVue v4)

- ブックマーク一覧画面（`src/List.vue`）および設定画面（`src/Preferences.vue`）は、Vue 3 の `<script setup lang="ts">` 構文と PrimeVue (v4) の `Aura` テーマ（`@primeuix/themes/aura`）および `primeicons` を用いて構築しなければならない（MUST）。
- プレーンな HTML/CSS による独自 UI の再発明を避け、`Card`、`DataTable`、`Column`、`InputText`、`Button`、`Dialog`、`Toast`、`ToggleSwitch`、`Select`、`Message` などの PrimeVue コンポーネントを優先して使用しなければならない（MUST）。
- コンポーネント固有のスタイルは `<style scoped>` に閉じ込め、背景色や文字色には PrimeVue の CSS 変数（`var(--p-surface-*)`, `var(--p-text-color)` 等）を使用しなければならない（MUST）。破壊的な操作（削除）には `severity="danger"`、副次的な操作には `severity="secondary"` を指定し、操作結果やバリデーションエラーは `Toast` コンポーネントで通知しなければならない（MUST）。
- **根拠**: 管理画面・設定画面間のデザイン統一性と視認性を保ちつつ、UI コンポーネントの保守コストを最小化するため（`DESIGN.md`）。


### IV. 型安全性とモジュール間共有・日本語ドキュメンテーション (Type Safety, Shared Schemas & Japanese Documentation)

- すべてのスクリプトとコンポーネントは TypeScript（`target: ES2022`）で記述し、変数・関数の引数と戻り値・Vue のリアクティブ状態（`ref<T>`, `reactive`, `computed`）には可能な限り明示的な型定義を与えなければならない（MUST）。
- `BookmarkEntry` や `NickmarkData` などのデータ構造およびストレージ操作関数は `src/background.ts` で一元定義してエクスポートし、`src/List.vue` や `src/Preferences.vue` からインポートして再利用しなければならない（MUST）。
- ソースコード内のコメント、JSDoc、および Markdown ドキュメントは特別な理由がない限り日本語で記述し、クラスや関数にはその役割・引数の意図を説明するコメントを記載しなければならない（MUST）。
- **根拠**: バックグラウンドと複数 UI 画面間でのデータスキーマの不整合をコンパイル時に検出し、コードの可読性と将来の保守性を高めるため（`.context/typescript.md`）。


### V. 即時反映される多言語対応とセキュアなスクリプト実行 (Reactive i18n & Secure Execution)

- すべてのユーザー向け文言（管理画面・設定画面のラベルおよびバックグラウンドのトースト通知）は `package/_locales/{en,ja}/messages.json` に定義し、`src/i18n.ts`（`initI18n`, `t`, `setLocale`）経由で取得することで、言語設定の変更が再読み込みなしで即座に反映されなければならない（MUST）。
- ブックマークレット（`javascript:` で始まる URL）はページ遷移を行わず、`chrome.userScripts.execute`（`world: "MAIN"`、Chrome 135 以降）を用いてアクティブタブ上で実行しなければならない（MUST）。また、コード破損を防ぐためブックマークレット内の `%s` は動的 URL プレースホルダーとして展開してはならない（MUST NOT）。
- `userScripts` API が利用不可（Chrome の「ユーザー スクリプトを許可する」設定がオフ等）の場合や、`chrome://`・Chrome ウェブストア等の実行禁止ページでは、実行を安全に中断してエラートーストや管理画面上の警告バナーで案内しなければならない（MUST）。
- **根拠**: 日本語・英語ユーザー双方に一貫した体験を提供するとともに、Manifest V3 のセキュリティ要件に準拠した安全なスクリプト実行を保証するため。


## 技術スタックとアーキテクチャ制約 (Technology Stack & Architecture Constraints)


- **プラットフォーム要件**: Chrome Extension Manifest V3（`minimum_chrome_version: "135"`）。権限は最小限の原則に基づき `omnibox`, `storage`, `unlimitedStorage`, `tabs`, `activeTab`, `scripting`, `userScripts`, `contextMenus`, `favicon` を `package/manifest.json` で管理する。
- **言語・フレームワーク**: TypeScript (`^6.0.3`, `ES2022`)、Vue 3 (`^3.5.34`)、PrimeVue (`^4.5.5`)、`@primeuix/themes` (`^2.0.3`)、`primeicons` (`^7.0.0`)、JSON エディタとして `vue3-ts-jsoneditor` (`^3.4.0`) を使用する。
- **ビルド・バンドル構成**: Webpack 5 (`webpack.config.js`) により、`src/background.ts`、`src/list.ts`、`src/preferences.ts` の 3 エントリーポイントをコンパイル・バンドルし、`package/js/[name].js` に出力する。アイコン画像は `sharp` を用いた `generate_icons.js` で生成する。
- **ディレクトリ構造と編集ルール**:
  - `src/`: すべての開発用ソースコード（`.ts`, `.vue`）。機能変更・バグ修正は必ず `src/` 配下で行う（MUST）。
  - `package/`: ブラウザ読み込み・配布用ディレクトリ（`manifest.json`, `list.html`, `preferences.html`, `_locales/`, `icons/`, `js/`）。**`package/js/` 配下のビルド成果物を直接編集してはならない（MUST NOT）。**
  - `.context/` および `DESIGN.md`: 仕様（`spec.md`）、技術スタック（`tech_stack.md`）、開発手順（`development.md`）、TypeScript 規約（`typescript.md`）、デザイン規約（`DESIGN.md`）を保持する基礎ドキュメント群。

## 開発ワークフローと品質ゲート (Development Workflow & Quality Gates)

- **ビルドの徹底**: `src/` 配下のファイルを変更した後は、必ず `npm run build` を実行し、`package/js/` の再生成と配布用 `package.zip` の更新がエラーなく完了することを確認しなければならない（MUST）。
- **設計選択肢の比較と技術的根拠の明示**: 新機能の実装や既存ロジックの変更を提案する際は、実装前に複数の設計案とそのメリット・デメリットを比較提示し、なぜその実装を選んだのかという技術的根拠を明示しなければならない（MUST）。
- **ドキュメントの同期**: 機能要件、オムニボックスコマンド、ストレージ構造、または使用ライブラリに変更が生じる場合は、コードの変更と合わせて `.context/` 内のドキュメントおよび `package/_locales/{en,ja}/messages.json` を更新しなければならない（MUST）。
- **ブラウザ実機検証**: 変更後は `chrome://extensions/` で `package/` ディレクトリを再読み込みし、オムニボックス操作（`nm`）、Service Worker のコンソールログ、および管理画面・設定画面の動作にリグレッションがないことを確認しなければならない（MUST）。

## Governance


- 本 Constitution（憲章）は Nickmark プロジェクトにおける最上位の設計・実装規約であり、すべての仕様策定（`/speckit-specify`）、計画作成（`/speckit-plan`）、タスク分割（`/speckit-tasks`）、および実装（`/speckit-implement`）は本憲章の原則に準拠しなければならない（MUST）。
- **改定手続き**: 本憲章の原則を追加・変更・削除する場合は、`.context/` 配下の基礎ドキュメントおよび `DESIGN.md` との整合性を確認し、変更理由と影響範囲を記録した上で `/speckit-constitution` を通じて更新する。
- **バージョニング方針**: セマンティックバージョニング（`MAJOR.MINOR.PATCH`）を採用する。
  - `MAJOR`: 原則の削除、または既存のアーキテクチャ・ガバナンスに対する後方互換性のない変更。
  - `MINOR`: 新しい原則やセクションの追加、または既存ルールに対する実質的な要件の拡充。
  - `PATCH`: 意味を変えない表現の改善、誤字修正、補足の追加。
- **コンプライアンス確認**: すべての実装・レビューにおいて、(1) `npm run build` の成功、(2) ハイブリッドストレージとチャンク処理の安全性、(3) PrimeVue デザインルールへの準拠、(4) 日英ロケール定義の完全性、(5) 日本語コメント・JSDoc の記述が満たされていることを検証する。ランタイムの開発ガイダンスには `AGENTS.md`（および `GEMINI.md`）と `.context/` 配下のドキュメントを併用する。

**Version**: 1.0.0 | **Ratified**: 2026-11-06 | **Last Amended**: 2026-11-06
