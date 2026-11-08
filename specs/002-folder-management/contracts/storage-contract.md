# ストレージ インターフェース契約 (Storage Contract)

**機能ブランチ**: `002-folder-management`  
**日付**: 2026-11-08  
**対象**: `chrome.storage.local` および `chrome.storage.sync` における保存キーとスキーマ

---

## 1. `chrome.storage.local`

| キー | 型 | デフォルト値 | 説明 |
|---|---|---|---|
| `bookmarks` | `Record<string, BookmarkEntry[]>` | `{}` | ローカルモード時の全ブックマークデータ（スラッシュを含むパス風ニックネーム対応） |
| `isSyncEnabled` | `boolean` | `false` | Google アカウント同期の有効化フラグ |
| `language` | `string` | 未設定（ブラウザ言語） | ユーザー選択の言語コード（`"ja"` または `"en"`） |
| `maxBatchOpenTabs` | `number` | `20` | フォルダ一括オープン時の自動実行安全上限タブ数（1〜100） |

---

## 2. `chrome.storage.sync`

| キー | 型 | 制限 | 説明 |
|---|---|---|---|
| `sync_data_0`, `sync_data_1`, ... | `string` | 1項目あたり最大 8,000 バイト、合計 100KB | 同期有効時のブックマーク JSON チャンク分割データ |

---

## 3. ストレージ API ヘルパー関数

`src/background.ts` で提供する設定読み書き関数：

```typescript
/**
 * 一括オープンの安全上限タブ数を取得します。
 * @returns {Promise<number>} 安全上限値（未設定または不正値の場合は 20）
 */
export async function getMaxBatchOpenTabs(): Promise<number>;

/**
 * 一括オープンの安全上限タブ数を設定します。
 * @param {number} limit 設定する上限値（1〜100）
 */
export async function setMaxBatchOpenTabs(limit: number): Promise<void>;
```
