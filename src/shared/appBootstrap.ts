import { Component, Plugin } from 'vue';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import 'primeicons/primeicons.css';
import { createNickmarkPreset, mountPrimeVueRootApp } from './primeVueBootstrap';

/**
 * Aura テーマをベースに、ライト／ダークモード双方で適切なページ背景（--p-page-background）を提供するカスタムプリセット
 */
const NickmarkPreset = createNickmarkPreset(Aura);

/**
 * Vue アプリケーションの生成オプション
 */
export interface BootstrapOptions {
  /** 確認ダイアログ（ConfirmationService）を有効にするかどうか */
  useConfirm?: boolean;
}

/**
 * PrimeVue（NickmarkPreset 拡張 Aura テーマ・ToastService・Tooltip）を構成した Vue アプリケーションをマウントします。
 * 一覧画面・設定画面で共通の初期化ロジックを提供します。
 * @param rootComponent - マウントするルート Vue コンポーネント
 * @param options - サービスの有効化オプション
 * @returns なし
 */
export function mountNickmarkApp(rootComponent: Component, options: BootstrapOptions = {}): void {
  const plugins: Plugin[] = [ToastService];
  if (options.useConfirm) {
    plugins.push(ConfirmationService);
  }

  mountPrimeVueRootApp(rootComponent, NickmarkPreset, {
    plugins,
    useTooltip: true
  });
}
