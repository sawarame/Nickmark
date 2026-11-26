import { Component, createApp, Plugin } from 'vue';
import PrimeVue from 'primevue/config';
import { definePreset } from '@primeuix/themes';
import Tooltip from 'primevue/tooltip';
import { ThemeColor } from './types';
import {
  buildHighlightColorScheme,
  buildPrimaryPalette,
  getCachedThemeColorSync
} from './theme';

/**
 * PrimeVue ルートアプリケーションの初期化オプション
 */
export interface PrimeVueRootBootstrapOptions {
  /** 追加登録する Vue プラグイン（ToastService / ConfirmationService 等）の配列 */
  plugins?: Plugin[];
  /** Tooltip ディレクティブを登録するかどうか（既定: true） */
  useTooltip?: boolean;
}

/**
 * 指定されたベースプリセットに対して、選択済みテーマカラーのプライマリパレット、
 * テーマ別ハイライトトークン（`--p-highlight-*`）、およびライト／ダークモード双方のページ背景
 * （`--p-page-background`）を拡張した Nickmark 共通テーマプリセットを生成します。
 * @param basePreset - 拡張元となる PrimeVue テーマプリセット（Aura またはそのサブセット）
 * @param initialColor - 初期適用するテーマカラー（省略時は `localStorage` 同期キャッシュから復元）
 * @returns Nickmark 向けに拡張されたテーマプリセット
 */
export function createNickmarkPreset<T extends Parameters<typeof definePreset>[0]>(
  basePreset: T,
  initialColor?: ThemeColor
) {
  const resolvedColor = initialColor ?? getCachedThemeColorSync();
  const primaryPalette = buildPrimaryPalette(resolvedColor);
  const highlightColorScheme = buildHighlightColorScheme(resolvedColor);
  return definePreset(basePreset, {
    semantic: {
      primary: primaryPalette,
      colorScheme: {
        light: {
          page: {
            background: '{surface.100}'
          },
          highlight: highlightColorScheme.light
        },
        dark: {
          page: {
            // ダークモード時は Card 背景（surface.900）より一段暗い背景色にして階層感を保つ
            background: '{surface.950}'
          },
          highlight: highlightColorScheme.dark
        }
      }
    }
  });
}

/**
 * PrimeVue および必要なプラグイン／ディレクティブを同期的に構成し、Vue アプリケーションを `#app` にマウントします。
 * フル構成・軽量ポップアップ構成の双方から共通利用される初期化コア関数です。
 * @param rootComponent - マウントするルート Vue コンポーネント
 * @param preset - 適用するテーマプリセットオブジェクト
 * @param options - 追加登録するプラグインおよびディレクティブのオプション
 * @returns なし
 */
export function mountPrimeVueRootApp(
  rootComponent: Component,
  preset: object,
  options: PrimeVueRootBootstrapOptions = {}
): void {
  const app = createApp(rootComponent);

  app.use(PrimeVue, {
    theme: {
      preset,
      options: {
        cssLayer: {
          name: 'primevue',
          order: 'tailwind-base, primevue, tailwind-utilities'
        }
      }
    }
  });

  if (options.plugins) {
    for (const plugin of options.plugins) {
      app.use(plugin);
    }
  }

  if (options.useTooltip !== false) {
    app.directive('tooltip', Tooltip);
  }

  app.mount('#app');
}
