<template>
  <div class="container" v-if="isLoaded">
    <Toast @close="handleToastClosed" @life-end="handleToastClosed" />

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
        <template #title>{{ t('themeColorTitle') || 'Theme Color' }}</template>
        <template #content>
          <div class="sync-desc theme-color-intro">
            {{
              t('themeColorDescription') ||
              'Choose the theme color applied to the popup, bookmark list, and preferences.'
            }}
          </div>
          <div
            class="theme-swatch-grid"
            role="radiogroup"
            :aria-label="t('themeColorTitle') || 'Theme Color'"
          >
            <button
              v-for="option in THEME_COLOR_DEFINITIONS"
              :key="option.id"
              type="button"
              role="radio"
              class="theme-swatch-option"
              :class="{ 'is-selected': selectedThemeColor === option.id }"
              :aria-checked="selectedThemeColor === option.id"
              :disabled="isSavingThemeColor"
              @click="handleThemeColorSelect(option.id)"
            >
              <span
                class="theme-swatch-dot"
                :style="{ backgroundColor: option.swatchHex }"
                aria-hidden="true"
              >
                <i v-if="selectedThemeColor === option.id" class="pi pi-check theme-swatch-check"></i>
              </span>
              <span class="theme-swatch-label">{{ t(option.labelKey) || option.id }}</span>
            </button>
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
                @update:modelValue="handleMaxBatchOpenTabsUpdate"
                @input="handleMaxBatchOpenTabsInput"
                class="w-full"
              />
            </div>
          </div>
        </template>
      </Card>

      <Card class="mb-4">
        <template #title>{{ t('openInNewTabTitle') || 'Open in New Tab' }}</template>
        <template #content>
          <div class="sync-row">
            <div class="sync-info">
              <div class="sync-label">{{ t('openInNewTabLabel') || 'Open in a new tab by default' }}</div>
              <div class="sync-desc">
                {{
                  t('openInNewTabDescription') ||
                  'When enabled, opening a bookmark or browser history item from the popup without modifier keys opens it in a new foreground tab (Shift+Enter still opens in a background tab).'
                }}
              </div>
            </div>
            <div class="toggle-container">
              <ToggleSwitch
                :modelValue="openInNewTab"
                :disabled="isSavingOpenInNewTab"
                :aria-label="t('openInNewTabLabel') || 'Open in a new tab by default'"
                @update:modelValue="handleOpenInNewTabChange"
              />
            </div>
          </div>

          <div v-if="openInNewTab" class="sync-row sub-setting-row">
            <div class="sync-info">
              <div class="sync-label">
                {{ t('openInCurrentIfNewTabLabel') || 'Open in the current tab when on a New Tab' }}
              </div>
              <div class="sync-desc">
                {{
                  t('openInCurrentIfNewTabDescription') ||
                  'When enabled, if the active tab is a New Tab page, opening a bookmark or history item without modifier keys opens it in that tab (Cmd/Ctrl/Alt+Enter still opens in a new tab).'
                }}
              </div>
            </div>
            <div class="toggle-container">
              <ToggleSwitch
                :modelValue="openInCurrentIfNewTab"
                :disabled="isSavingOpenInCurrentIfNewTab"
                :aria-label="t('openInCurrentIfNewTabLabel') || 'Open in the current tab when on a New Tab'"
                @update:modelValue="handleOpenInCurrentIfNewTabChange"
              />
            </div>
          </div>
        </template>
      </Card>

      <Card class="mb-4">
        <template #title>{{ t('historySearchTitle') || 'Browser History Search' }}</template>
        <template #content>
          <div class="sync-row">
            <div class="sync-info">
              <div class="sync-label">{{ t('historySearchLabel') || 'Include Browser History in Popup Search' }}</div>
              <div class="sync-desc">
                {{ t('historySearchDescription') || 'When enabled, matching browser history entries are shown below bookmark suggestions in the popup (requires permission to access browsing history).' }}
              </div>
            </div>
            <div class="toggle-container">
              <ToggleSwitch :modelValue="historySearchEnabled" />
              <div class="toggle-overlay" @click="handleHistorySearchToggleRequest"></div>
            </div>
          </div>
        </template>
      </Card>

      <Card class="mb-4">
        <template #title>
          <div class="presets-header-row">
            <span>{{ t('presetsTitle') || 'Presets' }}</span>
            <div class="presets-bulk-actions">
              <Button
                type="button"
                :label="t('presetsSelectAllBtn') || 'Select All'"
                severity="secondary"
                text
                size="small"
                :disabled="enabledPresetIds.length === PRESET_DEFINITIONS.length"
                @click="selectAllPresets"
              />
              <Button
                type="button"
                :label="t('presetsDeselectAllBtn') || 'Deselect All'"
                severity="secondary"
                text
                size="small"
                :disabled="enabledPresetIds.length === 0"
                @click="deselectAllPresets"
              />
            </div>
          </div>
        </template>
        <template #content>
          <div class="sync-desc presets-intro">
            {{
              t('presetsDescription') ||
              'Easily enable popular search services (%s dynamic URLs) and handy bookmarklets via checkboxes. Only your checkbox selections are stored, consuming virtually zero storage space.'
            }}
          </div>

          <div class="preset-category-block">
            <div class="preset-category-title">
              {{ t('presetsCategoryDynamicUrl') || 'Search Services (Dynamic URLs)' }}
            </div>
            <div class="preset-grid">
              <label
                v-for="preset in dynamicUrlPresets"
                :key="preset.id"
                class="preset-item"
                :class="{ 'is-enabled': enabledPresetIds.includes(preset.id) }"
                :for="'preset-' + preset.id"
              >
                <Checkbox
                  v-model="enabledPresetIds"
                  :inputId="'preset-' + preset.id"
                  :value="preset.id"
                  @change="handlePresetCheckboxChange"
                />
                <div class="preset-item-body">
                  <div class="preset-item-top">
                    <span class="preset-badge">{{ preset.nickname }}</span>
                    <span class="preset-title">{{ t(preset.titleKey) || preset.id }}</span>
                    <span class="preset-type-tag">[%s]</span>
                  </div>
                  <div class="preset-preview">{{ getPresetPreviewText(preset) }}</div>
                </div>
              </label>
            </div>
          </div>

          <div class="preset-category-block">
            <div class="preset-category-title">
              {{ t('presetsCategoryBookmarklet') || 'Bookmarklets' }}
            </div>
            <div class="preset-grid">
              <label
                v-for="preset in bookmarkletPresets"
                :key="preset.id"
                class="preset-item"
                :class="{ 'is-enabled': enabledPresetIds.includes(preset.id) }"
                :for="'preset-' + preset.id"
              >
                <Checkbox
                  v-model="enabledPresetIds"
                  :inputId="'preset-' + preset.id"
                  :value="preset.id"
                  @change="handlePresetCheckboxChange"
                />
                <div class="preset-item-body">
                  <div class="preset-item-top">
                    <span class="preset-badge">{{ preset.nickname }}</span>
                    <span class="preset-title">{{ t(preset.titleKey) || preset.id }}</span>
                    <span class="preset-type-tag">[JS]</span>
                  </div>
                  <div class="preset-preview">{{ getPresetPreviewText(preset) }}</div>
                </div>
              </label>
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
import { ref, computed, onMounted, onUnmounted, nextTick, Ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import ToggleSwitch from 'primevue/toggleswitch';
import InputNumber, { InputNumberInputEvent } from 'primevue/inputnumber';
import Dialog from 'primevue/dialog';
import Toast, { ToastEvent, ToastMessageOptions } from 'primevue/toast';

import { initI18n, t, setLocale, getCurrentLocale, Locale } from './i18n';
import {
  BookmarkEntry,
  DEFAULT_MAX_BATCH_OPEN_TABS,
  DEFAULT_THEME_COLOR,
  ENABLED_PRESETS_STORAGE_KEY,
  OPEN_IN_CURRENT_IF_NEW_TAB_STORAGE_KEY,
  OPEN_IN_NEW_TAB_STORAGE_KEY,
  PresetDefinition,
  PresetId,
  THEME_COLOR_STORAGE_KEY,
  ThemeColor
} from './shared/types';
import {
  PRESET_DEFINITIONS,
  normalizeEnabledPresetIds,
  resolvePresetUrl
} from './shared/presets';
import {
  THEME_COLOR_DEFINITIONS,
  applyThemeColor,
  parseValidThemeColor
} from './shared/theme';
import {
  getEnabledPresetIds,
  getMaxBatchOpenTabs,
  getOpenInCurrentIfNewTab,
  getOpenInNewTab,
  getSaveErrorMessage,
  getStorageDataWithTimestamp,
  getSyncEnabled,
  getThemeColor,
  isOverQuota,
  loadEnabledPresetsFromStorage,
  loadOpenInCurrentIfNewTabFromStorage,
  loadOpenInNewTabFromStorage,
  loadThemeColorFromStorage,
  saveBookmarksData,
  saveEnabledPresetsToStorage,
  saveOpenInCurrentIfNewTabToStorage,
  saveOpenInNewTabToStorage,
  saveThemeColorToStorage,
  setEnabledPresetIds,
  setHistorySearchEnabled,
  setMaxBatchOpenTabs,
  setOpenInCurrentIfNewTab,
  setOpenInNewTab,
  setSyncEnabled,
  setThemeColor
} from './shared/storage';
import { getEffectiveHistorySearchEnabled, requestHistoryPermission } from './shared/history';

const toast = useToast();
const selectedLanguage = ref<Locale>('en');
const selectedThemeColor = ref<ThemeColor>(DEFAULT_THEME_COLOR);
const isSavingThemeColor = ref(false);
const syncEnabled = ref(false);
const maxBatchOpenTabs = ref<number>(DEFAULT_MAX_BATCH_OPEN_TABS);
const openInNewTab = ref(false);
const isSavingOpenInNewTab = ref(false);
const openInCurrentIfNewTab = ref(false);
const isSavingOpenInCurrentIfNewTab = ref(false);
const historySearchEnabled = ref(false);
const isRequestingHistoryPermission = ref(false);
const enabledPresetIds = ref<PresetId[]>([]);
const isLoaded = ref(false);
const renderKey = ref(0);

/**
 * 検索サービス（動的 URL）カテゴリのプリセット一覧を返します。
 * @returns 動的 URL プリセット定義の配列
 */
const dynamicUrlPresets = computed((): PresetDefinition[] =>
  PRESET_DEFINITIONS.filter(p => p.category === 'dynamic_url')
);

/**
 * ブックマークレットカテゴリのプリセット一覧を返します。
 * @returns ブックマークレットプリセット定義の配列
 */
const bookmarkletPresets = computed((): PresetDefinition[] =>
  PRESET_DEFINITIONS.filter(p => p.category === 'bookmarklet')
);

const activeToastKeys = new Set<string>();

/**
 * トーストメッセージの重複判定用識別キーを生成します。
 * @param options - トーストメッセージ設定
 * @returns 種別・見出し・本文を組み合わせた一意キー
 */
const getToastKey = (options: ToastMessageOptions): string =>
  `${options.severity ?? ''}\0${options.summary ?? ''}\0${options.detail ?? ''}`;

/**
 * 同一内容のトーストが現在表示中の場合はスキップし、未表示の場合のみトーストを表示します。
 * @param options - 表示するトースト設定
 * @returns なし
 */
const addUniqueToast = (options: ToastMessageOptions): void => {
  const key = getToastKey(options);
  if (activeToastKeys.has(key)) return;
  activeToastKeys.add(key);
  toast.add(options);
};

/**
 * トーストが閉じられた（手動クローズまたは表示時間終了）際に表示中キーを解除します。
 * @param event - Toast コンポーネントの close / life-end イベント
 * @returns なし
 */
const handleToastClosed = (event: ToastEvent): void => {
  activeToastKeys.delete(getToastKey(event.message));
};

// 一括オープン安全上限の保存制御用状態（入力途中デバウンス・連続更新時の重複防止）
let lastSavedMaxBatchOpenTabs = DEFAULT_MAX_BATCH_OPEN_TABS;
let pendingMaxBatchOpenTabs: number | null = null;
let maxBatchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxBatchToastTimer: ReturnType<typeof setTimeout> | null = null;
let presetToastTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSaveMaxBatchPromise: Promise<void> | null = null;

// データ移行ダイアログ用の状態
const showMigrationDialog = ref(false);
const migrationType = ref<'enable' | 'disable'>('enable');
const migrationMessage = ref('');
const localInfo = ref<{ bookmarks: Record<string, BookmarkEntry[]>; lastUpdated: number; presets: PresetId[]; openInNewTab: boolean; openInCurrentIfNewTab: boolean; themeColor: ThemeColor } | null>(null);
const syncInfo = ref<{ bookmarks: Record<string, BookmarkEntry[]>; lastUpdated: number; presets: PresetId[]; openInNewTab: boolean; openInCurrentIfNewTab: boolean; themeColor: ThemeColor } | null>(null);

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
  const loadedThemeColor = await getThemeColor(true);
  selectedThemeColor.value = loadedThemeColor;
  applyThemeColor(loadedThemeColor);
  const loadedLimit = await getMaxBatchOpenTabs();
  maxBatchOpenTabs.value = loadedLimit;
  lastSavedMaxBatchOpenTabs = loadedLimit;
  openInNewTab.value = await getOpenInNewTab(true);
  openInCurrentIfNewTab.value = await getOpenInCurrentIfNewTab(true);
  historySearchEnabled.value = await getEffectiveHistorySearchEnabled();
  enabledPresetIds.value = await getEnabledPresetIds(true);
  isLoaded.value = true;
};

