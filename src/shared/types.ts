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
 * コマンドパレット候補の種別
 */
export type PaletteItemKind =
  | 'bookmark'
  | 'bookmarklet'
  | 'folder'
  | 'command'
  | 'completion';

/**
 * `:add` コマンド入力時に表示する登録対象プレビュー情報
 */
export interface AddPreviewMeta {
  /** 登録対象種別 */
  mode: 'currentTab' | 'directUrl' | 'bookmarklet';
  /** 正規化後のニックネーム（未入力時は空文字） */
  nickname: string;
  /** 登録対象 URL またはブックマークレットコード */
  targetUrl: string;
  /** 登録対象タイトル */
  targetTitle: string;
}

/**
 * コマンドパレットの 1 候補行を表す構造化モデル
 */
export interface PaletteItem {
  /** リスト描画用の一意キー */
  id: string;
  /** 候補種別 */
  kind: PaletteItemKind;
  /** 主見出し（ブックマークタイトル、コマンド説明、フォルダ名等） */
  title: string;
  /** 補助テキスト（表示用 URL、対象プレビュー等） */
  subtitle: string;
  /** ニックネームまたはコマンドラベル（任意） */
  badge?: string;
  /** 種別タグ（`[JS]`, `[%s]`, フォルダタブ数等、任意） */
  typeTag?: string;
  /** ピン留め表示フラグ（任意） */
  isPinned?: boolean;
  /** ファビコン画像 URL（任意） */
  faviconUrl?: string;
  /** `Tab` キー補完時に検索入力欄へ反映される文字列 */
  fillText: string;
  /** 確定実行時に渡されるコマンド文字列または解決済み URL */
  executeValue: string;
  /** 通常ブックマーク / ブックマークレット実行時のスコア更新用情報（任意） */
  matchTarget?: SuggestedMatchTarget;
  /** フォルダ一括オープン候補の場合の対象フォルダパス（任意） */
  folderPath?: string;
  /** `:add` 入力時の登録対象プレビュー情報（任意） */
  previewMeta?: AddPreviewMeta;
}

/**
 * ブックマーク遷移時のタブの開き方
 */
export type TabDisposition = 'currentTab' | 'newForegroundTab' | 'newBackgroundTab';

/**
 * 共通コマンド実行エンジンの処理結果ステータス
 */
export type CommandExecutionOutcome =
  | 'executed_close'
  | 'executed_keep_open'
  | 'success_toast'
  | 'info_prompt'
  | 'needs_confirmation'
  | 'error';

/**
 * フォルダ一括オープン上限超過時の確認用データ
 */
export interface BatchOpenConfirmationData {
  /** 対象フォルダパス */
  folderPath: string;
  /** 開く対象の一意 URL リスト */
  urls: string[];
  /** 所属するニックネームリスト */
  nicknames: string[];
  /** 現在の安全上限件数 */
  maxLimit: number;
}

/**
 * 共通コマンド実行エンジンの戻り値型
 */
export interface CommandExecutionResult {
  /** 実行結果ステータス */
  outcome: CommandExecutionOutcome;
  /** ユーザーへ提示する多言語メッセージ（任意） */
  message?: string;
  /** `info_prompt` 時に検索欄へ補完・維持する入力候補文字列（任意） */
  suggestedInput?: string;
  /** `needs_confirmation` 時の確認用データ（任意） */
  confirmation?: BatchOpenConfirmationData;
  /** オムニボックス互換用のフォールバック種別（任意） */
  legacyFallbackAction?: 'open_list_with_tab' | 'open_list_with_msg';
}

/**
 * ブックマークレット実行の結果型
 */
export interface BookmarkletExecutionResult {
  /** 実行に成功したかどうか */
  success: boolean;
  /** エラー種別（失敗時） */
  errorKind?: 'restricted' | 'not_allowed' | 'empty' | 'failed';
  /** ローカライズ済みのエラーメッセージ（失敗時） */
  errorMessage?: string;
}

/**
 * Service Worker と拡張機能 UI 間でやり取りするランタイムメッセージ型
 */
export type RuntimeMessage =
  | {
      action: 'EXECUTE_BATCH_OPEN';
      payload: {
        folderPath: string;
        urls: string[];
        nicknames: string[];
      };
    }
  | {
      action: 'EXECUTE_BOOKMARKLET';
      payload: {
        tabId: number;
        tabUrl?: string;
        bookmarkletUrl: string;
        matchedTemplateUrl?: string;
        matchedNickname?: string;
      };
    };

/**
 * 一括オープン時のデフォルト安全上限タブ数
 */
export const DEFAULT_MAX_BATCH_OPEN_TABS = 20;

/**
 * Chrome Storage Sync におけるチャンクキーのプレフィックス
 */
export const SYNC_KEY_PREFIX = 'sync_data_';

/**
 * オムニボックスで表示するポップアップ移行案内候補の識別 content 文字列
 */
export const OMNIBOX_MIGRATION_HINT_CONTENT = '→ Nickmark Popup Launcher';
