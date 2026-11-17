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
        <!-- フォルダ絞り込み・並び替え・一括操作バー -->
        <div class="folder-toolbar mb-3">
          <div class="toolbar-controls-group">
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
                @change="tableFirst = 0"
              />
            </div>
            <div class="sort-select-group">
              <label for="bookmark-sort" class="sort-filter-label">
                <i class="pi pi-sort-alt" style="margin-right: 0.25rem;"></i>
                {{ t('sortOrderLabel') || 'Sort' }}:
              </label>
              <Select
                id="bookmark-sort"
                v-model="selectedSortOrder"
                :options="sortOptions"
                optionLabel="label"
                optionValue="value"
                class="sort-select"
                @change="handleToolbarSortChange"
              />
            </div>
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

        <DataTable
          :value="sortedFilteredBookmarks"
          v-model:first="tableFirst"
          :sortField="tableSortField"
          :sortOrder="tableSortOrder"
          stripedRows
          :paginator="true"
          :rows="10"
          :pt="{ table: { style: 'table-layout: fixed; width: 100%; min-width: 820px;' } }"
          @sort="handleTableSort"
        >
          <Column field="nickname" :header="t('nicknameLabel') || 'Nickname'" sortable style="width: 180px">
            <template #body="slotProps">
              <div
                v-if="isEditingCell(slotProps.data, 'nickname') && inlineEdit"
                :ref="setInlineEditWrapperRef"
                class="inline-edit-wrapper"
                @focusout="handleInlineFocusOut"
              >
                <Textarea
                  v-model="inlineEdit.draftValue"
                  autoResize
                  rows="1"
                  class="inline-textarea"
                  :aria-label="t('nicknameLabel') || 'Nickname'"
                  @keydown="handleInlineKeydown"
                />
              </div>
              <div
                v-else
                class="inline-editable-cell cell-wrap-text"
                @click="startInlineEdit(slotProps.data, 'nickname')"
              >
                <span>{{ slotProps.data.nickname }}</span>
              </div>
            </template>
          </Column>
          <Column field="title" :header="t('titleLabel') || 'Title'" sortable style="width: 220px">
            <template #body="slotProps">
              <div
                v-if="isEditingCell(slotProps.data, 'title') && inlineEdit"
                :ref="setInlineEditWrapperRef"
                class="inline-edit-wrapper"
                @focusout="handleInlineFocusOut"
              >
                <Textarea
                  v-model="inlineEdit.draftValue"
                  autoResize
                  rows="1"
                  class="inline-textarea"
                  :aria-label="t('titleLabel') || 'Title'"
                  @keydown="handleInlineKeydown"
                />
              </div>
              <div
                v-else
                class="inline-editable-cell cell-wrap-text"
                @click="startInlineEdit(slotProps.data, 'title')"
              >
                <span>{{ slotProps.data.title }}</span>
              </div>
            </template>
          </Column>
          <Column field="url" :header="t('urlLabel') || 'URL'" sortable>
            <template #body="slotProps">
              <div
                v-if="isEditingCell(slotProps.data, 'url') && inlineEdit"
                :ref="setInlineEditWrapperRef"
                class="inline-edit-wrapper"
                @focusout="handleInlineFocusOut"
              >
                <Textarea
                  v-model="inlineEdit.draftValue"
                  autoResize
                  rows="2"
                  class="inline-textarea"
                  :class="{ 'bookmarklet-textarea': isBookmarkletUrl(inlineEdit.draftValue) }"
                  :aria-label="t('urlLabel') || 'URL'"
                  @keydown="handleInlineKeydown"
                />
                <div v-if="isDynamicUrl(inlineEdit.draftValue)" class="inline-default-value-field">
                  <label class="inline-default-value-label">
                    {{ t('defaultValueLabel') || 'Default value when query is omitted (Optional)' }}
                  </label>
                  <InputText
                    v-model="inlineEdit.draftDefaultValue"
                    :placeholder="t('defaultValuePlaceholder') || 'Default value for %s (navigates to site\'s top page if left blank)'"
                    class="w-full"
                    size="small"
                    @keydown="handleInlineKeydown"
                  />
                </div>
              </div>
              <div
                v-else
                class="inline-editable-cell url-cell-display"
                :title="slotProps.data.url"
                @click="startInlineEdit(slotProps.data, 'url')"
              >
                <i v-if="isBookmarkletUrl(slotProps.data.url)" class="pi pi-code bookmarklet-icon" aria-hidden="true"></i>
                <img v-else :src="getFaviconUrl(resolveNavigableUrl(slotProps.data))" class="favicon-img" alt="" />
                <span
                  class="url-text"
                  :class="{ 'bookmarklet-text': isBookmarkletUrl(slotProps.data.url) }"
                >
                  {{ slotProps.data.url }}
                </span>
              </div>
            </template>
          </Column>
          <Column :header="t('isPinnedLabel') || 'Pinned'" class="text-center" style="width: 80px">
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
          <Column :header="t('actionsLabel') || 'Actions'" class="text-center" style="width: 80px">
            <template #body="slotProps">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :aria-label="t('deleteBookmarkTooltip') || 'Delete'"
                v-tooltip="t('deleteBookmarkTooltip') || 'Delete'"
                @click="deleteBookmark(slotProps.data.nickname, slotProps.data.url)"
              />
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
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import JsonEditor from 'vue3-ts-jsoneditor';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import AutoComplete, { AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import Button from 'primevue/button';
import DataTable, { DataTableSortEvent } from 'primevue/datatable';
import Column from 'primevue/column';
import Card from 'primevue/card';
import Toast from 'primevue/toast';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import Select, { SelectChangeEvent } from 'primevue/select';
import ConfirmDialog from 'primevue/confirmdialog';

import {
  BookmarkEntry,
  DEFAULT_LIST_SORT_OPTION,
  ListSortOption
} from './shared/types';
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
import { parseValidListSortOption, sortBookmarkRows } from './shared/listSort';
import {
  createBookmarkEntry,
  deleteFolder,
  extractFolders,
  getListSortOrder,
  getMaxBatchOpenTabs,
  getSaveErrorMessage,
  loadBookmarksData,
  openFolderUrls,
  renameFolder,
  saveBookmarksData,
  setListSortOrder
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
 * インライン編集可能なテーブル列フィールド種別の型定義
 */
type InlineEditField = 'nickname' | 'title' | 'url';

/**
 * インライン編集中のセル状態および下書き入力値を保持する型定義
 */
interface InlineEditState {
  originalNickname: string;
  originalUrl: string;
  originalTitle: string;
  originalDefaultValue: string;
  field: InlineEditField;
  draftValue: string;
  draftDefaultValue: string;
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

// インライン編集状態（同時に1セルのみアクティブ）
const inlineEdit = ref<InlineEditState | null>(null);
const inlineEditWrapperRef = ref<HTMLElement | null>(null);
const isClosingInlineEdit = ref(false);

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

// 並び替え・ページング状態
const selectedSortOrder = ref<ListSortOption>(DEFAULT_LIST_SORT_OPTION);
const tableFirst = ref<number>(0);
const tableSortField = ref<keyof FlatBookmarkRow | undefined>(undefined);
const tableSortOrder = ref<number | undefined>(undefined);

/**
 * ツールバーの並び替えセレクト用選択肢配列を算出します。
 * @returns 並び替え選択肢オブジェクトの配列
 */
const sortOptions = computed((): Array<{ label: string; value: ListSortOption }> => {
  return [
    { label: t('sortOrderDefault') || 'デフォルト順', value: 'default' },
    { label: t('sortOrderLastUsedDesc') || '最終使用日時（新しい順）', value: 'last_used_desc' },
    { label: t('sortOrderLastUsedAsc') || '最終使用日時（古い順）', value: 'last_used_asc' },
    { label: t('sortOrderScoreDesc') || 'スコア（高い順）', value: 'score_desc' },
    { label: t('sortOrderScoreAsc') || 'スコア（低い順）', value: 'score_asc' }
  ];
});

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
 * フォルダ絞り込み後のブックマーク行を、ツールバーで選択された並び替え基準に従って整列します。
 * @returns 並び替え済みのブックマーク行配列
 */
const sortedFilteredBookmarks = computed((): FlatBookmarkRow[] => {
  return sortBookmarkRows(filteredBookmarks.value, selectedSortOrder.value);
});

/**
 * ツールバーの並び替えセレクト変更時に、列ヘッダーソートを解除して設定をローカル保存します。
 * @param event - Select の変更イベント
 * @returns 保存処理完了を示す Promise
 */
const handleToolbarSortChange = async (event: SelectChangeEvent): Promise<void> => {
  const nextSort = parseValidListSortOption(event.value);
  selectedSortOrder.value = nextSort;
  // 列ヘッダーソートと競合しないようテーブル側のソート状態を解除し、1ページ目に戻す
  tableSortField.value = undefined;
  tableSortOrder.value = undefined;
  tableFirst.value = 0;
  await setListSortOrder(nextSort);
};

/**
 * DataTable の列ヘッダークリックによるソート変更を処理します。
 * 列ソート有効時はツールバーの表示矛盾や再選択不可を防ぐため、メモリ上のみデフォルト表示へ切り替えます。
 * @param event - DataTable のソートイベント
 * @returns なし
 */
const handleTableSort = (event: DataTableSortEvent): void => {
  tableSortField.value =
    typeof event.sortField === 'string' ? (event.sortField as keyof FlatBookmarkRow) : undefined;
  tableSortOrder.value = event.sortOrder ?? undefined;
  if (event.sortField) {
    // ストレージの保存値は上書きせず、次回表示時は前回保存したツールバー選択を復元できるようにする
    selectedSortOrder.value = DEFAULT_LIST_SORT_OPTION;
  }
};

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
  if (inlineEdit.value?.field === 'url' && isBookmarkletUrl(inlineEdit.value.draftValue)) return true;
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
 * インライン編集中や各種ダイアログが開かれている場合は、ユーザーの作業内容を保護するため一覧の再読み込みをスキップします。
 * @returns 同期完了を示す Promise
 */
const onWindowFocusOrVisible = async (): Promise<void> => {
  refreshUserScriptsStatus();
  if (document.visibilityState === 'hidden') return;
  await checkAndConsumePendingToast();
  if (inlineEdit.value !== null || showJsonDialog.value || showRenameDialog.value) {
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
  selectedSortOrder.value = await getListSortOrder();
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
 * アクティブなインライン編集ラッパー DOM 要素の参照を保持します。
 * @param el - Vue のテンプレート ref コールバックから渡される要素参照
 * @returns なし
 */
const setInlineEditWrapperRef = (el: unknown): void => {
  if (el instanceof HTMLElement) {
    inlineEditWrapperRef.value = el;
  }
};

/**
 * 指定された行とフィールドが現在インライン編集中であるかを判定します。
 * @param row - 判定対象のブックマーク行データ
 * @param field - 判定対象の列フィールド名
 * @returns 該当セルが編集中であれば true、それ以外は false
 */
const isEditingCell = (row: FlatBookmarkRow, field: InlineEditField): boolean => {
  if (!inlineEdit.value) return false;
  return (
    inlineEdit.value.field === field &&
    inlineEdit.value.originalNickname === row.nickname &&
    inlineEdit.value.originalUrl === row.url
  );
};

/**
 * 指定されたブックマーク行の対象項目をインライン編集状態（テキストエリア表示）に切り替えます。
 * 既に別セルが編集中の場合は先に確定保存を試みた上で、対象テキストエリアへ自動フォーカスします。
 * @param row - 編集対象のブックマーク行データ
 * @param field - 編集を開始する列フィールド名
 * @returns 編集開始およびフォーカス完了を示す Promise
 */
const startInlineEdit = async (row: FlatBookmarkRow, field: InlineEditField): Promise<void> => {
  if (isEditingCell(row, field)) return;

  if (inlineEdit.value && !isClosingInlineEdit.value) {
    await commitInlineEdit();
  }

  let initialDraft = '';
  if (field === 'nickname') {
    initialDraft = row.nickname;
  } else if (field === 'title') {
    initialDraft = row.title || '';
  } else {
    initialDraft = row.url;
  }

  inlineEditWrapperRef.value = null;
  inlineEdit.value = {
    originalNickname: row.nickname,
    originalUrl: row.url,
    originalTitle: row.title || '',
    originalDefaultValue: row.default_value || '',
    field,
    draftValue: initialDraft,
    draftDefaultValue: row.default_value || '',
    score: row.score,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    is_pinned: !!row.is_pinned
  };

  await nextTick();
  const textareaEl = inlineEditWrapperRef.value?.querySelector('textarea');
  if (textareaEl instanceof HTMLTextAreaElement) {
    textareaEl.focus();
  }
};

/**
 * インライン編集の変更内容を破棄し、保存を行わずに通常表示へ戻します。
 * 直後に発生する focusout での誤保存を防ぐため排他フラグを制御します。
 * @returns なし
 */
const cancelInlineEdit = (): void => {
  if (!inlineEdit.value) return;
  isClosingInlineEdit.value = true;
  inlineEdit.value = null;
  inlineEditWrapperRef.value = null;
  nextTick(() => {
    isClosingInlineEdit.value = false;
  });
};

/**
 * インライン編集中の入力内容を検証・保存し、通常表示へ戻します。
 * 変更がない場合は保存および通知をスキップし、バリデーションエラーや保存失敗時は元の有効な値へ維持・復元します。
 * @returns 保存処理完了を示す Promise
 */
const commitInlineEdit = async (): Promise<void> => {
  if (!inlineEdit.value || isClosingInlineEdit.value) return;
  isClosingInlineEdit.value = true;

  const current = inlineEdit.value;
  const normalizedOrigNickname = normalizeNicknamePath(current.originalNickname);
  const newNickname =
    current.field === 'nickname'
      ? normalizeNicknamePath(current.draftValue)
      : normalizedOrigNickname;
  const newTitle =
    current.field === 'title'
      ? current.draftValue.trim()
      : (current.originalTitle || '').trim();
  const newUrl =
    current.field === 'url'
      ? current.draftValue.trim()
      : current.originalUrl.trim();
  const trimmedDefault = isDynamicUrl(newUrl)
    ? (current.field === 'url' ? current.draftDefaultValue : current.originalDefaultValue).trim()
    : '';
  const origEffectiveDefault = isDynamicUrl(current.originalUrl)
    ? (current.originalDefaultValue || '').trim()
    : '';

  // 実質的な変更がない場合はストレージ書き込みおよびトースト表示を行わずに編集を終了する
  const hasNoChange =
    (current.field === 'nickname' && newNickname === normalizedOrigNickname) ||
    (current.field === 'title' && newTitle === (current.originalTitle || '').trim()) ||
    (current.field === 'url' && newUrl === current.originalUrl.trim() && trimmedDefault === origEffectiveDefault);

  if (hasNoChange) {
    inlineEdit.value = null;
    inlineEditWrapperRef.value = null;
    isClosingInlineEdit.value = false;
    return;
  }

  // 必須項目（ニックネーム・URL）の空文字チェック
  if (!newNickname || !newUrl) {
    inlineEdit.value = null;
    inlineEditWrapperRef.value = null;
    isClosingInlineEdit.value = false;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: t('errorNicknameUrlRequired') || 'Nickname and URL are required.',
      life: 3000
    });
    return;
  }

  // 移動先または変更先での URL 重複チェック
  const isMoved = normalizedOrigNickname !== newNickname || !isSameUrl(current.originalUrl, newUrl);
  if (isMoved && bookmarksData.value[newNickname]?.some(b => isSameUrl(b.url, newUrl))) {
    inlineEdit.value = null;
    inlineEditWrapperRef.value = null;
    isClosingInlineEdit.value = false;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: t('errorUrlExists') || 'This URL already exists for this nickname.',
      life: 3000
    });
    return;
  }

  // 保存失敗時に安全に復元できるよう変更前のスナップショットを保持する
  const snapshot = JSON.parse(JSON.stringify(bookmarksData.value)) as Record<string, BookmarkEntry[]>;

  const updatedEntry: BookmarkEntry = {
    url: newUrl,
    title: newTitle,
    score: current.score,
    last_used_at: current.last_used_at,
    created_at: current.created_at,
    is_pinned: current.is_pinned
  };
  if (trimmedDefault) {
    updatedEntry.default_value = trimmedDefault;
  }

  // 同一ニックネームキー内での編集かつ非正規化キーの統合がない場合は元の表示順序を保つため同じ位置を更新する
  const canUpdateInPlace =
    current.originalNickname === newNickname &&
    Array.isArray(bookmarksData.value[newNickname]);

  if (canUpdateInPlace) {
    const targetList = bookmarksData.value[newNickname];
    const targetIndex = targetList.findIndex(b => b.url === current.originalUrl);
    if (targetIndex !== -1) {
      targetList.splice(targetIndex, 1, updatedEntry);
    } else {
      targetList.push(updatedEntry);
    }
  } else {
    const removeKeys = new Set([current.originalNickname, normalizedOrigNickname].filter(Boolean));
    for (const key of removeKeys) {
      if (bookmarksData.value[key]) {
        bookmarksData.value[key] = bookmarksData.value[key].filter(b => b.url !== current.originalUrl);
        if (bookmarksData.value[key].length === 0) {
          delete bookmarksData.value[key];
        }
      }
    }
    if (!bookmarksData.value[newNickname]) {
      bookmarksData.value[newNickname] = [];
    }
    bookmarksData.value[newNickname].push(updatedEntry);
  }

  try {
    await saveBookmarksData(bookmarksData.value);
    inlineEdit.value = null;
    inlineEditWrapperRef.value = null;
    toast.add({
      severity: 'success',
      summary: t('successUpdated') || 'Success',
      detail: t('successUpdated') || 'Updated successfully.',
      life: 3000
    });
  } catch (err: unknown) {
    bookmarksData.value = snapshot;
    inlineEdit.value = null;
    inlineEditWrapperRef.value = null;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: getSaveErrorMessage(err),
      life: 4000
    });
  } finally {
    isClosingInlineEdit.value = false;
  }
};