/**
 * カラースウォッチの選択を捕捉し、テーマカラーを即座にプレビュー反映しつつストレージへ保存します。
 * 保存に失敗した場合は直前のテーマカラーへロールバックしてエラーを通知します。
 * @param nextColor - 選択されたテーマカラー識別子
 * @returns 保存完了を示す Promise
 */
const handleThemeColorSelect = async (nextColor: ThemeColor): Promise<void> => {
  if (isSavingThemeColor.value || selectedThemeColor.value === nextColor) return;
  const previousColor = selectedThemeColor.value;
  selectedThemeColor.value = nextColor;
  applyThemeColor(nextColor);
  isSavingThemeColor.value = true;

  try {
    const saved = await setThemeColor(nextColor);
    selectedThemeColor.value = saved;
    applyThemeColor(saved);
    addUniqueToast({
      severity: 'success',
      summary: t('saveSuccess') || 'Saved',
      detail: t('saveSuccess') || 'Saved',
      life: 2000
    });
  } catch (err: unknown) {
    selectedThemeColor.value = previousColor;
    applyThemeColor(previousColor);
    addUniqueToast({
      severity: 'error',
      summary: 'Error',
      detail: getSaveErrorMessage(err, 'Failed to save theme color.'),
      life: 4000
    });
  } finally {
    isSavingThemeColor.value = false;
  }
};

