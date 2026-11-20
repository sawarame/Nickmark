import { Component } from 'vue';
import AuraBase from '@primeuix/themes/aura/base';
import badge from '@primeuix/themes/aura/badge';
import button from '@primeuix/themes/aura/button';
import inputtext from '@primeuix/themes/aura/inputtext';
import message from '@primeuix/themes/aura/message';
import ripple from '@primeuix/themes/aura/ripple';
import tooltip from '@primeuix/themes/aura/tooltip';
import 'primeicons/primeicons.css';
import { createNickmarkPreset, mountPrimeVueRootApp } from './primeVueBootstrap';

/**
 * ポップアップで使用する PrimeVue コンポーネント（InputText / Button / Message / Tooltip 等）のみに
 * 絞り込んだ Aura サブセットプリセットです。未使用コンポーネントのテーマ定義を除外し起動負荷を低減します。
 */
const PopupAuraSubset = {
  ...AuraBase,
  components: {
    badge,
    button,
    inputtext,
    message,
    ripple,
    tooltip
  }
};

/**
 * ポップアップ専用の軽量 Nickmark 拡張 Aura プリセット
 */
const NickmarkPopupPreset = createNickmarkPreset(PopupAuraSubset);

/**
 * コマンドパレット型ポップアップ（`popup.html`）向けに最小限の PrimeVue 機能のみを構成し、
 * Vue アプリケーションを同期的にマウントします。
 * @param rootComponent - マウントするルート Vue コンポーネント（`Popup.vue`）
 * @returns なし
 */
export function mountNickmarkPopupApp(rootComponent: Component): void {
  mountPrimeVueRootApp(rootComponent, NickmarkPopupPreset, {
    useTooltip: true
  });
}
