# モジュール・UI・権限契約: ポップアップ検索でのブラウザ履歴表示（オプトイン権限）

**対象機能**: `007-popup-history-search` | **作成日**: 2026-11-14 | **関連仕様**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/spec.md)

## 1. マニフェスト権限契約 (`package/manifest.json`)

- `permissions` 配列には `"history"` を**追加しない**。
- `optional_permissions` 配列を追加し、`"history"` のみを宣言する。

```json
{
  "optional_permissions": [
    "history"
  ]
}
```

---

## 2. 共有モジュール関数契約

### 2.1 `src/shared/history.ts`（新規モジュール）

| 関数名 | シグネチャ | 契約仕様 |
|---|---|---|
| `hasHistoryPermission` | `() => Promise<boolean>` | `chrome.permissions.contains({ permissions: ['history'] })` を呼び出す。API 未定義または例外発生時は `false` を返す（例外を外へ漏らさない）。 |
| `requestHistoryPermission` | `() => Promise<boolean>` | `chrome.permissions.request({ permissions: ['history'] })` を呼び出し、ユーザーが許可した場合は `true`、拒否・キャンセルまたは例外時は `false` を返す。必ずユーザージェスチャーコンテキストから直接呼び出す。 |
| `getEffectiveHistorySearchEnabled` | `() => Promise<boolean>` | `getHistorySearchEnabled()` と `hasHistoryPermission()` を確認し、双方とも `true` の場合のみ `true` を返す。 |
| `shouldSearchHistoryForQuery` | `(rawQuery: string) => boolean` | ゼロ幅文字除去後のトリム済み文字列が空、`':'` 開始、`'/'` のみ、または末尾 `'/'`（フォルダ明示指定）の場合は `false`、通常検索クエリの場合は `true` を返す。 |
| `searchHistoryPaletteItems` | `(rawQuery: string, excludeUrls: string[], limit?: number) => Promise<PaletteItem[]>` | `hasHistoryPermission()` が `false` または `shouldSearchHistoryForQuery(rawQuery)` が `false` の場合は空配列を返す。`chrome.history.search({ text: trimmedQuery, startTime: 0, maxResults: 30 })` を実行し、`http://` / `https://` / `file://` 等有効 URL かつ `excludeUrls` と `normalizeUrlForComparison` で一致しないエントリ（および履歴内重複を除いたもの）を最大 `limit`（デフォルト `MAX_HISTORY_SUGGESTIONS = 10`）件 `PaletteItem`（`kind: 'history'`）へ変換して返す。API エラー時はログ出力のうえ `[]` を返す。 |

### 2.2 `src/shared/url.ts`

| 関数名 | シグネチャ | 契約仕様 |
|---|---|---|
| `normalizeUrlForComparison` | `(rawUrl: string) => string` | URL 文字列を前後トリム、`decodeURI` 適用、スキーム＋ホスト小文字化、ルート以外の末尾単一スラッシュ除去で正規化した比較文字列を返す。不正な形式でも例外を投げずフォールバック正規化を行う。 |

### 2.3 `src/shared/storage.ts`

| 関数名 | シグネチャ | 契約仕様 |
|---|---|---|
| `getHistorySearchEnabled` | `() => Promise<boolean>` | `chrome.storage.local` の `historySearchEnabled` を取得（メモリキャッシュ併用、未設定時は `false`）。 |
| `setHistorySearchEnabled` | `(enabled: boolean) => Promise<void>` | メモリキャッシュと `chrome.storage.local` の `historySearchEnabled` を更新する。 |
| `updateHistorySearchEnabledCache` | `(enabled: boolean) => void` | `storage.onChanged` 等からキャッシュを同期する。 |

### 2.4 `src/shared/commands.ts`

| 関数名 | シグネチャ | 契約仕様 |
|---|---|---|
| `openUrlWithDisposition` | `(targetUrl: string, disposition: TabDisposition, tabId?: number) => Promise<void>` | **スコア更新（`updateScore`）を行わず**、`disposition` に応じて `chrome.tabs.update` または `chrome.tabs.create` のみを実行する。`navigateWithDisposition` は内部で `updateScore` 後に本関数を呼び出す形へ共通化する。 |

---

## 3. ポップアップ UI・操作契約 (`src/Popup.vue`)

### 3.1 表示構造

- `items` は `[...bookmarkItems, ...historyItems]` として算出する。
- `bookmarkItems` と `historyItems` の境界（`index === bookmarkItems.length && historyItems.length > 0`）に、キーボード移動対象外のセクション見出し（`role="presentation"`）を描画する。
  - 見出しには履歴アイコン（`pi-history`）とローカライズ済みラベル（例: `ブラウザ履歴` / `Browser History`）を表示する。
