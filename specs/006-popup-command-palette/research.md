# Technical Research: ポップアップのコマンドパレット化とオムニボックス移行案内

**Feature**: `006-popup-command-palette`
**Created**: 2026-11-14

## 1. ショートカットキーのクロスプラットフォーム定義

- **Decision**: `package/manifest.json` の `commands._execute_action.suggested_key.default` を `"Alt+Shift+D"` から `"Ctrl+Shift+U"` に変更する。
- **Rationale**: Chrome Manifest V3 の `commands` 仕様では、`"default": "Ctrl+Shift+U"` を指定すると Windows / Linux では `Ctrl+Shift+U`、macOS では自動的に `Command+Shift+U`（`Cmd+Shift+U`）へマッピングされる。Chrome 標準のショートカット等と競合しにくく、押しやすいキー配置となっている。
- **Alternatives considered**:
  - `"Alt+K"` / `"Option+K"`: 押しやすいが macOS の入力中に特殊文字（`˚`）と干渉する環境がある。
  - `"Ctrl+Shift+Space"`: IME 切替や他ランチャー（Spotlight / Alfred / Raycast）と競合する可能性が高い。
- **Migration note**: 既に拡張機能をインストール済みの環境では、Chrome 仕様上 `suggested_key` の変更が自動上書きされないため、ドキュメントおよび案内文言上で変更後ショートカットと `chrome://extensions/shortcuts` での確認方法を案内できるようにする。

## 2. コマンド実行エンジンおよびブックマークレット実行の共有化

- **Decision**: `src/background.ts` に実装されているコマンド実行ロジック（`:add`, `:addall`, `:open`, `:rm`, `:ls`, `:prefs`, `:help`）およびブックマークレット実行ロジックを `src/shared/commands.ts` に抽出し、副作用（ページ内トースト表示や `list.html` フォールバック、ポップアップ内フィードバック表示）を抽象化した戻り値型 `CommandExecutionResult` を返す設計とする。
- **Rationale**:
  - 移行期間中はオムニボックス（`src/background.ts`）とポップアップ（`src/Popup.vue`）の両方が同じコマンド仕様を実行する必要がある。ロジックを `src/shared/commands.ts` に一元化することでコード重複（Constitution 原則 IV）を防ぎ、将来オムニボックスを廃止する際も `src/background.ts` のオムニボックスリスナーを削除するだけで安全に完了できる。
  - オムニボックス側は従来通り `showToast` / `openOrReuseListTab` / `handleBatchOpenConfirmationRequest` を呼び出し、ポップアップ側は `CommandExecutionResult` を受けてポップアップ内にインラインフィードバック・確認 UI・自動クローズタイマーを制御できるため、特殊ページ（`chrome://` 等）での意図しない `list.html` 強制遷移を完全に排除できる。
- **Alternatives considered**:
  - `Popup.vue` 内に独自に `:add` や `:rm` を再実装する案: オムニボックス側と挙動が乖離しやすく保守コストが高いため却下。
  - すべてを `background.ts` への `chrome.runtime.sendMessage` 経由にする案: 通常の検索やストレージ操作（`:add`, `:rm` 等）は `src/shared/storage.ts` が直接 Promise を返すためポップアップ内でも高速に完結できる。一方、ブックマークレット実行およびポップアップが閉じる直前のタブ操作・スコア更新はメッセージ経由または共通関数で確実に完了させる。

## 3. ブックマークレット実行と `chrome.userScripts` の実行経路

- **Decision**: ポップアップからブックマークレットを実行する際は、バックグラウンド（Service Worker）へ `EXECUTE_BOOKMARKLET` メッセージを送信して `executeBookmarkletOnTab` を実行し、結果（`{ success: boolean; errorMessage?: string }`）を受け取る。
- **Rationale**:
  - 成功時はポップアップを即座に閉じても Service Worker 側でスコア更新処理まで確実に完遂する。
  - 禁止ページ（`chrome://` 等）や「ユーザー スクリプトを許可する」未設定、コード空・実行時エラーの場合は `success: false` とロケール済みエラーメッセージを返し、ポップアップ内でエラー通知を表示して `list.html` への強制遷移を避けられる。
- **Alternatives considered**:
  - ポップアップから直接 `chrome.userScripts.execute` を実行する案: 実行成功直後に `window.close()` を呼ぶと非同期の `updateScore` 完了前にポップアップコンテキストが破棄される恐れがあるため却下。

## 4. ポップアップ候補モデル（`:add` フォルダ補完・対象タブプレビュー）

