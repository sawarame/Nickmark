/**
 * ブックマーク登録ポップアップのエントリーポイント
 */
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import Popup from './Popup.vue';

import 'primeicons/primeicons.css';

const app = createApp(Popup);

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
app.directive('tooltip', Tooltip);

app.mount('#app');
