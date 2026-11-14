<template>
  <div class="container" v-if="isLoaded">
    <Toast />
    <ConfirmDialog />

    <div class="header">
      <h1>{{ title }}</h1>
      <Button
        icon="pi pi-cog"
        severity="secondary"
        text
        rounded
        size="large"
        class="prefs-btn"
        :aria-label="t('preferencesTitle') || 'Preferences'"
        v-tooltip.left="t('preferencesTitle') || 'Preferences'"
        @click="openPreferences"
      />
    </div>

    <Message v-if="hasAnyBookmarklet && !userScriptsAllowed" severity="warn" class="mb-4">
      <div class="user-scripts-banner-content">
        <span>{{ t('errorUserScriptsNotAllowed') }}</span>
        <Button
          size="small"
          severity="warn"
          outlined
          icon="pi pi-external-link"
          :label="t('openExtensionSettingsBtn') || 'Open Extension Settings'"
          @click="openExtensionDetails"
        />
      </div>
    </Message>

    <Card class="mb-4">
      <template #title>{{ t('addBookmarkTitle') || 'Add Nickmark' }}</template>
      <template #content>
        <div class="form-grid">
          <div class="field">
            <label for="nickname">{{ t('nicknameLabel') || 'Nickname' }}</label>
            <AutoComplete
              id="nickname"
              v-model="newBookmark.nickname"
              :suggestions="newBookmarkNicknameSuggestions"
              class="w-full"
              inputClass="w-full"
              placeholder="e.g. work/gh"
              @complete="searchNewBookmarkNicknames"
            />
          </div>
          <div class="field">
            <label for="titleInput">{{ t('titleLabel') || 'Title (Optional)' }}</label>
            <InputText id="titleInput" v-model="newBookmark.title" placeholder="My GitHub" />
          </div>
          <div class="field">
            <label for="url">{{ t('urlLabel') || 'URL' }}</label>
            <InputText id="url" v-model="newBookmark.url" placeholder="https://... or javascript:..." />
          </div>
          <div class="field-btn">
            <Button :label="t('addBtn') || 'Add'" icon="pi pi-plus" @click="addBookmark" />
          </div>
        </div>
        <div v-if="isDynamicUrl(newBookmark.url)" class="default-value-field">
          <label for="defaultValue">{{ t('defaultValueLabel') || 'Default value when query is omitted (Optional)' }}</label>
          <InputText
            id="defaultValue"
            v-model="newBookmark.default_value"
            :placeholder="t('defaultValuePlaceholder') || 'Default value for %s (navigates to site\'s top page if left blank)'"
            class="w-full"
          />
        </div>
      </template>
    </Card>

    <Card class="mb-4">
      <template #title>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>{{ t('manageNickmarksTitle') || 'Manage Nickmarks' }}</span>
          <div style="display: flex; gap: 0.5rem;">
            <Button :label="t('exportBtn') || 'Export'" icon="pi pi-download" severity="secondary" size="small" @click="downloadJsonFile" />
            <Button :label="t('editJsonBtn') || 'Jsonで編集'" icon="pi pi-code" size="small" @click="openJsonDialog" />
          </div>
        </div>
      </template>
      <template #content>
        <!-- フォルダ絞り込み・一括操作バー -->
        <div class="folder-toolbar mb-3">
          <div class="folder-select-group">
            <label for="folder-filter" class="folder-filter-label">
              <i class="pi pi-folder" style="margin-right: 0.25rem;"></i>
              {{ t('folderFilterLabel') || 'Folder' }}:
            </label>
            <Select
              id="folder-filter"
              v-model="selectedFolder"
              :options="folderOptions"
              optionLabel="label"
              optionValue="value"
              class="folder-select"
            />
          </div>
          <div v-if="isSpecificFolderSelected" class="folder-actions-group">
            <Button
              icon="pi pi-external-link"
              :label="t('openFolderBtn') || 'Open All'"
              severity="secondary"
              size="small"
              @click="batchOpenSelectedFolder"
            />
            <Button
              icon="pi pi-pencil"
              :label="t('renameFolderBtn') || 'Rename'"
              severity="secondary"
              size="small"
              text
              @click="openRenameFolderDialog"
            />
            <Button
              icon="pi pi-trash"
              :label="t('deleteFolderBtn') || 'Delete'"
              severity="danger"
              size="small"
              text
              @click="confirmDeleteSelectedFolder"
            />
          </div>
        </div>

        <DataTable :value="filteredBookmarks" stripedRows tableStyle="min-width: 50rem" :paginator="true" :rows="10">
          <Column field="nickname" :header="t('nicknameLabel') || 'Nickname'" sortable></Column>
          <Column field="title" :header="t('titleLabel') || 'Title'" sortable></Column>
          <Column field="url" :header="t('urlLabel') || 'URL'" sortable>
            <template #body="slotProps">
              <div v-if="isBookmarkletUrl(slotProps.data.url)" class="flex align-items-center gap-2">
                <i class="pi pi-code bookmarklet-icon" aria-hidden="true"></i>
                <span class="url-text bookmarklet-text" :title="slotProps.data.url">{{ slotProps.data.url }}</span>
              </div>
              <div v-else class="flex align-items-center gap-2">
                <img :src="getFaviconUrl(resolveNavigableUrl(slotProps.data))" class="favicon-img" alt="" />
                <a :href="resolveNavigableUrl(slotProps.data)" target="_blank" rel="noopener noreferrer" class="url-link">
                  <span class="url-text">{{ slotProps.data.url }}</span>
                </a>
              </div>
            </template>
          </Column>
          <Column :header="t('isPinnedLabel') || 'Pinned'" class="text-center" style="width: 4rem">
            <template #body="slotProps">
              <Button
                icon="pi pi-thumbtack"
                :severity="slotProps.data.is_pinned ? 'primary' : 'secondary'"
                :text="!slotProps.data.is_pinned"
                rounded
                @click="togglePin(slotProps.data)"
                v-tooltip="slotProps.data.is_pinned ? t('unpinTooltip') : t('pinTooltip')"
              />
            </template>
          </Column>
          <Column :header="t('actionsLabel') || 'Actions'">
            <template #body="slotProps">
              <Button icon="pi pi-pencil" severity="secondary" text rounded aria-label="Edit" @click="openEditDialog(slotProps.data)" />
              <Button icon="pi pi-trash" severity="danger" text rounded aria-label="Delete" @click="deleteBookmark(slotProps.data.nickname, slotProps.data.url)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- フォルダリネームダイアログ -->
    <Dialog
      v-model:visible="showRenameDialog"
      modal
      :header="t('renameFolderDialogTitle') || 'Rename Folder'"
      :style="{ width: '450px', maxWidth: '90vw' }"
    >
      <div class="form-grid">
        <div class="field w-full">
          <label for="new-folder-name">{{ t('newFolderNameLabel') || 'New Folder Name' }}</label>
          <InputText
            id="new-folder-name"
            v-model="newFolderName"
            class="w-full"
            placeholder="e.g. office"
            @keydown.enter.prevent="executeRenameFolder"
          />
        </div>
      </div>
      <template #footer>
        <Button :label="t('cancelBtn') || 'Cancel'" icon="pi pi-times" text @click="showRenameDialog = false" />
        <Button :label="t('saveBtn') || 'Save'" icon="pi pi-check" @click="executeRenameFolder" autofocus />
      </template>
    </Dialog>

    <!-- ブックマーク編集ダイアログ -->
    <Dialog v-model:visible="showEditDialog" modal :header="t('editBookmarkTitle') || 'Edit Nickmark'" :style="{ width: '1100px', maxWidth: '95vw' }">
      <div class="form-grid">
        <div class="field">
          <label for="edit-nickname">{{ t('nicknameLabel') || 'Nickname' }}</label>
          <InputText id="edit-nickname" v-model="editBookmarkData.nickname" />
        </div>
        <div class="field">
          <label for="edit-title">{{ t('titleLabel') || 'Title' }}</label>
          <InputText id="edit-title" v-model="editBookmarkData.title" />
        </div>
        <div class="field">
          <label for="edit-url">{{ t('urlLabel') || 'URL' }}</label>
          <InputText id="edit-url" v-model="editBookmarkData.url" />
        </div>
        <div class="field-btn">
          <Button
            icon="pi pi-thumbtack"
            :severity="editBookmarkData.is_pinned ? 'primary' : 'secondary'"
            :text="!editBookmarkData.is_pinned"
            rounded
            :aria-label="t('isPinnedLabel') || 'Pinned'"
            v-tooltip="editBookmarkData.is_pinned ? t('unpinTooltip') : t('pinTooltip')"
            @click="editBookmarkData.is_pinned = !editBookmarkData.is_pinned"
          />
        </div>
      </div>
      <div v-if="isDynamicUrl(editBookmarkData.url)" class="default-value-field">
        <label for="edit-default-value">{{ t('defaultValueLabel') || 'Default value when query is omitted (Optional)' }}</label>
        <InputText
          id="edit-default-value"
          v-model="editBookmarkData.default_value"
          :placeholder="t('defaultValuePlaceholder') || 'Default value for %s (navigates to site\'s top page if left blank)'"
          class="w-full"
        />
      </div>
      <template #footer>
        <Button :label="t('cancelBtn') || 'Cancel'" icon="pi pi-times" text @click="showEditDialog = false" />
        <Button :label="t('saveBtn') || 'Save'" icon="pi pi-check" @click="saveEditBookmark" autofocus />
      </template>
    </Dialog>

    <!-- JSON 編集ダイアログ -->
    <Dialog v-model:visible="showJsonDialog" modal :header="t('editJsonBtn') || 'Edit in JSON'" maximizable :style="{ width: '90vw' }" :contentStyle="{ height: '70vh', display: 'flex', flexDirection: 'column' }">
      <JsonEditor
        v-model:text="jsonEditText"
        mode="text"
        :darkTheme="true"
        style="flex: 1; min-height: 0;"
      />
      <template #footer>
        <Button :label="t('cancelBtn') || 'Cancel'" icon="pi pi-times" text @click="showJsonDialog = false" />
        <Button :label="t('saveBtn') || 'Save'" icon="pi pi-check" @click="saveJsonEdit" autofocus :disabled="!isJsonValid" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import JsonEditor from 'vue3-ts-jsoneditor';
