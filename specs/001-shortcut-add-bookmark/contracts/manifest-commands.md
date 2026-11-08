# インターフェース契約: Manifest & Commands (Manifest & Commands Contract)

**機能ブランチ**: `001-shortcut-add-bookmark`
**作成日**: 2026-11-08
**ステータス**: 完了 (Completed)

---

## 1. `package/manifest.json` 定義契約

### Action 定義
ツールバーアイコンおよびポップアップの指定。

```json
"action": {
  "default_popup": "popup.html",
  "default_icon": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "default_title": "__MSG_extensionName__"
}
```

### Commands 定義
キーボードショートカットの予約コマンド `_execute_action`。

```json
"commands": {
  "_execute_action": {
    "suggested_key": {
      "default": "Alt+Shift+D",
      "mac": "Alt+Command+D"
    },
    "description": "__MSG_commandRegisterBookmark__"
  }
}
```

---

## 2. 多言語メッセージ契約 (`package/_locales/{en,ja}/messages.json`)

以下のキーが必ず双方のロケールファイルに定義されていなければならない（MUST）。

| メッセージキー | 日本語 (`ja`) | 英語 (`en`) | 用途 |
| :--- | :--- | :--- | :--- |
| `commandRegisterBookmark` | ブックマーク登録ダイアログを開く | Open bookmark registration dialog | ショートカット一覧画面での説明文 |
| `popupTitle` | ブックマーク登録 | Add Nickmark | ポップアップのヘッダータイトル |
| `saveBtn` | 登録 | Save | 登録実行ボタンのラベル |
| `closeBtn` | 閉じる | Close | キャンセル/閉じるボタンのラベル |
| `openOptionsTooltip` | ブックマーク一覧画面を開く | Open Nickmarks Manager | ヘッダー一覧ボタンのツールチップ |
| `openPreferencesTooltip` | 設定画面を開く | Open Preferences | ヘッダー設定ボタンのツールチップ |
| `errorSyncQuotaExceeded` | データサイズ制限（100KB）を超えたため保存できませんでした。 | Cannot save because data size exceeded sync quota (100KB). | 容量超過時のエラー（既存共通） |
