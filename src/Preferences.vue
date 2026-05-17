<template>
  <div class="container" v-if="isLoaded">
    <Toast />

    <div :key="renderKey">
      <div class="header">
        <h1>{{ t('preferencesTitle') }}</h1>
      </div>

      <Card class="mb-4">
        <template #title>{{ t('syncTitle') || 'Sync' }}</template>
        <template #content>
          <div class="sync-row">
            <div class="sync-info">
              <div class="sync-label">{{ t('enableSyncLabel') || 'Google Account Sync' }}</div>
              <div class="sync-desc">{{ t('syncDescription') || 'Sync your bookmarks across devices using your Google account (Limit: 100KB).' }}</div>
            </div>
            <div class="toggle-container">
              <ToggleSwitch :modelValue="syncEnabled" />
              <div class="toggle-overlay" @click="handleToggleRequest"></div>
            </div>
          </div>
        </template>
      </Card>

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

    <!-- Migration / Conflict Resolution Dialog -->
    <Dialog v-model:visible="showMigrationDialog" modal :header="t('migrationTitle') || 'Data Migration'" :style="{ width: '650px' }" :closable="false">
      <div class="migration-content">
        <p>{{ migrationMessage }}</p>

        <div v-if="localInfo && syncInfo" class="comparison-grid">
          <div class="comparison-item" :class="{ 'latest': localInfo.lastUpdated >= syncInfo.lastUpdated }">
            <div class="comp-label">Local Data</div>
            <div class="comp-time">{{ formatTime(localInfo.lastUpdated) }}</div>
            <div class="comp-count">{{ getBookmarkCount(localInfo.bookmarks) }} items</div>
          </div>
          <div class="comparison-arrow">
            <i class="pi pi-arrows-h"></i>
          </div>
          <div class="comparison-item" :class="{ 'latest': syncInfo.lastUpdated > localInfo.lastUpdated }">
            <div class="comp-label">Cloud Data</div>
            <div class="comp-time">{{ formatTime(syncInfo.lastUpdated) }}</div>
            <div class="comp-count">{{ getBookmarkCount(syncInfo.bookmarks) }} items</div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button :label="t('cancelBtn') || 'Cancel'" icon="pi pi-times" text @click="cancelMigration" />
        <Button v-if="migrationType === 'enable'" :label="t('useCloudDataBtn') || 'Use Cloud Data'" icon="pi pi-cloud-download" severity="secondary" @click="useExistingSyncData" />
        <Button v-if="migrationType === 'disable'" :label="t('keepLocalDataBtn') || 'Keep Local Data'" icon="pi pi-folder" severity="secondary" @click="keepExistingLocalData" />
        <Button :label="migrationType === 'enable' ? (t('overwriteCloudBtn') || 'Overwrite Cloud') : (t('overwriteLocalBtn') || 'Overwrite Local')" 
                :icon="migrationType === 'enable' ? 'pi pi-cloud-upload' : 'pi pi-download'" 
                @click="performMigration" autofocus />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import Dialog from 'primevue/dialog';
import Toast from 'primevue/toast';

import { initI18n, t, setLocale, getCurrentLocale, Locale } from './i18n';
import { getSyncEnabled, setSyncEnabled, getStorageDataWithTimestamp, saveBookmarksData, isOverQuota, BookmarkEntry } from './background';

const toast = useToast();
const selectedLanguage = ref<Locale>('en');
const syncEnabled = ref(false);
const isLoaded = ref(false);
const renderKey = ref(0);

// Migration State
const showMigrationDialog = ref(false);
const migrationType = ref<'enable' | 'disable'>('enable');
const migrationMessage = ref('');
const localInfo = ref<{ bookmarks: Record<string, BookmarkEntry[]>, lastUpdated: number } | null>(null);
const syncInfo = ref<{ bookmarks: Record<string, BookmarkEntry[]>, lastUpdated: number } | null>(null);

const languageOptions = ref([
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' }
]);

const loadSettings = async () => {
  await initI18n();
  selectedLanguage.value = getCurrentLocale();
  syncEnabled.value = await getSyncEnabled();
  isLoaded.value = true;
};

const saveLanguage = async () => {
  await setLocale(selectedLanguage.value);
  renderKey.value++; 

  toast.add({ 
    severity: 'success', 
    summary: t('saveSuccess'), 
    detail: t('saveSuccess'), 
    life: 3000 
  });
};

const handleToggleRequest = () => {
  if (showMigrationDialog.value) return;
  handleSyncToggle(!syncEnabled.value);
};