import InputText from 'primevue/inputtext';
import AutoComplete, { AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Card from 'primevue/card';
import Toast from 'primevue/toast';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import Select from 'primevue/select';
import ConfirmDialog from 'primevue/confirmdialog';

import { BookmarkEntry } from './shared/types';
import {
  getFaviconUrl,
  isBookmarkletUrl,
  isDynamicUrl,
  isSameUrl,
  isUserScriptsAvailable,
  normalizeNicknamePath,
  resolveNavigableUrl
} from './shared/url';
import { renderToastInDocument } from './shared/toast';
import {
  createBookmarkEntry,
  deleteFolder,
  extractFolders,
  getMaxBatchOpenTabs,
  getSaveErrorMessage,
  loadBookmarksData,
  openFolderUrls,
  renameFolder,
  saveBookmarksData
} from './shared/storage';
import { filterNicknameSuggestions } from './shared/search';
import { initI18n, t } from './i18n';

/**
 * 一覧テーブルに表示するフラット化済みブックマーク行の型定義
 */
interface FlatBookmarkRow extends BookmarkEntry {
  nickname: string;
}

/**
 * 編集ダイアログで扱うフォームデータの型定義
 */
interface EditBookmarkForm {
  originalNickname: string;
  originalUrl: string;
  nickname: string;
  url: string;
  title: string;
  default_value: string;
  score: number;
  last_used_at: number;
  created_at: number;
  is_pinned: boolean;
}

const toast = useToast();
const confirm = useConfirm();

const title = ref('');
const bookmarksData = ref<Record<string, BookmarkEntry[]>>({});
const isLoaded = ref(false);
const userScriptsAllowed = ref(true);

const newBookmark = ref({
  nickname: '',
  url: '',
  title: '',
  default_value: ''
});

const newBookmarkNicknameSuggestions = ref<string[]>([]);

/**
 * 新規登録フォーム用のニックネームおよびフォルダプレフィックス補完候補を検索します。
 * @param event - AutoComplete 入力イベント
 * @returns なし
 */
const searchNewBookmarkNicknames = (event: AutoCompleteCompleteEvent): void => {
  newBookmarkNicknameSuggestions.value = filterNicknameSuggestions(
    event.query || '',
    bookmarksData.value
  );
};

// 編集ダイアログの状態
const showEditDialog = ref(false);
const editBookmarkData = ref<EditBookmarkForm>({
  originalNickname: '',
  originalUrl: '',
  nickname: '',
  url: '',
  title: '',
  default_value: '',
  score: 1.0,
  last_used_at: 0,
  created_at: 0,
  is_pinned: false
});

// JSON 編集ダイアログの状態
const showJsonDialog = ref(false);
const jsonEditText = ref('');

/**
 * JSON エディタ内の文字列が有効な JSON 構文であるかを検証します。
 * @returns パース可能な場合は true
 */
const isJsonValid = computed((): boolean => {
  if (!jsonEditText.value) return false;
  try {
    JSON.parse(jsonEditText.value);
    return true;
  } catch {
    return false;
  }
});

// フォルダ絞り込み・管理状態
const selectedFolder = ref<string>('__ALL__');
const showRenameDialog = ref(false);
const newFolderName = ref('');

/**
 * 具体的なフォルダが選択されているか（すべて・ルート以外）を判定します。
 * @returns フォルダ選択中の場合は true
 */
const isSpecificFolderSelected = computed((): boolean => {
  return selectedFolder.value !== '__ALL__' && selectedFolder.value !== '__ROOT__';
});

/**
 * 辞書形式のブックマークデータをテーブル表示用のフラット配列へ変換します。
 * @returns フラット化されたブックマーク行の配列
 */
const flatBookmarks = computed((): FlatBookmarkRow[] => {
  const result: FlatBookmarkRow[] = [];
  for (const [nickname, entries] of Object.entries(bookmarksData.value)) {
    for (const entry of entries) {
      result.push({
        nickname,
        ...entry
      });
    }
  }
  return result;
});

/**
 * フォルダ絞り込み用 Select の選択肢配列を算出します。
 * @returns 選択肢オブジェクトの配列
 */
const folderOptions = computed(() => {
  const folders = extractFolders(bookmarksData.value);
  const options = [
    { label: t('allFoldersOption') || 'すべてのフォルダ', value: '__ALL__' },
    { label: t('rootFolderOption') || '未分類（ルート）', value: '__ROOT__' }
  ];

  const sortedFolders = Array.from(folders.values()).sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sortedFolders) {
    options.push({
      label: `📁 ${f.path} (${f.openableUrlCount})`,
      value: f.path
    });
  }

  return options;
});

