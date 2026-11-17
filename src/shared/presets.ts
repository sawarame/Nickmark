import { getCurrentLocale, Locale, t } from '../i18n';
import { BookmarkEntry, PresetDefinition, PresetId } from './types';
import { isSameUrl, normalizeUrlForComparison } from './url';

/**
 * Markdown リンクコピー（`mdlink`）用のブックマークレットコード
 * 現在のページの `[タイトル](URL)` をクリップボードへコピーし、画面上部に控えめな完了通知を表示します。
 */
const MDLINK_BOOKMARKLET_URL =
  "javascript:(()=>{const t=(document.title||location.href).replace(/([\\[\\]])/g,'\\\\$1');const m=`[${t}](${location.href})`;const notify=()=>{const id='nickmark-mdlink-toast';const old=document.getElementById(id);if(old)old.remove();const el=document.createElement('div');el.id=id;el.textContent='Copied: '+m;Object.assign(el.style,{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',backgroundColor:'#1e293b',color:'#f8fafc',padding:'10px 18px',borderRadius:'8px',fontSize:'13px',zIndex:'2147483647',boxShadow:'0 10px 15px -3px rgba(0,0,0,0.4)',border:'1px solid #334155',maxWidth:'80vw',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'});document.body.appendChild(el);setTimeout(()=>el.remove(),2200);};const fallback=()=>{const a=document.createElement('textarea');a.value=m;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();notify();};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(m).then(notify).catch(fallback);}else{fallback();}})();";

/**
 * Wayback Machine 表示（`wayback`）用のブックマークレットコード
 * 現在のページの URL を Internet Archive Wayback Machine で開きます。
 */
const WAYBACK_BOOKMARKLET_URL =
  "javascript:(()=>{location.href='https://web.archive.org/web/*/'+location.href;})();";

/**
 * 標準収録される全 12 件のプリセット定義カタログ（動的 URL 10 件、ブックマークレット 2 件）
 */
export const PRESET_DEFINITIONS: readonly PresetDefinition[] = [
  {
    id: 'g',
    nickname: 'g',
    category: 'dynamic_url',
    titleKey: 'presetTitleGoogle',
    urlJa: 'https://www.google.com/search?q=%s'
  },
  {
    id: 'yt',
    nickname: 'yt',
    category: 'dynamic_url',
    titleKey: 'presetTitleYoutube',
    urlJa: 'https://www.youtube.com/results?search_query=%s'
  },
  {
    id: 'gh',
    nickname: 'gh',
    category: 'dynamic_url',
    titleKey: 'presetTitleGithub',
    urlJa: 'https://github.com/search?q=%s'
  },
  {
    id: 'map',
    nickname: 'map',
    category: 'dynamic_url',
    titleKey: 'presetTitleMaps',
    urlJa: 'https://www.google.com/maps/search/%s'
  },
  {
    id: 'tr',
    nickname: 'tr',
    category: 'dynamic_url',
    titleKey: 'presetTitleTranslate',
    urlJa: 'https://translate.google.com/?text=%s'
  },
  {
    id: 'wiki',
    nickname: 'wiki',
    category: 'dynamic_url',
    titleKey: 'presetTitleWikipedia',
    urlJa: 'https://ja.wikipedia.org/w/index.php?search=%s',
    urlEn: 'https://en.wikipedia.org/w/index.php?search=%s'
  },
  {
    id: 'amz',
    nickname: 'amz',
    category: 'dynamic_url',
    titleKey: 'presetTitleAmazon',
    urlJa: 'https://www.amazon.co.jp/s?k=%s'
  },
  {
    id: 'x',
    nickname: 'x',
    category: 'dynamic_url',
    titleKey: 'presetTitleX',
    urlJa: 'https://x.com/search?q=%s'
  },
  {
    id: 'npm',
    nickname: 'npm',
    category: 'dynamic_url',
    titleKey: 'presetTitleNpm',
    urlJa: 'https://www.npmjs.com/search?q=%s'
  },
  {
    id: 'mdn',
    nickname: 'mdn',
    category: 'dynamic_url',
    titleKey: 'presetTitleMdn',
    urlJa: 'https://developer.mozilla.org/search?q=%s'
  },
  {
    id: 'mdlink',
    nickname: 'mdlink',
    category: 'bookmarklet',
    titleKey: 'presetTitleMdlink',
    descriptionKey: 'presetDescMdlink',
    urlJa: MDLINK_BOOKMARKLET_URL
  },
  {
    id: 'wayback',
    nickname: 'wayback',
    category: 'bookmarklet',
    titleKey: 'presetTitleWayback',
    descriptionKey: 'presetDescWayback',
    urlJa: WAYBACK_BOOKMARKLET_URL
  }
];

/**
 * 定義済みプリセット ID の高速検索用セット
 */
