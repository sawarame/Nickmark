import { getCurrentLocale, Locale, t } from '../i18n';
import { BookmarkEntry, PresetDefinition, PresetId } from './types';
import { isSameUrl, normalizeUrlForComparison } from './url';

/**
 * Markdown リンクコピー（`mdlink`）用のブックマークレットコード
 * 現在のページの `[タイトル](URL)` をクリップボードへコピーし、画面上部に控えめな完了通知を表示します。
 * ページ側でのコピーに失敗した場合は戻り値を検証し、失敗時の誤通知を防ぎます。
 */
const MDLINK_BOOKMARKLET_URL =
  "javascript:(()=>{const t=(document.title||location.href).replace(/([\\[\\]])/g,'\\\\$1');const m=`[${t}](${location.href})`;const notify=(msg,err)=>{const id='nickmark-mdlink-toast';const old=document.getElementById(id);if(old)old.remove();const el=document.createElement('div');el.id=id;el.textContent=msg;Object.assign(el.style,{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',backgroundColor:err?'#7f1d1d':'#1e293b',color:'#f8fafc',padding:'10px 18px',borderRadius:'8px',fontSize:'13px',zIndex:'2147483647',boxShadow:'0 10px 15px -3px rgba(0,0,0,0.4)',border:err?'1px solid #ef4444':'1px solid #334155',maxWidth:'80vw',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'});const root=document.body||document.documentElement;if(root){root.appendChild(el);setTimeout(()=>el.remove(),2600);}};const fallback=()=>{const a=document.createElement('textarea');a.value=m;a.setAttribute('readonly','');a.style.position='fixed';a.style.opacity='0';const root=document.body||document.documentElement;if(!root){return;}root.appendChild(a);a.focus({preventScroll:true});a.select();let ok=false;try{ok=document.execCommand('copy');}catch{ok=false;}a.remove();if(ok){notify('Copied: '+m,false);}else{notify('Copy failed. Please run mdlink from the Nickmark popup.',true);}};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(m).then(()=>notify('Copied: '+m,false)).catch(fallback);}else{fallback();}})();";

/**
 * HTML リンクコピー（`htmllink`）用のブックマークレットコード
 * 現在のページの `<a href="URL">タイトル</a>` を `text/html` と `text/plain` のマルチ MIME でクリップボードへコピーし、
 * 画面上部に控えめな完了通知を表示します。
 */
const HTMLLINK_BOOKMARKLET_URL =
  "javascript:(()=>{const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');const t=esc(document.title||location.href);const u=esc(location.href);const h=`<a href=\"${u}\">${t}</a>`;const notify=(msg,err)=>{const id='nickmark-htmllink-toast';const old=document.getElementById(id);if(old)old.remove();const el=document.createElement('div');el.id=id;el.textContent=msg;Object.assign(el.style,{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',backgroundColor:err?'#7f1d1d':'#1e293b',color:'#f8fafc',padding:'10px 18px',borderRadius:'8px',fontSize:'13px',zIndex:'2147483647',boxShadow:'0 10px 15px -3px rgba(0,0,0,0.4)',border:err?'1px solid #ef4444':'1px solid #334155',maxWidth:'80vw',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'});const root=document.body||document.documentElement;if(root){root.appendChild(el);setTimeout(()=>el.remove(),2600);}};const fallback=()=>{const onCopy=e=>{e.preventDefault();if(e.clipboardData){e.clipboardData.setData('text/html',h);e.clipboardData.setData('text/plain',h);}};const a=document.createElement('textarea');a.value=h;a.setAttribute('readonly','');a.style.position='fixed';a.style.opacity='0';const root=document.body||document.documentElement;if(!root){return;}root.appendChild(a);a.focus({preventScroll:true});a.select();document.addEventListener('copy',onCopy,true);let ok=false;try{ok=document.execCommand('copy');}catch{ok=false;}finally{document.removeEventListener('copy',onCopy,true);a.remove();}if(ok){notify('Copied: '+h,false);}else{notify('Copy failed. Please run htmllink from the Nickmark popup.',true);}};if(navigator.clipboard&&navigator.clipboard.write&&typeof ClipboardItem!=='undefined'){const item=new ClipboardItem({'text/html':new Blob([h],{type:'text/html'}),'text/plain':new Blob([h],{type:'text/plain'})});navigator.clipboard.write([item]).then(()=>notify('Copied: '+h,false)).catch(fallback);}else{fallback();}})();";