const handleSyncToggle = async (newValue: boolean) => {
  const isEnabling = newValue;

  if (isEnabling) {
    // ON にする場合
    const local = await getStorageDataWithTimestamp('local');
    if (isOverQuota(local.bookmarks)) {
      toast.add({ 
        severity: 'error', 
        summary: 'Error', 
        detail: t('errorSyncQuotaExceeded') || 'Local data exceeds 100KB. Please reduce data before enabling sync.', 
        life: 5000 
      });
      return;
    }

    const sync = await getStorageDataWithTimestamp('sync');
    const hasSyncData = Object.keys(sync.bookmarks).length > 0;

    if (hasSyncData) {
      migrationType.value = 'enable';
      migrationMessage.value = t('confirmEnableSyncWithData') || 'Existing cloud data found. Which data do you want to use?';
      localInfo.value = local;
      syncInfo.value = sync;
      showMigrationDialog.value = true;
    } else {
      // 同期データがない場合は自動コピーして有効化
      try {
        await setSyncEnabled(true);
        await saveBookmarksData(local.bookmarks);
        syncEnabled.value = true;
        toast.add({ severity: 'success', summary: 'Sync Enabled', detail: t('syncEnabledMessage') || 'Sync has been enabled.', life: 3000 });
      } catch (e: any) {
        await setSyncEnabled(false);
        const detail = e.message === 'QUOTA_EXCEEDED' ? t('errorSyncQuotaExceeded') : e.message;
        toast.add({ severity: 'error', summary: 'Error', detail: detail || 'Failed to enable sync.', life: 5000 });
      }
    }
  } else {
    // OFF にする場合
    const local = await getStorageDataWithTimestamp('local');
    const sync = await getStorageDataWithTimestamp('sync');
    const hasLocalData = Object.keys(local.bookmarks).length > 0;

    if (hasLocalData) {
      migrationType.value = 'disable';
      migrationMessage.value = t('confirmDisableSyncWithData') || 'Local data already exists. Which data do you want to keep?';
      localInfo.value = local;
      syncInfo.value = sync;
      showMigrationDialog.value = true;
    } else {
      // ローカルデータがない場合は同期データをコピーして無効化
      try {
        await setSyncEnabled(false);
        await saveBookmarksData(sync.bookmarks);
        syncEnabled.value = false;
        toast.add({ severity: 'info', summary: 'Sync Disabled', detail: t('syncDisabledMessage') || 'Sync has been disabled. Data copied to local.', life: 3000 });
      } catch (e: any) {
        await setSyncEnabled(true);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to disable sync safely.', life: 5000 });
      }
    }
  }
};

const performMigration = async () => {
  try {
    if (migrationType.value === 'enable') {
      // Local -> Sync
      await setSyncEnabled(true);
      if (localInfo.value) await saveBookmarksData(localInfo.value.bookmarks);
      syncEnabled.value = true;
    } else {
      // Sync -> Local
      await setSyncEnabled(false);
      if (syncInfo.value) await saveBookmarksData(syncInfo.value.bookmarks);
      syncEnabled.value = false;
    }
    showMigrationDialog.value = false;
    toast.add({ severity: 'success', summary: 'Success', detail: t('migrationSuccess') || 'Data migration successful.', life: 3000 });
  } catch (e: any) {
    // 失敗した場合は設定を元に戻す試みをする
    await setSyncEnabled(migrationType.value !== 'enable');
    const detail = e.message === 'QUOTA_EXCEEDED' ? t('errorSyncQuotaExceeded') : e.message;
    toast.add({ severity: 'error', summary: 'Migration Failed', detail: detail || 'Error occurred during migration.', life: 5000 });
  }
};

const useExistingSyncData = async () => {
  // Sync データをそのまま使う（有効化するだけ）
  await setSyncEnabled(true);
  syncEnabled.value = true;
  showMigrationDialog.value = false;
  toast.add({ severity: 'success', summary: 'Sync Enabled', detail: t('syncEnabledMessage') || 'Sync enabled using cloud data.', life: 3000 });
};

const keepExistingLocalData = async () => {
  // ローカルデータをそのまま使う（無効化するだけ）
  await setSyncEnabled(false);
  syncEnabled.value = false;
  showMigrationDialog.value = false;
  toast.add({ severity: 'info', summary: 'Sync Disabled', detail: t('syncDisabledMessageOnly') || 'Sync disabled. Keeping local data.', life: 3000 });
};

const cancelMigration = () => {
  showMigrationDialog.value = false;
  localInfo.value = null;
  syncInfo.value = null;
};

const formatTime = (ts: number) => {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleString();
};

const getBookmarkCount = (bookmarks: Record<string, any>) => {
  let count = 0;
  for (const entries of Object.values(bookmarks)) {
    if (Array.isArray(entries)) count += entries.length;
  }
  return count;
};

onMounted(async () => {
  await loadSettings();
});
</script>

<style scoped>
.container {
  max-width: 800px;
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

.sync-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.sync-info {
  flex: 1;
}

.sync-label {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.sync-desc {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.toggle-container {
  position: relative;
  display: inline-block;
}

.toggle-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  cursor: pointer;
}

.migration-content p {
  margin-top: 0;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.comparison-grid {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--p-surface-50);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--p-surface-200);
}

.comparison-item {
  flex: 1;
  text-align: center;
  padding: 0.75rem 0.5rem;
  border-radius: 6px;
  min-width: 0;
}

.comparison-item.latest {
  background: var(--p-primary-50);
  border: 1px solid var(--p-primary-200);
}

.comp-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.comp-time {
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
}

.comp-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.comparison-arrow {
  color: var(--p-text-muted-color);
  font-size: 1.25rem;
}

.latest .comp-time {
  color: var(--p-primary-color);
}
</style>