/**
 * プリセットのプレビュー表示テキスト（動的 URL またはブックマークレットの説明文）を取得します。
 * @param preset - 対象のプリセット定義
 * @returns 表示用のプレビュー文字列
 */
const getPresetPreviewText = (preset: PresetDefinition): string => {
  if (preset.descriptionKey) {
    return t(preset.descriptionKey) || resolvePresetUrl(preset, selectedLanguage.value);
  }
  return resolvePresetUrl(preset, selectedLanguage.value);
};

/**
 * プリセット設定の保存完了トーストを短いデバウンス付きで表示します。
 * 連続チェック操作時にトーストが積み上がるのを防ぎます。
 * @returns なし
 */
const schedulePresetSavedToast = (): void => {
  if (presetToastTimer !== null) {
    clearTimeout(presetToastTimer);
  }
  presetToastTimer = setTimeout(() => {
    presetToastTimer = null;
    addUniqueToast({
      severity: 'success',
      summary: t('saveSuccess') || 'Saved',
      detail: t('saveSuccess') || 'Saved',
      life: 2000
    });
  }, 150);
};

/**
 * 有効化プリセット ID リストをストレージへ保存し、UI 状態を正規化します。
 * @param nextIds - 保存するプリセット ID リスト
 * @returns 保存完了を示す Promise
 */