/**
 * Wayback Machine 表示（`wayback`）用のブックマークレットコード
 * 現在のページの URL を Internet Archive Wayback Machine で開きます。
 */
const WAYBACK_BOOKMARKLET_URL =
  "javascript:(()=>{location.href='https://web.archive.org/web/*/'+location.href;})();";

/**
 * 標準収録される全 18 件のプリセット定義カタログ（動的 URL 15 件、ブックマークレット 3 件）
 */
export const PRESET_DEFINITIONS: readonly PresetDefinition[] = [
  {
    id: 'g',
    nickname: 'g',
    category: 'dynamic_url',
    titleKey: 'presetTitleGoogle',
    defaultUrl: 'https://www.google.com/search?q=%s'
  },
  {
    id: 'b',
    nickname: 'b',
    category: 'dynamic_url',
    titleKey: 'presetTitleBing',
    defaultUrl: 'https://www.bing.com/search?q=%s'
  },
  {
    id: 'y',
    nickname: 'y',
    category: 'dynamic_url',
    titleKey: 'presetTitleYahoo',
    defaultUrl: 'https://search.yahoo.com/search?p=%s',
    localeUrls: {
      ja: 'https://search.yahoo.co.jp/search?p=%s'
    }
  },
  {
    id: 'nv',
    nickname: 'nv',
    category: 'dynamic_url',
    titleKey: 'presetTitleNaver',
    defaultUrl: 'https://search.naver.com/search.naver?query=%s'
  },
  {
    id: 'bd',
    nickname: 'bd',
    category: 'dynamic_url',
    titleKey: 'presetTitleBaidu',
    defaultUrl: 'https://www.baidu.com/s?wd=%s'
  },
  {
    id: 'ddg',
    nickname: 'ddg',
    category: 'dynamic_url',
    titleKey: 'presetTitleDuckduckgo',
    defaultUrl: 'https://duckduckgo.com/?q=%s'
  },
  {
    id: 'yt',
    nickname: 'yt',
    category: 'dynamic_url',
    titleKey: 'presetTitleYoutube',
    defaultUrl: 'https://www.youtube.com/results?search_query=%s'
  },
  {
    id: 'gh',
    nickname: 'gh',
    category: 'dynamic_url',
    titleKey: 'presetTitleGithub',
    defaultUrl: 'https://github.com/search?q=%s'
  },
  {
    id: 'map',
    nickname: 'map',
    category: 'dynamic_url',
    titleKey: 'presetTitleMaps',
    defaultUrl: 'https://www.google.com/maps/search/%s'
  },
  {
    id: 'tr',
    nickname: 'tr',
    category: 'dynamic_url',
    titleKey: 'presetTitleTranslate',
    defaultUrl: 'https://translate.google.com/?text=%s'
  },
  {
    id: 'wiki',
    nickname: 'wiki',
    category: 'dynamic_url',
    titleKey: 'presetTitleWikipedia',
    defaultUrl: 'https://en.wikipedia.org/w/index.php?search=%s',
    localeUrls: {
      ja: 'https://ja.wikipedia.org/w/index.php?search=%s',
      en: 'https://en.wikipedia.org/w/index.php?search=%s',
      zh_CN: 'https://zh.wikipedia.org/w/index.php?search=%s',
      zh_TW: 'https://zh.wikipedia.org/w/index.php?search=%s',
      ko: 'https://ko.wikipedia.org/w/index.php?search=%s'
    }
  },
  {
    id: 'amz',
    nickname: 'amz',
    category: 'dynamic_url',
    titleKey: 'presetTitleAmazon',
    defaultUrl: 'https://www.amazon.co.jp/s?k=%s'
  },
  {
    id: 'x',
    nickname: 'x',
    category: 'dynamic_url',
    titleKey: 'presetTitleX',
    defaultUrl: 'https://x.com/search?q=%s'
  },
  {
    id: 'npm',
    nickname: 'npm',
    category: 'dynamic_url',
    titleKey: 'presetTitleNpm',
    defaultUrl: 'https://www.npmjs.com/search?q=%s'
  },
  {
    id: 'mdn',
    nickname: 'mdn',
    category: 'dynamic_url',
    titleKey: 'presetTitleMdn',
    defaultUrl: 'https://developer.mozilla.org/search?q=%s'
  },
  {
    id: 'mdlink',
    nickname: 'mdlink',
    category: 'bookmarklet',
    titleKey: 'presetTitleMdlink',
    descriptionKey: 'presetDescMdlink',
    defaultUrl: MDLINK_BOOKMARKLET_URL
  },
  {
    id: 'htmllink',
    nickname: 'htmllink',
    category: 'bookmarklet',
    titleKey: 'presetTitleHtmllink',
    descriptionKey: 'presetDescHtmllink',
    defaultUrl: HTMLLINK_BOOKMARKLET_URL
  },
  {
    id: 'wayback',
    nickname: 'wayback',
    category: 'bookmarklet',
    titleKey: 'presetTitleWayback',
    descriptionKey: 'presetDescWayback',
    defaultUrl: WAYBACK_BOOKMARKLET_URL
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
  return preset.localeUrls?.[activeLocale] ?? preset.defaultUrl;
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

/**
 * 指定された URL 文字列が標準プリセット `mdlink` のブックマークレットコードと一致するかを判定します。
 * @param url - 判定対象の URL またはブックマークレット文字列
 * @returns `mdlink` プリセットと一致する場合は true、それ以外は false
 */
export function isPresetMdlinkUrl(url: string): boolean {
  if (!url) return false;
  return isSameUrl(url.trim(), MDLINK_BOOKMARKLET_URL);
}

/**
 * 指定された URL 文字列が標準プリセット `htmllink` のブックマークレットコードと一致するかを判定します。
 * @param url - 判定対象の URL またはブックマークレット文字列
 * @returns `htmllink` プリセットと一致する場合は true、それ以外は false
 */
export function isPresetHtmllinkUrl(url: string): boolean {
  if (!url) return false;
  return isSameUrl(url.trim(), HTMLLINK_BOOKMARKLET_URL);
}

/**
 * ページタイトルと URL から Markdown 形式のリンク文字列 `[タイトル](URL)` を生成します。
 * タイトル内の角括弧（`[` / `]`）はリンク構文の崩れを防ぐためバックスラッシュでエスケープし、
 * タイトルが空または空白のみの場合は URL 文字列をタイトルとして使用します。
 * @param title - 対象ページのタイトル（未取得時は undefined）
 * @param url - 対象ページの URL
 * @returns Markdown 形式のリンク文字列
 */
export function formatMarkdownLink(title: string | undefined, url: string): string {
  const trimmedUrl = (url || '').trim();
  const rawTitle = (title || '').trim() || trimmedUrl;
  const escapedTitle = rawTitle.replace(/([\[\]])/g, '\\$1');
  return `[${escapedTitle}](${trimmedUrl})`;
}

/**
 * HTML テキストおよび属性値向けに特殊文字（`&`, `<`, `>`, `"`, `'`）をエスケープします。
 * @param text - エスケープ対象の生文字列
 * @returns HTML エスケープ済み文字列
 */
export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ページタイトルと URL から HTML 形式のリンク文字列 `<a href="URL">タイトル</a>` を生成します。
 * URL およびタイトルに含まれる HTML 特殊文字をエスケープし、
 * タイトルが空または空白のみの場合は URL 文字列をタイトルとして使用します。
 * @param title - 対象ページのタイトル（未取得時は undefined）
 * @param url - 対象ページの URL
 * @returns HTML 形式のアンカータグ文字列
 */
export function formatHtmlLink(title: string | undefined, url: string): string {
  const trimmedUrl = (url || '').trim();
  const rawTitle = (title || '').trim() || trimmedUrl;
  return `<a href="${escapeHtml(trimmedUrl)}">${escapeHtml(rawTitle)}</a>`;
}
