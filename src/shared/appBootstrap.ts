import { createApp, Component } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip';
import 'primeicons/primeicons.css';

/**
 * Vue アプリケーションの生成オプション
 */
export interface BootstrapOptions {
  /** 確認ダイアログ（ConfirmationService）を有効にするかどうか */
  useConfirm?: boolean;
}

/**
 * PrimeVue（Aura テーマ・ToastService・Tooltip）を構成した Vue アプリケーションをマウントします。
 * 各画面（一覧・設定・ポップアップ）のエントリーポイント間で共通の初期化ロジックを提供します。
 * @param rootComponent - マウントするルート Vue コンポーネント
 * @param options - サービスの有効化オプション
 * @returns なし
 */
export function mountNickmarkApp(rootComponent: Component, options: BootstrapOptions = {}): void {
  const app = createApp(rootComponent);

  app.use(PrimeVue, {
    theme: {
      preset: Aura,
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
