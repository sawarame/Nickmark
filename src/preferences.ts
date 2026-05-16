import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import Preferences from './Preferences.vue';

import 'primeicons/primeicons.css';

const app = createApp(Preferences);

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

app.mount('#app');