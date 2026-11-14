import { t } from '../i18n';
import { getHistorySearchEnabled } from './storage';
import { MAX_HISTORY_SUGGESTIONS, PaletteItem } from './types';
import {
  formatUrlForOmniboxDisplay,
  getFaviconUrl,
  isBookmarkletUrl,
  normalizeNicknamePath,
  normalizeUrlForComparison
} from './url';
import { stripZeroWidthChars } from './search';

// ブックマーク候補との重複除外後に上限件数を確保するため、余裕を持って多めに取得する
const HISTORY_FETCH_BUFFER_LIMIT = 30;

/**
 * 拡張機能にブラウザ履歴アクセス権限（`history`）が付与されているかを確認します。
 * API が利用できない場合や確認中に例外が発生した場合は安全に `false` を返します。
 * @returns 履歴権限が付与されている場合は true、未付与またはエラー時は false
 */
export async function hasHistoryPermission(): Promise<boolean> {
  try {
    if (typeof chrome === 'undefined' || !chrome.permissions?.contains) {
      return false;
    }
    return await chrome.permissions.contains({ permissions: ['history'] });
  } catch (err: unknown) {
    console.warn('履歴アクセス権限の確認に失敗しました:', err);
    return false;
  }
}

/**
 * ユーザーに対してブラウザ履歴アクセス権限（`history`）の許可を要求します。
 * 必ずクリック等のユーザージェスチャーコンテキストから直接呼び出す必要があります。
 * @returns ユーザーが許可した場合（または既に許可済みの場合）は true、拒否・エラー時は false
 */
export async function requestHistoryPermission(): Promise<boolean> {
  try {
    if (typeof chrome === 'undefined' || !chrome.permissions?.request) {
      return false;
    }
    return await chrome.permissions.request({ permissions: ['history'] });
  } catch (err: unknown) {
    console.warn('履歴アクセス権限の要求に失敗しました:', err);
    return false;
  }
}

/**
 * ユーザー設定とブラウザ権限の双方を考慮し、現在ブラウザ履歴検索が実効的に有効かを判定します。
 * ブラウザ側で権限が取り消されている場合も安全に `false` を返します。
 * @returns 設定が有効かつ履歴アクセス権限が付与されている場合は true
 */
export async function getEffectiveHistorySearchEnabled(): Promise<boolean> {
  const [settingEnabled, permissionGranted] = await Promise.all([
    getHistorySearchEnabled(),
    hasHistoryPermission()
  ]);
  return settingEnabled && permissionGranted;
}

/**
 * 検索入力文字列がブラウザ履歴検索の対象となる通常クエリかどうかを判定します。
 * 空文字、空白のみ、スラッシュのみ、`:` コマンド入力、および末尾 `/` のフォルダ一括指定時は `false` を返します。
 * @param rawQuery - 検索欄の入力文字列
 * @returns 履歴検索を実行すべき場合は true、除外すべき場合は false
 */
export function shouldSearchHistoryForQuery(rawQuery: string): boolean {
  const trimmed = stripZeroWidthChars(rawQuery).trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(':')) return false;
  if (trimmed.endsWith('/')) return false;
  if (trimmed.includes('/') && !normalizeNicknamePath(trimmed)) return false;
  return true;
}

/**
 * ブラウザ閲覧履歴を検索し、ブックマーク候補と重複しないコマンドパレット用履歴アイテム配列を構築します。
 * `startTime: 0` を指定して過去 24 時間に限らず全履歴期間を検索対象とします。
 * @param rawQuery - 検索欄の入力文字列
 * @param excludeUrls - 上部のブックマーク候補に表示済みの URL 一覧（重複除外用）
 * @param limit - 返却する履歴候補の最大件数（デフォルト: `MAX_HISTORY_SUGGESTIONS`）
 * @returns 変換された `PaletteItem[]`（エラー時や対象外クエリ時は空配列）
 */
export async function searchHistoryPaletteItems(
  rawQuery: string,
  excludeUrls: string[],
  limit: number = MAX_HISTORY_SUGGESTIONS
): Promise<PaletteItem[]> {
  if (!shouldSearchHistoryForQuery(rawQuery)) return [];
  if (limit <= 0) return [];
  if (!(await hasHistoryPermission())) return [];

  if (typeof chrome === 'undefined' || !chrome.history?.search) {
    return [];
  }

  const trimmedQuery = stripZeroWidthChars(rawQuery).trim();

  try {
    const historyEntries = await chrome.history.search({
      text: trimmedQuery,
      startTime: 0,
      maxResults: Math.max(limit * 3, HISTORY_FETCH_BUFFER_LIMIT)
    });

    const excludeSet = new Set<string>();
    for (const url of excludeUrls) {
      const normalized = normalizeUrlForComparison(url);
      if (normalized) excludeSet.add(normalized);
    }

    const seenSet = new Set<string>();
    const items: PaletteItem[] = [];
    const historyTag = t('popupHistoryTag') || '履歴';

    for (const entry of historyEntries) {
      const url = entry.url?.trim();
      if (!url || isBookmarkletUrl(url)) continue;

      const normalized = normalizeUrlForComparison(url);
      if (!normalized || excludeSet.has(normalized) || seenSet.has(normalized)) {
        continue;
      }

      seenSet.add(normalized);
      const displayUrl = formatUrlForOmniboxDisplay(url);
      const title = entry.title?.trim() || displayUrl;

      items.push({
        id: `history:${items.length}:${url}`,
        kind: 'history',
        title,
        subtitle: displayUrl,
        typeTag: historyTag,
        isPinned: false,
        faviconUrl: getFaviconUrl(url),
        // 履歴候補はニックネームを持たないため Tab 補完で検索欄を上書きしない
        fillText: '',
        executeValue: url
      });

      if (items.length >= limit) break;
    }

    return items;
  } catch (err: unknown) {
    console.warn('ブラウザ履歴の検索に失敗しました:', err);
    return [];
  }
}