/**
 * 選択中フォルダに応じてテーブルに表示するブックマーク行を絞り込みます。
 * @returns 絞り込み済みのブックマーク行配列
 */
const filteredBookmarks = computed((): FlatBookmarkRow[] => {
  if (selectedFolder.value === '__ALL__') {
    return flatBookmarks.value;
  }
  if (selectedFolder.value === '__ROOT__') {
    return flatBookmarks.value.filter(item => !normalizeNicknamePath(item.nickname).includes('/'));
  }
  const folderPath = normalizeNicknamePath(selectedFolder.value);
  const prefix = folderPath + '/';
  return flatBookmarks.value.filter(item => normalizeNicknamePath(item.nickname).startsWith(prefix));
});

/**
 * 選択中フォルダの全ブックマークを一括で開きます。
 * @returns 処理完了を示す Promise
 */
const batchOpenSelectedFolder = async (): Promise<void> => {
  if (!isSpecificFolderSelected.value) return;
  const folderPath = selectedFolder.value;
  const result = await openFolderUrls(folderPath, false);

  if (result.requiresConfirmation && result.folderPath && result.urls) {
    const maxLimit = await getMaxBatchOpenTabs();
    confirm.require({
      header: t('confirmBatchOpenTitle') || '大量タブオープンの確認',
      message:
        t('confirmBatchOpenMessage', [folderPath, String(result.urls.length), String(maxLimit)]) ||
        `フォルダ「${folderPath}」には ${result.urls.length} 件のタブが含まれています。安全上限（${maxLimit}件）を超えていますが、すべて開きますか？`,
      icon: 'pi pi-exclamation-triangle',
      rejectProps: {
        severity: 'secondary',
        outlined: true,
        label: t('cancelBtn') || 'キャンセル'
      },
      acceptProps: {
        severity: 'primary',
        label: t('confirmBatchOpenBtn') || 'すべて開く'
      },
      accept: async () => {
        const confirmedResult = await openFolderUrls(folderPath, true);
        if (confirmedResult.success) {
          toast.add({
            severity: 'success',
            summary: 'Success',
            detail: `${confirmedResult.openedCount} tabs opened.`,
            life: 3000
          });
        }
      }
    });
  } else if (result.success) {
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: `${result.openedCount} tabs opened.`,
      life: 3000
    });
  }
};

