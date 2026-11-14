import {
  AddPreviewMeta,
  BookmarkEntry,
  PaletteItem,
  ResolvedSearchMatch,
  SuggestedMatchTarget
} from './types';
import {
  escapeXml,
  expandDynamicUrl,
  formatUrlForOmniboxDisplay,
  getFaviconUrl,
  isBookmarkletUrl,
  isDynamicUrl,
  normalizeNicknamePath,
  resolveFallbackUrl
} from './url';
import { extractFolders } from './storage';
import { t } from '../i18n';

// オムニボックス候補の一意化およびエントリ識別に使用する不可視文字（ゼロ幅文字）
const ZW_BIT_ZERO = '\u200B';
const ZW_BIT_ONE = '\u200C';
const ZERO_WIDTH_ALL_REGEX = /[\u200B-\u200D\uFEFF]/g;
const TRAILING_ZW_MARKER_REGEX = /^([^\u200B-\u200D\uFEFF]+)([\u200B\u200C]+)$/;

/**
 * 文字列に含まれるゼロ幅文字（不可視マーカー）をすべて除去します。
 * @param text - 対象の文字列
 * @returns ゼロ幅文字を除去したクリーンな文字列
 */
export function stripZeroWidthChars(text: string): string {
  if (!text) return '';
  return text.replace(ZERO_WIDTH_ALL_REGEX, '');
}

/**
 * 非負整数インデックスをゼロ幅文字（`\u200B` と `\u200C`）の2進数ビット列にエンコードします。
 * アドレスバー上の見た目をニックネームのまま維持しつつ、Chrome の重複候補フィルタリングを回避し、
 * 同一ニックネーム内の複数 URL エントリを一意に識別するために使用します。
 * @param index - エンコード対象の非負整数インデックス
 * @returns ゼロ幅文字のみで構成された識別マーカー文字列
 */
export function encodeZeroWidthIndex(index: number): string {
  const safeIndex = Math.max(0, Math.floor(index));
  return safeIndex
    .toString(2)
    .split('')
    .map(bit => (bit === '0' ? ZW_BIT_ZERO : ZW_BIT_ONE))
    .join('');
}

/**
 * ゼロ幅文字で構成された識別マーカー文字列を元の非負整数インデックスにデコードします。
 * @param marker - `\u200B` および `\u200C` で構成されたマーカー文字列
 * @returns デコードされた非負整数インデックス。不正な形式の場合は null
 */
