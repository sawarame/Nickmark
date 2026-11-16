# Phase 1 モジュール・UI・多言語契約: ポップアップ初期表示時の Tips 表示

**Feature**: ポップアップ初期表示時の Tips 表示 (`specs/009-popup-tips/spec.md`)
**Date**: 2026-11-17

## 1. モジュールインターフェース契約

### 1.1 `src/shared/url.ts`（既存ユーティリティ拡張）

- **`isMacPlatform(): boolean`**
  - 既存の `getShortcutLabel()` 内にあるプラットフォーム判定を切り出して共通化する。
  - 戻り値: macOS 環境の場合は `true`、それ以外（判定不可含む）は `false`。
- **`getPrimaryModifierLabel(): 'Cmd' | 'Ctrl'`**
  - `isMacPlatform()` を用いて、macOS では `'Cmd'`、それ以外では `'Ctrl'` を返す。

### 1.2 `src/shared/tips.ts`（新規モジュール）

- **`POPUP_TIPS: readonly TipEntry[]`**
  - 8 件の定義済み Tip エントリ配列。
- **`pickRandomTipIndex(totalCount: number, excludeIndex?: number): number`**
  - 契約:
    - `totalCount <= 0` の場合は `-1` を返す。
    - `totalCount === 1` の場合は常に `0` を返す。
    - `excludeIndex` が `0 <= excludeIndex < totalCount` を満たし、`totalCount >= 2` の場合、戻り値は必ず `0 <= result < totalCount` かつ `result !== excludeIndex` となる。
    - 上記以外は `0 <= result < totalCount` の整数を均等確率で返す。
- **`formatTipMessage(tip: TipEntry, translate: (key: string, substitutions?: string[]) => string): string`**
  - `tip.usesPrimaryModifier` が `true` の場合は `[getPrimaryModifierLabel()]` を置換引数として `translate(tip.messageKey, [getPrimaryModifierLabel()])` を呼び出す。
  - それ以外は `translate(tip.messageKey)` を呼び出して表示用テキストを返す。

---

## 2. UI・アクセシビリティ・キーボード操作契約（`src/Popup.vue`）

### 2.1 表示条件・DOM 配置

- **配置位置**: `.palette-search-bar` の直下、`.palette-feedback` / `.batch-confirm-box` / `.palette-list` と排他的に描画する（`v-else-if="shouldShowTips"`）。
- **表示条件**:
  - `query.trim().length === 0`
  - `pendingBatchConfirm === null`
  - `feedback === null`
  - `i18nVersion > 0`（i18n 初期化完了後）

### 2.2 インタラクションとフォーカス契約

- **要素属性**:
  - `role="button"`（クリックで次の Tip へ切り替え可能であることを支援技術へ伝達）
  - `tabindex="-1"`（`Tab` キーで検索欄から意図せずフォーカスが外れることを防止）
  - `:aria-label="tr('popupTipsNextTooltip')"`（または適切な切り替え操作説明）
- **マウス操作**:
  - `@mousedown.prevent`: クリック時の検索入力欄からのフォーカス離脱を抑止する。
  - `@click="cycleTip"`: `pickRandomTipIndex(POPUP_TIPS.length, currentTipIndex)` で別 Tip へ切り替え、念のため `focusSearchInput()` を呼んで検索入力欄へのフォーカスを保証する。
- **レイアウト制約**:
  - 横幅 `600px` 内に収まること（`min-width: 0` と適切な折り返し設定により横スクロールバーを発生させない）。
  - テキストは `var(--p-text-muted-color)` を基調とした控えめなトーンで、「TIP」バッジ（または `pi-lightbulb` アイコン）および右端の控えめな切替アイコン（`pi-refresh` 等）で構成し、既存の `.palette-container`（`min-height: 120px`）の空白スペースに自然に収まるサイズとする。

---

## 3. 多言語メッセージ契約（`package/_locales/{ja,en}/messages.json`）

以下のキーを日本語・英語の双方で必ず定義する。

| メッセージキー | 用途 | プレースホルダー |
| --- | --- | --- |
| `popupTipsBadge` | Tips ラベル（例: `TIP`） | なし |
| `popupTipsNextHint` | クリックで切り替えできる旨のツールチップ / `aria-label`（例: `クリックで次のヒントを表示` / `Click for next tip`） | なし |
| `popupTipAddCommand` | `:add` / `:a` コマンドの Tip | なし |
| `popupTipAddallCommand` | `:addall` / `:aa` コマンドの Tip | なし |
| `popupTipFolderOpen` | `フォルダ名/`・`:open` 一括オープンの Tip | なし |
| `popupTipDynamicUrl` | `%s` 動的 URL とデフォルト値の Tip | なし |
| `popupTipTabDisposition` | `Shift+Enter` / `$1+Enter` タブ開き分けの Tip | `$1`（`Cmd` または `Ctrl`） |
| `popupTipKeyboardNav` | `↑`/`↓`・`Ctrl+N`/`P`・`Tab` 補完の Tip | なし |
| `popupTipBookmarklet` | `javascript:` ブックマークレット実行の Tip | なし |
| `popupTipManagementCommands` | `:ls` / `:prefs` / `:help` の Tip | なし |