const savePresetsSelection = async (nextIds: readonly string[]): Promise<void> => {
  try {
    const saved = await setEnabledPresetIds(nextIds);
    enabledPresetIds.value = saved;
    schedulePresetSavedToast();
  } catch (err: unknown) {
    enabledPresetIds.value = await getEnabledPresetIds(true);
    addUniqueToast({
      severity: 'error',
      summary: 'Error',
      detail: getSaveErrorMessage(err, 'Failed to save presets.'),
      life: 4000
    });
  }
};

/**
 * 個別のプリセットチェックボックス変更時に選択状態を保存します。
 * @returns 保存完了を示す Promise
 */
const handlePresetCheckboxChange = async (): Promise<void> => {
  await savePresetsSelection(enabledPresetIds.value);
};

/**
 * 全プリセットを一括で有効化（すべて選択）して保存します。
 * @returns 保存完了を示す Promise
 */
const selectAllPresets = async (): Promise<void> => {
  const allIds = PRESET_DEFINITIONS.map(p => p.id);
  enabledPresetIds.value = allIds;
  await savePresetsSelection(allIds);
};

/**
 * 全プリセットを一括で無効化（すべて解除）して保存します。
 * @returns 保存完了を示す Promise
 */
const deselectAllPresets = async (): Promise<void> => {
  enabledPresetIds.value = [];
  await savePresetsSelection([]);
};

/**
 * 他タブやバックグラウンドで同期対象の設定（プリセット・別タブ開き方）が変更された際に設定画面の表示を同期します。
 * @param changes - 変更されたストレージキーの辞書
 * @param area - 変更が発生したストレージ領域
 * @returns なし
 */
const handleStorageChanged = (
  changes: { [key: string]: chrome.storage.StorageChange },
  area: string
): void => {
  const isTargetArea =
    (syncEnabled.value && area === 'sync') || (!syncEnabled.value && area === 'local');
  if (!isTargetArea) return;

  if (changes[ENABLED_PRESETS_STORAGE_KEY]) {
    enabledPresetIds.value = normalizeEnabledPresetIds(
      changes[ENABLED_PRESETS_STORAGE_KEY].newValue
    );
  }
  if (changes[OPEN_IN_NEW_TAB_STORAGE_KEY]) {
    openInNewTab.value = Boolean(changes[OPEN_IN_NEW_TAB_STORAGE_KEY].newValue);
  }
  if (changes[OPEN_IN_CURRENT_IF_NEW_TAB_STORAGE_KEY]) {
    openInCurrentIfNewTab.value = Boolean(changes[OPEN_IN_CURRENT_IF_NEW_TAB_STORAGE_KEY].newValue);
  }
  if (changes[THEME_COLOR_STORAGE_KEY]) {
    const nextColor = parseValidThemeColor(changes[THEME_COLOR_STORAGE_KEY].newValue);
    selectedThemeColor.value = nextColor;
    applyThemeColor(nextColor);
  }
};

/**
 * ブーリアン設定トグルの変更を楽観的更新付きで保存し、失敗時は元の値へロールバックしてエラーを通知します。
 * @param stateRef - 表示用のリアクティブ参照
 * @param savingRef - 保存中フラグのリアクティブ参照
 * @param nextValue - 切り替え後の設定値
 * @param persist - 永続化を実行する非同期関数
 * @returns 処理完了を示す Promise
 */
const saveBooleanSettingToggle = async (
  stateRef: Ref<boolean>,
  savingRef: Ref<boolean>,
  nextValue: boolean,
  persist: (value: boolean) => Promise<boolean>
): Promise<void> => {
  if (savingRef.value) return;
  const previousValue = stateRef.value;
  stateRef.value = nextValue;
  savingRef.value = true;

  try {
    const saved = await persist(nextValue);
    stateRef.value = saved;
    addUniqueToast({
      severity: 'success',
      summary: t('saveSuccess') || 'Saved',
      detail: t('saveSuccess') || 'Saved',
      life: 2000
    });
  } catch (err: unknown) {
    stateRef.value = previousValue;
    addUniqueToast({
      severity: 'error',
      summary: 'Error',
      detail: getSaveErrorMessage(err, 'Failed to save setting.'),
      life: 4000
    });
  } finally {
    savingRef.value = false;
  }
};

/**
 * 「デフォルトで別タブで開く」トグルの変更を捕捉し、ストレージへ保存します。
 * @param nextValue - 切り替え後の設定値
 * @returns 処理完了を示す Promise
 */
const handleOpenInNewTabChange = async (nextValue: boolean): Promise<void> => {
  await saveBooleanSettingToggle(openInNewTab, isSavingOpenInNewTab, nextValue, setOpenInNewTab);
};

