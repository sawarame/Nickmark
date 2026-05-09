<template>
  <div class="container">
    <Toast />
    
    <div class="header">
      <h1>{{ title }}</h1>
    </div>

    <Card class="mb-4">
      <template #title>Add Nickmark</template>
      <template #content>
        <div class="form-grid">
          <div class="field">
            <label for="nickname">Nickname</label>
            <InputText id="nickname" v-model="newBookmark.nickname" placeholder="e.g. gh" />
          </div>
          <div class="field">
            <label for="url">URL</label>
            <InputText id="url" v-model="newBookmark.url" placeholder="https://github.com/..." />
          </div>
          <div class="field">
            <label for="titleInput">Title (Optional)</label>
            <InputText id="titleInput" v-model="newBookmark.title" placeholder="My GitHub" />
          </div>
          <div class="field-btn">
            <Button label="Add" icon="pi pi-plus" @click="addBookmark" />
          </div>
        </div>
      </template>
    </Card>

    <Card class="mb-4">
      <template #title>Manage Nickmarks</template>
      <template #content>
        <DataTable :value="flatBookmarks" stripedRows tableStyle="min-width: 50rem" :paginator="true" :rows="10">
          <Column field="nickname" header="Nickname" sortable></Column>
          <Column field="url" header="URL" sortable></Column>
          <Column field="score" header="Score" sortable>
            <template #body="slotProps">
              {{ slotProps.data.score.toFixed(2) }}
            </template>
          </Column>
          <Column header="Actions">
            <template #body="slotProps">
              <Button icon="pi pi-trash" severity="danger" text rounded aria-label="Delete" @click="deleteBookmark(slotProps.data.nickname, slotProps.data.url)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card>
      <template #title>Import / Export JSON</template>
      <template #content>
        <div class="field mb-2">
          <Textarea v-model="jsonText" rows="10" class="w-full" style="font-family: monospace;" />
        </div>
        <div class="flex gap-2 mt-2">
          <Button label="Export to JSON" icon="pi pi-download" severity="secondary" @click="exportJson" />
          <Button label="Import from JSON" icon="pi pi-upload" severity="secondary" @click="importJson" />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Card from 'primevue/card';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';

import { BookmarkEntry } from './background';

const toast = useToast();

const title = ref('');
const bookmarksData = ref<Record<string, BookmarkEntry[]>>({});
const jsonText = ref('');

const newBookmark = ref({
  nickname: '',
  url: '',
  title: ''
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
  const data = await chrome.storage.local.get('bookmarks');
  bookmarksData.value = (data.bookmarks || {}) as Record<string, BookmarkEntry[]>;
};

onMounted(async () => {
  title.value = chrome.i18n.getMessage('extensionName') ? chrome.i18n.getMessage('extensionName') + ' Options' : 'Nickmark Options';
  await loadBookmarks();
});

const addBookmark = async () => {
  const { nickname, url, title } = newBookmark.value;
  const trimmedNickname = nickname.trim();
  const trimmedUrl = url.trim();

  if (!trimmedNickname || !trimmedUrl) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Nickname and URL are required.', life: 3000 });
    return;
  }

  if (!bookmarksData.value[trimmedNickname]) {
    bookmarksData.value[trimmedNickname] = [];
  }

  if (bookmarksData.value[trimmedNickname].some(b => b.url === trimmedUrl)) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'This URL already exists for this nickname.', life: 3000 });
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

  await chrome.storage.local.set({ bookmarks: bookmarksData.value });
  
  newBookmark.value = { nickname: '', url: '', title: '' };
  toast.add({ severity: 'success', summary: 'Success', detail: 'Added successfully.', life: 3000 });
};

const deleteBookmark = async (nickname: string, url: string) => {
  if (bookmarksData.value[nickname]) {
    bookmarksData.value[nickname] = bookmarksData.value[nickname].filter(b => b.url !== url);
    if (bookmarksData.value[nickname].length === 0) {
      delete bookmarksData.value[nickname];
    }
    await chrome.storage.local.set({ bookmarks: bookmarksData.value });
    toast.add({ severity: 'success', summary: 'Success', detail: 'Deleted successfully.', life: 3000 });
  }
};

const exportJson = () => {
  jsonText.value = JSON.stringify({ bookmarks: bookmarksData.value }, null, 2);
  toast.add({ severity: 'info', summary: 'Exported', detail: 'Exported to text area.', life: 3000 });
};

const importJson = async () => {
  try {
    const data = JSON.parse(jsonText.value);
    if (data && typeof data === 'object' && 'bookmarks' in data) {
      await chrome.storage.local.set({ bookmarks: data.bookmarks });
      await loadBookmarks();
      toast.add({ severity: 'success', summary: 'Imported', detail: 'Imported successfully.', life: 3000 });
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: 'Invalid JSON structure. Missing "bookmarks" root key.', life: 3000 });
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Invalid JSON format.', life: 3000 });
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
  display: grid;
  grid-template-columns: 1fr 2fr 2fr auto;
  gap: 1rem;
  align-items: end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 500;
}

.field-btn {
  display: flex;
  align-items: flex-end;
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
</style>