const VALID_PRESET_ID_SET = new Set<string>(PRESET_DEFINITIONS.map(p => p.id));

/**
 * プリセット ID からプリセット定義へのマップ
 */
const PRESET_DEFINITION_MAP = new Map<PresetId, PresetDefinition>(
  PRESET_DEFINITIONS.map(p => [p.id, p])
);

/**
 * 指定された値が有効な定義済みプリセット ID であるかを判定します。
 * @param value - 判定対象の値
 * @returns 有効な PresetId の場合は true、それ以外は false
 */
export function isValidPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && VALID_PRESET_ID_SET.has(value);
}

/**
 * 任意の入力値を検証し、重複のない定義順の有効な `PresetId` 配列へ正規化します。
 * 未設定・不正型・未知の ID は安全に除外されます。
 * @param raw - ストレージや UI から渡された未検証の値
 * @returns 正規化された PresetId の配列
 */
export function normalizeEnabledPresetIds(raw: unknown): PresetId[] {
  if (!Array.isArray(raw)) return [];
  const enabledSet = new Set<PresetId>();
  for (const item of raw) {
    if (isValidPresetId(item)) {
      enabledSet.add(item);
    }
  }
  // 常にカタログ定義順で安定した配列を返す
  return PRESET_DEFINITIONS.map(p => p.id).filter(id => enabledSet.has(id));
}

/**
 * プリセット定義と現在のロケールから実際に使用する URL（または `javascript:` コード）を解決します。
 * @param preset - 対象のプリセット定義
 * @param locale - 表示言語ロケール（省略時は現在のロケール）
 * @returns 解決された URL 文字列
 */
export function resolvePresetUrl(preset: PresetDefinition, locale?: Locale): string {
  const activeLocale = locale ?? getCurrentLocale();
  if (activeLocale === 'en' && preset.urlEn) {
    return preset.urlEn;
  }
  return preset.urlJa;
}

/**
 * プリセット定義から検索合成用の仮想 `BookmarkEntry` オブジェクトを生成します。
 * スコアは常に `1.0` 固定、ピン留めは `false` とし、ユーザー登録ブックマークを常に優先させます。
 * @param preset - 対象のプリセット定義
 * @param locale - 表示言語ロケール（省略時は現在のロケール）
 * @returns 仮想 BookmarkEntry オブジェクト
 */
export function createPresetBookmarkEntry(
  preset: PresetDefinition,
  locale?: Locale
): BookmarkEntry {
  const url = resolvePresetUrl(preset, locale);
  const title = t(preset.titleKey) || preset.id;
  return {
    url,
    title,
    score: 1.0,
    last_used_at: 0,
    created_at: 0,
    is_pinned: false
  };
}

/**
 * ユーザー登録のブックマーク辞書に、有効化されているプリセットを仮想エントリとして合成した新しい辞書を返します。
 * 元の `bookmarks` オブジェクトは変更しません（非破壊）。
 * 同一ニックネームかつ同一 URL のブックマークが既にユーザー登録されている場合は重複表示を防ぐため合成をスキップします。
 * @param bookmarks - ユーザー登録のブックマーク辞書
 * @param enabledPresetIds - 有効化されているプリセット ID の配列
 * @param locale - 表示言語ロケール（省略時は現在のロケール）
 * @returns プリセットが合成された検索用ブックマーク辞書
 */
export function mergeBookmarksWithPresets(
  bookmarks: Record<string, BookmarkEntry[]>,
  enabledPresetIds: readonly string[],
  locale?: Locale
): Record<string, BookmarkEntry[]> {
  const normalizedIds = normalizeEnabledPresetIds(enabledPresetIds);
  if (normalizedIds.length === 0) {
    return bookmarks;
  }

  const activeLocale = locale ?? getCurrentLocale();
  const merged: Record<string, BookmarkEntry[]> = { ...bookmarks };

  for (const presetId of normalizedIds) {
    const preset = PRESET_DEFINITION_MAP.get(presetId);
    if (!preset) continue;

    const presetUrl = resolvePresetUrl(preset, activeLocale);
    const normPresetUrl = normalizeUrlForComparison(presetUrl);
    const existingEntries = merged[preset.nickname] || [];

    // 同一ニックネームに同一 URL が手動登録されている場合はユーザー登録側のみを表示する
    const hasDuplicate = existingEntries.some(
      entry =>
        isSameUrl(entry.url, presetUrl) ||
        (normPresetUrl.length > 0 && normalizeUrlForComparison(entry.url) === normPresetUrl)
    );
    if (hasDuplicate) continue;

    const virtualEntry = createPresetBookmarkEntry(preset, activeLocale);
    merged[preset.nickname] = [...existingEntries, virtualEntry];
  }

  return merged;
}
