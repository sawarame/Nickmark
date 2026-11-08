# インターフェース契約: UI 操作とライフサイクル (UI Actions & Lifecycle Contract)

**機能ブランチ**: `001-shortcut-add-bookmark`
**作成日**: 2026-11-08
**ステータス**: 完了 (Completed)

---

## 1. ポップアップの起動・初期化シーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Browser as Chrome ブラウザ
    participant Popup as Popup.vue
    participant Storage as chrome.storage
    participant Tabs as chrome.tabs

    User->>Browser: ショートカット (Cmd+Opt+D / Alt+Shift+D) または アイコンクリック
    Browser->>Popup: popup.html をポップアップウィンドウとして展開
    activate Popup
    Popup->>Tabs: query({ active: true, currentWindow: true })
    Tabs-->>Popup: アクティブタブ情報 (id, title, url)
    Popup->>Storage: loadBookmarksData()
    Storage-->>Popup: 既存の全ブックマークデータ
    Popup->>Popup: フォーム初期化 (title, url 設定) & ニックネーム補完候補の準備
    Popup->>User: ニックネーム入力欄にフォーカスを当てて表示
    deactivate Popup
```

---

## 2. 保存実行とクローズシーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Popup as Popup.vue
    participant Storage as chrome.storage
    participant Scripting as chrome.scripting (showToast)
    participant Tab as Web ページ

    User->>Popup: ニックネームを入力して Enter 押下
    activate Popup
    Popup->>Popup: バリデーション実行 (nickname, url)
    alt バリデーション失敗
        Popup->>User: エラーメッセージを表示して待機
    else バリデーション成功
        Popup->>Storage: saveBookmarksData(bookmarks)
        Storage-->>Popup: 保存完了
        opt アクティブタブが存在し、スクリプト注入可能
            Popup->>Scripting: showToast(tabId, message)
            Scripting->>Tab: DOM 要素 (トースト) を一時注入・表示
        end
        Popup->>Popup: window.close() により即座にダイアログ終了
        deactivate Popup
    end
```

---

## 3. キーボード操作契約

| キー | 対象要素 | 動作 |
| :--- | :--- | :--- |
| `Enter` | ニックネーム / タイトル / URL / デフォルト値入力欄 | フォーム送信（保存実行）を行い、成功時にポップアップを閉じる。 |
| `Escape` | ポップアップ全体 | ポップアップを直ちに閉じる（Chrome 標準動作 + 必要に応じハンドリング）。 |
| `Tab` / `Shift+Tab` | フォーカス可能要素 | ニックネーム → タイトル → URL → (デフォルト値) → 登録ボタン → ヘッダーボタンの順に巡回。 |
