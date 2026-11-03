<template>
  <div class="container" v-if="isLoaded">
    <Toast />
    
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
            <InputText id="nickname" v-model="newBookmark.nickname" placeholder="e.g. gh" />
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
        <DataTable :value="flatBookmarks" stripedRows tableStyle="min-width: 50rem" :paginator="true" :rows="10">
          <Column field="nickname" :header="t('nicknameLabel') || 'Nickname'" sortable></Column>
          <Column field="title" :header="t('titleLabel') || 'Title'" sortable></Column>
          <Column field="url" :header="t('urlLabel') || 'URL'" sortable>
            <template #body="slotProps">
              <div v-if="isBookmarkletUrl(slotProps.data.url)" class="flex align-items-center gap-2">
                <i class="pi pi-code bookmarklet-icon" aria-hidden="true"></i>
                <span class="url-text bookmarklet-text" :title="slotProps.data.url">{{ slotProps.data.url }}</span>
              </div>
              <div v-else class="flex align-items-center gap-2">
                <img :src="getFaviconUrl(getNavigableUrl(slotProps.data))" class="favicon-img" alt="" />
                <a :href="getNavigableUrl(slotProps.data)" target="_blank" rel="noopener noreferrer" class="url-link">
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

import JsonEditor from 'vue3-ts-jsoneditor';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Card from 'primevue/card';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';

import {
  BookmarkEntry,
  loadBookmarksData,
  saveBookmarksData,
  isDynamicUrl,
  resolveFallbackUrl,
  isBookmarkletUrl,
  isUserScriptsAvailable
} from './background';
import { initI18n, t } from './i18n';

const toast = useToast();

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

// 編集ダイアログの状態
const showEditDialog = ref(false);
const editBookmarkData = ref({
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

// JSON Dialog state
const showJsonDialog = ref(false);
const jsonEditText = ref('');

const isJsonValid = computed(() => {
  if (!jsonEditText.value) return false;
  try {
    JSON.parse(jsonEditText.value);
    return true;
  } catch (e) {
    return false;
  }
});

const flatBookmarks = computed(() => {
  const result: any[] = [];
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
 * 登録済みまたは入力中のデータにブックマークレット（`javascript:`）が含まれているかを判定します。
 */
const hasAnyBookmarklet = computed((): boolean => {
  if (isBookmarkletUrl(newBookmark.value.url)) return true;
  if (showEditDialog.value && isBookmarkletUrl(editBookmarkData.value.url)) return true;
  return flatBookmarks.value.some((item) => isBookmarkletUrl(item.url));
});

/**
 * `chrome.userScripts` API の許可状態（「ユーザー スクリプトを許可する」トグル状態）を再確認します。
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

const loadBookmarks = async () => {
  bookmarksData.value = await loadBookmarksData();
};

/**
 * ブックマークエントリから実際にリンク・ファビコン取得に使用できる遷移先 URL を返します。
 * 動的 URL（`%s` を含む）の場合はフォールバック URL を返します。
 * @param entry - 対象のブックマークエントリ
 * @returns 遷移可能な URL 文字列
 */
const getNavigableUrl = (entry: BookmarkEntry): string => {
  return isDynamicUrl(entry.url) ? resolveFallbackUrl(entry) : entry.url;
};

const getFaviconUrl = (pageUrl: string) => {
  try {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', pageUrl);
    url.searchParams.set('size', '32');
    return url.toString();
  } catch (e) {
    return '';
  }
};

/**
 * 管理画面上にカスタムトースト通知を表示します。
 * @param message - 表示する通知メッセージ
 * @returns なし
 */
const showCustomToast = (message: string): void => {
  const id = 'nickmark-custom-toast';
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = id;
  div.textContent = message;
  Object.assign(div.style, {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    maxWidth: '80vw',
    padding: '12px 24px',
    backgroundColor: '#323232',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '1.5',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: 'opacity 0.3s, transform 0.3s',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    pointerEvents: 'none',
    opacity: '0'
  });

  document.body.appendChild(div);
  div.offsetHeight;
  div.style.opacity = '1';
  div.style.transform = 'translateX(-50%) translateY(8px)';

  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateX(-50%)';
    setTimeout(() => div.remove(), 300);
  }, 4000);
};

onMounted(async () => {
  await initI18n();
  title.value = (t('extensionName') || 'Nickmark') + ' Bookmarks';
  refreshUserScriptsStatus();
  await loadBookmarks();

  // 拡張機能設定タブから戻ってきた際にユーザースクリプト許可状態を即時反映する
  window.addEventListener('focus', refreshUserScriptsStatus);
  document.addEventListener('visibilitychange', refreshUserScriptsStatus);

  // バックグラウンドからのメッセージ待受
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'updatePage') {
      if (request.msg) showCustomToast(request.msg);
      if (request.url) newBookmark.value.url = request.url;
      if (request.title) newBookmark.value.title = request.title;
    } else if (request.action === 'showToast' && request.message) {
      showCustomToast(request.message);
    }
  });

  // URL パラメータ経由のメッセージおよび初期入力値の確認
  const urlParams = new URLSearchParams(window.location.search);
  const msg = urlParams.get('msg');
  const prefilledUrl = urlParams.get('url');
  const prefilledTitle = urlParams.get('title');

  if (prefilledUrl) {
    newBookmark.value.url = prefilledUrl;
  }
  if (prefilledTitle) {
    newBookmark.value.title = prefilledTitle;
  }

  if (msg) {
    showCustomToast(msg);
  }

  if (msg || prefilledUrl || prefilledTitle) {
    // 画面リロードなしで URL クエリパラメータをクリーンアップする
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
  isLoaded.value = true;
});