/**
 * フォルダ名変更ダイアログを開きます。
 * @returns なし
 */
const openRenameFolderDialog = (): void => {
  if (!isSpecificFolderSelected.value) return;
  newFolderName.value = selectedFolder.value;
  showRenameDialog.value = true;
};

/**
 * フォルダ名の一括変更を実行します。
 * @returns 処理完了を示す Promise
 */
const executeRenameFolder = async (): Promise<void> => {
  const oldPath = selectedFolder.value;
  const newPath = normalizeNicknamePath(newFolderName.value);
  if (!newPath || normalizeNicknamePath(oldPath) === newPath) {
    showRenameDialog.value = false;
    return;
  }

  const res = await renameFolder(oldPath, newPath);
  if (res.success) {
    await loadBookmarks();
    selectedFolder.value = newPath;
    showRenameDialog.value = false;
    toast.add({
      severity: 'success',
      summary: 'Renamed',
      detail:
        t('renameFolderSuccessMessage', [newPath, String(res.affectedCount)]) ||
        `フォルダ名を「${newPath}」に変更しました。`,
      life: 3000
    });
  } else {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: res.error || 'Failed to rename folder.',
      life: 4000
    });
  }
};

/**
 * 選択中フォルダの全ブックマーク一括削除を確認・実行します。
 * @returns なし
 */
