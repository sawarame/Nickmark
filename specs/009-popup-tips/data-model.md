# Phase 1 データモデル・状態設計: ポップアップ初期表示時の Tips 表示

**Feature**: ポップアップ初期表示時の Tips 表示 (`specs/009-popup-tips/spec.md`)
**Date**: 2026-11-17

## 1. 静的モデル定義（`src/shared/types.ts`）

本機能は永続化ストレージ（`chrome.storage.local` / `chrome.storage.sync`）へ新たな設定・データを保存しないため、ストレージスキーマの変更は発生しない。メモリ上で扱う Tips カタログ定義のみを型定義する。

### `TipEntry`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | `string` | 必須 | Tip を一意に識別する ID（例: `'add-command'`, `'tab-disposition'`） |
| `messageKey` | `string` | 必須 | `package/_locales/{ja,en}/messages.json` の本文メッセージキー |
| `icon` | `string` | 任意 | PrimeIcons クラス名（例: `'pi-lightbulb'`, `'pi-terminal'`）。未指定時は既定の電球アイコン |
| `usesPrimaryModifier` | `boolean` | 任意 | `true` の場合、メッセージ内の `$1` に OS 別の修飾キー表記（`Cmd` または `Ctrl`）を展開する |

---

## 2. Tips カタログ構成（`src/shared/tips.ts`）

仕様書 FR-008 に準拠し、実在機能のみを紹介する 8 件の静的カタログ `POPUP_TIPS: readonly TipEntry[]` を定義する。

| # | `id` | `messageKey` | 紹介する機能・操作 |
| --- | --- | --- | --- |
| 1 | `add-command` | `popupTipAddCommand` | `:add <名前>`（短縮 `:a`）で現在のタブを登録 |
| 2 | `addall-command` | `popupTipAddallCommand` | `:addall <名前>`（短縮 `:aa`）で現在のウィンドウの全タブを一括登録 |
| 3 | `folder-open` | `popupTipFolderOpen` | `フォルダ名/` または `:open フォルダ名/` でフォルダ配下を一括オープン |
| 4 | `dynamic-url` | `popupTipDynamicUrl` | `%s` を含む動的 URL に `ニックネーム 検索語` で引数を埋め込んで検索 |
| 5 | `tab-disposition` | `popupTipTabDisposition` | `Shift+Enter` でバックグラウンドタブ（開いたまま連続起動）、`$1+Enter` で新しいフォアグラウンドタブ起動 |
| 6 | `keyboard-nav` | `popupTipKeyboardNav` | `↑`/`↓`（`Ctrl+N`/`Ctrl+P`）で候補移動、`Tab` キーで入力欄へ補完 |
| 7 | `bookmarklet` | `popupTipBookmarklet` | `:add <名前> javascript:...` でブックマークレットを登録し、現在タブで実行 |
| 8 | `management-commands` | `popupTipManagementCommands` | `:ls` で一覧・フォルダ管理、`:prefs` で設定・同期、`:help` でドキュメントを表示 |

---

## 3. ポップアップ画面のリアクティブ状態（`src/Popup.vue`）

既存の `Popup.vue` の状態に以下を追加・連携する。

| 状態 / Computed | 型 | 初期値 / 導出ルール | 役割 |
| --- | --- | --- | --- |
| `currentTipIndex` | `Ref<number>` | `pickRandomTipIndex(POPUP_TIPS.length)` | 現在選択されている Tip のインデックス |
| `currentTip` | `ComputedRef<TipEntry \| null>` | `POPUP_TIPS[currentTipIndex.value] ?? null` | 現在表示対象の Tip エントリ |
| `currentTipText` | `ComputedRef<string>` | `resolveTipText(currentTip.value, tr)` | 現在言語で解決済みの Tip 本文 |
| `shouldShowTips` | `ComputedRef<boolean>` | `query.value.trim().length === 0 && !pendingBatchConfirm.value && !feedback.value && i18nVersion.value > 0 && currentTip.value !== null` | Tips 領域の表示条件 |

### 状態遷移図（表示切り替え）

```text
[ポップアップ起動]
   ├─ initI18n() 未完了 (i18nVersion === 0) ──> 空白（最小高さ維持、言語チラつき防止）
   └─ initI18n() 完了   (i18nVersion > 0)
        ├─ query.trim() === '' && !feedback && !pendingBatchConfirm
        │     ──> [Tips 表示] (currentTipIndex 番目の Tip)
        │           ├─ Tips クリック ──> currentTipIndex を別インデックスへ更新 + 検索欄へ再フォーカス
        │           └─ 1文字以上入力 ──> [候補リスト表示]
        ├─ query.trim() !== '' && !pendingBatchConfirm
        │     ──> [候補リスト表示]
        │           └─ 入力を全消去  ──> [Tips 表示] へ復帰
        ├─ feedback !== null
        │     ──> [フィードバックバナー表示]（2.5秒後自動消去で空白なら [Tips 表示] へ復帰）
        └─ pendingBatchConfirm !== null
              ──> [大量タブオープン確認ダイアログ表示]
```
