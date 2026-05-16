<template>
  <div class="container" v-if="isLoaded">
    <Toast />
    
    <div :key="renderKey">
      <div class="header">
        <h1>{{ t('preferencesTitle') }}</h1>
      </div>

      <Card class="mb-4">
        <template #title>{{ t('languageSetting') }}</template>
        <template #content>
          <div class="form-grid">
            <div class="field">
              <Select 
                v-model="selectedLanguage" 
                :options="languageOptions" 
                optionLabel="label" 
                optionValue="value"
                placeholder="Select Language"
                @change="saveLanguage"
                class="w-full"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Toast from 'primevue/toast';

import { initI18n, t, setLocale, getCurrentLocale, Locale } from './i18n';

const toast = useToast();
const selectedLanguage = ref<Locale>('en');
const isLoaded = ref(false);
const renderKey = ref(0);

const languageOptions = ref([
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' }
]);

const loadSettings = async () => {
  await initI18n();
  selectedLanguage.value = getCurrentLocale();
  isLoaded.value = true;
};

const saveLanguage = async () => {
  await setLocale(selectedLanguage.value);
  renderKey.value++; // Force re-render of localized strings
  
  toast.add({ 
    severity: 'success', 
    summary: t('saveSuccess'), 
    detail: t('saveSuccess'), 
    life: 3000 
  });
};

onMounted(async () => {
  await loadSettings();
});
</script>

<style scoped>
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  background-color: var(--p-surface-100);
  min-height: 100vh;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--p-text-color);
}

.mb-4 {
  margin-bottom: 1.5rem;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.w-full {
  width: 100%;
}
</style>