onUnmounted(() => {
  window.removeEventListener('focus', refreshUserScriptsStatus);
  document.removeEventListener('visibilitychange', refreshUserScriptsStatus);
});

const openPreferences = () => {
  window.location.href = 'preferences.html';
};

/**
 * フォームの入力内容から新しいブックマークを登録します。
 * URL に `%s` が含まれる場合のみ、入力された `default_value`（引数省略時のデフォルト値）を保存します。
 * @returns 処理完了を示す Promise
 */
const addBookmark = async (): Promise<void> => {
  const { nickname, url, title, default_value } = newBookmark.value;
  const trimmedNickname = nickname.trim();
  const trimmedUrl = url.trim();
  const trimmedDefault = isDynamicUrl(trimmedUrl) ? (default_value || '').trim() : '';

  if (!trimmedNickname || !trimmedUrl) {
    toast.add({ severity: 'error', summary: 'Error', detail: t('errorNicknameUrlRequired') || 'Nickname and URL are required.', life: 3000 });
    return;
  }

  if (!bookmarksData.value[trimmedNickname]) {
    bookmarksData.value[trimmedNickname] = [];
  }

  if (bookmarksData.value[trimmedNickname].some(b => b.url === trimmedUrl)) {
    toast.add({ severity: 'error', summary: 'Error', detail: t('errorUrlExists') || 'This URL already exists for this nickname.', life: 3000 });
    return;
  }

  const now = Date.now();
  const entryToAdd: BookmarkEntry = {
    url: trimmedUrl,
    title: title.trim(),
    score: 1.0,
    last_used_at: now,
    created_at: now
  };
  if (trimmedDefault) {
    entryToAdd.default_value = trimmedDefault;
  }

  bookmarksData.value[trimmedNickname].push(entryToAdd);

  await saveBookmarksData(bookmarksData.value);
  
  newBookmark.value = { nickname: '', url: '', title: '', default_value: '' };
  toast.add({ severity: 'success', summary: t('successAdded') || 'Success', detail: t('successAdded') || 'Added successfully.', life: 3000 });
};

const deleteBookmark = async (nickname: string, url: string) => {
  if (bookmarksData.value[nickname]) {
    bookmarksData.value[nickname] = bookmarksData.value[nickname].filter(b => b.url !== url);
    if (bookmarksData.value[nickname].length === 0) {
      delete bookmarksData.value[nickname];
    }
    await saveBookmarksData(bookmarksData.value);
    toast.add({ severity: 'success', summary: t('successDeleted') || 'Success', detail: t('successDeleted') || 'Deleted successfully.', life: 3000 });
  }
};

const togglePin = async (data: any) => {
  const nickname = data.nickname;
  const url = data.url;
  if (bookmarksData.value[nickname]) {
    const entry = bookmarksData.value[nickname].find(b => b.url === url);
    if (entry) {
      entry.is_pinned = !entry.is_pinned;
      await saveBookmarksData(bookmarksData.value);
    }
  }
};

const downloadJsonFile = () => {
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
  toast.add({ severity: 'success', summary: t('successExported') || 'Exported', detail: t('successFileDownloaded') || 'File downloaded successfully.', life: 3000 });
};

/**
 * JSON エディタで編集されたブックマークデータの構造を検証します。
 * @param bookmarks - パースされた bookmarks オブジェクト
 * @returns 構造が妥当な場合は true、不正な場合は false
 */
