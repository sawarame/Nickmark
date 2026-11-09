# インターフェース契約: パス正規化・オムニボックス・UIフィルタ仕様

**機能ブランチ**: `003-fix-leading-slash-folder`  
**日付**: 2026-11-09  
**対象**: `src/background.ts`, `src/List.vue`, `src/Popup.vue` 間の正規化・検索・フィルタリング契約

---

## 1. 共通エクスポート関数契約 (`src/background.ts`)

```typescript
/**
 * ニックネームまたはフォルダパス文字列から先頭・末尾のスラッシュと連続スラッシュを除去し正規化します。
 */
export function normalizeNicknamePath(rawPath: string): string;
```

- `extractFolders(bookmarks)`:
  - 内部で各ニックネームキーに対して `normalizeNicknamePath(nickname)` を適用してから `/` で分割する。
  - 返却される `Map<string, FolderInfo>` のキーには空文字 `""` や先頭・末尾 `/` を持つ文字列は一切含まれない。
- `openFolderUrls(folderPath, force, currentTabId)` / `renameFolder(oldPath, newPath)` / `deleteFolder(folderPath)`:
  - 引数のフォルダパスを `normalizeNicknamePath` で正規化し、ブックマークのキー比較時も `normalizeNicknamePath(nick)` と比較することで、未正規化の既存データに対しても漏れなく動作する。

---

## 2. オムニボックス入力・サジェスト契約 (`src/background.ts`)

| モード | ユーザー入力例 | 正規化後の解釈 | 期待される動作 |
|---|---|---|---|
| 通常検索（末尾スラッシュ） | `nm /work/` または `nm //work//` | フォルダ指定 `work` + 明示的末尾スラッシュ `true` | デフォルト候補に `📁 work/` の一括オープンを表示。Enter で `work` 配下を一括オープン |
| 通常検索（先頭スラッシュのみ） | `nm /work` | 検索トークン `work` | `work/gh` 等が前方一致（Tier 2）でヒットし、サジェスト先頭にも `📁 work/` 一括オープン候補を提示 |
| 通常検索（階層パス） | `nm /work/gh` | 検索トークン `work/gh` | `work/gh` が完全一致（Tier 1）でヒット |
| コマンド `:open` / `:o` | `nm :open /work` または `:open /work/` | ターゲット `work` | `work/` フォルダ候補をサジェストし、Enter で `work` 配下を一括オープン |
| コマンド `:add` / `:addall` | `nm :add /work/gh` | 保存キー `work/gh` | 先頭・末尾・連続スラッシュを除去した `work/gh` として保存 |
| コマンド `:rm` | `nm :rm /work/gh` | 削除対象 `work/gh` | 先頭スラッシュを除いた `work/gh` を照合・サジェスト・削除 |

---

## 3. 管理画面（`src/List.vue`）・ポップアップ（`src/Popup.vue`）UI 契約

1. **フォルダ絞り込み (`filteredBookmarks` in `List.vue`)**:
   - 各ブックマークのニックネームを `normalizeNicknamePath(item.nickname)` として評価する。
   - `__ROOT__`（未分類）選択時: 正規化後のニックネームに `/` が含まれない項目（旧 `/gh` なども含む）を表示。
   - 特定フォルダ `folderPath`（例: `work`）選択時: 正規化後のニックネームが `folderPath` と完全一致するか、`folderPath + '/'` で始まる項目をすべて表示。
2. **オートコンプリート補完 (`searchNewBookmarkNicknames` in `List.vue`, `searchNicknames` in `Popup.vue`)**:
   - 入力クエリ `event.query` の先頭スラッシュや連続スラッシュを除去（例: `/wo` → `wo`、`/work/` → `work/`）してフォルダプレフィックスおよび既存ニックネームと前方一致・部分一致照合を行う。
3. **新規登録・編集・JSON 編集保存**:
   - 保存時に `normalizeNicknamePath` を適用する。
   - スラッシュのみの入力（例: `/` や `///`）は正規化後に空文字 `""` となるため、既存の「ニックネームは必須です (`errorNicknameUrlRequired`)」バリデーションエラーとして弾く。
