# TypeScript コーディングルール (TypeScript Rules)

## 1. コンパイラ設定

- `target`: `ES2022` を指定し、モダンな JavaScript の機能を活用する。
- `moduleResolution`: `node` を使用。
- Vue のテンプレート内で Any 型エラーを防ぐなどの目的で、`strict` は `false` (または部分的に緩和) とするが、可能な限り型定義を明示的に行う。
- `chrome` API の型定義として `@types/chrome` を利用する。

## 2. コーディングスタイル

- **コメントの記載**: ソースコードには日本語でコメントを記述する。すべてのクラス、関数、メソッドには JSDoc 形式（概要、`@param`、`@returns`）で日本語のドキュメントコメントを記載すること。
- **型の明示**: 変数、関数の引数、戻り値には可能な限り型を明示する。
- **インタフェースと型エイリアス**: データの構造（例: `BookmarkEntry`, `NickmarkData`）は `src/shared/types.ts`（および `src/background.ts` からの再エクスポート）で定義し、バックグラウンドと各 UI 画面（`List.vue`, `Preferences.vue`, `Popup.vue`）で共有する。
- **非同期処理**: `Promise` を扱う場合は `async/await` 構文を使用し、`then/catch` の連鎖を避けて可読性を高める。
- **Chrome API の利用**: `chrome.*` API は Promise を返す V3 の仕様に合わせて `await chrome.storage.local.get(...)` のように記述する。

## 3. Vue 3 (Composition API) 固有のルール

- コンポーネントは `<script setup lang="ts">` 構文を使用して記述する。
- リアクティブな状態には `ref` または `reactive` を利用し、型の推論を効かせる（必要に応じてジェネリクスで型を指定する 例: `ref<Record<string, BookmarkEntry[]>>({})`）。
- 算出プロパティには `computed` を使用し、依存関係を明確にする。
- テンプレートへの型の露出を意識し、型安全なコードを心がける。

## 4. モジュールとインポート

- 共通の型定義・定数・ドメインロジックは `src/shared/` 配下の各モジュールおよび `src/background.ts` からエクスポートし、各画面コンポーネント（`src/List.vue`, `src/Preferences.vue`, `src/Popup.vue`）からインポートして再利用する。