- **Decision**: `src/shared/search.ts` にポップアップコマンドパレット専用の候補構築関数（`buildPaletteSuggestions` 等）を追加し、既存の `resolveRegularSearchMatches`, `resolveCommandMatches`, `extractFolders`, `filterNicknameSuggestions` を再利用して構造化アイテム `PaletteItem[]` を生成する。
- **Rationale**:
  - オムニボックス API は XML 文字列の `description` と単一 `content` しか返せないが、ポップアップ UI では favicon URL、フォルダアイコン、種別バッジ（`[JS]`, `[%s]`, `📌`）、ニックネーム、タイトル、URL、および `Tab` 補完用テキスト（`fillText`）を個別に構造化して描画できる。
  - `:add` / `:a` コマンド入力中は、`appendRegisterNicknameCandidates` 相当の既存ニックネーム候補に加え、`extractFolders` 由来のフォルダプレフィックス候補（`folder/`）を補完リストに統合する。さらに先頭のコマンド実行候補には、第2引数（直接 URL）またはアクティブタブ情報（タイトル・URL）を解決して登録対象プレビューとして表示する。
- **Alternatives considered**:
  - 既存の `resolveCommandMatches` の XML 文字列をパースしてポップアップに描画する案: 脆弱であり、ファビコンやフォルダ補完・タブプレビューを柔軟に出せないため却下。

## 5. オムニボックス移行案内候補の表示と安全処理

- **Decision**:
  - `src/shared/url.ts` または `src/i18n.ts` 周辺で OS 判定（`navigator.userAgent` 等により macOS かどうかを同期/非同期に判定）を行い、Mac では `Cmd+Shift+U`、Windows/Linux では `Ctrl+Shift+U` を案内文言に埋め込む。
  - `chrome.omnibox.onInputStarted` のデフォルト案内を移行促進メッセージ（例: `Nickmark - 次回からは Cmd+Shift+U でポップアップをご利用ください`）にする。
  - `chrome.omnibox.onInputChanged` で生成されるサジェスト配列の先頭に、専用の識別トークン（例: `MIGRATION_SUGGESTION_CONTENT = ':popup-hint'` などの安全かつ重複しない固定コマンドまたはマーカー）を持つ移行案内候補を1件挿入する。ただし `setDefaultSuggestion` には従来通り最上位の検索マッチまたはコマンドを設定するため、ユーザーがそのまま `Enter` を押した際の即時遷移体験は損なわれない。
  - `chrome.omnibox.onInputEntered` でこの移行案内候補が選択された場合は、URL 遷移やデータ変更を行わず、対象タブ上でスクリプト注入が可能な場合のみ「ショートカット（Cmd+Shift+U / Ctrl+Shift+U）からご利用ください」という案内トーストを表示する（スクリプト注入不可ページではエラーや強制遷移を起こさず安全に終了する）。
- **Rationale**: 既存の `nm <query> + Enter` 操作を破壊せず、かつアドレスバーを使ったすべてのユーザーに確実に新 UI への移行を認知させることができる。
- **Alternatives considered**:
  - `setDefaultSuggestion` 自体を移行案内にしてしまう案: 従来の `nm gh` + `Enter` が遷移しなくなり移行期間中のユーザビリティを損ねるため却下。
  - 候補リストの末尾に追加する案: Chrome オムニボックスは表示件数に上限（最大5〜6件程度）があるため、候補が多い場合に画面外に押し出されて見えなくなる恐れがある。先頭（1行目）に置くことで確実に視認できる。

## 6. UI/UX レイアウト、キーボード操作・IME 制御、アイコン共有

- **Decision**:
  - `package/popup.html` の `body` 幅を `600px`（`min-height` はコンテンツ追従・最大高さ制限内でスクロール）に変更する。
  - `src/Popup.vue` は PrimeVue の `InputText`, `Button`, `Message` および `primeicons` をベースに構築し、検索入力欄の右端に `tabindex="-1"` のアイコンボタン（一覧画面・設定画面）を配置する。
  - キーボード操作は `keydown` ハンドラで `event.isComposing || event.keyCode === 229` を最初にガードし、日本語 IME 確定中の `Enter` 誤爆を防ぐ。
  - `ArrowDown` / `ArrowUp` / `Ctrl+N` / `Ctrl+P` で `selectedIndex` のみを移動し、`scrollIntoView({ block: 'nearest' })` で追従させる。`Tab` で `items[selectedIndex].fillText` を検索入力欄に反映する。
  - `getFaviconUrl` ヘルパーを `src/shared/url.ts` に共通化し、`List.vue` と `Popup.vue` の双方から再利用する。
- **Rationale**: Constitution 原則 III（Vue 3 + PrimeVue 統一 UI）および原則 IV（重複排除）に準拠し、キーボード操作の一貫性と高速な入力体験を両立できる。
