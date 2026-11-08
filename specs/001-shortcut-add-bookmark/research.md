# リサーチ・技術調査 (Research & Architecture Decisions)

**機能ブランチ**: `001-shortcut-add-bookmark`
**作成日**: 2026-11-08
**ステータス**: 完了 (Completed)

---

## 1. Chrome Commands API と Action Popup の連携

### 決定事項 (Decision)
`package/manifest.json` に `commands` API の予約コマンド `_execute_action` を定義し、同時に `action.default_popup` に `popup.html` を指定する。

```json
"action": {
  "default_popup": "popup.html",
  "default_icon": { ... },
  "default_title": "__MSG_extensionName__"
},
"commands": {
  "_execute_action": {
    "suggested_key": {
      "default": "Alt+Shift+D",
      "mac": "Command+Shift+D"
    },
    "description": "__MSG_commandRegisterBookmark__"
  }
}
```

### 採択理由 (Rationale)
1. Chrome 拡張機能の Manifest V3 では、`_execute_action` コマンドにショートカットキーを割り当てることで、ブラウザネイティブの挙動としてツールバーのポップアップを瞬時に展開できる。
2. バックグラウンド側でキーイベント（`chrome.commands.onCommand`）を手動リッスンしてポップアップを開く代替手段（`chrome.action.openPopup()`）に比べ、Chrome 135 以降の全環境で権限やフォーカスの奪取問題が発生せず、確実に最前面で開く。
3. ユーザーは `chrome://extensions/shortcuts` からブラウザ標準のUIで自由に変更・無効化できる。

### 検討した代替案 (Alternatives Considered)
- **Content Script によるページ内モーダル注入**:
  `chrome://` や Chrome ウェブストア、新規タブ等の保護ページで実行できず、ページ側の CSS や z-index、iframe との競合が発生するため不採用。
- **独立ウィンドウ（`chrome.windows.create`）**:
  ウィンドウの生成オーバーヘッドが大きく、キーボード操作で手軽に登録するという UX に合わないため不採用。

---

## 2. ツールバーアイコンクリックの挙動移行

### 決定事項 (Decision)
既存の `chrome.action.onClicked` リスナー（管理画面を開く処理）は、`action.default_popup` の設定によりポップアップ展開に置き換わる。これに伴い、ポップアップのヘッダーに「一覧画面を開く」「設定画面を開く」アイコンボタンを配置する。

### 採択理由 (Rationale)
1. `action.default_popup` が指定されている場合、ブラウザのツールバーアイコンをクリックした際も同じポップアップが開く（Chrome の標準仕様）。
2. ヘッダーに一覧画面・設定画面への明確なアイコンリンク（`pi pi-list`, `pi pi-cog`）を設置することで、これまでの「アイコンクリックで管理画面を開いていた」ユーザーの利便性を損なわず、むしろ登録と一覧閲覧の統合ハブとして使い勝手を向上できる。

---

## 3. ポップアップの UI 実装・ビルド構成

### 決定事項 (Decision)
1. **エントリーポイント**: `src/popup.ts` および `src/Popup.vue` を新設し、`webpack.config.js` に `popup: './src/popup.ts'` を追加して `package/js/popup.js` をビルド出力する。
2. **HTML ファイル**: `package/popup.html` を新設し、`list.html` や `preferences.html` と同様に PrimeVue の基本スタイルと `js/popup.js` を読み込む。
3. **UI フレームワーク**: プロジェクト憲章（憲章 III）に基づき、Vue 3 `<script setup lang="ts">` と PrimeVue v4（Aura テーマ）のコンポーネント（`AutoComplete` または `InputText`、`Button`、`Toast` 等）を使用する。

### 採択理由 (Rationale)
既存の `src/list.ts` や `src/preferences.ts` と完全に同一のアーキテクチャ・設定を踏襲することで、コードの共通化とデザインの一貫性（Aura ダークテーマ）を担保できる。

---

## 4. アクティブタブ情報の取得とトースト通知連携

### 決定事項 (Decision)
1. **タブ情報の取得**: ポップアップ初期化時、`chrome.tabs.query({ active: true, currentWindow: true })` を呼び出して現在アクティブなタブの `url` と `title` を取得し、フォームの初期値に設定する。
2. **トースト通知の表示**: `src/background.ts` に実装されている `showToast(tabId, message)` 関数を `export` し、`Popup.vue` からインポートして使用する（またはポップアップから直接呼び出す）。
3. **安全なクローズ**: ブックマーク保存が完了したら、アクティブタブにトーストを注入した直後に `window.close()` を呼び出してポップアップを即座に閉じる。

### 採択理由 (Rationale)
1. ポップアップ自体は拡張機能コンテキストで動作するため、`activeTab` / `tabs` 権限によりアクティブタブの URL・タイトルを確実に取得できる。
2. 既存の `showToast` ロジックを再利用することで、二重実装を防ぎ、アドレスバーからの `:add` コマンドと全く同一のデザイン・アニメーションのトースト通知を提供できる。
3. 保護ページ（`chrome://` 等）で `executeScript` が拒否された場合でも、既存の例外ハンドリングにより処理が中断せず、安全にポップアップが閉じる。

---

## 5. ニックネーム補完（AutoComplete）の実装

### 決定事項 (Decision)
1. ポップアップ起動時に `loadBookmarksData()` で既存の全ブックマークデータを読み込み、ニックネーム一覧（`Object.keys(bookmarks)`）をキャッシュする。
2. ユーザーがニックネームを入力する際、入力文字列で前方一致・部分一致する既存ニックネームをリアルタイムで抽出し、PrimeVue の `AutoComplete`（またはサジェストドロップダウン）で表示する。
3. ユーザーが候補を選択した場合はそのニックネームが補完され、Enter キーでそのニックネームへの追加登録（マルチURL）が実行される。

### 採択理由 (Rationale)
1. Nickmark のデータはクライアント側のストレージ（ローカルまたは同期）に保持されており、ニックネーム一覧の抽出・フィルタリングはミリ秒未満（50ms以内）で完了するため、極めて軽快な操作性を維持できる。
2. Enter キーで素早く確定でき、キーボード操作特化型の設計原則（憲章 I）に完全に合致する。