const confirmDeleteSelectedFolder = (): void => {
  if (!isSpecificFolderSelected.value) return;
  const folderPath = selectedFolder.value;
  const count = filteredBookmarks.value.length;

  confirm.require({
    header: t('confirmDeleteFolderTitle') || 'フォルダの削除確認',
    message:
      t('confirmDeleteFolderMessage', [folderPath, String(count)]) ||
      `フォルダ「${folderPath}」配下のすべてのブックマーク（${count}件）を削除しますか？この操作は元に戻せません。`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: {
      severity: 'secondary',
      outlined: true,
      label: t('cancelBtn') || 'キャンセル'
    },
    acceptProps: {
      severity: 'danger',
      label: t('deleteFolderBtn') || '削除'
    },
    accept: async () => {
      const res = await deleteFolder(folderPath);
      if (res.success) {
        await loadBookmarks();
        selectedFolder.value = '__ALL__';
        toast.add({
          severity: 'info',
          summary: 'Deleted',
          detail:
            t('deleteFolderSuccessMessage', [folderPath]) ||
            `フォルダ「${folderPath}」と配下のブックマークを削除しました。`,
          life: 3000
        });
      }
    }
  });
};

/**
 * 登録済みまたは入力中のデータにブックマークレット（`javascript:`）が含まれているかを判定します。
 * @returns 1件でも含まれる場合は true
 */
const hasAnyBookmarklet = computed((): boolean => {
  if (isBookmarkletUrl(newBookmark.value.url)) return true;
  if (showEditDialog.value && isBookmarkletUrl(editBookmarkData.value.url)) return true;
  return flatBookmarks.value.some(item => isBookmarkletUrl(item.url));
});

/**
 * `chrome.userScripts` API の許可状態を再確認します。
 * @returns なし
 */
const refreshUserScriptsStatus = (): void => {
  userScriptsAllowed.value = isUserScriptsAvailable();
};

/**
 * Chrome の拡張機能詳細設定画面（`chrome://extensions/?id=...`）を新しいタブで開きます。
 * @returns なし
 */
const openExtensionDetails = (): void => {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime?.id) {
    chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  }
};

/**
 * ブックマークデータを読み込みます。
 * @param force - true の場合、メモリキャッシュを破棄してストレージから再取得します
 * @returns 読み込み完了を示す Promise
 */
const loadBookmarks = async (force: boolean = false): Promise<void> => {
  bookmarksData.value = await loadBookmarksData(force);
};

/**
 * タブへのフォーカス復帰時または表示状態変更時に、ユーザースクリプト状態、保留中の通知、ブックマーク一覧を同期します。
 * 編集ダイアログ等が開かれている場合は、ユーザーの作業内容を保護するため一覧の再読み込みをスキップします。
 * @returns 同期完了を示す Promise
 */
const onWindowFocusOrVisible = async (): Promise<void> => {
  refreshUserScriptsStatus();
  if (document.visibilityState === 'hidden') return;
  await checkAndConsumePendingToast();
  if (showEditDialog.value || showJsonDialog.value || showRenameDialog.value) {
    return;
  }
  await loadBookmarks(true);
};

let lastToastMessage = '';
let lastToastTime = 0;

/**
 * 管理画面上に中央トースト通知（黒い帯）を表示します。
 * 直近に同じメッセージが表示された場合は重複表示を防止します。
 * @param message - 表示する通知メッセージ
 * @returns なし
 */
const showCustomToast = (message: string): void => {
  if (!message) return;
  const now = Date.now();
  // 2秒以内の同一メッセージは二重表示を防止する
  if (message === lastToastMessage && now - lastToastTime < 2000) {
    return;
  }
  lastToastMessage = message;
  lastToastTime = now;

  renderToastInDocument(message, 4000, 'nickmark-custom-toast', '9999');
};

/**
 * バックグラウンドから保存された保留中のトースト通知（pendingToast）を確認し、
 * 存在する場合は通知を表示してストレージから削除します。
 * @returns 処理完了を示す Promise
 */
const checkAndConsumePendingToast = async (): Promise<void> => {
  try {
    const data = await chrome.storage.local.get('pendingToast');
    if (typeof data.pendingToast === 'string' && data.pendingToast) {
      await chrome.storage.local.remove('pendingToast');
      showCustomToast(data.pendingToast);
    }
  } catch (e) {
    console.error('Failed to consume pending toast:', e);
  }
};

