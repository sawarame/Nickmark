import { createApp, Component } from 'vue';
import PrimeVue from 'primevue/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip';
import 'primeicons/primeicons.css';

/**
 * Aura テーマをベースに、ライト／ダークモード双方で適切なページ背景（--p-page-background）を提供するカスタムプリセット
 */
const NickmarkPreset = definePreset(Aura, {
  semantic: {
    colorScheme: {
      light: {
        page: {
          background: '{surface.100}'
        }
      },
      dark: {
        page: {
          // ダークモード時は Card 背景（surface.900）より一段暗い背景色にして階層感を保つ
          background: '{surface.950}'
        }
      }
    }
  }
});

/**
 * Vue アプリケーションの生成オプション
 */
export interface BootstrapOptions {
  /** 確認ダイアログ（ConfirmationService）を有効にするかどうか */
  useConfirm?: boolean;
}

/**
 * PrimeVue（NickmarkPreset 拡張 Aura テーマ・ToastService・Tooltip）を構成した Vue アプリケーションをマウントします。
 * 各画面（一覧・設定・ポップアップ）のエントリーポイント間で共通の初期化ロジックを提供します。
 * @param rootComponent - マウントするルート Vue コンポーネント
 * @param options - サービスの有効化オプション
 * @returns なし
 */
export function mountNickmarkApp(rootComponent: Component, options: BootstrapOptions = {}): void {
  const app = createApp(rootComponent);

  app.use(PrimeVue, {
    theme: {
      preset: NickmarkPreset,
      options: {
        cssLayer: {
          name: 'primevue',
          order: 'tailwind-base, primevue, tailwind-utilities'
        }
      }
    }
  });
  app.use(ToastService);

  if (options.useConfirm) {
    app.use(ConfirmationService);
  }

  app.directive('tooltip', Tooltip);
  app.mount('#app');
}
