<template>
  <div class="container" v-if="isLoaded">
    <Toast />

    <div :key="renderKey">
      <div class="header">
        <Button
          icon="pi pi-arrow-left"
          severity="secondary"
          text
          rounded
          size="large"
          :aria-label="t('backToListBtn')"
          v-tooltip="t('backToListBtn')"
          @click="goBack"
        />
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

      <Card class="mb-4">
        <template #title>{{ t('maxBatchOpenTabsLabel') || 'Safety limit for batch open tabs' }}</template>
        <template #content>
          <div class="sync-row">
            <div class="sync-info">
              <div class="sync-desc">
                {{ t('maxBatchOpenTabsDescription') || 'The maximum number of tabs to open automatically when batch opening a folder (1-100, default: 20).' }}
              </div>
            </div>
            <div style="min-width: 140px;">
              <InputNumber
                v-model="maxBatchOpenTabs"
                :min="1"
                :max="100"
                showButtons
                buttonLayout="horizontal"
                :step="1"
                @change="saveMaxBatchOpenTabs"
                class="w-full"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- データ移行・競合解決ダイアログ -->
    <Dialog
      v-model:visible="showMigrationDialog"
      modal
      :header="t('migrationTitle') || 'Data Migration'"
      :style="{ width: '750px', maxWidth: '90vw' }"
      :closable="false"
    >
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
        <Button
          :label="migrationType === 'enable' ? (t('overwriteCloudBtn') || 'Overwrite Cloud') : (t('overwriteLocalBtn') || 'Overwrite Local')"
          :icon="migrationType === 'enable' ? 'pi pi-cloud-upload' : 'pi pi-download'"
          @click="performMigration"
          autofocus
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import InputNumber from 'primevue/inputnumber';
import Dialog from 'primevue/dialog';
import Toast from 'primevue/toast';

import { initI18n, t, setLocale, getCurrentLocale, Locale } from './i18n';
import { BookmarkEntry, DEFAULT_MAX_BATCH_OPEN_TABS } from './shared/types';
import {
  getMaxBatchOpenTabs,
  getSaveErrorMessage,
  getStorageDataWithTimestamp,
  getSyncEnabled,
  isOverQuota,
  saveBookmarksData,
  setMaxBatchOpenTabs,
  setSyncEnabled
} from './shared/storage';

const toast = useToast();
const selectedLanguage = ref<Locale>('en');
const syncEnabled = ref(false);
const maxBatchOpenTabs = ref<number>(DEFAULT_MAX_BATCH_OPEN_TABS);
const isLoaded = ref(false);
const renderKey = ref(0);

// データ移行ダイアログ用の状態
const showMigrationDialog = ref(false);
const migrationType = ref<'enable' | 'disable'>('enable');
const migrationMessage = ref('');
const localInfo = ref<{ bookmarks: Record<string, BookmarkEntry[]>; lastUpdated: number } | null>(null);
const syncInfo = ref<{ bookmarks: Record<string, BookmarkEntry[]>; lastUpdated: number } | null>(null);

const languageOptions = ref([
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' }
]);

/**
 * 設定画面の初期値をストレージから読み込みます。
 * @returns 読み込み完了を示す Promise
 */
const loadSettings = async (): Promise<void> => {
  await initI18n();
  selectedLanguage.value = getCurrentLocale();
  syncEnabled.value = await getSyncEnabled();
  maxBatchOpenTabs.value = await getMaxBatchOpenTabs();
  isLoaded.value = true;
};

/**
 * 一括オープン時の安全上限タブ数設定を保存します。
 * @returns 保存完了を示す Promise
 */
const saveMaxBatchOpenTabs = async (): Promise<void> => {
  if (typeof maxBatchOpenTabs.value === 'number') {
    await setMaxBatchOpenTabs(maxBatchOpenTabs.value);
    toast.add({
      severity: 'success',
      summary: t('saveSuccess') || 'Saved',
      detail: t('saveSuccess') || 'Saved',
      life: 2000
    });
  }
};

/**
 * 言語設定を保存し、画面内の表示文言を即座に再描画します。
 * @returns 保存完了を示す Promise
 */
const saveLanguage = async (): Promise<void> => {
  await setLocale(selectedLanguage.value);
  renderKey.value++;

  toast.add({
    severity: 'success',
    summary: t('saveSuccess'),
    detail: t('saveSuccess'),
    life: 3000
  });
};

/**
 * 同期設定の更新および必要に応じてデータ保存を行い、失敗時は元の設定へロールバックします。
 * @param targetEnabled - 切り替え後の同期設定（true: 有効、false: 無効）
 * @param bookmarksToSave - 切り替え先にコピー保存するブックマークデータ（省略時は設定変更のみ）
 * @param successNotice - 成功時のトースト通知設定
 * @param errorSummary - 失敗時のトースト見出し
 * @param fallbackError - 不明エラー時のフォールバック文言
 * @returns 成功した場合は true、失敗した場合は false
 */
const applySyncTransition = async (
  targetEnabled: boolean,
  bookmarksToSave: Record<string, BookmarkEntry[]> | null,
  successNotice: { severity: 'success' | 'info'; summary: string; detail: string },
  errorSummary: string,
  fallbackError: string
): Promise<boolean> => {
  try {
    await setSyncEnabled(targetEnabled);
    if (bookmarksToSave) {
      await saveBookmarksData(bookmarksToSave);
    }
    syncEnabled.value = targetEnabled;
    toast.add({ ...successNotice, life: 3000 });
    return true;
  } catch (err: unknown) {
    await setSyncEnabled(!targetEnabled);
    toast.add({
      severity: 'error',
      summary: errorSummary,
      detail: getSaveErrorMessage(err, fallbackError),
      life: 5000
    });
    return false;
  }
};

