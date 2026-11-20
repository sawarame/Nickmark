import {
  AddPreviewMeta,
  BookmarkEntry,
  FolderInfo,
  PaletteItem,
  ResolvedSearchMatch
} from './types';
import {
  expandDynamicUrl,
  formatUrlForDisplay,
  getFaviconUrl,
  isBookmarkletUrl,
  isDynamicUrl,
  isSameUrl,
  normalizeNicknamePath,
  normalizeUrlForComparison,
  resolveFallbackUrl
} from './url';
import { extractFolders } from './storage';
import { t } from '../i18n';

// 入力文字列のサニタイズ用に除去する不可視のゼロ幅文字パターン
const ZERO_WIDTH_ALL_REGEX = /[\u200B-\u200D\uFEFF]/g;

/**
 * 文字列に含まれるゼロ幅文字（不可視文字）をすべて除去します。
 * @param text - 対象の文字列
 * @returns ゼロ幅文字を除去したクリーンな文字列
 */
export function stripZeroWidthChars(text: string): string {
  if (!text) return '';
  return text.replace(ZERO_WIDTH_ALL_REGEX, '');
}

/**
 * フォルダ検索用のオプション設定
 */
export interface FindMatchingFoldersOptions {
  /** 末尾スラッシュ明示時など、セグメント境界のサフィックス完全一致のみに限定する場合は true（既定: false） */
  exactSuffix?: boolean;
  /** 返却する最大件数（未指定時は全件） */
  limit?: number;
}

/**
 * フォルダパスを大文字・小文字を区別しないアルファベット順で比較します。
 * @param a - 比較対象のフォルダパス 1
 * @param b - 比較対象のフォルダパス 2
 * @returns 並び順を示す比較値（負・0・正）
 */
export function compareFolderPaths(a: string, b: string): number {
  const lowerCompare = a.toLowerCase().localeCompare(b.toLowerCase());
  return lowerCompare !== 0 ? lowerCompare : a.localeCompare(b);
}

/**
 * フォルダパスがクエリ文字列にセグメント境界（`/` 区切り）起点で一致するか判定します。
 * - `exactSuffix === false`: いずれかの階層セグメントから始まるサフィックスパスがクエリで前方一致する場合に true
 * - `exactSuffix === true`: いずれかの階層セグメントから始まるサフィックスパスがクエリと完全一致する場合に true
 * @param folderPath - 正規化済みのフォルダパス
 * @param lowerNormQuery - 小文字化・正規化済みのクエリ文字列
 * @param exactSuffix - サフィックス完全一致のみを許容する場合は true
 * @returns 一致する場合は true
 */
function matchesFolderBySegment(
  folderPath: string,
  lowerNormQuery: string,
  exactSuffix: boolean
): boolean {
  const lowerPath = folderPath.toLowerCase();
  if (exactSuffix) {
    return lowerPath === lowerNormQuery || lowerPath.endsWith(`/${lowerNormQuery}`);
  }
  if (lowerPath.startsWith(lowerNormQuery)) {
    return true;
  }

  let searchFrom = 0;
  while (true) {
    const slashIndex = lowerPath.indexOf('/', searchFrom);
    if (slashIndex === -1) return false;
    if (lowerPath.startsWith(lowerNormQuery, slashIndex + 1)) {
      return true;
    }
    searchFrom = slashIndex + 1;
  }
}

/**
 * 抽出済みフォルダ群からクエリに一致する開く対象ありのフォルダを抽出し、アルファベット順で返します。
 * クエリが空の場合は開く対象ありの全フォルダをアルファベット順で返します。
 * @param folders - `extractFolders` で抽出したフォルダ情報マップ
 * @param rawQuery - ユーザーが入力したクエリ文字列
 * @param options - マッチ条件および取得上限オプション
 * @returns アルファベット順にソートされた一致フォルダ情報配列
 */
