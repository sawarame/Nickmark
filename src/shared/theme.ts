import { updatePrimaryPalette } from '@primeuix/themes';
import {
  DEFAULT_THEME_COLOR,
  ThemeColor,
  ThemeColorDefinition
} from './types';

/**
 * 初回描画時のちらつき（FOUC）を防止するための `localStorage` 同期キャッシュキー
 */
const THEME_COLOR_CACHE_KEY = 'nickmark:theme:color';

/**
 * PrimeVue Aura プライマリパレットで使用する 11 段階のトーンキー一覧
 */
const PRIMARY_PALETTE_SHADES = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950'
] as const;

/**
 * 選択可能な定番 6 色のテーマカラー定義カタログ
 */
export const THEME_COLOR_DEFINITIONS: readonly ThemeColorDefinition[] = [
  {
    id: 'emerald',
    labelKey: 'themeColorEmerald',
    swatchHex: '#10b981'
  },
  {
    id: 'blue',
    labelKey: 'themeColorBlue',
    swatchHex: '#3b82f6'
  },
  {
    id: 'slate',
    labelKey: 'themeColorSlate',
    swatchHex: '#64748b'
  },
  {
    id: 'indigo',
    labelKey: 'themeColorIndigo',
    swatchHex: '#6366f1'
  },
  {
    id: 'orange',
    labelKey: 'themeColorOrange',
    swatchHex: '#f97316'
  },
  {
    id: 'rose',
    labelKey: 'themeColorRose',
    swatchHex: '#f43f5e'
  }
];

/**
 * 有効なテーマカラー ID の高速判定用セット
 */
const VALID_THEME_COLOR_SET = new Set<string>(THEME_COLOR_DEFINITIONS.map(def => def.id));

/**
 * 任意の値がサポート対象のテーマカラー識別子であるかを判定します。
 * @param value - 検証対象の値
 * @returns サポート対象の `ThemeColor` であれば true
 */
export function isValidThemeColor(value: unknown): value is ThemeColor {
  return typeof value === 'string' && VALID_THEME_COLOR_SET.has(value);
}

/**
 * 任意の値を検証し、有効なテーマカラー識別子へ正規化します。
 * 未設定または不正な値の場合はデフォルト値（`'emerald'`）を返します。
 * @param value - 正規化対象の値
 * @returns 正規化された `ThemeColor`
 */
export function parseValidThemeColor(value: unknown): ThemeColor {
  return isValidThemeColor(value) ? value : DEFAULT_THEME_COLOR;
}

/**
 * 指定されたテーマカラーに対応する PrimeVue Aura の `semantic.primary` パレットトークンマップを生成します。
 * @param color - 対象のテーマカラー識別子
 * @returns 50〜950 の各トーンを Aura プリミティブトークン参照へマッピングした辞書
 */
export function buildPrimaryPalette(color: ThemeColor): Record<string, string> {
  const normalized = parseValidThemeColor(color);
  const palette: Record<string, string> = {};
  for (const shade of PRIMARY_PALETTE_SHADES) {
    palette[shade] = `{${normalized}.${shade}}`;
  }
  return palette;
}

/**
 * `localStorage` に同期キャッシュされている直近のテーマカラーを取得します。
 * Service Worker など `localStorage` が利用できない環境や未保存時はデフォルト値を返します。
 * @returns キャッシュ済みの `ThemeColor`（取得不可時は `'emerald'`）
 */
export function getCachedThemeColorSync(): ThemeColor {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME_COLOR;
  try {
    return parseValidThemeColor(localStorage.getItem(THEME_COLOR_CACHE_KEY));
  } catch {
    // ストレージアクセス不可時は安全にデフォルト値へフォールバックする
    return DEFAULT_THEME_COLOR;
  }
}

/**
 * 選択されたテーマカラーを `localStorage` の同期キャッシュへ保存します。
 * Service Worker など `localStorage` が利用できない環境では何もしません。
 * @param color - キャッシュするテーマカラー識別子
 * @returns なし
 */
export function saveCachedThemeColorSync(color: ThemeColor): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(THEME_COLOR_CACHE_KEY, parseValidThemeColor(color));
  } catch {
    // 書き込み不可時でも動作継続を優先する
  }
}

/**
 * 成功トーストの単一カラースキーム向けデザイントークン定義
 */
export interface ThemedSuccessToastSchemeTokens {
  background: string;
  borderColor: string;
  color: string;
  detailColor: string;
  shadow: string;
  closeButton: {
    hoverBackground: string;
    focusRing: {
      color: string;
      shadow: string;
    };
  };
}

/**
 * PrimeVue Toast コンポーネントの `:dt` プロパティへ渡す成功トースト用デザイントークン定義
 */
export interface ThemedSuccessToastTokens {
  colorScheme: {
    light: {
      success: ThemedSuccessToastSchemeTokens;
    };
    dark: {
      success: ThemedSuccessToastSchemeTokens;
    };
  };
}

/**
 * PrimeVue Toast の `success` トーストをテーマカラー（`primary` パレット）へ連動させる
 * スコープ付きデザイントークン定義を生成します。
 * ライト／ダークモード双方で Aura テーマの標準構造を踏襲しつつ、
 * ダークモードのアクセント文字・フォーカスリングには視認性の高い `{primary.400}` を採用します。
 * @returns `<Toast :dt="...">` へそのまま渡せるデザイントークンオブジェクト
 */
export function buildThemedSuccessToastTokens(): ThemedSuccessToastTokens {
  return {
    colorScheme: {
      light: {
        success: {
          background: 'color-mix(in srgb, {primary.50}, transparent 5%)',
          borderColor: '{primary.200}',
          color: '{primary.600}',
          detailColor: '{surface.700}',
          shadow: '0px 4px 8px 0px color-mix(in srgb, {primary.500}, transparent 96%)',
          closeButton: {
            hoverBackground: '{primary.100}',
            focusRing: {
              color: '{primary.600}',
              shadow: 'none'
            }
          }
        }
      },
      dark: {
        success: {
          background: 'color-mix(in srgb, {primary.500}, transparent 84%)',
          borderColor: 'color-mix(in srgb, {primary.700}, transparent 64%)',
          // ダーク背景上で slate / indigo を含む全 6 色の視認性を確保するため primary.400 を使用する
          color: '{primary.400}',
          detailColor: '{surface.0}',
          shadow: '0px 4px 8px 0px color-mix(in srgb, {primary.500}, transparent 96%)',
          closeButton: {
            hoverBackground: 'rgba(255, 255, 255, 0.05)',
            focusRing: {
              color: '{primary.400}',
              shadow: 'none'
            }
          }
        }
      }
    }
  };
}

/**
 * 指定されたテーマカラーを PrimeVue の実行時プライマリパレットへ即座に適用し、
 * 次回起動時のちらつき防止用同期キャッシュも同時に更新します。
 * @param color - 適用するテーマカラー識別子
 * @returns 正規化されて適用された `ThemeColor`
 */
export function applyThemeColor(color: ThemeColor): ThemeColor {
  const normalized = parseValidThemeColor(color);
  saveCachedThemeColorSync(normalized);
  if (typeof document !== 'undefined') {
    updatePrimaryPalette(buildPrimaryPalette(normalized));
  }
  return normalized;
}
