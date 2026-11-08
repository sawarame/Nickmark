# ランタイムメッセージ インターフェース契約 (Runtime Messages Contract)

**機能ブランチ**: `002-folder-management`  
**日付**: 2026-11-08  
**対象**: Service Worker（`background.ts`）と拡張機能各画面（`List.vue`, `Popup.vue`, ページ内注入確認スクリプト）間のメッセージ通信規約

---

## 1. メッセージ一覧

### A. 一括オープン確認要求・承認メッセージ (`EXECUTE_BATCH_OPEN`)
安全上限を超過したフォルダ一括オープンで、ユーザーが承認した際に Service Worker へ実行を指示します。

```typescript
export interface ExecuteBatchOpenMessage {
  action: 'EXECUTE_BATCH_OPEN';
  payload: {
    folderPath: string;
    urls: string[];
    nicknames: string[];
  };
}

export interface ExecuteBatchOpenResponse {
  success: boolean;
  openedCount: number;
  error?: string;
}
```

### B. フォルダ一括リネーム要求メッセージ (`RENAME_FOLDER`)
管理画面からフォルダ名の一括変更を指示します。

```typescript
export interface RenameFolderMessage {
  action: 'RENAME_FOLDER';
  payload: {
    oldPath: string;
    newPath: string;
  };
}

export interface RenameFolderResponse {
  success: boolean;
  affectedCount: number;
  error?: string;
}
```

### C. フォルダ一括削除要求メッセージ (`DELETE_FOLDER`)
管理画面からフォルダ配下の全ブックマーク削除を指示します。

```typescript
export interface DeleteFolderMessage {
  action: 'DELETE_FOLDER';
  payload: {
    folderPath: string;
  };
}

export interface DeleteFolderResponse {
  success: boolean;
  deletedCount: number;
  error?: string;
}
```