export function findMatchingFolders(
  folders: Map<string, FolderInfo>,
  rawQuery: string,
  options: FindMatchingFoldersOptions = {}
): FolderInfo[] {
  const { exactSuffix = false, limit } = options;
  const normQuery = normalizeNicknamePath(rawQuery);
  const lowerNormQuery = normQuery.toLowerCase();

  // スラッシュのみ（例: "/" や "///"）の場合は全件誤ヒットを防ぐため空配列を返す
  if (!lowerNormQuery && rawQuery.includes('/')) {
    return [];
  }

  const matched = Array.from(folders.values()).filter(folder => {
    if (folder.openableUrlCount <= 0) return false;
    if (!lowerNormQuery) return true;
    return matchesFolderBySegment(folder.path, lowerNormQuery, exactSuffix);
  });

  matched.sort((a, b) => compareFolderPaths(a.path, b.path));

  if (limit !== undefined && limit >= 0) {
    return matched.slice(0, limit);
  }
  return matched;
}

/**
 * ニックネームが入力文字列（または正規化後の入力文字列）で前方一致するか判定します。
 * @param target - 判定対象のニックネームまたはフォルダパス
 * @param lowerInput - 小文字化済みの生入力
 * @param lowerNormInput - 小文字化済みの正規化入力
 * @returns 前方一致する場合は true
 */
function startsWithInputOrNormalized(
  target: string,
  lowerInput: string,
  lowerNormInput: string
): boolean {
  const lowerTarget = target.toLowerCase();
  return (
    lowerTarget.startsWith(lowerInput) ||
    (!!lowerNormInput && lowerTarget.startsWith(lowerNormInput))
  );
}

/**
 * UI の AutoComplete 入力欄向けに、既存のフォルダプレフィックス（`folder/`）およびニックネーム候補を絞り込みます。
 * 先頭・連続スラッシュの正規化と末尾スラッシュ指定の維持を行い、フォルダ前方一致 ＞ ニックネーム前方一致 ＞ 部分一致の順で返します。
 * @param rawInput - ユーザーが入力したクエリ文字列
 * @param bookmarks - 現在のブックマーク辞書
 * @returns 補完候補文字列の配列
 */