/**
 * 「“新しいタブ”のときはそのタブで開く」トグルの変更を捕捉し、ストレージへ保存します。
 * @param nextValue - 切り替え後の設定値
 * @returns 処理完了を示す Promise
 */
const handleOpenInCurrentIfNewTabChange = async (nextValue: boolean): Promise<void> => {
  await saveBooleanSettingToggle(
    openInCurrentIfNewTab,
    isSavingOpenInCurrentIfNewTab,
    nextValue,
    setOpenInCurrentIfNewTab
  );
};

/**
 * ブラウザ履歴検索トグルのクリックを捕捉し、任意権限の確認・要求と設定保存を行います。
 * ON 切り替え時はユーザージェスチャーコンテキストを保持するため、先行する非同期処理を挟まず直接権限を要求します。
 * @returns 処理完了を示す Promise
 */
const handleHistorySearchToggleRequest = async (): Promise<void> => {
  if (isRequestingHistoryPermission.value) return;

  if (!historySearchEnabled.value) {
    isRequestingHistoryPermission.value = true;
    try {
      const granted = await requestHistoryPermission();
      if (granted) {
        await setHistorySearchEnabled(true);
        historySearchEnabled.value = true;
        addUniqueToast({
          severity: 'success',
          summary: t('saveSuccess') || 'Saved',
          detail:
            t('historySearchEnabledMessage') ||
            'Browser history search has been enabled.',
          life: 3000
        });
      } else {
        await setHistorySearchEnabled(false);
        historySearchEnabled.value = false;
        addUniqueToast({
          severity: 'warn',
          summary: t('historySearchTitle') || 'Browser History Search',
          detail:
            t('historyPermissionDeniedMessage') ||
            'Could not enable because permission to access browser history was denied.',
          life: 4000
        });
      }
    } finally {
      isRequestingHistoryPermission.value = false;
    }
    return;
  }

  await setHistorySearchEnabled(false);
  historySearchEnabled.value = false;
  addUniqueToast({
    severity: 'info',
    summary: t('saveSuccess') || 'Saved',
    detail:
      t('historySearchDisabledMessage') ||
      'Browser history search has been disabled.',
    life: 3000
  });
};

/**
 * 安全上限タブ数を 1〜100 の整数へ丸めます。
 * @param value - 正規化対象の数値
 * @returns 1〜100 の整数値
 */
const clampMaxBatchOpenTabs = (value: number): number =>
  Math.max(1, Math.min(100, Math.floor(value)));

/**
 * 入力デバウンス用のタイマーをキャンセルします。
 * @returns なし
 */
const clearMaxBatchDebounceTimer = (): void => {
  if (maxBatchDebounceTimer !== null) {
    clearTimeout(maxBatchDebounceTimer);
    maxBatchDebounceTimer = null;
  }
};

/**
 * 安全上限設定の保存完了トーストを短いデバウンス付きで表示します。
 * ボタン長押し等の連続変更時にトーストが大量に積み上がるのを防ぎます。
 * @returns なし
 */
const scheduleMaxBatchSavedToast = (): void => {
  if (maxBatchToastTimer !== null) {
    clearTimeout(maxBatchToastTimer);
  }
  maxBatchToastTimer = setTimeout(() => {
    maxBatchToastTimer = null;
    addUniqueToast({
      severity: 'success',
      summary: t('saveSuccess') || 'Saved',
      detail: t('saveSuccess') || 'Saved',
      life: 2000
    });
  }, 150);
};

/**
 * 一括オープン時の安全上限タブ数設定をストレージへ保存します。
 * @param value - 保存する上限タブ数
 * @param showNotice - true の場合は保存完了トーストを表示します
 * @returns 保存完了を示す Promise
 */
const saveMaxBatchOpenTabs = async (value: number, showNotice: boolean = true): Promise<void> => {
  const normalized = clampMaxBatchOpenTabs(value);
  clearMaxBatchDebounceTimer();
  pendingMaxBatchOpenTabs = null;

  if (normalized === lastSavedMaxBatchOpenTabs) {
    maxBatchOpenTabs.value = normalized;
    return;
  }

  const previousValue = lastSavedMaxBatchOpenTabs;
  lastSavedMaxBatchOpenTabs = normalized;
  maxBatchOpenTabs.value = normalized;

  const task = setMaxBatchOpenTabs(normalized);
  pendingSaveMaxBatchPromise = task;
  try {
    await task;
    if (showNotice) {
      scheduleMaxBatchSavedToast();
    }
  } catch (err: unknown) {
    // 保存失敗時は直前の有効値へ戻し、エラーを通知する
    lastSavedMaxBatchOpenTabs = previousValue;
    maxBatchOpenTabs.value = previousValue;
    addUniqueToast({
      severity: 'error',
      summary: 'Error',
      detail: getSaveErrorMessage(err, 'Failed to save setting.'),
      life: 4000
    });
  } finally {
    if (pendingSaveMaxBatchPromise === task) {
      pendingSaveMaxBatchPromise = null;
    }
  }
};

/**
 * InputNumber の確定変更（スピンボタン・矢印キー・Enter・フォーカスアウト）を捕捉して保存します。
 * 空欄のまま確定された場合は直前の有効値へ復元します。
 * @param value - 更新後のモデル値（空欄時は null）
 * @returns 処理完了を示す Promise
 */