export function decodeZeroWidthIndex(marker: string): number | null {
  if (!marker || !/^[\u200B\u200C]+$/.test(marker)) return null;
  // 2文字以上で先頭ビットが 0 のものは正規のエンコード値ではないため除外する
  if (marker.length > 1 && marker[0] === ZW_BIT_ZERO) return null;

  const binaryStr = marker
    .split('')
    .map(ch => (ch === ZW_BIT_ZERO ? '0' : '1'))
    .join('');
  const parsed = parseInt(binaryStr, 2);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 末尾に付与されたゼロ幅文字マーカーから対象のブックマーク遷移先情報を復元します。
 * Service Worker が再起動してメモリ上のサジェストマップが失われた場合のフォールバックとして機能します。
 * @param rawText - オムニボックスから渡された生テキスト
 * @param bookmarks - 現在のブックマークデータ
 * @returns 復元された遷移先情報。マーカーが存在しない、または該当エントリがない場合は null
 */
export function resolveMatchFromZeroWidthMarker(
  rawText: string,
  bookmarks: Record<string, BookmarkEntry[]>
): SuggestedMatchTarget | null {
  const markerMatch = rawText.match(TRAILING_ZW_MARKER_REGEX);
  if (!markerMatch) return null;

  const visibleText = markerMatch[1].trim();
  const entryIndex = decodeZeroWidthIndex(markerMatch[2]);
  if (entryIndex === null || entryIndex < 0) return null;

  // 表示文字列全体がニックネームとして存在する場合
  if (bookmarks[visibleText] && bookmarks[visibleText][entryIndex]) {
    const entry = bookmarks[visibleText][entryIndex];
    const resolvedUrl = isDynamicUrl(entry.url) ? resolveFallbackUrl(entry) : entry.url;
    return {
      nickname: visibleText,
      resolvedUrl,
      templateUrl: entry.url
    };
  }

  // 「ニックネーム 動的URL引数」の形式である場合
  const firstSpaceMatch = visibleText.match(/\s+/);
  if (firstSpaceMatch && firstSpaceMatch.index !== undefined) {
    const firstToken = visibleText.slice(0, firstSpaceMatch.index);
    const restArg = visibleText.slice(firstSpaceMatch.index + firstSpaceMatch[0].length).trim();
    if (bookmarks[firstToken] && bookmarks[firstToken][entryIndex]) {
      const entry = bookmarks[firstToken][entryIndex];
      const resolvedUrl =
        isDynamicUrl(entry.url) && restArg
          ? expandDynamicUrl(entry.url, restArg)
          : isDynamicUrl(entry.url)
            ? resolveFallbackUrl(entry)
            : entry.url;
      return {
        nickname: firstToken,
        resolvedUrl,
        templateUrl: entry.url
      };
    }
  }

  return null;
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
 * @param text - オムニボックスに入力された検索文字列
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

/**
 * コマンド入力文字列を解析し、マッチするコマンド候補のリストを返します。
 * @param text - 入力されたコマンド文字列（例: ":add mynick"）
 * @param bookmarks - 現在のブックマークデータ
 * @returns マッチしたコマンド候補の配列
 */
export function resolveCommandMatches(
  text: string,
  bookmarks: Record<string, BookmarkEntry[]>
): { content: string; description: string }[] {
  const firstSpaceIndex = text.indexOf(' ');
  const hasSpace = firstSpaceIndex !== -1;
  const cmd = !hasSpace ? text : text.substring(0, firstSpaceIndex);
  const restTrimmed = (!hasSpace ? '' : text.substring(firstSpaceIndex + 1)).trim();
  const rawRest = !hasSpace ? '' : text.substring(firstSpaceIndex + 1);

  const commandMatches: { content: string; description: string }[] = [];
  const sortedNicknames = getSortedNicknames(bookmarks);

  const isCmdMatch = (targetCmds: string[]): boolean =>
    hasSpace ? targetCmds.includes(cmd) : targetCmds.some(target => target.startsWith(cmd));

  const getNicknameSummary = (n: string): string => {
    const entries = bookmarks[n] || [];
    const escapedN = escapeXml(n);
    if (entries.length === 1) {
      const title = escapeXml(entries[0].title) || 'No title';
      const url = escapeXml(formatUrlForOmniboxDisplay(entries[0].url));
      return `<match>${escapedN}</match> ${title} - <url>${url}</url>`;
    }
    if (entries.length > 1) {
      return `<match>${escapedN}</match> - Multiple URLs (${entries.length})`;
    }
    return `<match>${escapedN}</match>`;
  };

  /**
   * 登録系コマンド（:add / :addall）向けに既存ニックネーム補完候補を2行目以降に追加します。
   * @param canonicalCmd - 展開するコマンド名（':add' または ':addall'）
   * @param restParts - スペース分割済みの引数配列
   */
  const appendRegisterNicknameCandidates = (canonicalCmd: string, restParts: string[]): void => {
    if (!hasSpace || restParts.length > 1) return;
    const nicknameInput = restParts[0] || '';
    const normNickInput = normalizeNicknamePath(nicknameInput);
    const lowerNickInput = nicknameInput.toLowerCase();
    const lowerNormNickInput = normNickInput.toLowerCase();

    const nickCandidates = nicknameInput
      ? sortedNicknames.filter(
          n =>
            startsWithInputOrNormalized(n, lowerNickInput, lowerNormNickInput) &&
            n !== nicknameInput &&
            (!normNickInput || n !== normNickInput)
        )
      : sortedNicknames;

    for (const n of nickCandidates.slice(0, 8)) {
      commandMatches.push({
        content: `${canonicalCmd} ${n}`,
        description: `<match>${canonicalCmd}</match> ${getNicknameSummary(n)}`
      });
    }
  };

  // :add / :a コマンド
  if (isCmdMatch([':add', ':a'])) {
    const restParts = restTrimmed ? restTrimmed.split(/\s+/) : [];
    const isBookmarkletArg = restParts.length >= 2 && isBookmarkletUrl(restParts[1]);
    const isDirectUrl = restParts.length >= 2 && /^https?:\/\/\S+$/i.test(restParts[1]);
    const modeHint = isBookmarkletArg
      ? 'Add bookmarklet'
      : isDirectUrl
        ? 'Add custom URL'
        : 'Add current tab (or [nickname] [https://... | javascript:...] [title])';

    commandMatches.push({
      content: ':add ' + restTrimmed,
      description: `<match>:add</match> ${escapeXml(rawRest) || '[nickname] [url(optional)] [title(optional)]'} - ${modeHint}`
    });
    appendRegisterNicknameCandidates(':add', restParts);
  }

  // :addall / :aa コマンド
  if (isCmdMatch([':addall', ':aa'])) {
    const restParts = restTrimmed ? restTrimmed.split(/\s+/) : [];
    commandMatches.push({
      content: ':addall ' + restTrimmed,
      description: `<match>:addall</match> ${escapeXml(rawRest) || '[nickname]'} - Add all tabs in current window`
    });
    appendRegisterNicknameCandidates(':addall', restParts);
  }

  // 単体遷移系コマンド
  if (isCmdMatch([':ls'])) {
    commandMatches.push({ content: ':ls', description: '<match>:ls</match> - Open Options / Manage Nickmarks' });
  }
  if (isCmdMatch([':prefs'])) {
    commandMatches.push({ content: ':prefs', description: '<match>:prefs</match> - Open Preferences / Language Settings' });
  }
  if (isCmdMatch([':help'])) {
    commandMatches.push({ content: ':help', description: '<match>:help</match> - Open Help / Documentation' });
  }

  // :open / :o コマンド
  if (isCmdMatch([':open', ':o'])) {
    const folders = extractFolders(bookmarks);
    if (!restTrimmed) {
      commandMatches.push({
        content: ':open ',
        description: '<match>:open</match> [nickname or folder/] - Open all URLs in new tabs'
      });
      if (cmd === ':open' || cmd === ':o') {
        for (const f of Array.from(folders.values()).slice(0, 4)) {
          if (f.openableUrlCount > 0) {
            commandMatches.push({
              content: `:open ${f.path}/`,
              description: `<match>:open</match> 📁 ${escapeXml(f.path)}/ <dim>(${f.openableUrlCount} tabs)</dim>`
            });
          }
        }
        for (const n of sortedNicknames.slice(0, 6)) {
          commandMatches.push({
            content: `:open ${n}`,
            description: `<match>:open</match> ${getNicknameSummary(n)}`
          });
        }
      }
    } else {
      const lowerInput = restTrimmed.toLowerCase();
      const lowerNormInput = normalizeNicknamePath(restTrimmed).toLowerCase();

      for (const f of folders.values()) {
        const matchesFolder =
          startsWithInputOrNormalized(f.path, lowerInput, lowerNormInput) ||
          startsWithInputOrNormalized(`${f.path}/`, lowerInput, lowerNormInput);

        if (f.openableUrlCount > 0 && matchesFolder) {
          commandMatches.push({
            content: `:open ${f.path}/`,
            description: `<match>:open</match> 📁 ${escapeXml(f.path)}/ <dim>(${f.openableUrlCount} tabs)</dim>`
          });
        }
      }

      const matches = sortedNicknames.filter(n =>
        startsWithInputOrNormalized(n, lowerInput, lowerNormInput)
      );
      for (const n of matches) {
        commandMatches.push({
          content: `:open ${n}`,
          description: `<match>:open</match> ${getNicknameSummary(n)}`
        });
      }
      if (commandMatches.length === 0) {
        commandMatches.push({
          content: text,
          description: `<match>:open</match> No nicknames or folders match "${escapeXml(restTrimmed)}"`
        });
      }
    }
  }

  // :rm コマンド
  if (isCmdMatch([':rm'])) {
    if (!restTrimmed) {
      commandMatches.push({
        content: ':rm ',
        description: '<match>:rm</match> [nickname] - Remove Nickmark'
      });
      if (cmd === ':rm') {
        for (const n of sortedNicknames.slice(0, 8)) {
          commandMatches.push({
            content: `:rm ${n}`,
            description: `<match>:rm</match> ${getNicknameSummary(n)}`
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

      if (matches.length === 0) {
        commandMatches.push({
          content: text,
          description: `<match>:rm</match> No nicknames match "${escapeXml(restTrimmed)}"`
        });
      } else {
        for (const n of matches) {
          const entries = bookmarks[n];
          const isExact =
            n.toLowerCase() === lowerNickInput ||
            (!!lowerNormNickInput && n.toLowerCase() === lowerNormNickInput);

          if (isExact && entries.length > 1) {
            if (!urlInput) {
              const msg = t('errorMultipleUrlsFound') || 'Multiple URLs found. Select one below or Enter to manage.';
              commandMatches.push({
                content: `:rm ${n}`,
                description: `⚠️ <match>${escapeXml(n)}</match> - ${msg}`
              });
            }

            for (const entry of entries) {
              if (!urlInput || entry.url.toLowerCase().includes(urlInput.toLowerCase())) {
                const title = escapeXml(entry.title) || 'No title';
                const url = escapeXml(formatUrlForOmniboxDisplay(entry.url));
                commandMatches.push({
                  content: `:rm ${n} ${entry.url}`,
                  description: `<match>:rm ${escapeXml(n)}</match> ${title} - <url>${url}</url>`
                });
              }
            }
          } else {
            commandMatches.push({
              content: `:rm ${n}`,
              description: `<match>:rm</match> ${getNicknameSummary(n)}`
            });
          }
        }
      }
    }
  }

  return commandMatches;
}

/**
 * 検索マッチ結果からオムニボックス表示用の説明文（XML）を生成します。
 * @param match - 検索マッチ結果
 * @returns XML エスケープ済みのサジェスト説明文
 */
export function formatSearchMatchDescription(match: ResolvedSearchMatch): string {
  const mTitle = escapeXml(match.entry.title) || 'No title';
  const isBookmarklet = isBookmarkletUrl(match.resolvedUrl);
  const mUrl = escapeXml(formatUrlForOmniboxDisplay(match.resolvedUrl));
  const typeBadge = isBookmarklet
    ? ' <dim>[JS]</dim>'
    : match.isDynamic
      ? match.dynamicArg
        ? ` <dim>(${escapeXml(match.dynamicArg)})</dim>`
        : ' <dim>[%s]</dim>'
      : '';
  return `<match>${escapeXml(match.nickname)}</match>${typeBadge}: ${mTitle} - <url>${mUrl}</url>`;
}

/**
 * 通常検索のマッチ結果リストから、オムニボックスに渡すサジェスト候補配列と遷移先解決マップを構築します。
 * 同一ニックネーム内の複数 URL エントリ等を一意に識別するため、必要時に不可視のゼロ幅文字マーカーを付与します。
 * @param rawText - オムニボックスの現在の生入力テキスト
 * @param allMatches - ソート済みの検索マッチ結果配列
 * @param bookmarks - 現在のブックマークデータ
 * @returns サジェスト候補配列と content 文字列から遷移先への対応マップ
 */
export function buildRegularSearchSuggestions(
  rawText: string,
  allMatches: ResolvedSearchMatch[],
  bookmarks: Record<string, BookmarkEntry[]>
): {
  suggestions: chrome.omnibox.SuggestResult[];
  matchMap: Map<string, SuggestedMatchTarget>;
} {
  const suggestions: chrome.omnibox.SuggestResult[] = [];
  const matchMap = new Map<string, SuggestedMatchTarget>();
  const usedContents = new Set<string>();
  const defaultTopCache = new Map<string, ResolvedSearchMatch | null>();

  const topMatches = allMatches.slice(0, 10);

  for (let i = 0; i < topMatches.length; i++) {
    const match = topMatches[i];
    const baseContent =
      match.isDynamic && match.dynamicArg
        ? `${match.nickname} ${match.dynamicArg}`
        : match.nickname;

    if (!defaultTopCache.has(baseContent)) {
      const resolved = resolveRegularSearchMatches(baseContent, bookmarks);
      defaultTopCache.set(baseContent, resolved.length > 0 ? resolved[0] : null);
    }
    const defaultTop = defaultTopCache.get(baseContent) || null;

    const resolvesToSameEntry =
      !!defaultTop &&
      defaultTop.nickname === match.nickname &&
      defaultTop.entry.url === match.entry.url &&
      defaultTop.resolvedUrl === match.resolvedUrl;

    const conflictsWithRawInput = allMatches.length > 1 && baseContent === rawText;
    const canUsePlainContent =
      !usedContents.has(baseContent) &&
      !conflictsWithRawInput &&
      resolvesToSameEntry;

    let finalContent: string;
    if (canUsePlainContent) {
      finalContent = baseContent;
    } else {
      const entriesForNick = bookmarks[match.nickname] || [];
      const entryIndex = entriesForNick.indexOf(match.entry);
      const markerSeed = entryIndex >= 0 ? entryIndex : i;
      finalContent = baseContent + encodeZeroWidthIndex(markerSeed);

      let fallbackSeed = entriesForNick.length + i + 1;
      while (usedContents.has(finalContent) || (allMatches.length > 1 && finalContent === rawText)) {
        finalContent = baseContent + encodeZeroWidthIndex(fallbackSeed++);
      }
    }

    usedContents.add(finalContent);
    matchMap.set(finalContent, {
      nickname: match.nickname,
      resolvedUrl: match.resolvedUrl,
      templateUrl: match.entry.url
    });

    suggestions.push({
      content: finalContent,
      description: formatSearchMatchDescription(match)
    });
  }

  return { suggestions, matchMap };
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
  const matchedFolder = normQuery ? folders.get(normQuery) : undefined;

  const items: PaletteItem[] = [];

  // 末尾スラッシュ明示時は対象フォルダ一括オープン候補を最上位に配置する
  if (isExplicitFolderInput && matchedFolder && matchedFolder.openableUrlCount > 0) {
    items.push({
      id: `folder:${matchedFolder.path}`,
      kind: 'folder',
      title:
        t('openAllInFolder', [matchedFolder.path, String(matchedFolder.openableUrlCount)]) ||
        `📁 フォルダ「${matchedFolder.path}」の全ブックマークを一括オープン (${matchedFolder.openableUrlCount}タブ)`,
      subtitle: `${matchedFolder.path}/`,
      badge: `${matchedFolder.path}/`,
      typeTag: `📁 ${matchedFolder.openableUrlCount}`,
      fillText: `${matchedFolder.path}/`,
      executeValue: `${matchedFolder.path}/`,
      folderPath: matchedFolder.path
    });
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
      subtitle: formatUrlForOmniboxDisplay(match.resolvedUrl),
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

  // 末尾スラッシュでない場合でも一致するフォルダがあればサジェスト内に一括オープン候補を追加する
  if (!isExplicitFolderInput && normQuery) {
    const lowerNorm = normQuery.toLowerCase();
    const matchedFolders = Array.from(folders.values()).filter(
      folder =>
        folder.openableUrlCount > 0 &&
        (folder.path.toLowerCase() === lowerNorm || folder.path.toLowerCase().startsWith(lowerNorm))
    );

    if (matchedFolders.length > 0) {
      const topFolder = matchedFolders[0];
      const folderItem: PaletteItem = {
        id: `folder:${topFolder.path}`,
        kind: 'folder',
        title:
          t('openFolderSummary', [topFolder.path, String(topFolder.openableUrlCount)]) ||
          `📁 ${topFolder.path} (${topFolder.openableUrlCount}タブを一括オープン)`,
        subtitle: `${topFolder.path}/`,
        badge: `${topFolder.path}/`,
        typeTag: `📁 ${topFolder.openableUrlCount}`,
        fillText: `${topFolder.path}/`,
        executeValue: `${topFolder.path}/`,
        folderPath: topFolder.path
      };

      // 同名の単体ニックネーム完全一致がない場合は最上位、ある場合はその直下に配置する
      const hasExactSingleMatch = allMatches.length > 0 && allMatches[0].tier === 1;
      if (hasExactSingleMatch) {
        items.splice(1, 0, folderItem);
      } else {
        items.unshift(folderItem);
      }
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
    const url = formatUrlForOmniboxDisplay(entry.url);
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
  const folders = extractFolders(bookmarks);

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
        ? `${targetTitle} — ${formatUrlForOmniboxDisplay(targetUrl)}`
        : formatUrlForOmniboxDisplay(targetUrl)
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

  // :open / :o コマンド
  if (isCmdMatch([':open', ':o'])) {
    if (!restTrimmed) {
      items.push({
        id: 'cmd:open:prompt',
        kind: 'completion',
        title: ':open [nickname or folder/]',
        subtitle: t('popupCommandOpenHint') || 'ニックネームまたはフォルダを一括オープン',
        badge: ':open',
        fillText: ':open ',
        executeValue: ':open'
      });

      if (cmd === ':open' || cmd === ':o') {
        for (const f of Array.from(folders.values()).slice(0, 4)) {
          if (f.openableUrlCount > 0) {
            items.push({
              id: `cmd:open:folder:${f.path}`,
              kind: 'command',
              title: `📁 ${f.path}/`,
              subtitle:
                t('openFolderSummary', [f.path, String(f.openableUrlCount)]) ||
                `📁 ${f.path} (${f.openableUrlCount}タブを一括オープン)`,
              badge: ':open',
              typeTag: `📁 ${f.openableUrlCount}`,
              fillText: `:open ${f.path}/`,
              executeValue: `:open ${f.path}/`
            });
          }
        }
        for (const n of sortedNicknames.slice(0, 6)) {
          const { summary, faviconUrl } = summarizeNicknameForPalette(n, bookmarks);
          items.push({
            id: `cmd:open:nick:${n}`,
            kind: 'command',
            title: n,
            subtitle: summary,
            badge: ':open',
            faviconUrl,
            fillText: `:open ${n}`,
            executeValue: `:open ${n}`
          });
        }
      }
    } else {
      const lowerInput = restTrimmed.toLowerCase();
      const lowerNormInput = normalizeNicknamePath(restTrimmed).toLowerCase();

      for (const f of folders.values()) {
        const matchesFolder =
          startsWithInputOrNormalized(f.path, lowerInput, lowerNormInput) ||
          startsWithInputOrNormalized(`${f.path}/`, lowerInput, lowerNormInput);

        if (f.openableUrlCount > 0 && matchesFolder) {
          items.push({
            id: `cmd:open:folder:${f.path}`,
            kind: 'command',
            title: `📁 ${f.path}/`,
            subtitle:
              t('openFolderSummary', [f.path, String(f.openableUrlCount)]) ||
              `📁 ${f.path} (${f.openableUrlCount}タブを一括オープン)`,
            badge: ':open',
            typeTag: `📁 ${f.openableUrlCount}`,
            fillText: `:open ${f.path}/`,
            executeValue: `:open ${f.path}/`
          });
        }
      }

      const matches = sortedNicknames.filter(n =>
        startsWithInputOrNormalized(n, lowerInput, lowerNormInput)
      );
      for (const n of matches.slice(0, 15)) {
        const { summary, faviconUrl } = summarizeNicknameForPalette(n, bookmarks);
        items.push({
          id: `cmd:open:nick:${n}`,
          kind: 'command',
          title: n,
          subtitle: summary,
          badge: ':open',
          faviconUrl,
          fillText: `:open ${n}`,
          executeValue: `:open ${n}`
        });
      }
    }
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
                subtitle: formatUrlForOmniboxDisplay(entry.url),
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