onMounted(async () => {
  await initI18n();
  title.value = (t('extensionName') || 'Nickmark') + ' Bookmarks';
  refreshUserScriptsStatus();
  await loadBookmarks();
  await checkAndConsumePendingToast();

  // 拡張機能設定タブや他タブから戻ってきた際にユーザースクリプト状態とブックマーク一覧を即時反映する
  window.addEventListener('focus', onWindowFocusOrVisible);
  document.addEventListener('visibilitychange', onWindowFocusOrVisible);

  // バックグラウンドからの状態更新メッセージを待ち受ける
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request && request.action === 'updatePage') {
      if (request.url) newBookmark.value.url = request.url;
      if (request.title) newBookmark.value.title = request.title;
      chrome.storage.local.remove('pendingToast').catch(() => {});
      if (request.msg) showCustomToast(request.msg);
      loadBookmarks(true).then(() => {
        sendResponse({ success: true });
      });
      return true;
    }
  });

  // URL パラメータ経由のメッセージおよび初期入力値の確認
  const urlParams = new URLSearchParams(window.location.search);
  const msg = urlParams.get('msg');
  const prefilledUrl = urlParams.get('url');
  const prefilledTitle = urlParams.get('title');

  if (prefilledUrl) newBookmark.value.url = prefilledUrl;
  if (prefilledTitle) newBookmark.value.title = prefilledTitle;
  if (msg) showCustomToast(msg);

  if (msg || prefilledUrl || prefilledTitle) {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
  isLoaded.value = true;
});

onUnmounted(() => {
  window.removeEventListener('focus', onWindowFocusOrVisible);
  document.removeEventListener('visibilitychange', onWindowFocusOrVisible);
});

/**
 * 設定画面（preferences.html）へ遷移します。
 * @returns なし
 */
const openPreferences = (): void => {
  window.location.href = 'preferences.html';
};

/**
 * フォームの入力内容から新しいブックマークを登録します。
 * URL に `%s` が含まれる場合のみ、入力された `default_value`（引数省略時のデフォルト値）を保存します。
 * @returns 処理完了を示す Promise
 */
const addBookmark = async (): Promise<void> => {
  const { nickname, url, title: inputTitle, default_value } = newBookmark.value;
  const trimmedNickname = normalizeNicknamePath(nickname);
  const trimmedUrl = url.trim();
  const trimmedDefault = isDynamicUrl(trimmedUrl) ? (default_value || '').trim() : '';

  if (!trimmedNickname || !trimmedUrl) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: t('errorNicknameUrlRequired') || 'Nickname and URL are required.',
      life: 3000
    });
    return;
  }

  if (!bookmarksData.value[trimmedNickname]) {
    bookmarksData.value[trimmedNickname] = [];
  }

  if (bookmarksData.value[trimmedNickname].some(b => isSameUrl(b.url, trimmedUrl))) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: t('errorUrlExists') || 'This URL already exists for this nickname.',
      life: 3000
    });
    return;
  }

  bookmarksData.value[trimmedNickname].push(
    createBookmarkEntry(trimmedUrl, inputTitle.trim(), trimmedDefault)
  );

  try {
    await saveBookmarksData(bookmarksData.value);
    newBookmark.value = { nickname: '', url: '', title: '', default_value: '' };
    toast.add({
      severity: 'success',
      summary: t('successAdded') || 'Success',
      detail: t('successAdded') || 'Added successfully.',
      life: 3000
    });
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: getSaveErrorMessage(err),
      life: 4000
    });
  }
};

/**
 * 指定されたニックネームと URL に一致するブックマークを削除します。
 * @param nickname - 削除対象のニックネーム
 * @param url - 削除対象の URL
 * @returns 削除処理完了を示す Promise
 */
const deleteBookmark = async (nickname: string, url: string): Promise<void> => {
  if (!bookmarksData.value[nickname]) return;

  bookmarksData.value[nickname] = bookmarksData.value[nickname].filter(b => b.url !== url);
  if (bookmarksData.value[nickname].length === 0) {
    delete bookmarksData.value[nickname];
  }
  await saveBookmarksData(bookmarksData.value);
  toast.add({
    severity: 'success',
    summary: t('successDeleted') || 'Success',
    detail: t('successDeleted') || 'Deleted successfully.',
    life: 3000
  });
};

/**
 * 指定されたブックマークのピン留め状態をトグルして保存します。
 * @param data - 対象行のブックマークデータ
 * @returns 更新処理完了を示す Promise
 */
const togglePin = async (data: FlatBookmarkRow): Promise<void> => {
  const entries = bookmarksData.value[data.nickname];
  if (!entries) return;
  const entry = entries.find(b => b.url === data.url);
  if (entry) {
    entry.is_pinned = !entry.is_pinned;
    await saveBookmarksData(bookmarksData.value);
  }
};