- `items.length === 0` かつ `!isSearchingHistory`（またはブックマーク 0 件・履歴 0 件）の場合にのみ `palette-empty`（「一致する候補が見つかりませんでした。」）を表示する。なお、ブックマークが 0 件で履歴結果が返却された場合は即座に履歴候補を表示する。

### 3.2 非同期検索と競合防止

- デバウンス時間: `80ms`（連続入力中の不要な検索を抑制）。
- 世代番号 `historyRequestSeq`:
  - 条件不一致（空、`:` 開始、末尾 `/`、確認ダイアログ表示中、`!isHistorySearchActive`）になった瞬間、待機タイマーをキャンセルし `historyRequestSeq++` を実行して `historyItems = []` とする。
  - `searchHistoryPaletteItems` 完了時、`seq === historyRequestSeq` かつクエリが依然検索対象である場合のみ `historyItems.value` を更新する。

### 3.3 キーボード・選択安定性

- `bookmarkItems` 変化時: 従来通り `selectedIndex` を `bookmarkItems.length > 0 ? 0 : -1` に設定する。
- `historyItems` 更新時:
  - 既存の `items` 上でユーザーが選択中だったアイテム ID が更新後の `items` に残っていれば、そのインデックスを維持する。
  - 未選択（`selectedIndex === -1`）だった状態で `historyItems` が 1 件以上到着した場合は、`selectedIndex = 0` を選択する。
- `Tab` キー押下時: `kind === 'history'` の `fillText` は `''` のため入力欄は変更しない。
- `Enter` / クリック時: `kind === 'history'` の場合は `openUrlWithDisposition` を呼び出し、`newBackgroundTab` のみポップアップ維持、それ以外は `closePopup()` する。

---

## 4. 設定画面 UI 契約 (`src/Preferences.vue`)

- 既存の `Card` + `.sync-row` + `ToggleSwitch` + `.toggle-overlay` レイアウトを踏襲した「ブラウザ履歴検索」カードを追加する。
- 初期ロード時（`loadSettings`）に `historySearchEnabled.value = (await getHistorySearchEnabled()) && (await hasHistoryPermission())` を設定する。
- トグルクリックハンドラ（`handleHistorySearchToggleRequest`）:
  - 現在 `false` の場合:
    - 直ちに `const granted = await requestHistoryPermission()` を呼び出す（直前に非同期処理を挟まない）。
    - `granted === true`: `await setHistorySearchEnabled(true)`、`historySearchEnabled.value = true`、成功 `Toast` 表示。
    - `granted === false`: `await setHistorySearchEnabled(false)`、`historySearchEnabled.value = false`、警告/エラー `Toast` 表示（許可されなかった旨を案内）。
  - 現在 `true` の場合:
    - `await setHistorySearchEnabled(false)`、`historySearchEnabled.value = false`、情報 `Toast` 表示。

---

## 5. 多言語リソース契約 (`package/_locales/{ja,en}/messages.json`)

以下のキーを日英双方に追加する。

| キー名 | 日本語（例） | 英語（例） | 用途 |
|---|---|---|---|
| `historySearchTitle` | `ブラウザ履歴検索` | `Browser History Search` | 設定画面カードタイトル |
| `historySearchLabel` | `ポップアップ検索にブラウザ履歴を含める` | `Include Browser History in Popup Search` | 設定項目ラベル |
| `historySearchDescription` | `有効にすると、ポップアップでの検索時に候補ブックマークの下へブラウザ履歴を表示します（有効化時に履歴へのアクセス許可が必要です）。` | `When enabled, matching browser history entries are shown below bookmark suggestions in the popup (requires permission to access browsing history).` | 設定項目説明文 |
| `historySearchEnabledMessage` | `ブラウザ履歴検索を有効にしました。` | `Browser history search has been enabled.` | 有効化成功 Toast |
| `historySearchDisabledMessage` | `ブラウザ履歴検索を無効にしました。` | `Browser history search has been disabled.` | 無効化完了 Toast |
| `historyPermissionDeniedMessage` | `ブラウザ履歴へのアクセスが許可されなかったため、有効化できませんでした。` | `Could not enable because permission to access browser history was denied.` | 許可拒否時 Toast |
| `popupHistorySectionTitle` | `ブラウザ履歴` | `Browser History` | ポップアップ履歴セクション見出し |
| `popupHistoryTag` | `履歴` | `History` | 履歴候補アイテムの種別タグ |
