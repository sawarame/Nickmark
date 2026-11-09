# データモデルと正規化設計 (Data Model & Normalization Rules)

**機能ブランチ**: `003-fix-leading-slash-folder`  
**日付**: 2026-11-09  
**対象**: ニックネームパス正規化関数、ブックマーク辞書マージ規則、フォルダ導出ルール

---

## 1. パス正規化ルール (`normalizeNicknamePath`)

すべてのニックネームおよびフォルダパス指定は、以下の純粋関数によって正規化されます。

```typescript
/**
 * ニックネームまたはフォルダパス文字列を正規化します。
 * - 前後の空白を除去
 * - 連続するスラッシュ（// など）を単一のスラッシュ（/）に統合
 * - 先頭および末尾のスラッシュ（/）を除去
 * - 各階層セグメントの前後の余分な空白も除去
 * @param {string} rawPath - 入力された生のニックネームまたはフォルダパス
 * @returns {string} 正規化されたパス文字列（スラッシュのみの場合は空文字 ""）
 */
export function normalizeNicknamePath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') return '';
  return rawPath
    .trim()
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0)
    .join('/');
}
```

### 正規化の変換例

| 入力文字列 (`rawPath`) | 正規化結果 (`normalizeNicknamePath`) | 抽出されるフォルダ (`extractFolders`) |
|---|---|---|
| `"work/gh"` | `"work/gh"` | `["work"]` |
| `"/work/gh"` | `"work/gh"` | `["work"]` |
| `"/work/gh/"` | `"work/gh"` | `["work"]` |
| `"///infra//aws///console//"` | `"infra/aws/console"` | `["infra", "infra/aws"]` |
| `"/gh"` | `"gh"` | `[]`（未分類 / ルート） |
| `"/"` または `"///"` | `""`（空文字・無効） | `[]` |

---

## 2. ストレージデータ読み込み・保存時の正規化とマージ規則

既存のストレージ（`chrome.storage.local` / `chrome.storage.sync`）に `"/work/gh"` のような未正規化キーが存在する場合、または `/work/gh` と `work/gh` の両方が存在する場合でも、データ損失を起こさずに正規化・統合します。

### マージアルゴリズム (`normalizeBookmarksDictionary`)
1. 辞書内の各キー `rawKey` に対して `normKey = normalizeNicknamePath(rawKey)` を算出する。
2. `normKey` が空文字（`""`）の場合は無効なキーとしてスキップする。
3. すでに `normalizedBookmarks[normKey]` が存在する場合：
   - 既存エントリ配列に対して、`isSameUrl(existing.url, incoming.url)` で重複チェックを行う。
   - 同一 URL が存在しない場合はそのまま追加する。
   - 同一 URL が既に存在する場合は、より高い `score`、より新しい `last_used_at`、`is_pinned` の論理和（OR）、空でない `title` / `default_value` を優先して統合する。
4. この正規化処理を `loadBookmarksData()` および `saveBookmarksData()` の双方で適用することで、メモリキャッシュ・UI表示・ストレージ保存のすべてにおいて正規化済みキーを保証する。

---

## 3. エンティティ構造への影響

既存の永続化スキーマ（`BookmarkEntry`, `NickmarkData`, `FolderInfo`）の型構造自体は一切変更しません（100% 後方互換）。

- **`BookmarkEntry`**: 変更なし。
- **`NickmarkData.bookmarks`**: キー文字列が常に `normalizeNicknamePath` を通過した正規化形式となる。
- **`FolderInfo`**:
  - `path`: 常に先頭・末尾スラッシュを含まない正規化パス（例: `"work"`, `"infra/aws"`）。空文字 `""` のフォルダは絶対に生成されない。
  - `depth`: ルート直下のフォルダが `0`、サブフォルダが `1, 2, ...` と正確に計算される。