/**
 * 現在のブックマークデータを JSON ファイルとしてエクスポート（ダウンロード）します。
 * @returns なし
 */
const downloadJsonFile = (): void => {
  const dataStr = JSON.stringify({ bookmarks: bookmarksData.value }, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nickmark_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.add({
    severity: 'success',
    summary: t('successExported') || 'Exported',
    detail: t('successFileDownloaded') || 'File downloaded successfully.',
    life: 3000
  });
};

/**
 * JSON エディタで編集されたブックマークデータの構造を検証します。
 * @param bookmarks - パースされた bookmarks オブジェクト
 * @returns 構造が妥当な場合は true、不正な場合は false
 */
const validateBookmarksJson = (bookmarks: unknown): bookmarks is Record<string, BookmarkEntry[]> => {
  if (!bookmarks || typeof bookmarks !== 'object') return false;
  const record = bookmarks as Record<string, unknown>;
  for (const nickname of Object.keys(record)) {
    if (normalizeNicknamePath(nickname) === '') {
      toast.add({ severity: 'error', summary: 'Error', detail: 'Nickname cannot be empty.', life: 3000 });
      return false;
    }
    const entries = record[nickname];
    if (!Array.isArray(entries)) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Invalid structure for nickname "${nickname}". Expected an array.`,
        life: 3000
      });
      return false;
    }
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: `Invalid entry for nickname "${nickname}".`,
          life: 3000
        });
        return false;
      }
      const candidate = entry as Partial<BookmarkEntry>;
      if (!candidate.url || typeof candidate.url !== 'string' || candidate.url.trim() === '') {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: `URL is required for nickname "${nickname}".`,
          life: 3000
        });
        return false;
      }
      if (candidate.default_value !== undefined && typeof candidate.default_value !== 'string') {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: `Invalid default_value for nickname "${nickname}". Expected a string.`,
          life: 3000
        });
        return false;
      }
    }
  }
  return true;
};

/**
 * 指定されたブックマーク行のデータを編集ダイアログに読み込んで表示します。
 * @param data - テーブル行のブックマークデータ
 * @returns なし
 */
const openEditDialog = (data: FlatBookmarkRow): void => {
  editBookmarkData.value = {
    originalNickname: data.nickname,
    originalUrl: data.url,
    nickname: data.nickname,
    url: data.url,
    title: data.title || '',
    default_value: data.default_value || '',
    score: data.score,
    last_used_at: data.last_used_at,
    created_at: data.created_at,
    is_pinned: !!data.is_pinned
  };
  showEditDialog.value = true;
};

/**
 * 編集ダイアログでの変更内容を保存します。
 * URL から `%s` が削除された場合は不要な `default_value` を除去して保存します。
 * @returns 処理完了を示す Promise
 */
const saveEditBookmark = async (): Promise<void> => {
  const { originalNickname, originalUrl, nickname, url, title: editTitle, default_value, is_pinned } =
    editBookmarkData.value;
  const newNickname = normalizeNicknamePath(nickname);
  const newUrl = url.trim();
  const trimmedDefault = isDynamicUrl(newUrl) ? (default_value || '').trim() : '';

  if (!newNickname || !newUrl) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: t('errorNicknameUrlRequired') || 'Nickname and URL are required.',
      life: 3000
    });
    return;
  }

  const isMoved = normalizeNicknamePath(originalNickname) !== newNickname || !isSameUrl(originalUrl, newUrl);
  if (isMoved && bookmarksData.value[newNickname]?.some(b => isSameUrl(b.url, newUrl))) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: t('errorUrlExists') || 'This URL already exists for this nickname.',
      life: 3000
    });
    return;
  }

  // 元の登録キー（および正規化キー）から旧エントリを除去する
  const removeKeys = new Set([originalNickname, normalizeNicknamePath(originalNickname)].filter(Boolean));
  for (const key of removeKeys) {
    if (bookmarksData.value[key]) {
      bookmarksData.value[key] = bookmarksData.value[key].filter(b => b.url !== originalUrl);
      if (bookmarksData.value[key].length === 0) {
        delete bookmarksData.value[key];
      }
    }
  }

  if (!bookmarksData.value[newNickname]) {
    bookmarksData.value[newNickname] = [];
  }
  const updatedEntry: BookmarkEntry = {
    url: newUrl,
    title: editTitle.trim(),
    score: editBookmarkData.value.score,
    last_used_at: editBookmarkData.value.last_used_at,
    created_at: editBookmarkData.value.created_at,
    is_pinned
  };
  if (trimmedDefault) {
    updatedEntry.default_value = trimmedDefault;
  }
  bookmarksData.value[newNickname].push(updatedEntry);

  try {
    await saveBookmarksData(bookmarksData.value);
    showEditDialog.value = false;
    toast.add({
      severity: 'success',
      summary: t('successUpdated') || 'Success',
      detail: t('successUpdated') || 'Updated successfully.',
      life: 3000
    });
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: getSaveErrorMessage(err),
      life: 4000
    });
  }
};

/**
 * JSON 直接編集ダイアログを開きます。
 * @returns なし
 */
const openJsonDialog = (): void => {
  jsonEditText.value = JSON.stringify({ bookmarks: bookmarksData.value }, null, 2);
  showJsonDialog.value = true;
};

/**
 * JSON エディタで編集された内容を検証・保存します。
 * @returns 保存処理完了を示す Promise
 */
const saveJsonEdit = async (): Promise<void> => {
  try {
    const data = JSON.parse(jsonEditText.value);
    if (data && typeof data === 'object' && 'bookmarks' in data) {
      if (!validateBookmarksJson(data.bookmarks)) return;
      await saveBookmarksData(data.bookmarks);
      await loadBookmarks();
      toast.add({
        severity: 'success',
        summary: t('successJsonUpdated') || 'Success',
        detail: t('successJsonUpdated') || 'JSON updated successfully.',
        life: 3000
      });
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: t('errorInvalidJsonStructure') || 'Invalid JSON structure. Missing "bookmarks" root key.',
        life: 3000
      });
    }
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: t('errorInvalidJsonFormat') || 'Invalid JSON format.',
      life: 3000
    });
  }
};
</script>

<style>
/* PrimeVue 要素向けのグローバルリセット */
body {
  margin: 0;
  font-family: var(--font-family);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>

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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

/* 設定画面へ移動する歯車ボタンを大きく表示 */
.prefs-btn {
  width: 3rem;
  height: 3rem;
}

.prefs-btn :deep(.p-button-icon) {
  font-size: 1.5rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--p-text-color);
}

.mb-3 {
  margin-bottom: 1rem;
}

.mb-4 {
  margin-bottom: 1.5rem;
}

.text-center {
  text-align: center;
}

.form-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1 1 180px;
  min-width: 0;
}

.field:nth-child(1) {
  flex: 1 1 180px;
}

.field:nth-child(2) {
  flex: 1.5 1 200px;
}

.field:nth-child(3) {
  flex: 2.5 1 250px;
}

.field-btn {
  flex: 0 0 auto;
}

.field :deep(.p-autocomplete) {
  width: 100%;
}

.field :deep(.p-autocomplete-input) {
  width: 100%;
  min-width: 0;
}

.field :deep(.p-inputtext) {
  width: 100%;
  min-width: 0;
}

/* 動的URL (%s) 入力時に表示する引数省略時のデフォルト値入力欄 */
.default-value-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* ユーザースクリプト未許可時の案内バナーレイアウト */
.user-scripts-banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  width: 100%;
}

.favicon-img {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  vertical-align: middle;
  flex-shrink: 0;
}

/* ブックマークレット用のコードアイコン（16x16 の Favicon と幅・高さを揃える） */
.bookmarklet-icon {
  width: 16px;
  height: 16px;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.url-text {
  word-break: break-all;
  font-size: 0.9rem;
}

/* ブックマークレットのコード文字列表示（リンクにせず、長大なコードは3行で省略表示する） */
.bookmarklet-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  color: var(--p-text-color);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.url-link {
  text-decoration: none;
  color: var(--p-primary-color);
  display: flex;
}

.url-link:hover {
  text-decoration: underline;
}

.w-full {
  width: 100%;
}

.flex {
  display: flex;
}

.align-items-center {
  align-items: center;
}

.gap-2 {
  gap: 0.5rem;
}

/* レスポンシブ調整 */
@media (max-width: 768px) {
  .form-grid {
    flex-direction: column;
    align-items: stretch;
  }
  .field {
    width: 100%;
  }
  .field:nth-child(1),
  .field:nth-child(2),
  .field:nth-child(3) {
    flex: 1 1 auto;
    width: 100%;
  }
  .field-btn {
    align-items: stretch;
  }
  .field-btn button {
    width: 100%;
  }
}

/* vue3-ts-jsoneditor 内部の表示崩れを起こす全幅ボタンを非表示にする */
:deep(.jse-full-width) {
  display: none !important;
}

.folder-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.folder-select-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.folder-filter-label {
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.folder-select {
  min-width: 220px;
}

.folder-actions-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
</style>
