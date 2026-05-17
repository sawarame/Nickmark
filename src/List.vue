<template>
  <div class="container" v-if="isLoaded">
    <Toast />
    
    <div class="header">
      <h1>{{ title }}</h1>
    </div>

    <Card class="mb-4">
      <template #title>{{ t('addBookmarkTitle') || 'Add Nickmark' }}</template>
      <template #content>
        <div class="form-grid">
          <div class="field">
            <label for="nickname">{{ t('nicknameLabel') || 'Nickname' }}</label>
            <InputText id="nickname" v-model="newBookmark.nickname" placeholder="e.g. gh" />
          </div>
          <div class="field">
            <label for="url">{{ t('urlLabel') || 'URL' }}</label>
            <InputText id="url" v-model="newBookmark.url" placeholder="https://github.com/..." />
          </div>
          <div class="field">
            <label for="titleInput">{{ t('titleLabel') || 'Title (Optional)' }}</label>
            <InputText id="titleInput" v-model="newBookmark.title" placeholder="My GitHub" />
          </div>
          <div class="field-btn">
            <Button :label="t('addBtn') || 'Add'" icon="pi pi-plus" @click="addBookmark" />
          </div>
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
            <Button icon="pi pi-cog" severity="secondary" size="small" text rounded @click="openPreferences" />
          </div>
        </div>
      </template>
      <template #content>
        <DataTable :value="flatBookmarks" stripedRows tableStyle="min-width: 50rem" :paginator="true" :rows="10">
          <Column field="nickname" :header="t('nicknameLabel') || 'Nickname'" sortable></Column>
          <Column field="title" :header="t('titleLabel') || 'Title'" sortable></Column>
          <Column field="url" :header="t('urlLabel') || 'URL'" sortable></Column>
          <Column :header="t('actionsLabel') || 'Actions'">
            <template #body="slotProps">
              <Button icon="pi pi-pencil" severity="secondary" text rounded aria-label="Edit" @click="openEditDialog(slotProps.data)" />
              <Button icon="pi pi-trash" severity="danger" text rounded aria-label="Delete" @click="deleteBookmark(slotProps.data.nickname, slotProps.data.url)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showEditDialog" modal header="Edit Nickmark" :style="{ width: '50vw' }">
      <div class="form-grid">
        <div class="field">
          <label for="edit-nickname">Nickname</label>
          <InputText id="edit-nickname" v-model="editBookmarkData.nickname" />
        </div>
        <div class="field">
          <label for="edit-url">URL</label>
          <InputText id="edit-url" v-model="editBookmarkData.url" />
        </div>
        <div class="field">
          <label for="edit-title">Title</label>
          <InputText id="edit-title" v-model="editBookmarkData.title" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" text @click="showEditDialog = false" />
        <Button label="Save" icon="pi pi-check" @click="saveEditBookmark" autofocus />
      </template>
    </Dialog>

    <Dialog v-model:visible="showJsonDialog" modal header="Edit in JSON" maximizable :style="{ width: '90vw' }" :contentStyle="{ height: '70vh', display: 'flex', flexDirection: 'column' }">
      <JsonEditor
        v-model:text="jsonEditText"
        mode="text"
        :darkTheme="true"
        style="flex: 1; min-height: 0;"
      />
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" text @click="showJsonDialog = false" />
        <Button label="Save" icon="pi pi-check" @click="saveJsonEdit" autofocus :disabled="!isJsonValid" />
      </template>
    </Dialog>


  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
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

import { BookmarkEntry, loadBookmarksData, saveBookmarksData } from './background';
import { initI18n, t } from './i18n';

const toast = useToast();

const title = ref('');
const bookmarksData = ref<Record<string, BookmarkEntry[]>>({});
const isLoaded = ref(false);

const newBookmark = ref({
  nickname: '',
  url: '',
  title: ''
});

// Edit Dialog state
const showEditDialog = ref(false);
const editBookmarkData = ref({
  originalNickname: '',
  originalUrl: '',
  nickname: '',
  url: '',
  title: '',
  score: 1.0,
  last_used_at: 0,
  created_at: 0
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

const loadBookmarks = async () => {
  bookmarksData.value = await loadBookmarksData();
};

const showCustomToast = (message: string) => {
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
    padding: '12px 24px',
    backgroundColor: '#323232',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
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
  }, 3000);
};

onMounted(async () => {
  await initI18n();
  title.value = (t('extensionName') || 'Nickmark') + ' Bookmarks';
  await loadBookmarks();

  // Check for message in URL
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
    // Clean up URL without refreshing
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
  isLoaded.value = true;
});

const openPreferences = () => {
  window.location.href = 'preferences.html';
};

const addBookmark = async () => {
  const { nickname, url, title } = newBookmark.value;
  const trimmedNickname = nickname.trim();
  const trimmedUrl = url.trim();

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
  bookmarksData.value[trimmedNickname].push({
    url: trimmedUrl,
    title: title.trim(),
    score: 1.0,
    last_used_at: now,
    created_at: now
  });

  await saveBookmarksData(bookmarksData.value);
  
  newBookmark.value = { nickname: '', url: '', title: '' };
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
    }
  }
  return true;
};

const openEditDialog = (data: any) => {
  editBookmarkData.value = {
    originalNickname: data.nickname,
    originalUrl: data.url,
    nickname: data.nickname,
    url: data.url,
    title: data.title || '',
    score: data.score,
    last_used_at: data.last_used_at,
    created_at: data.created_at
  };
  showEditDialog.value = true;
};

const saveEditBookmark = async () => {
  const { originalNickname, originalUrl, nickname, url, title } = editBookmarkData.value;
  const newNickname = nickname.trim();
  const newUrl = url.trim();

  if (!newNickname || !newUrl) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Nickname and URL are required.', life: 3000 });
    return;
  }

  if (originalNickname !== newNickname || originalUrl !== newUrl) {
    if (bookmarksData.value[newNickname] && bookmarksData.value[newNickname].some(b => b.url === newUrl && (newNickname !== originalNickname || b.url !== originalUrl))) {
       toast.add({ severity: 'error', summary: 'Error', detail: 'This URL already exists for the new nickname.', life: 3000 });
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
  bookmarksData.value[newNickname].push({
    url: newUrl,
    title: title.trim(),
    score: editBookmarkData.value.score,
    last_used_at: editBookmarkData.value.last_used_at,
    created_at: editBookmarkData.value.created_at
  });

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
  max-width: 900px;
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

.w-full {
  width: 100%;
}

.flex {
  display: flex;
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