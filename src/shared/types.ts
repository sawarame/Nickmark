/**
 * ブックマークエントリの型定義
 */
export interface BookmarkEntry {
  url: string;
  title: string;
  score: number;
  last_used_at: number;
  created_at: number;
  is_pinned?: boolean;
  default_value?: string;
}

/**
 * 拡張機能全体のデータ構造
 */
export interface NickmarkData {
  bookmarks: Record<string, BookmarkEntry[]>;
}

/**
 * 動的に導出されるフォルダ情報の型定義
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
  /** 所属する一意な開く対象URL（重複除外後、ブックマークレット除外）の総件数 */
  openableUrlCount: number;
}

/**
 * フォルダ一括オープンの実行結果型
 */
export interface BatchOpenResult {
  /** 実行が成功したか（上限超過による中断の場合は false） */
  success: boolean;
  /** 実際に開いたタブの件数 */
  openedCount: number;
  /** 対象となった一意な URL の総件数 */
  totalCount: number;
  /** 上限超過により確認が必要な状態か */
  requiresConfirmation?: boolean;
  /** 確認が必要な場合のフォルダパス */
  folderPath?: string;
  /** 確認が必要な場合の URL リスト */
  urls?: string[];
  /** 確認が必要な場合のニックネームリスト */
  nicknames?: string[];
  /** エラーコードまたはエラーメッセージ（存在する場合） */
  error?: string;
}

/**
 * 通常検索におけるマッチ結果の型定義
 */
export interface ResolvedSearchMatch {
  nickname: string;
  entry: BookmarkEntry;
  resolvedUrl: string;
  tier: number;
  isDynamic: boolean;
  dynamicArg: string;
}

/**
 * サジェスト候補の content 文字列から遷移先ブックマークを特定するためのターゲット情報
 */
export interface SuggestedMatchTarget {
  nickname: string;
  resolvedUrl: string;
  templateUrl: string;
}

/**
 * 一括オープン時のデフォルト安全上限タブ数
 */
export const DEFAULT_MAX_BATCH_OPEN_TABS = 20;

/**
 * Chrome Storage Sync におけるチャンクキーのプレフィックス
 */
export const SYNC_KEY_PREFIX = 'sync_data_';
