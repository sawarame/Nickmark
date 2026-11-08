# データモデル設計 (Data Model): フォルダ管理と一括オープン

**機能ブランチ**: `002-folder-management`  
**日付**: 2026-11-08  
**対象**: ブックマークのフォルダ表現、階層構造、設定データモデル

---

## 1. エンティティ定義

### A. ブックマークエントリ (BookmarkEntry)
既存のデータ構造を維持し、下位互換性を 100% 保証します。

```typescript
/**
 * ブックマークエントリの型定義
 */
export interface BookmarkEntry {
  /** 登録先 URL または javascript: で始まるブックマークレットコード */
  url: string;
  /** ブックマークのタイトル（任意） */
  title: string;
  /** 使用頻度と経過時間に基づく指数減衰スコア */
  score: number;
  /** 最終使用日時のエポックミリ秒タイムスタンプ */
  last_used_at: number;
  /** 作成日時のエポックミリ秒タイムスタンプ */
  created_at: number;
  /** ピン留め（優先表示）フラグ */
  is_pinned?: boolean;
  /** 動的URL (%s) の引数省略時のデフォルト値（任意） */
  default_value?: string;
}
```

### B. ストレージデータ (NickmarkData)
```typescript
/**
 * 拡張機能全体のデータ構造
 */
export interface NickmarkData {
  /**
   * ニックネームをキーとするブックマークエントリ配列の辞書
   * パス風ニックネーム（例: "work/gh", "infra/aws/ec2"）を許容する
   */
  bookmarks: Record<string, BookmarkEntry[]>;
}
```

### C. フォルダメタ情報 (FolderInfo - 実行時導出モデル)
ストレージには保存せず、既存の `bookmarks` のキー（ニックネーム）から動的に導出・集計される実行時モデルです。

```typescript
/**
 * 動的に導出されるフォルダ情報
 */
export interface FolderInfo {
  /** フォルダの完全パスプレフィックス（例: "work", "infra/aws"） */
  path: string;
  /** フォルダの表示名（最後のセグメント。例: "aws"） */
  name: string;
  /** フォルダ階層の深さ（ルート直下は 0） */
  depth: number;
  /** 所属する全ニックネームのリスト（再帰的配下を含む） */
  nicknames: string[];
  /** 所属する一意な通常URL（重複除外後、ブックマークレット除外）の総件数 */
  openableUrlCount: number;
}
```

### D. 設定データ (UserSettings)
`chrome.storage.local` に保存されるデバイス固有の設定モデルです。

```typescript
/**
 * ユーザーローカル設定
 */
export interface UserPreferences {
  /** Google アカウント同期の有効化フラグ */
  isSyncEnabled: boolean;
  /** 表示言語（'ja' | 'en' | 未設定時のシステム既定） */
  language?: string;
  /**
   * フォルダ一括オープン時の安全上限タブ数
   * デフォルト: 20、範囲: 1〜100
   */
  maxBatchOpenTabs: number;
}
```

---

## 2. 導出ロジックとアルゴリズム

### フォルダ抽出ロジック (`extractFolders`)
```typescript
/**
 * ブックマーク辞書からすべてのフォルダ階層情報を抽出・導出します。
 * @param bookmarks - 登録されている全ブックマーク辞書
 * @returns 抽出されたフォルダ情報のマップ（キー: path）
 */
export function extractFolders(bookmarks: Record<string, BookmarkEntry[]>): Map<string, FolderInfo> {
  const folderMap = new Map<string, FolderInfo>();

  for (const nickname of Object.keys(bookmarks)) {
    const parts = nickname.split('/');
    if (parts.length <= 1) continue; // スラッシュを含まないものは未分類（ルート）

    // 親階層を順次走査（例: a/b/c の場合、"a" と "a/b"）
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      if (!folderMap.has(currentPath)) {
        folderMap.set(currentPath, {
          path: currentPath,
          name: parts[i],
          depth: i,
          nicknames: [],
          openableUrlCount: 0,
        });
      }
      folderMap.get(currentPath)!.nicknames.push(nickname);
    }
  }

  // 各フォルダの開く対象URL総数（重複排除後）を集計
  for (const folder of folderMap.values()) {
    const uniqueUrls = new Set<string>();
    for (const nick of folder.nicknames) {
      const entries = bookmarks[nick] || [];
      for (const entry of entries) {
        if (!isBookmarkletUrl(entry.url)) {
          uniqueUrls.add(entry.url);
        }
      }
    }
    folder.openableUrlCount = uniqueUrls.size;
  }

  return folderMap;
}
```

---

## 3. バリデーションルール

1. **ニックネーム命名規約**:
   - 先頭または末尾のスラッシュは禁止（例: `/work` や `work/` はニックネームそのものとしては登録不可。自動トリムされる）。
   - 連続するスラッシュは禁止（例: `work//gh` → `work/gh` に自動正規化）。
2. **フォルダ名リネーム時のバリデーション**:
   - 空文字、または空白のみのフォルダ名は禁止。
   - 変更先フォルダ名にスラッシュを不正に使用しないこと。
   - 既存の他フォルダと重複・競合する場合は確認を求めるかマージを警告。
3. **安全上限件数 (`maxBatchOpenTabs`)**:
   - 整数値であり、`1` 以上 `100` 以下でなければならない。
   - 不正な値（NaN、0以下、101以上）の場合はデフォルト値 `20` にフォールバックする。
