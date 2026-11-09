# データモデル・判定論理仕様 (Data Model & Evaluation Rules)

**Feature**: `005-fix-folder-bulk-open`  
**Date**: 2026-11-10  
**Status**: Completed  

---

## 1. 概念モデルとエンティティの分離

Nickmark におけるブックマークデータ構造は引き続き `Record<string, BookmarkEntry[]>` を維持します。
本機能改修では、ニックネーム文字列の解釈において「ルート（未分類）エントリ」と「フォルダ所属エントリ」の境界を明確に定義・分離します。

```text
ニックネーム空間: Record<string, BookmarkEntry[]>
  ├── 未分類（ルート）エントリ: スラッシュを含まないニックネーム（例: "work"）
  └── フォルダ所属エントリ: スラッシュを含むニックネーム（例: "work/mail", "work/dev/repo"）
        └── 所属親フォルダ: "work"（直下エントリ: "work/mail"、サブフォルダ: "work/dev"）
```

### エンティティ定義

1. **単体ブックマーク (Standalone Bookmark)**:
   - ニックネームの正規化後パス `normalizeNicknamePath(nickname)` にスラッシュ `/` が含まれないエントリ。
   - 例: `work`, `mail`, `github`
   - 分類: `__ROOT__`（未分類）にのみ属する。いかなるフォルダの配下にも属さない。

2. **フォルダ (Virtual Folder)**:
   - スラッシュを含むニックネームのプレフィックスから動的に抽出される仮想構造（`FolderInfo`）。
   - フォルダパス: `folderPath`（例: `work`）
   - 所属条件: 正規化されたニックネーム `normNick` が `folderPath + '/'` で始まること（`normNick.startsWith(folderPath + '/')`）。
   - **完全一致（`normNick === folderPath`）の排除**: フォルダパスと同名の単体ブックマークはフォルダの「中身」ではなく「独立した別エントリ」である。

---

## 2. 判定・抽出アルゴリズムの更新規則

### A. フォルダ配下ニックネームの抽出規則

指定されたフォルダ `folderPath` に対する対象判定式：

```typescript
// フォルダプレフィックス
const normalizedPath = normalizeNicknamePath(folderPath);
const folderPrefix = normalizedPath + '/';

// 判定式: folderPrefix で前方一致するもののみが真
const isChildOfFolder = (nickname: string): boolean => {
  const normNick = normalizeNicknamePath(nickname);
  return normNick.startsWith(folderPrefix);
};
```

| ニックネーム | 判定対象フォルダ | 従来の判定 (`===` または `startsWith`) | 新しい判定 (`startsWith` のみ) | 備考 |
|---|---|---|---|---|
| `work` | `work` | **True (誤マッチ)** | **False (除外)** | 単体ブックマークとして保護 |
| `work/` | `work` | True (正規化後 `work` となるため) | **False (除外)** | 不正末尾スラッシュ単体は除外 |
| `work/mail` | `work` | True | **True (対象)** | フォルダ直下ブックマーク |
| `work/sub/repo` | `work` | True | **True (対象)** | サブフォルダ配下ブックマーク |
| `worker` | `work` | False | False | 別名（誤マッチなし） |
| `work_task` | `work` | False | False | 別名（誤マッチなし） |

### B. 管理画面フィルタリング規則 (`List.vue`)

- `selectedFolder === '__ALL__'`:
  すべてのブックマークを表示。
- `selectedFolder === '__ROOT__'`:
  正規化ニックネームに `/` を含まないブックマークのみを表示（`!normNick.includes('/')`）。
  ※ `work` はここに表示される。
- `selectedFolder === '<folderPath>'`:
  `normNick.startsWith(folderPath + '/')` を満たすブックマークのみを表示。
  ※ `work` はここには表示されない（`work/mail` 等のみが表示される）。

### C. フォルダ一括管理規則（リネーム・削除）

- **リネーム (`renameFolder`)**:
  - `normKey.startsWith(oldPrefix)` を満たすキーのみを `newPrefix` に置換。
  - `normKey === normOld` のキーは置換対象外とし、元のキーのまま保持する。
- **削除 (`deleteFolder`)**:
  - `normKey.startsWith(prefix)` を満たすキーのみをストレージから削除。
  - `normKey === normPath` のキーは削除対象外とし、ストレージに残す。