const handleMaxBatchOpenTabsUpdate = async (value: number | null): Promise<void> => {
  clearMaxBatchDebounceTimer();
  pendingMaxBatchOpenTabs = null;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    // 同一ティック内で元の値に戻すと InputNumber 側の watch が発火しないため nextTick 後に復元する
    await nextTick();
    maxBatchOpenTabs.value = lastSavedMaxBatchOpenTabs;
    return;
  }

  await saveMaxBatchOpenTabs(value, true);
};

/**
 * InputNumber への直接キー入力を捕捉し、有効範囲（1〜100）の数値であればデバウンス保存を予約します。
 * フォーカスを外さずそのままリロード・遷移する場合の取りこぼしを防ぎます。
 * @param event - InputNumber の入力イベントオブジェクト
 * @returns なし
 */
const handleMaxBatchOpenTabsInput = (event: InputNumberInputEvent): void => {
  if (
    typeof event.value !== 'number' ||
    !Number.isFinite(event.value) ||
    event.value < 1 ||
    event.value > 100
  ) {
    clearMaxBatchDebounceTimer();
    pendingMaxBatchOpenTabs = null;
    return;
  }

  const normalized = clampMaxBatchOpenTabs(event.value);
  if (normalized === lastSavedMaxBatchOpenTabs) {
    clearMaxBatchDebounceTimer();
    pendingMaxBatchOpenTabs = null;
    return;
  }

  pendingMaxBatchOpenTabs = normalized;
  clearMaxBatchDebounceTimer();
  maxBatchDebounceTimer = setTimeout(() => {
    maxBatchDebounceTimer = null;
    if (pendingMaxBatchOpenTabs !== null) {
      void saveMaxBatchOpenTabs(pendingMaxBatchOpenTabs, true);
    }
  }, 350);
};

/**
 * デバウンス待機中および実行中の安全上限設定保存をすべて完了させます。
 * @param showNotice - true の場合は保存完了トーストを表示します
 * @returns 完了を示す Promise
 */
const flushPendingMaxBatchOpenTabs = async (showNotice: boolean = false): Promise<void> => {
  clearMaxBatchDebounceTimer();
  if (pendingMaxBatchOpenTabs !== null) {
    await saveMaxBatchOpenTabs(pendingMaxBatchOpenTabs, showNotice);
  }
  if (pendingSaveMaxBatchPromise) {
    await pendingSaveMaxBatchPromise;
  }
};

/**
 * ページ離脱（リロード・タブ閉じ等）直前に未保存の安全上限入力値をストレージへフラッシュします。
 * @returns なし
 */
const handlePageHide = (): void => {
  if (pendingMaxBatchOpenTabs !== null) {
    void flushPendingMaxBatchOpenTabs(false);
  }
};

/**
 * 言語設定を保存し、画面内の表示文言を即座に再描画します。
 * @returns 保存完了を示す Promise
 */
const saveLanguage = async (): Promise<void> => {
  await setLocale(selectedLanguage.value);
  renderKey.value++;

  addUniqueToast({
    severity: 'success',
    summary: t('saveSuccess'),
    detail: t('saveSuccess'),
    life: 3000
  });
};

/**
 * 同期設定の更新および必要に応じてブックマーク・プリセット・別タブ開き方・テーマカラー設定のデータ保存を行い、失敗時は元の設定へロールバックします。
 * @param targetEnabled - 切り替え後の同期設定（true: 有効、false: 無効）
 * @param bookmarksToSave - 切り替え先にコピー保存するブックマークデータ（省略時は設定変更のみ）
 * @param presetsToSave - 切り替え先にコピー保存するプリセット ID 配列（省略時は移行先既存値を維持）
 * @param openInNewTabToSave - 切り替え先にコピー保存する「デフォルトで別タブで開く」設定（省略時は移行先既存値を維持）
 * @param openInCurrentIfNewTabToSave - 切り替え先にコピー保存する「“新しいタブ”のときはそのタブで開く」設定（省略時は移行先既存値を維持）
 * @param themeColorToSave - 切り替え先にコピー保存するテーマカラー設定（省略時は移行先既存値を維持）
 * @param successNotice - 成功時のトースト通知設定
 * @param errorSummary - 失敗時のトースト見出し
 * @param fallbackError - 不明エラー時のフォールバック文言
 * @returns 成功した場合は true、失敗した場合は false
 */