export function filterNicknameSuggestions(
  rawInput: string,
  bookmarks: Record<string, BookmarkEntry[]>
): string[] {
  const trimmedRaw = (rawInput || '').trim();
  const hasTrailingSlash = trimmedRaw.endsWith('/');
  const cleanSegments = trimmedRaw
    .split('/')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  const query =
    cleanSegments.length > 0
      ? (cleanSegments.join('/') + (hasTrailingSlash ? '/' : '')).toLowerCase()
      : '';

  const allNicknames = Array.from(
    new Set(Object.keys(bookmarks).map(n => normalizeNicknamePath(n)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const folders = extractFolders(bookmarks);
  const folderPrefixes = Array.from(folders.values())
    .map(f => `${f.path}/`)
    .sort((a, b) => a.localeCompare(b));

  if (!query) {
    return [...folderPrefixes, ...allNicknames];
  }

  const folderMatches = folderPrefixes.filter(f => f.toLowerCase().startsWith(query));
  const prefixMatches: string[] = [];
  const partialMatches: string[] = [];

  for (const name of allNicknames) {
    const lower = name.toLowerCase();
    if (lower.startsWith(query)) {
      prefixMatches.push(name);
    } else if (lower.includes(query)) {
      partialMatches.push(name);
    }
  }

  return [...folderMatches, ...prefixMatches, ...partialMatches];
}

/**
 * ブックマークデータ内のニックネーム一覧を優先度順（ピン留め ＞ 最大スコア降順 ＞ 名前昇順）で取得します。
 * @param bookmarks - 現在のブックマークデータ
 * @returns ソート済みのニックネーム配列
 */
function getSortedNicknames(bookmarks: Record<string, BookmarkEntry[]>): string[] {
  return Object.keys(bookmarks).sort((a, b) => {
    const entriesA = bookmarks[a] || [];
    const entriesB = bookmarks[b] || [];
    const pinA = entriesA.some(e => e.is_pinned) ? 1 : 0;
    const pinB = entriesB.some(e => e.is_pinned) ? 1 : 0;
    if (pinB !== pinA) return pinB - pinA;

    const maxScoreA = entriesA.reduce((max, e) => Math.max(max, e.score || 0), 0);
    const maxScoreB = entriesB.reduce((max, e) => Math.max(max, e.score || 0), 0);
    if (maxScoreB !== maxScoreA) return maxScoreB - maxScoreA;

    return a.localeCompare(b);
  });
}

/**
 * 通常検索の入力テキストを解析し、マッチ度ティア・ピン留め・スコア順にソートされた候補リストを返します。
 * @param text - 検索欄に入力された検索文字列
 * @param bookmarks - 現在のブックマークデータ
 * @returns ソート済みの検索マッチ結果配列
 */
export function resolveRegularSearchMatches(
  text: string,
  bookmarks: Record<string, BookmarkEntry[]>
): ResolvedSearchMatch[] {
  const trimmed = stripZeroWidthChars(text).trim();
  if (!trimmed) return [];

  // 1語目（ニックネーム候補）と2語目以降（動的URLの引数または絞り込みキーワード）に分割する
  const firstSpaceMatch = trimmed.match(/\s+/);
  const firstToken = firstSpaceMatch ? trimmed.slice(0, firstSpaceMatch.index) : trimmed;
  const restQuery = firstSpaceMatch
    ? trimmed.slice((firstSpaceMatch.index ?? 0) + firstSpaceMatch[0].length).trim()
    : '';

  const normFirstToken = normalizeNicknamePath(firstToken);
  // スラッシュのみ（例: "/" や "///"）で正規化後が空文字の場合は全件誤ヒットを防ぐためマッチなしとする
  if (!normFirstToken && firstToken.includes('/')) {
    return [];
  }

  const firstTokenLower = firstToken.toLowerCase();
  const normFirstTokenLower = normFirstToken.toLowerCase();
  const restTokensLower = restQuery ? restQuery.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const allTokensLower = trimmed.toLowerCase().split(/\s+/).filter(Boolean);

  const allMatches: ResolvedSearchMatch[] = [];

  for (const [nickname, entries] of Object.entries(bookmarks)) {
    const nickLower = nickname.toLowerCase();
    let nickTier: number | null = null;

    if (nickLower === firstTokenLower || (normFirstTokenLower && nickLower === normFirstTokenLower)) {
      nickTier = 1; // ニックネーム完全一致
    } else if (startsWithInputOrNormalized(nickname, firstTokenLower, normFirstTokenLower)) {
      nickTier = 2; // ニックネーム前方一致
    } else if (
      nickLower.includes(firstTokenLower) ||
      (normFirstTokenLower && nickLower.includes(normFirstTokenLower))
    ) {
      nickTier = 3; // ニックネーム部分一致
    }

    for (const entry of entries) {
      const dynamic = isDynamicUrl(entry.url);
      let addedInNickTier = false;

      if (nickTier !== null) {
        if (dynamic) {
          const resolvedUrl = restQuery
            ? expandDynamicUrl(entry.url, restQuery)
            : resolveFallbackUrl(entry);
          allMatches.push({
            nickname,
            entry,
            resolvedUrl,
            tier: nickTier,
            isDynamic: true,
            dynamicArg: restQuery
          });
          addedInNickTier = true;
        } else {
          const searchable = `${nickname} ${entry.title || ''} ${entry.url}`.toLowerCase();
          const passesFilter =
            restTokensLower.length === 0 || restTokensLower.every(token => searchable.includes(token));

          if (passesFilter) {
            allMatches.push({
              nickname,
              entry,
              resolvedUrl: entry.url,
              tier: nickTier,
              isDynamic: false,
              dynamicArg: ''
            });
            addedInNickTier = true;
          }
        }
      }

      // ニックネーム基準でヒットしなかった場合でも、全キーワードがタイトル・URL等に含まれれば横断検索（Tier 4）としてヒットさせる
      if (!addedInNickTier) {
        const fullSearchable = `${nickname} ${entry.title || ''} ${entry.url} ${entry.default_value || ''}`.toLowerCase();
        if (allTokensLower.every(token => fullSearchable.includes(token))) {
          allMatches.push({
            nickname,
            entry,
            resolvedUrl: dynamic ? resolveFallbackUrl(entry) : entry.url,
            tier: 4,
            isDynamic: dynamic,
            dynamicArg: ''
          });
        }
      }
    }
  }

  // マッチ度ティア昇順 ＞ ピン留め優先 ＞ スコア降順 ＞ URL昇順 でソートする
  allMatches.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const pA = a.entry.is_pinned ? 1 : 0;
    const pB = b.entry.is_pinned ? 1 : 0;
    if (pB !== pA) return pB - pA;
    if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
    return a.resolvedUrl.localeCompare(b.resolvedUrl);
  });

  return allMatches;
}

// 通常検索時のフォルダ候補表示上限
const MAX_EXPLICIT_FOLDER_PALETTE_ITEMS = 30;
const MAX_INLINE_FOLDER_PALETTE_ITEMS = 10;

/**
 * フォルダ情報から通常検索パレット表示用の `PaletteItem` を生成します。
 * @param folder - 対象のフォルダ情報
 * @param explicit - 末尾 `/` による明示的フォルダ指定時の表示形式とする場合は true
 * @returns 生成されたフォルダ一括オープン候補アイテム
 */
function createRegularFolderPaletteItem(folder: FolderInfo, explicit: boolean): PaletteItem {
  const title = explicit
    ? t('openAllInFolder', [folder.path, String(folder.openableUrlCount)]) ||
      `📁 フォルダ「${folder.path}」の全ブックマークを一括オープン (${folder.openableUrlCount}タブ)`
    : t('openFolderSummary', [folder.path, String(folder.openableUrlCount)]) ||
      `📁 ${folder.path} (${folder.openableUrlCount}タブを一括オープン)`;

  return {
    id: `folder:${folder.path}`,
    kind: 'folder',
    title,
    subtitle: `${folder.path}/`,
    badge: `${folder.path}/`,
    typeTag: `📁 ${folder.openableUrlCount}`,
    fillText: `${folder.path}/`,
    executeValue: `${folder.path}/`,
    folderPath: folder.path
  };
}

/**
 * 通常検索モード入力からコマンドパレット表示用の候補リスト（`PaletteItem[]`）を構築します。
 * フォルダ一括オープン候補、通常 URL、動的 URL、ブックマークレットを構造化して返します。
 * @param rawQuery - 検索欄の入力文字列
 * @param bookmarks - 現在のブックマークデータ
 * @returns コマンドパレット候補アイテムの配列
 */
export function buildRegularPaletteItems(
  rawQuery: string,
  bookmarks: Record<string, BookmarkEntry[]>
): PaletteItem[] {
  const trimmed = stripZeroWidthChars(rawQuery).trim();
  if (!trimmed) return [];

  const normQuery = normalizeNicknamePath(trimmed);
  // スラッシュのみ（例: "/" や "///"）の場合は全件誤ヒットを防ぐため空配列を返す
  if (!normQuery && trimmed.includes('/')) {
    return [];
  }

  const allMatches = resolveRegularSearchMatches(trimmed, bookmarks);
  const folders = extractFolders(bookmarks);
  const isExplicitFolderInput = trimmed.endsWith('/');

  const items: PaletteItem[] = [];

  // 末尾スラッシュ明示時はサフィックス完全一致するフォルダ一括オープン候補をアルファベット順で最上位に配置する
  if (isExplicitFolderInput && normQuery) {
    const matchedFolders = findMatchingFolders(folders, normQuery, {
      exactSuffix: true,
      limit: MAX_EXPLICIT_FOLDER_PALETTE_ITEMS
    });
    for (const folder of matchedFolders) {
      items.push(createRegularFolderPaletteItem(folder, true));
    }
  }

  // 一致したブックマーク・動的 URL・ブックマークレットを変換する
  for (let i = 0; i < Math.min(allMatches.length, 30); i++) {
    const match = allMatches[i];
    const isBookmarklet = isBookmarkletUrl(match.resolvedUrl);
    const fillText =
      match.isDynamic && match.dynamicArg
        ? `${match.nickname} ${match.dynamicArg}`
        : match.nickname;
    const typeTag = isBookmarklet
      ? '[JS]'
      : match.isDynamic
        ? match.dynamicArg
          ? `(${match.dynamicArg})`
          : '[%s]'
        : undefined;

    items.push({
      id: `match:${i}:${match.nickname}:${match.entry.url}`,
      kind: isBookmarklet ? 'bookmarklet' : 'bookmark',
      title: match.entry.title || match.nickname,
      subtitle: formatUrlForDisplay(match.resolvedUrl),
      badge: match.nickname,
      typeTag,
      isPinned: !!match.entry.is_pinned,
      faviconUrl: isBookmarklet ? '' : getFaviconUrl(match.resolvedUrl),
      fillText,
      executeValue: match.resolvedUrl,
      matchTarget: {
        nickname: match.nickname,
        resolvedUrl: match.resolvedUrl,
        templateUrl: match.entry.url
      }
    });
  }

  // 末尾スラッシュでない場合でもセグメント境界前方一致するフォルダがあればアルファベット順で一括オープン候補を追加する
  if (!isExplicitFolderInput && normQuery) {
    const matchedFolders = findMatchingFolders(folders, normQuery, {
      exactSuffix: false,
      limit: MAX_INLINE_FOLDER_PALETTE_ITEMS
    });

    if (matchedFolders.length > 0) {
      const folderItems = matchedFolders.map(folder =>
        createRegularFolderPaletteItem(folder, false)
      );

      // 同名の単体ニックネーム完全一致（tier === 1）がない場合は最上位、ある場合はその直下に配置する
      const firstNonExactIndex = items.findIndex((_, idx) => allMatches[idx]?.tier !== 1);
      const insertIndex = firstNonExactIndex === -1 ? items.length : firstNonExactIndex;
      items.splice(insertIndex, 0, ...folderItems);
    }
  }

  return items;
}

/**
 * 既存ニックネームに紐づくブックマークの概要説明文字列と代表アイコン用 URL を生成します。
 * @param nickname - 対象のニックネーム
 * @param bookmarks - 現在のブックマーク辞書
 * @returns 要約文字列と代表ファビコン URL
 */
function summarizeNicknameForPalette(
  nickname: string,
  bookmarks: Record<string, BookmarkEntry[]>
): { summary: string; faviconUrl: string } {
  const entries = bookmarks[nickname] || [];
  if (entries.length === 1) {
    const entry = entries[0];
    const title = entry.title || 'No title';
    const url = formatUrlForDisplay(entry.url);
    return {
      summary: `${title} — ${url}`,
      faviconUrl: isBookmarkletUrl(entry.url) ? '' : getFaviconUrl(entry.url)
    };
  }
  if (entries.length > 1) {
    const firstNormal = entries.find(e => !isBookmarkletUrl(e.url));
    return {
      summary: `Multiple URLs (${entries.length})`,
      faviconUrl: firstNormal ? getFaviconUrl(firstNormal.url) : ''
    };
  }
  return { summary: nickname, faviconUrl: '' };
}

/**
 * コマンドモード（`:` プレフィックス）入力からコマンドパレット表示用の候補リストを構築します。
 * `:add` / `:a` 入力時はフォルダプレフィックス補完と登録対象タブ/URL プレビューを付与します。
 * @param rawQuery - 検索欄の入力文字列（先頭が `:`）
 * @param bookmarks - 現在のブックマーク辞書
 * @param currentTab - 登録プレビュー用の現在アクティブタブ情報（任意）
 * @returns コマンドパレット候補アイテムの配列
 */
export function buildCommandPaletteItems(
  rawQuery: string,
  bookmarks: Record<string, BookmarkEntry[]>,
  currentTab?: { url?: string; title?: string }
): PaletteItem[] {
  const trimmedStart = stripZeroWidthChars(rawQuery).trimStart();
  if (!trimmedStart.startsWith(':')) return [];

  const firstSpaceIndex = trimmedStart.indexOf(' ');
  const hasSpace = firstSpaceIndex !== -1;
  const cmd = !hasSpace ? trimmedStart : trimmedStart.substring(0, firstSpaceIndex);
  const rawRest = !hasSpace ? '' : trimmedStart.substring(firstSpaceIndex + 1);
  const restTrimmed = rawRest.trim();

  const items: PaletteItem[] = [];
  const sortedNicknames = getSortedNicknames(bookmarks);

  const isCmdMatch = (targetCmds: string[]): boolean =>
    hasSpace ? targetCmds.includes(cmd) : targetCmds.some(target => target.startsWith(cmd));

  /**
   * 登録系コマンド（`:add` / `:addall`）向けにフォルダプレフィックスおよび既存ニックネーム補完候補を追加します。
   * @param canonicalCmd - 展開先のコマンド名（`':add'` または `':addall'`）
   * @param restParts - スペース分割済みの引数配列
   */
  const appendRegisterCompletions = (canonicalCmd: string, restParts: string[]): void => {
    if (!hasSpace || restParts.length > 1 || (restParts.length === 1 && rawRest.endsWith(' '))) {
      return;
    }
    const nicknameInput = restParts[0] || '';
    const normNickInput = normalizeNicknamePath(nicknameInput);
    const candidates = filterNicknameSuggestions(nicknameInput, bookmarks);

    let added = 0;
    for (const candidate of candidates) {
      if (added >= 10) break;
      const isFolderPrefix = candidate.endsWith('/');
      const normCandidate = normalizeNicknamePath(candidate);
      if (!isFolderPrefix && (candidate === nicknameInput || (!!normNickInput && normCandidate === normNickInput))) {
        continue;
      }

      if (isFolderPrefix) {
        items.push({
          id: `cmd:${canonicalCmd}:folder:${candidate}`,
          kind: 'completion',
          title: `📁 ${candidate}`,
          subtitle: t('popupFolderPrefixCompletionHint') || 'フォルダ補完',
          badge: canonicalCmd,
          typeTag: 'FOLDER',
          fillText: `${canonicalCmd} ${candidate}`,
          executeValue: `${canonicalCmd} ${candidate}`
        });
      } else {
        const { summary, faviconUrl } = summarizeNicknameForPalette(candidate, bookmarks);
        items.push({
          id: `cmd:${canonicalCmd}:nick:${candidate}`,
          kind: 'command',
          title: candidate,
          subtitle: `${t('popupExistingNicknameCompletionHint') || '既存ニックネーム'} — ${summary}`,
          badge: canonicalCmd,
          faviconUrl,
          fillText: `${canonicalCmd} ${candidate}`,
          executeValue: `${canonicalCmd} ${candidate}`
        });
      }
      added++;
    }
  };

  // :add / :a コマンド
  if (isCmdMatch([':add', ':a'])) {
    const restParts = restTrimmed ? restTrimmed.split(/\s+/) : [];
    const nicknameInput = restParts[0] || '';
    const secondArg = restParts[1] || '';
    const isBookmarkletArg = restParts.length >= 2 && isBookmarkletUrl(secondArg);
    const isDirectHttpUrl = restParts.length >= 2 && /^https?:\/\/\S+$/i.test(secondArg);

    const rawAfterNicknameMatch = trimmedStart.match(/^:(?:add|a)\s+\S+\s+([\s\S]+)$/);
    const targetUrl = isBookmarkletArg
      ? (rawAfterNicknameMatch ? rawAfterNicknameMatch[1].trim() : secondArg)
      : isDirectHttpUrl
        ? secondArg
        : (currentTab?.url || '');
    const customTitle = isBookmarkletArg
      ? ''
      : isDirectHttpUrl
        ? restParts.slice(3).join(' ').trim()
        : restParts.slice(2).join(' ').trim();
    const targetTitle = customTitle || (isBookmarkletArg || isDirectHttpUrl ? '' : (currentTab?.title || ''));
    const mode: AddPreviewMeta['mode'] = isBookmarkletArg
      ? 'bookmarklet'
      : isDirectHttpUrl
        ? 'directUrl'
        : 'currentTab';

    const actionHint = isBookmarkletArg
      ? (t('popupCommandAddBookmarkletHint') || 'ブックマークレットを登録')
      : isDirectHttpUrl
        ? (t('popupCommandAddUrlHint') || '指定 URL を登録')
        : (t('popupCommandAddHint') || '現在のタブを登録（または [ニックネーム] [URL] [タイトル]）');

    const targetLabel = t('popupAddPreviewTargetLabel') || '登録対象';
    const previewBody = targetUrl
      ? targetTitle
        ? `${targetTitle} — ${formatUrlForDisplay(targetUrl)}`
        : formatUrlForDisplay(targetUrl)
      : (t('popupNoOpenableTabUrl') || '現在のタブから登録可能な URL を取得できませんでした。');

    items.push({
      id: 'cmd:add:exec',
      kind: 'command',
      title: restTrimmed ? `:add ${restTrimmed}` : `:add [${t('nicknameLabel') || 'ニックネーム'}]`,
      subtitle: `${actionHint} | ${targetLabel}: ${previewBody}`,
      badge: ':add',
      typeTag: isBookmarkletArg ? '[JS]' : undefined,
      faviconUrl: !isBookmarkletArg && targetUrl ? getFaviconUrl(targetUrl) : '',
      fillText: hasSpace ? trimmedStart : ':add ',
      executeValue: restTrimmed ? `:add ${restTrimmed}` : ':add',
      previewMeta: {
        mode,
        nickname: normalizeNicknamePath(nicknameInput),
        targetUrl,
        targetTitle
      }
    });

    appendRegisterCompletions(':add', restParts);
  }

  // :addall / :aa コマンド
  if (isCmdMatch([':addall', ':aa'])) {
    const restParts = restTrimmed ? restTrimmed.split(/\s+/) : [];
    items.push({
      id: 'cmd:addall:exec',
      kind: 'command',
      title: restTrimmed ? `:addall ${restTrimmed}` : `:addall [${t('nicknameLabel') || 'ニックネーム'}]`,
      subtitle: t('popupCommandAddallHint') || '現在のウィンドウの全タブを一括登録',
      badge: ':addall',
      fillText: hasSpace ? trimmedStart : ':addall ',
      executeValue: restTrimmed ? `:addall ${restTrimmed}` : ':addall'
    });
    appendRegisterCompletions(':addall', restParts);
  }

  // 単体遷移系コマンド
  if (isCmdMatch([':ls'])) {
    items.push({
      id: 'cmd:ls',
      kind: 'command',
      title: ':ls',
      subtitle: t('popupCommandLsHint') || 'ブックマーク一覧・管理画面を開く',
      badge: ':ls',
      fillText: ':ls',
      executeValue: ':ls'
    });
  }
  if (isCmdMatch([':prefs'])) {
    items.push({
      id: 'cmd:prefs',
      kind: 'command',
      title: ':prefs',
      subtitle: t('popupCommandPrefsHint') || '設定・言語画面を開く',
      badge: ':prefs',
      fillText: ':prefs',
      executeValue: ':prefs'
    });
  }
  if (isCmdMatch([':help'])) {
    items.push({
      id: 'cmd:help',
      kind: 'command',
      title: ':help',
      subtitle: t('popupCommandHelpHint') || 'ヘルプ・ドキュメントを開く',
      badge: ':help',
      fillText: ':help',
      executeValue: ':help'
    });
  }

  // :rm コマンド
  if (isCmdMatch([':rm'])) {
    if (!restTrimmed) {
      items.push({
        id: 'cmd:rm:prompt',
        kind: 'completion',
        title: ':rm [nickname]',
        subtitle: t('popupCommandRmHint') || 'ニックネームまたは特定の URL を削除',
        badge: ':rm',
        fillText: ':rm ',
        executeValue: ':rm'
      });

      if (cmd === ':rm') {
        for (const n of sortedNicknames.slice(0, 8)) {
          const { summary, faviconUrl } = summarizeNicknameForPalette(n, bookmarks);
          items.push({
            id: `cmd:rm:nick:${n}`,
            kind: 'command',
            title: n,
            subtitle: summary,
            badge: ':rm',
            faviconUrl,
            fillText: `:rm ${n}`,
            executeValue: `:rm ${n}`
          });
        }
      }
    } else {
      const nicknameParts = restTrimmed.split(/\s+/);
      const nicknameInput = nicknameParts[0];
      const normNickInput = normalizeNicknamePath(nicknameInput);
      const urlInput = nicknameParts.slice(1).join(' ').trim();
      const lowerNickInput = nicknameInput.toLowerCase();
      const lowerNormNickInput = normNickInput.toLowerCase();

      const matches = sortedNicknames.filter(n =>
        startsWithInputOrNormalized(n, lowerNickInput, lowerNormNickInput)
      );

      for (const n of matches.slice(0, 15)) {
        const entries = bookmarks[n] || [];
        const isExact =
          n.toLowerCase() === lowerNickInput ||
          (!!lowerNormNickInput && n.toLowerCase() === lowerNormNickInput);

        if (isExact && entries.length > 1) {
          if (!urlInput) {
            items.push({
              id: `cmd:rm:multi:${n}`,
              kind: 'completion',
              title: `${n} (${entries.length})`,
              subtitle: t('errorMultipleUrlsFound') || '複数の URL が見つかりました。候補の中から選択してください。',
              badge: ':rm',
              typeTag: 'WARN',
              fillText: `:rm ${n} `,
              executeValue: `:rm ${n}`
            });
          }

          entries.forEach((entry, idx) => {
            if (!urlInput || entry.url.toLowerCase().includes(urlInput.toLowerCase())) {
              const isBml = isBookmarkletUrl(entry.url);
              items.push({
                id: `cmd:rm:url:${n}:${idx}`,
                kind: 'command',
                title: entry.title || n,
                subtitle: formatUrlForDisplay(entry.url),
                badge: `:rm ${n}`,
                typeTag: isBml ? '[JS]' : undefined,
                faviconUrl: isBml ? '' : getFaviconUrl(entry.url),
                fillText: `:rm ${n} ${entry.url}`,
                executeValue: `:rm ${n} ${entry.url}`
              });
            }
          });
        } else {
          const { summary, faviconUrl } = summarizeNicknameForPalette(n, bookmarks);
          items.push({
            id: `cmd:rm:nick:${n}`,
            kind: 'command',
            title: n,
            subtitle: summary,
            badge: ':rm',
            faviconUrl,
            fillText: `:rm ${n}`,
            executeValue: `:rm ${n}`
          });
        }
      }
    }
  }

  return items;
}

/**
 * コマンドパレットの入力文字列を解析し、表示する候補リストを構築します。
 * 入力が空の場合は仕様に従い空配列を返します。
 * @param rawQuery - 検索欄の入力文字列
 * @param bookmarks - 現在のブックマークデータ
 * @param currentTab - 登録プレビュー等に使用する現在アクティブタブ情報（任意）
 * @returns パレットに表示する候補アイテムの配列
 */
export function buildPaletteSuggestions(
  rawQuery: string,
  bookmarks: Record<string, BookmarkEntry[]>,
  currentTab?: { url?: string; title?: string }
): PaletteItem[] {
  const clean = stripZeroWidthChars(rawQuery);
  if (!clean.trim()) return [];
  if (clean.trimStart().startsWith(':')) {
    return buildCommandPaletteItems(clean, bookmarks, currentTab);
  }
  return buildRegularPaletteItems(clean, bookmarks);
}

/**
 * 指定された URL がすでに登録されているブックマークのニックネーム一覧を取得します。
 * パーセントエンコードや末尾スラッシュ・スキーム／ホストの大文字小文字差異を吸収して判定し、
 * ブックマークレット（`javascript:`）エントリは除外します。
 * @param targetUrl - 判定対象の URL 文字列
 * @param bookmarks - 現在のブックマーク辞書
 * @returns 該当 URL が登録されているニックネームの配列（優先度順）
 */
export function findNicknamesForUrl(
  targetUrl: string,
  bookmarks: Record<string, BookmarkEntry[]>
): string[] {
  if (!targetUrl || isBookmarkletUrl(targetUrl)) return [];
  const trimmedUrl = targetUrl.trim();
  if (!trimmedUrl) return [];

  const normTargetUrl = normalizeUrlForComparison(trimmedUrl);
  const sortedNicknames = getSortedNicknames(bookmarks);
  const matched: string[] = [];

  for (const nickname of sortedNicknames) {
    const entries = bookmarks[nickname] || [];
    const hasMatch = entries.some(entry => {
      if (!entry.url || isBookmarkletUrl(entry.url)) return false;
      return (
        isSameUrl(entry.url, trimmedUrl) ||
        (normTargetUrl.length > 0 && normalizeUrlForComparison(entry.url) === normTargetUrl)
      );
    });
    if (hasMatch) {
      matched.push(nickname);
    }
  }

  return matched;
}