const validateBookmarksJson = (bookmarks: any): boolean => {
  if (!bookmarks || typeof bookmarks !== 'object') return false;
  for (const nickname in bookmarks) {
    if (nickname.trim() === '') {
      toast.add({ severity: 'error', summary: 'Error', detail: 'Nickname cannot be empty.', life: 3000 });
      return false;
    }
    if (!Array.isArray(bookmarks[nickname])) {
      toast.add({ severity: 'error', summary: 'Error', detail: `Invalid structure for nickname "${nickname}". Expected an array.`, life: 3000 });
      return false;
    }
    for (const entry of bookmarks[nickname]) {
      if (!entry.url || typeof entry.url !== 'string' || entry.url.trim() === '') {
        toast.add({ severity: 'error', summary: 'Error', detail: `URL is required for nickname "${nickname}".`, life: 3000 });
        return false;
      }
      if (entry.default_value !== undefined && typeof entry.default_value !== 'string') {
        toast.add({ severity: 'error', summary: 'Error', detail: `Invalid default_value for nickname "${nickname}". Expected a string.`, life: 3000 });
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
const openEditDialog = (data: any): void => {
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
  const { originalNickname, originalUrl, nickname, url, title, default_value, is_pinned } = editBookmarkData.value;
  const newNickname = nickname.trim();
  const newUrl = url.trim();
  const trimmedDefault = isDynamicUrl(newUrl) ? (default_value || '').trim() : '';

  if (!newNickname || !newUrl) {
    toast.add({ severity: 'error', summary: 'Error', detail: t('errorNicknameUrlRequired') || 'Nickname and URL are required.', life: 3000 });
    return;
  }

  if (originalNickname !== newNickname || originalUrl !== newUrl) {
    if (bookmarksData.value[newNickname] && bookmarksData.value[newNickname].some(b => b.url === newUrl && (newNickname !== originalNickname || b.url !== originalUrl))) {
       toast.add({ severity: 'error', summary: 'Error', detail: t('errorUrlExists') || 'This URL already exists for this nickname.', life: 3000 });
       return;
    }
  }

  if (bookmarksData.value[originalNickname]) {
    bookmarksData.value[originalNickname] = bookmarksData.value[originalNickname].filter(b => b.url !== originalUrl);
    if (bookmarksData.value[originalNickname].length === 0) {
      delete bookmarksData.value[originalNickname];
    }
  }

  if (!bookmarksData.value[newNickname]) {
    bookmarksData.value[newNickname] = [];
  }
  const updatedEntry: BookmarkEntry = {
    url: newUrl,
    title: title.trim(),
    score: editBookmarkData.value.score,
    last_used_at: editBookmarkData.value.last_used_at,
    created_at: editBookmarkData.value.created_at,
    is_pinned: is_pinned
  };
  if (trimmedDefault) {
    updatedEntry.default_value = trimmedDefault;
  }
  bookmarksData.value[newNickname].push(updatedEntry);

  await saveBookmarksData(bookmarksData.value);
  showEditDialog.value = false;
  toast.add({ severity: 'success', summary: t('successUpdated') || 'Success', detail: t('successUpdated') || 'Updated successfully.', life: 3000 });
};

const openJsonDialog = () => {
  jsonEditText.value = JSON.stringify({ bookmarks: bookmarksData.value }, null, 2);
  showJsonDialog.value = true;
};

const saveJsonEdit = async () => {
  try {
    const data = JSON.parse(jsonEditText.value);
    if (data && typeof data === 'object' && 'bookmarks' in data) {
      if (!validateBookmarksJson(data.bookmarks)) return;
      await saveBookmarksData(data.bookmarks);
      await loadBookmarks();
      toast.add({ severity: 'success', summary: t('successJsonUpdated') || 'Success', detail: t('successJsonUpdated') || 'JSON updated successfully.', life: 3000 });
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: t('errorInvalidJsonStructure') || 'Invalid JSON structure. Missing "bookmarks" root key.', life: 3000 });
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: t('errorInvalidJsonFormat') || 'Invalid JSON format.', life: 3000 });
  }
};
</script>

<style>
/* Global resets for primevue elements */
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

.mb-2 {
  margin-bottom: 0.5rem;
}

.mb-4 {
  margin-bottom: 1.5rem;
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
  flex: 1;
  min-width: 150px;
}

.field:nth-child(1) {
  flex: 0 0 120px;
}

.field:nth-child(2),
.field:nth-child(3) {
  flex: 2 1 200px;
}

.field-btn {
  flex: 0 0 auto;
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

.mt-2 {
  margin-top: 0.5rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .field-btn {
    align-items: stretch;
  }
  .field-btn button {
    width: 100%;
  }
}

/* Hide the problematic full-width button inside vue3-ts-jsoneditor */
:deep(.jse-full-width) {
  display: none !important;
}
</style>