const applySyncTransition = async (
  targetEnabled: boolean,
  bookmarksToSave: Record<string, BookmarkEntry[]> | null,
  presetsToSave: PresetId[] | null,
  openInNewTabToSave: boolean | null,
  openInCurrentIfNewTabToSave: boolean | null,
  themeColorToSave: ThemeColor | null,
  successNotice: { severity: 'success' | 'info'; summary: string; detail: string },
  errorSummary: string,
  fallbackError: string
): Promise<boolean> => {
  try {
    await setSyncEnabled(targetEnabled);
    if (bookmarksToSave) {
      await saveBookmarksData(bookmarksToSave);
    }
    if (presetsToSave !== null) {
      await setEnabledPresetIds(presetsToSave);
    } else if (targetEnabled) {
      // クラウド側の既存データを採用して同期を有効化した場合は、クラウドのプリセット設定をローカルにもミラーする
      const cloudPresets = await loadEnabledPresetsFromStorage('sync');
      await saveEnabledPresetsToStorage('local', cloudPresets);
    }
    if (openInNewTabToSave !== null) {
      await setOpenInNewTab(openInNewTabToSave);
    } else if (targetEnabled) {
      // クラウド側の既存データを採用して同期を有効化した場合は、クラウドの別タブ開き方設定をローカルにもミラーする
      const cloudOpenInNewTab = await loadOpenInNewTabFromStorage('sync');
      await saveOpenInNewTabToStorage('local', cloudOpenInNewTab);
    }
    if (openInCurrentIfNewTabToSave !== null) {
      await setOpenInCurrentIfNewTab(openInCurrentIfNewTabToSave);
    } else if (targetEnabled) {
      // クラウド側の既存データを採用して同期を有効化した場合は、新しいタブ時の現在タブ開き方設定もローカルへミラーする
      const cloudOpenInCurrentIfNewTab = await loadOpenInCurrentIfNewTabFromStorage('sync');
      await saveOpenInCurrentIfNewTabToStorage('local', cloudOpenInCurrentIfNewTab);
    }
    if (themeColorToSave !== null) {
      await setThemeColor(themeColorToSave);
    } else if (targetEnabled) {
      // クラウド側の既存データを採用して同期を有効化した場合は、クラウドのテーマカラー設定をローカルにもミラーする
      const cloudThemeColor = await loadThemeColorFromStorage('sync');
      await saveThemeColorToStorage('local', cloudThemeColor);
    }
    syncEnabled.value = targetEnabled;
    enabledPresetIds.value = await getEnabledPresetIds(true);
    openInNewTab.value = await getOpenInNewTab(true);
    openInCurrentIfNewTab.value = await getOpenInCurrentIfNewTab(true);
    const syncedThemeColor = await getThemeColor(true);
    selectedThemeColor.value = syncedThemeColor;
    applyThemeColor(syncedThemeColor);
    addUniqueToast({ ...successNotice, life: 3000 });
    return true;
  } catch (err: unknown) {
    await setSyncEnabled(!targetEnabled);
    enabledPresetIds.value = await getEnabledPresetIds(true);
    openInNewTab.value = await getOpenInNewTab(true);
    openInCurrentIfNewTab.value = await getOpenInCurrentIfNewTab(true);
    const restoredThemeColor = await getThemeColor(true);
    selectedThemeColor.value = restoredThemeColor;
    applyThemeColor(restoredThemeColor);
    addUniqueToast({
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
  const [local, localPresets, localOpenInNewTab, localOpenInCurrentIfNewTab, localThemeColor] = await Promise.all([
    getStorageDataWithTimestamp('local'),
    loadEnabledPresetsFromStorage('local'),
    loadOpenInNewTabFromStorage('local'),
    loadOpenInCurrentIfNewTabFromStorage('local'),
    loadThemeColorFromStorage('local')
  ]);

  if (newValue) {
    if (isOverQuota(local.bookmarks)) {
      addUniqueToast({
        severity: 'error',
        summary: 'Error',
        detail:
          t('errorSyncQuotaExceeded') ||
          'Local data exceeds 100KB. Please reduce data before enabling sync.',
        life: 5000
      });
      return;
    }

    const [sync, syncPresets, syncOpenInNewTab, syncOpenInCurrentIfNewTab, syncThemeColor] = await Promise.all([
      getStorageDataWithTimestamp('sync'),
      loadEnabledPresetsFromStorage('sync'),
      loadOpenInNewTabFromStorage('sync'),
      loadOpenInCurrentIfNewTabFromStorage('sync'),
      loadThemeColorFromStorage('sync')
    ]);
    if (
      Object.keys(sync.bookmarks).length > 0 ||
      syncPresets.length > 0 ||
      syncOpenInNewTab ||
      syncOpenInCurrentIfNewTab ||
      syncThemeColor !== DEFAULT_THEME_COLOR
    ) {
      migrationType.value = 'enable';
      migrationMessage.value =
        t('confirmEnableSyncWithData') ||
        'Existing cloud data found. Which data do you want to use?';
      localInfo.value = {
        ...local,
        presets: localPresets,
        openInNewTab: localOpenInNewTab,
        openInCurrentIfNewTab: localOpenInCurrentIfNewTab,
        themeColor: localThemeColor
      };
      syncInfo.value = {
        ...sync,
        presets: syncPresets,
        openInNewTab: syncOpenInNewTab,
        openInCurrentIfNewTab: syncOpenInCurrentIfNewTab,
        themeColor: syncThemeColor
      };
      showMigrationDialog.value = true;
      return;
    }

    await applySyncTransition(
      true,
      local.bookmarks,
      localPresets,
      localOpenInNewTab,
      localOpenInCurrentIfNewTab,
      localThemeColor,
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

  const [sync, syncPresets, syncOpenInNewTab, syncOpenInCurrentIfNewTab, syncThemeColor] = await Promise.all([
    getStorageDataWithTimestamp('sync'),
    loadEnabledPresetsFromStorage('sync'),
    loadOpenInNewTabFromStorage('sync'),
    loadOpenInCurrentIfNewTabFromStorage('sync'),
    loadThemeColorFromStorage('sync')
  ]);
  if (
    Object.keys(local.bookmarks).length > 0 ||
    localPresets.length > 0 ||
    localOpenInNewTab ||
    localOpenInCurrentIfNewTab ||
    localThemeColor !== DEFAULT_THEME_COLOR
  ) {
    migrationType.value = 'disable';
    migrationMessage.value =
      t('confirmDisableSyncWithData') ||
      'Local data already exists. Which data do you want to keep?';
    localInfo.value = {
      ...local,
      presets: localPresets,
      openInNewTab: localOpenInNewTab,
      openInCurrentIfNewTab: localOpenInCurrentIfNewTab,
      themeColor: localThemeColor
    };
    syncInfo.value = {
      ...sync,
      presets: syncPresets,
      openInNewTab: syncOpenInNewTab,
      openInCurrentIfNewTab: syncOpenInCurrentIfNewTab,
      themeColor: syncThemeColor
    };
    showMigrationDialog.value = true;
    return;
  }

  await applySyncTransition(
    false,
    sync.bookmarks,
    syncPresets,
    syncOpenInNewTab,
    syncOpenInCurrentIfNewTab,
    syncThemeColor,
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
  const sourcePresets = isEnabling
    ? localInfo.value?.presets ?? null
    : syncInfo.value?.presets ?? null;
  const sourceOpenInNewTab = isEnabling
    ? localInfo.value?.openInNewTab ?? null
    : syncInfo.value?.openInNewTab ?? null;
  const sourceOpenInCurrentIfNewTab = isEnabling
    ? localInfo.value?.openInCurrentIfNewTab ?? null
    : syncInfo.value?.openInCurrentIfNewTab ?? null;
  const sourceThemeColor = isEnabling
    ? localInfo.value?.themeColor ?? null
    : syncInfo.value?.themeColor ?? null;

  const ok = await applySyncTransition(
    isEnabling,
    sourceBookmarks,
    sourcePresets,
    sourceOpenInNewTab,
    sourceOpenInCurrentIfNewTab,
    sourceThemeColor,
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
    null,
    null,
    null,
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
    null,
    null,
    null,
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
 * 未保存の入力を確定させてからブックマーク一覧画面へ戻ります。
 * @returns 遷移前の保存完了を示す Promise
 */
const goBack = async (): Promise<void> => {
  await flushPendingMaxBatchOpenTabs(false);
  window.location.href = 'list.html';
};

onMounted(async () => {
  window.addEventListener('pagehide', handlePageHide);
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChanged);
  }
  await loadSettings();
});

onUnmounted(() => {
  window.removeEventListener('pagehide', handlePageHide);
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(handleStorageChanged);
  }
  clearMaxBatchDebounceTimer();
  if (maxBatchToastTimer !== null) {
    clearTimeout(maxBatchToastTimer);
    maxBatchToastTimer = null;
  }
  if (presetToastTimer !== null) {
    clearTimeout(presetToastTimer);
    presetToastTimer = null;
  }
});
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  background-color: var(--p-page-background);
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

.sub-setting-row {
  margin-top: 1rem;
  padding-top: 1rem;
  padding-left: 1rem;
  border-top: 1px solid var(--p-content-border-color);
  border-left: 2px solid color-mix(in srgb, var(--p-primary-color) 40%, var(--p-content-border-color));
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
  background: var(--p-form-field-filled-background);
  color: var(--p-text-color);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
}

.comparison-item {
  flex: 1;
  text-align: center;
  padding: 0.75rem 0.5rem;
  border-radius: 6px;
  min-width: 0;
}

.comparison-item.latest {
  background: var(--p-highlight-background);
  color: var(--p-highlight-color);
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 35%, transparent);
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

.presets-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.presets-bulk-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.presets-intro {
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

.preset-category-block {
  margin-top: 1.25rem;
}

.preset-category-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 0.75rem;
}

.preset-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 0.875rem;
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
  background-color: var(--p-content-background);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  user-select: none;
}

.preset-item:hover {
  border-color: color-mix(in srgb, var(--p-primary-color) 45%, var(--p-content-border-color));
}

.preset-item.is-enabled {
  background-color: color-mix(in srgb, var(--p-primary-color) 8%, var(--p-content-background));
  border-color: color-mix(in srgb, var(--p-primary-color) 45%, var(--p-content-border-color));
}

.preset-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.preset-item-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.preset-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  font-weight: 700;
  background-color: var(--p-highlight-background);
  color: var(--p-highlight-color);
}

.preset-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.preset-type-tag {
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--p-text-muted-color);
  margin-left: auto;
}

.preset-preview {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.theme-color-intro {
  margin-bottom: 1rem;
  line-height: 1.5;
}

.theme-swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.theme-swatch-option {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.875rem;
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
  background-color: var(--p-content-background);
  color: var(--p-text-color);
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  text-align: left;
}

.theme-swatch-option:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--p-primary-color) 45%, var(--p-content-border-color));
}

.theme-swatch-option:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.theme-swatch-option.is-selected {
  background-color: color-mix(in srgb, var(--p-primary-color) 10%, var(--p-content-background));
  border-color: var(--p-primary-color);
  font-weight: 600;
}

.theme-swatch-option:disabled {
  opacity: 0.65;
  cursor: wait;
}

.theme-swatch-dot {
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}

.theme-swatch-check {
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 700;
}

.theme-swatch-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
