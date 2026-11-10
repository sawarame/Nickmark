# インターフェース契約: フォルダ一括オープンおよびフォルダ操作 (Bulk Open & Folder Operation Contract)

**Feature**: `005-fix-folder-bulk-open`  
**Date**: 2026-11-10  
**Status**: Completed  

---

## 1. `openFolderUrls` 契約

指定されたフォルダ配下の全ブックマークを一括で開くコア関数。

```typescript
export async function openFolderUrls(
  folderPath: string,
  force: boolean = false,
  currentTabId?: number
): Promise<BatchOpenResult>;
```

### 事前条件 (Preconditions)
- `folderPath` は空文字や空白のみであってはならない。

### 動作契約 (Behavioral Contract)
1. `normalizeNicknamePath(folderPath)` によりフォルダパスを正規化（`normalizedPath`）。
2. `folderPrefix = normalizedPath + '/'` を生成。
3. `matchingNicknames` は `normNick.startsWith(folderPrefix)` を満たすニックネームのみを収集する。
   - **契約**: `normNick === normalizedPath` は一致対象に含めてはならない（MUST NOT）。
4. `matchingNicknames.length === 0` の場合:
   - `{ success: false, openedCount: 0, totalCount: 0, error: 'FOLDER_NOT_FOUND' }` を返す。
   - `currentTabId` が指定されていれば「フォルダが見つかりませんでした」のトーストを表示する。
5. 対象 URL の収集（重複排除・ブックマークレット除外・動的 URL のフォールバック解決）を行い、開く対象が 0 件の場合は `{ success: false, openedCount: 0, totalCount: 0, error: 'NO_OPENABLE_URLS' }` を返す。
6. 安全上限チェックを経てタブを開き、各ブックマークのスコアを更新する。

---

## 2. `renameFolder` 契約

指定されたフォルダ配下のブックマークのプレフィックスを一括置換する関数。

```typescript
export async function renameFolder(
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; affectedCount: number; error?: string }>;
```

### 動作契約 (Behavioral Contract)
1. `normOld = normalizeNicknamePath(oldPath)`、`normNew = normalizeNicknamePath(newPath)`。
2. `oldPrefix = normOld + '/'`、`newPrefix = normNew + '/'`。
3. ストレージ内の各キーについて：
   - `normKey.startsWith(oldPrefix)` の場合: プレフィックスを `newPrefix` に置換して更新対象に含める。
   - `normKey === normOld` の場合: **置換対象外**とし、キーを変更せずにそのまま維持する。

---

## 3. `deleteFolder` 契約

指定されたフォルダ配下の全ブックマークを一括削除する関数。

```typescript
export async function deleteFolder(
  folderPath: string
): Promise<{ success: boolean; deletedCount: number; error?: string }>;
```

### 動作契約 (Behavioral Contract)
1. `normPath = normalizeNicknamePath(folderPath)`、`prefix = normPath + '/'`。
2. ストレージ内の各キーについて：
   - `normKey.startsWith(prefix)` の場合: ストレージから削除（`deletedCount` をインクリメント）。
   - `normKey === normPath` の場合: **削除対象外**とし、そのままストレージに保持する。

---

## 4. オムニボックス入力契約 (`handleRegularSearchSuggestions` & `onInputEntered`)

### 入力: `nm <target>/` (末尾スラッシュ付き)
- デフォルトサジェストに「フォルダ `<target>` の全ブックマークを一括オープン (Nタブ)」を表示。
- Enter 実行時、`openFolderUrls(target, false, ...)` が実行され、単体 `<target>` は開かず配下のみが開く。

### 入力: `nm :open <target>/`
- 明示的フォルダ指定として `openFolderUrls(target, false, ...)` が実行され、単体 `<target>` は開かず配下のみが開く。

### 入力: `nm :open <target>` (末尾スラッシュなし)
- 単体 `<target>` が存在する場合: 単体 `<target>` のみを開く。
- 単体 `<target>` が存在せずフォルダ `<target>` のみ存在する場合: `openFolderUrls(target, false, ...)` が実行され配下が開く。