/**
 * インライン編集中のキーボードイベント（Enter による保存確定、Escape によるキャンセル）を処理します。
 * 日本語 IME 変換確定中の Enter は誤確定を防ぐため無視し、Shift+Enter を含め改行入力は行いません。
 * @param event - キーボードイベント
 * @returns なし
 */
const handleInlineKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    event.preventDefault();
    void commitInlineEdit();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelInlineEdit();
  }
};

/**
 * インライン編集ラッパーのフォーカスアウトを検知し、ラッパー外部へフォーカスが移動した場合のみ保存を実行します。
 * URL 欄とデフォルト値欄の間のフォーカス移動では編集を継続します。
 * @param event - フォーカスイベント
 * @returns なし
 */
const handleInlineFocusOut = (event: FocusEvent): void => {
  if (!inlineEdit.value || isClosingInlineEdit.value) return;
  const wrapperEl = event.currentTarget as HTMLElement | null;
  const nextTarget = event.relatedTarget as Node | null;
  if (wrapperEl && nextTarget && wrapperEl.contains(nextTarget)) {
    return;
  }
  void commitInlineEdit();
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
  color: var(--p-text-color);
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
  background-color: var(--p-page-background);
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

/* URLセルの1行省略表示コンテナ */
.url-cell-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.url-text {
  display: block;
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
}

/* ブックマークレットの等幅コード文字列表示（通常URLと同じく1行で「...」省略表示する） */
.bookmarklet-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  color: var(--p-text-color);
}

/* インライン編集可能なセルのクリック領域（空タイトル時もクリック可能にする） */
.inline-editable-cell {
  min-height: 2rem;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0.25rem 0.4rem;
  border-radius: var(--p-border-radius-sm, 4px);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.inline-editable-cell:hover {
  background-color: var(--p-content-hover-background, rgba(0, 0, 0, 0.04));
}

/* ニックネーム・タイトル列でスペースなしの連続文字列も固定幅内に収める */
.cell-wrap-text {
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* インライン編集時のラッパーコンテナ */
.inline-edit-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.inline-textarea {
  width: 100%;
  max-height: 180px;
  overflow-y: auto;
  resize: vertical;
  font-size: 0.9rem;
  line-height: 1.4;
}

.bookmarklet-textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
}

.inline-default-value-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.inline-default-value-label {
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
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

.toolbar-controls-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.folder-select-group,
.sort-select-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.folder-filter-label,
.sort-filter-label {
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.folder-select {
  min-width: 220px;
}

.sort-select {
  min-width: 230px;
}

.folder-actions-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
</style>