/**
 * 同期トグルのクリックを捕捉し、切り替え確認フローを開始します。
 * @returns なし
 */
const handleToggleRequest = (): void => {
  if (showMigrationDialog.value) return;
  handleSyncToggle(!syncEnabled.value);
};

/**
 * 同期の ON/OFF 切り替え時の容量チェックおよび競合データの検出を行います。
 * 移行先に既存データが存在する場合はデータ移行ダイアログを表示します。
 * @param newValue - 切り替え先の同期状態（true: ON、false: OFF）
 * @returns 処理完了を示す Promise
 */
const handleSyncToggle = async (newValue: boolean): Promise<void> => {
  const local = await getStorageDataWithTimestamp('local');

  if (newValue) {
    if (isOverQuota(local.bookmarks)) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail:
          t('errorSyncQuotaExceeded') ||
          'Local data exceeds 100KB. Please reduce data before enabling sync.',
        life: 5000
      });
      return;
    }

    const sync = await getStorageDataWithTimestamp('sync');
    if (Object.keys(sync.bookmarks).length > 0) {
      migrationType.value = 'enable';
      migrationMessage.value =
        t('confirmEnableSyncWithData') ||
        'Existing cloud data found. Which data do you want to use?';
      localInfo.value = local;
      syncInfo.value = sync;
      showMigrationDialog.value = true;
      return;
    }

    await applySyncTransition(
      true,
      local.bookmarks,
      {
        severity: 'success',
        summary: 'Sync Enabled',
        detail: t('syncEnabledMessage') || 'Sync has been enabled.'
      },
      'Error',
      'Failed to enable sync.'
    );
    return;
  }

  const sync = await getStorageDataWithTimestamp('sync');
  if (Object.keys(local.bookmarks).length > 0) {
    migrationType.value = 'disable';
    migrationMessage.value =
      t('confirmDisableSyncWithData') ||
      'Local data already exists. Which data do you want to keep?';
    localInfo.value = local;
    syncInfo.value = sync;
    showMigrationDialog.value = true;
    return;
  }

  await applySyncTransition(
    false,
    sync.bookmarks,
    {
      severity: 'info',
      summary: 'Sync Disabled',
      detail: t('syncDisabledMessage') || 'Sync has been disabled. Data copied to local.'
    },
    'Error',
    'Failed to disable sync safely.'
  );
};

/**
 * 移行ダイアログで「上書き移行」が選択された際、選択元データで移行先を上書きします。
 * @returns 移行処理完了を示す Promise
 */
const performMigration = async (): Promise<void> => {
  const isEnabling = migrationType.value === 'enable';
  const sourceBookmarks = isEnabling
    ? localInfo.value?.bookmarks ?? null
    : syncInfo.value?.bookmarks ?? null;

  const ok = await applySyncTransition(
    isEnabling,
    sourceBookmarks,
    {
      severity: 'success',
      summary: 'Success',
      detail: t('migrationSuccess') || 'Data migration successful.'
    },
    'Migration Failed',
    'Error occurred during migration.'
  );

  if (ok) {
    showMigrationDialog.value = false;
  }
};

/**
 * 既存のクラウドデータをそのまま利用して同期を有効化します。
 * @returns 処理完了を示す Promise
 */
const useExistingSyncData = async (): Promise<void> => {
  await applySyncTransition(
    true,
    null,
    {
      severity: 'success',
      summary: 'Sync Enabled',
      detail: t('syncEnabledMessage') || 'Sync enabled using cloud data.'
    },
    'Error',
    'Failed to enable sync.'
  );
  showMigrationDialog.value = false;
};

/**
 * 既存のローカルデータを保持したまま同期を無効化します。
 * @returns 処理完了を示す Promise
 */
const keepExistingLocalData = async (): Promise<void> => {
  await applySyncTransition(
    false,
    null,
    {
      severity: 'info',
      summary: 'Sync Disabled',
      detail: t('syncDisabledMessageOnly') || 'Sync disabled. Keeping local data.'
    },
    'Error',
    'Failed to disable sync.'
  );
  showMigrationDialog.value = false;
};

/**
 * データ移行ダイアログをキャンセルして閉じます。
 * @returns なし
 */
const cancelMigration = (): void => {
  showMigrationDialog.value = false;
  localInfo.value = null;
  syncInfo.value = null;
};

/**
 * タイムスタンプをローカライズされた日時文字列へ変換します。
 * @param ts - Unix タイムスタンプ（ミリ秒）
 * @returns フォーマットされた日時文字列（未設定時は 'N/A'）
 */
const formatTime = (ts: number): string => {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleString();
};

/**
 * ブックマーク辞書に含まれる総エントリ件数を集計します。
 * @param bookmarks - 集計対象のブックマーク辞書
 * @returns エントリ総数
 */
const getBookmarkCount = (bookmarks: Record<string, BookmarkEntry[]>): number => {
  let count = 0;
  for (const entries of Object.values(bookmarks)) {
    if (Array.isArray(entries)) count += entries.length;
  }
  return count;
};

/**
 * ブックマーク一覧画面へ戻ります。
 * @returns なし
 */
const goBack = (): void => {
  window.location.href = 'list.html';
};

onMounted(async () => {
  await loadSettings();
});
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  background-color: var(--p-surface-100);
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
