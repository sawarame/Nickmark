# Internal Contract: Extension Messaging (拡張機能内メッセージング規約)

**Feature Branch**: `004-refresh-list-on-add`  
**Date**: 2026-11-09  
**Related Spec**: [spec.md](../spec.md)

## 概要

本ドキュメントは、Nickmark の Service Worker（`src/background.ts`）とブックマーク一覧画面（`src/List.vue`）間で送受信されるメッセージのインターフェース契約を定義します。

---

## メッセージスキーマ

### 1. `updatePage` メッセージ

Service Worker から既存の一覧画面タブへフォーカスを移動させた際、画面の更新と通知表示を指示するために送信されます。

#### 送信元
- `src/background.ts`: `openOrReuseListTab(params?: { msg?: string; url?: string; title?: string })`

#### 送信先
- `src/List.vue`: `chrome.runtime.onMessage` リスナー

#### ペイロード仕様

```typescript
export interface UpdatePageRequest {
  action: 'updatePage';
  /** トースト通知として表示するメッセージ文字列（任意） */
  msg?: string;
  /** 新規追加フォームの URL 欄に反映する URL（任意） */
  url?: string;
  /** 新規追加フォームのタイトル欄に反映するタイトル（任意） */
  title?: string;
}
```

#### 受信側の契約・振る舞い要件 (Behavior Contract)
1. **キャッシュ無効化と一覧再取得**:
   - `action === 'updatePage'` を検知した場合、受信側はメモリキャッシュをクリアした上で、直ちに非同期でブックマーク最新データを再取得（`loadBookmarks()`）し、一覧表示を更新しなければならない (MUST)。
2. **通知メッセージの表示**:
   - `request.msg` が指定されている場合、`showCustomToast(request.msg)` を呼び出してユーザーに完了通知を表示しなければならない (MUST)。
3. **入力フィールドの補完**:
   - `request.url` または `request.title` が指定されている場合、新規登録用モデル（`newBookmark`）の該当フィールドを更新しなければならない (MUST)。

---

## 内部関数インターフェース仕様

### `clearBookmarksCache`

モジュールレベルのメモリキャッシュを破棄し、次回のデータ読み込みを強制的に Chrome ストレージアクセスへと切り替えます。

```typescript
/**
 * メモリ上に保持されているブックマークキャッシュおよび読み込みプロミスを破棄します。
 * 次回 loadBookmarksData() 呼び出し時にストレージから最新データが再取得されます。
 */
export function clearBookmarksCache(): void;
```
