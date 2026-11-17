import { ColumnFilterQueries, DEFAULT_LIST_SORT_OPTION, ListSortOption } from './types';

/**
 * 一覧の並び替え対象として最小限必要なブックマーク行インターフェース
 */
export interface SortableBookmarkRow {
  nickname: string;
  url: string;
  score: number;
  last_used_at: number;
}

/**
 * 列別フィルタリング対象として最小限必要なブックマーク行インターフェース
 */
export interface FilterableBookmarkRow {
  nickname: string;
  title?: string;
  url: string;
}

/**
 * 有効な ListSortOption 値の一覧セット
 */
const VALID_LIST_SORT_OPTIONS: ReadonlySet<string> = new Set<ListSortOption>([
  'default',
  'last_used_desc',
  'last_used_asc',
  'score_desc',
  'score_asc'
]);

/**
 * 数値比較の項目と方向を表す内部設定型
 */
interface NumericSortConfig {
  field: 'last_used_at' | 'score';
  direction: 1 | -1;
}

/**
 * ソート種別から比較対象フィールドと昇降順方向への対応表
 */
const NUMERIC_SORT_CONFIG_MAP: Record<Exclude<ListSortOption, 'default'>, NumericSortConfig> = {
  last_used_desc: { field: 'last_used_at', direction: -1 },
  last_used_asc: { field: 'last_used_at', direction: 1 },
  score_desc: { field: 'score', direction: -1 },
  score_asc: { field: 'score', direction: 1 }
};

/**
 * 指定された値が有効な ListSortOption であるかを判定します。
 * @param value - 検証対象の値
 * @returns 有効な ListSortOption である場合は true
 */
export function isValidListSortOption(value: unknown): value is ListSortOption {
  return typeof value === 'string' && VALID_LIST_SORT_OPTIONS.has(value);
}

/**
 * 任意の値を検証し、有効な ListSortOption へ正規化します。
 * 未知の文字列や破損値の場合は安全にデフォルト値（'default'）を返します。
 * @param value - ストレージ等から取得した未検証の値
 * @returns 正規化された ListSortOption
 */
export function parseValidListSortOption(value: unknown): ListSortOption {
  return isValidListSortOption(value) ? value : DEFAULT_LIST_SORT_OPTION;
}

/**
 * 比較用の数値フィールドを有限数へ正規化します。
 * 未設定・NaN・無限大などの異常値は 0 として扱います。
 * @param value - 正規化対象の数値
 * @returns 有限の数値
 */
function toFiniteSortNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * 同値行の順序を安定させるための決定的な補助比較を行います。
 * ニックネーム昇順 → URL 昇順の優先度で比較します。
 * @param a - 比較対象の行 A
 * @param b - 比較対象の行 B
 * @returns 比較結果（負値・0・正値）
 */
function compareBookmarkRowTieBreaker(a: SortableBookmarkRow, b: SortableBookmarkRow): number {
  const nickA = a.nickname || '';
  const nickB = b.nickname || '';
  const nickDiff = nickA.localeCompare(nickB);
  if (nickDiff !== 0) return nickDiff;

  const urlA = a.url || '';
  const urlB = b.url || '';
  return urlA.localeCompare(urlB);
}

/**
 * 指定された並び替え基準に従ってブックマーク行配列を非破壊で並び替えます。
 * 最終使用日時・スコアでの並び替え時はピン留め状態を優先せず、純粋に数値の大小で比較します。
 * @param rows - 並び替え対象のブックマーク行配列
 * @param sortOption - 適用する並び替え基準
 * @returns 並び替え済みの新しい配列
 */
export function sortBookmarkRows<T extends SortableBookmarkRow>(
  rows: readonly T[],
  sortOption: ListSortOption
): T[] {
  // 元の配列を破壊しないよう浅いコピーを生成する
  const copied = [...rows];
  if (sortOption === 'default') {
    return copied;
  }

  const config = NUMERIC_SORT_CONFIG_MAP[sortOption];
  return copied.sort((a, b) => {
    const valA = toFiniteSortNumber(a[config.field]);
    const valB = toFiniteSortNumber(b[config.field]);
    if (valA !== valB) {
      return (valA - valB) * config.direction;
    }
    return compareBookmarkRowTieBreaker(a, b);
  });
}

/**
 * 対象フィールドの文字列が、指定された検索クエリに一致するかを判定します。
 * 大文字・小文字を区別せず、空白区切りで複数ワードが入力された場合はすべてのワードが含まれる（AND 部分一致）かを検証します。
 * クエリが空（または空白のみ）の場合は常に true を返します。
 * @param fieldValue - 検査対象のセル文字列
 * @param rawQuery - ユーザーが入力した検索クエリ文字列
 * @returns 条件を満たす場合は true、それ以外は false
 */
export function matchesColumnFilter(
  fieldValue: string | undefined | null,
  rawQuery: string | undefined | null
): boolean {
  const trimmedQuery = (rawQuery || '').trim();
  if (!trimmedQuery) return true;

  const targetLower = (fieldValue || '').toLowerCase();
  const tokens = trimmedQuery.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every(token => targetLower.includes(token));
}

/**
 * ブックマーク行配列に対して、「ニックネーム」「タイトル」「URL」の列別フィルタークエリを AND 条件で適用し、
 * 条件に合致する行のみを非破壊で抽出して返します。
 * @param rows - 絞り込み対象のブックマーク行配列
 * @param queries - 各列（`nickname`, `title`, `url`）の検索クエリ
 * @returns 絞り込み済みの新しい配列
 */
export function filterBookmarkRowsByColumns<T extends FilterableBookmarkRow>(
  rows: readonly T[],
  queries: ColumnFilterQueries
): T[] {
  const nickQuery = (queries.nickname || '').trim();
  const titleQuery = (queries.title || '').trim();
  const urlQuery = (queries.url || '').trim();

  if (!nickQuery && !titleQuery && !urlQuery) {
    return [...rows];
  }

  return rows.filter(
    row =>
      matchesColumnFilter(row.nickname, nickQuery) &&
      matchesColumnFilter(row.title, titleQuery) &&
      matchesColumnFilter(row.url, urlQuery)
  );
}
