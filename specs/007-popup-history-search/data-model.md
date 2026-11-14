# Phase 1 データモデル: ポップアップ検索でのブラウザ履歴表示（オプトイン権限）

**対象機能**: `007-popup-history-search` | **作成日**: 2026-11-14 | **関連仕様**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/spec.md)

## 1. ストレージおよびデバイス固有設定モデル

### 1.1 デバイス固有設定（`chrome.storage.local`）

| キー名 | 型 | デフォルト値 | 同期対象 | 説明 |
|---|---|---|---|---|
| `historySearchEnabled` | `boolean` | `false` | 非同期（ローカル専用） | ポップアップでのブラウザ履歴検索を有効にするユーザー意図フラグ。実際の検索可否は本フラグと `chrome.permissions.contains({ permissions: ['history'] })` の論理積で決定する。 |

- **既存設定との整合性**:
  - `isSyncEnabled` や `language`、`maxBatchOpenTabs` と同じく、`chrome.storage.local` に単一キーとして保存する。
  - `chrome.storage.sync` には保存しないため、100KB クォータやチャンク分割ロジックに影響を与えない。
  - [storage.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/storage.ts) にメモリキャッシュ（`historySearchEnabledCache: boolean | null`）および `getHistorySearchEnabled()` / `setHistorySearchEnabled(enabled: boolean)` / `updateHistorySearchEnabledCache(enabled: boolean)` を設ける。

---

## 2. 型定義拡張（`src/shared/types.ts`）

### 2.1 `PaletteItemKind` の拡張

```typescript
/**
 * コマンドパレット候補の種別
 */
export type PaletteItemKind =
  | 'bookmark'
  | 'bookmarklet'
  | 'folder'
  | 'command'
  | 'completion'
  | 'history';
```

### 2.2 `PaletteItem` における `'history'` 表現規約

既存の `PaletteItem` インターフェースを変更せず、各フィールドを以下の規約で使用する（追加プロパティ不要で `Popup.vue` と一貫性を保つ）。

| フィールド | `'history'` 時の設定値 | 備考 |
|---|---|---|
| `id` | `` `history:${index}:${item.url}` `` | Vue の `:key` 用一意識別子 |
| `kind` | `'history'` | 候補種別（履歴） |
| `title` | `item.title?.trim() \|\| formatUrlForOmniboxDisplay(item.url)` | タイトルが空の場合は表示用 URL を代替表示 |
| `subtitle` | `formatUrlForOmniboxDisplay(item.url)` | 表示用に整形された URL |
| `badge` | `undefined` | 履歴にはニックネームが存在しないため未設定 |
| `typeTag` | `t('popupHistoryTag') \|\| 'HISTORY'` | 任意で履歴であることを示す控えめなタグ（またはセクション見出しと合わせて表示） |
| `isPinned` | `false` | 履歴はピン留め対象外 |
| `faviconUrl` | `getFaviconUrl(item.url)` | Chrome Favicon API（`/_favicon/`）経由のサイトアイコン URL |
| `fillText` | `''` | `Tab` 補完による入力上書きを行わない |
| `executeValue` | `item.url` | 遷移先の生の URL |
| `matchTarget` | `undefined` | スコア更新対象外であることを保証 |

### 2.3 定数追加

```typescript
/**
 * ポップアップに同時表示するブラウザ履歴候補の最大件数
 */
export const MAX_HISTORY_SUGGESTIONS = 10;
```

---

## 3. ポップアップ内状態モデル（`src/Popup.vue`）

### 3.1 リアクティブ状態と結合構造

```text
query (string)
  ├──► bookmarkItems (computed: PaletteItem[])  ───┐
  │      - 同期計算（buildPaletteSuggestions）      │
  │      - ブックマーク / フォルダ / コマンド候補    ├──► items (computed: PaletteItem[])
  │                                                 │      [...bookmarkItems, ...historyItems]
  └──► watch(query) ──[80ms debounce + seq check]──►┤
         └─► historyItems (ref: PaletteItem[])      │
               - 非同期取得（searchHistoryPaletteItems）
               - 通常検索かつ権限・設定有効時のみ取得
               - bookmarkItems の URL と重複除外、最大 10 件
```

### 3.2 状態遷移ルール

1. **初期化（`onMounted`）**:
   - `getEffectiveHistorySearchEnabled()`（`getHistorySearchEnabled() && hasHistoryPermission()`）により履歴検索の実効有効フラグ `isHistorySearchActive` を取得する。
2. **入力変更（通常検索時）**:
   - `bookmarkItems` は同期的に即時更新される。
   - `isHistorySearchActive` が `true`、かつ `query` が通常検索（非空、非空白のみ、非スラッシュのみ、`:` で始まらない、末尾 `/` で終わらない）かつ確認ダイアログ非表示の場合のみ、デバウンス後に `chrome.history.search` を実行する。
   - ブックマーク候補内の `kind === 'bookmark'` の `executeValue` を重複除外セットとして渡し、一致 URL を除外した最大 10 件を `historyItems` に格納する。
3. **入力クリア / コマンドモード移行**:
   - タイマー破棄、リクエスト世代番号インクリメント、`historyItems = []` を即座に適用する。
4. **実行（`executeItem`）**:
   - `item.kind === 'history'` の場合は `openUrlWithDisposition(item.executeValue, disposition, currentTab.value?.id)` を実行し、`updateScore` は呼ばない。
   - `disposition === 'newBackgroundTab'` なら検索欄へフォーカス維持、それ以外はポップアップを閉じる。

---

## 4. 設定画面状態モデル（`src/Preferences.vue`）

| 状態変数 | 型 | 説明 |
|---|---|---|
| `historySearchEnabled` | `Ref<boolean>` | UI 上のトグル表示値。ロード時は `await getHistorySearchEnabled() && await hasHistoryPermission()` を設定。 |

### トグル切り替え時の状態遷移

- **現在 `false` → `true`（有効化要求）**:
  1. クリックハンドラ内で直接 `await requestHistoryPermission()`（`chrome.permissions.request({ permissions: ['history'] })`）を実行する。
  2. 戻り値が `true` の場合: `await setHistorySearchEnabled(true)`、`historySearchEnabled.value = true`、成功 Toast を表示。
  3. 戻り値が `false` の場合: `await setHistorySearchEnabled(false)`、`historySearchEnabled.value = false`、拒否された旨の警告/エラー Toast を表示。
- **現在 `true` → `false`（無効化要求）**:
  1. `await setHistorySearchEnabled(false)`、`historySearchEnabled.value = false`、無効化完了 Toast を表示。
