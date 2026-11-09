# 調査・設計検討書 (Research & Design Decisions): フォルダ一括オープン時の単体ブックマーク除外

**Feature**: `005-fix-folder-bulk-open`  
**Date**: 2026-11-10  
**Status**: Completed  

---

## 1. 課題の背景と根本原因分析

### 課題の概要
ユーザーが「フォルダの一括オープン」を行った際、そのフォルダに登録していない「フォルダ名と同じニックネームの単体ブックマーク」まで同時に開いてしまう事象が発生していました。
（例: 単体ニックネーム `work` と、フォルダ内ニックネーム `work/mail`, `work/jira` が存在する場合、フォルダ `work` を一括オープンすると `work` 自体も開いてしまう）

### 根本原因の特定
コードベースを精査した結果、以下の3箇所において「フォルダ配下（`folderPrefix`）」だけでなく「フォルダ名そのものとの完全一致（`normNick === normalizedPath`）」を同等に対象に含めていたことが原因と判明しました。

1. **`src/background.ts` の `openFolderUrls` 関数 (L255-261)**:
   ```typescript
   const matchingNicknames = Object.keys(bookmarks).filter(
     nick => {
       const normNick = normalizeNicknamePath(nick);
       return normNick === normalizedPath || normNick.startsWith(folderPrefix); // ← ここで normNick === normalizedPath を含めている
     }
   );
   ```
2. **`src/List.vue` の `filteredBookmarks` 算出プロパティ (L435-438)**:
   ```typescript
   return flatBookmarks.value.filter(item => {
     const normNick = normalizeNicknamePath(item.nickname);
     return normNick === folderPath || normNick.startsWith(prefix); // ← ここで normNick === folderPath を含めている
   });
   ```
3. **`src/background.ts` の `renameFolder` / `deleteFolder` 関数 (L475, L519)**:
   ```typescript
   // renameFolder
   if (normKey === normOld) { ... }
   // deleteFolder
   if (normKey === normPath || normKey.startsWith(prefix)) { ... }
   ```

Nickmark のフォルダ抽出ロジック（`extractFolders`）においては、スラッシュを含まない単体ニックネーム（例: `work`）はフォルダ自身とは解釈されず、`parts.length <= 1` としてルート（未分類）扱いとされています。また、`extractFolders` が算出する `openableUrlCount` にも単体 `work` は含まれていませんでした。
したがって、上記3箇所の条件判定が `extractFolders` の概念設計と不一致を起こしていたことが根本原因です。

---

## 2. 設計選択肢の比較検討 (Design Decisions)

### 選択肢 1: プレフィックス一致（`folderPrefix`）のみに絞り込む方式（推奨・採用）

- **内容**:
  フォルダ `work` の配下エントリを抽出・処理する判定条件から `normNick === normalizedPath` を完全に除去し、`normNick.startsWith(folderPrefix)`（ただし `folderPrefix = normalizedPath + '/'`）のみを対象とする。
- **メリット**:
  - `extractFolders` の階層抽出モデルと完全に一致する。
  - 単体ニックネーム `work` は未分類（ルート）の独立したブックマークとして保護され、フォルダ `work` の一括オープン、絞り込み、リネーム、削除のいずれにも巻き込まれない。
  - 実装がシンプルで極めて安全。計算量やパフォーマンスへの悪影響が一切ない。
- **デメリット**:
  - 特になし。

### 選択肢 2: `extractFolders` 側で単体ニックネームもフォルダの一部として扱う方式（却下）

- **内容**:
  `work` 単体もフォルダ `work` の直下要素（例: `work/` 直下のインデックス）とみなし、`extractFolders` やオムニボックス側で単体エントリもフォルダ配下に統合する。
- **却下理由**:
  - ユーザーの要求「フォルダに登録していないブックマークは一括で開く対象外にして欲しい」に直接反する。
  - `work` 単体ニックネームでアクセスしたいユーザーにとって、フォルダと単体エントリの境界が曖昧になり、オムニボックスの単独補完・遷移体験（憲章 原則I）が損なわれる。

---

## 3. 影響範囲の検証

1. **オムニボックス `:open` コマンド**:
   - `:open work/`（末尾スラッシュあり）:
     `isExplicitFolder` が true となり、`openFolderUrls("work", ...)` が呼ばれる。単体 `work` は開かず、`work/*` のみが開く（要件を充足）。
   - `:open work`（末尾スラッシュなし）:
     単体 `work` が存在する場合は単体 `work` のみが開く。単体 `work` が存在せずフォルダ `work` のみ存在する場合は `openFolderUrls("work", ...)` が呼ばれ `work/*` が開く（既存の優先順位仕様と合致）。
2. **オムニボックス検索サジェスト (`nm work/`)**:
   - `handleRegularSearchSuggestions` において、`nm work/` の一括オープン候補が選択・実行された際、`openFolderUrls` が呼ばれるため、単体 `work` は開かない（要件を充足）。
3. **管理画面 (`src/List.vue`)**:
   - フォルダ絞り込みフィルタで「work」選択時: テーブルに `work/*` のみが表示され、単体 `work` は表示されない。
   - 「未分類（ルート）」選択時: 単体 `work` が表示される。
   - フォルダ横の「一括オープン」実行時: `work/*` のみが開く。
   - フォルダ横の「リネーム」実行時: `work/*` のみがリネームされ、単体 `work` はリネームされない。
   - フォルダ横の「削除」実行時: `work/*` のみが削除され、単体 `work` は削除されない。

---

## 4. 結論

選択肢 1 を採用し、以下の修正を実施します：
- `src/background.ts`:
  - `openFolderUrls`: `normNick.startsWith(folderPrefix)` のみを対象にフィルタリング。
  - `renameFolder`: `normKey.startsWith(oldPrefix)` のみをリネーム対象とする。
  - `deleteFolder`: `normKey.startsWith(prefix)` のみを削除対象とする。
- `src/List.vue`:
  - `filteredBookmarks`: `normNick.startsWith(prefix)` のみを対象にフィルタリング。
- `.context/spec.md`:
  - フォルダ仕様に「同名単体ブックマークとの完全分離」に関する仕様記述を明記。
