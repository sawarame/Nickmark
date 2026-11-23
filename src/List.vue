<template>
  <div class="container" v-if="isLoaded">
    <Toast />
    <ConfirmDialog />

    <div :key="i18nVersion">
    <div class="header">
      <h1>Nickmark</h1>
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
              :pt="{
                pcInputText: {
                  root: {
                    onKeydown: handleNoSpaceKeydown,
                    onCompositionstart: handleNicknameCompositionStart,
                    onCompositionend: (e: CompositionEvent) => handleNicknameCompositionEnd(e, val => { newBookmark.nickname = val; }),
                    onInput: (e: Event) => handleNicknameInput(e, val => { newBookmark.nickname = val; })
                  }
                }
              }"
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
          <div class="header-actions-group">
            <Button
              :label="t('importBtn') || 'Import'"
              icon="pi pi-upload"
              severity="secondary"
              size="small"
              @click="triggerImportFile"
            />
            <Button
              :label="t('exportBtn') || 'Export'"
              icon="pi pi-download"
              severity="secondary"
              size="small"
              @click="downloadJsonFile"
            />
            <Button
              :label="t('editJsonBtn') || 'Jsonで編集'"
              icon="pi pi-code"
              size="small"
              @click="openJsonDialog"
            />
            <input
              ref="importFileInputRef"
              type="file"
              accept=".json,.html,.htm,application/json,text/html"
              class="hidden-file-input"
              @change="handleImportFileSelected"
            />
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
          <Column
            field="nickname"
            sortable
            style="width: 180px"
            :pt="{ columnHeaderContent: { class: 'filterable-header-content' } }"
          >
            <template #header>
              <span class="p-datatable-column-title" data-pc-section="columntitle">
                {{ t('nicknameLabel') || 'Nickname' }}
              </span>
              <Button
                type="button"
                :icon="hasActiveColumnFilter('nickname') ? 'pi pi-filter-fill' : 'pi pi-filter'"
                :severity="hasActiveColumnFilter('nickname') || columnFilters.nickname.open ? 'primary' : 'secondary'"
                text
                rounded
                size="small"
                class="column-filter-toggle-btn"
                :class="{ 'is-active': hasActiveColumnFilter('nickname') }"
                :aria-label="getColumnFilterTooltip('nickname')"
                :aria-expanded="columnFilters.nickname.open"
                v-tooltip.top="getColumnFilterTooltip('nickname')"
                @click.stop="toggleColumnFilter('nickname')"
                @mousedown.stop
                @keydown.stop
              />
              <div
                v-if="columnFilters.nickname.open"
                :ref="el => setColumnFilterBoxRef('nickname', el)"
                class="column-filter-box"
                @click.stop
                @mousedown.stop
                @keydown.stop
              >
                <Textarea
                  :modelValue="columnFilters.nickname.query"
                  autoResize
                  rows="1"
                  class="column-filter-textarea"
                  :placeholder="getColumnFilterPlaceholder('nickname')"
                  :aria-label="getColumnFilterPlaceholder('nickname')"
                  @update:modelValue="val => updateColumnFilterQuery('nickname', val)"
                  @keydown="e => handleColumnFilterKeydown(e, 'nickname')"
                />
                <Button
                  v-if="columnFilters.nickname.query"
                  type="button"
                  icon="pi pi-times"
                  severity="secondary"
                  text
                  rounded
                  size="small"
                  class="column-filter-clear-btn"
                  :aria-label="t('clearColumnFilterTooltip') || 'Clear filter'"
                  v-tooltip.top="t('clearColumnFilterTooltip') || 'Clear filter'"
                  @click.stop="clearColumnFilter('nickname')"
                />
              </div>
            </template>
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
                  @compositionstart="handleInlineNicknameCompositionStart"
                  @compositionend="handleInlineNicknameCompositionEnd"
                  @input="handleInlineNicknameInput"
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
          <Column
            field="title"
            sortable
            style="width: 220px"
            :pt="{ columnHeaderContent: { class: 'filterable-header-content' } }"
          >
            <template #header>
              <span class="p-datatable-column-title" data-pc-section="columntitle">
                {{ t('titleLabel') || 'Title' }}
              </span>
              <Button
                type="button"
                :icon="hasActiveColumnFilter('title') ? 'pi pi-filter-fill' : 'pi pi-filter'"
                :severity="hasActiveColumnFilter('title') || columnFilters.title.open ? 'primary' : 'secondary'"
                text
                rounded
                size="small"
                class="column-filter-toggle-btn"
                :class="{ 'is-active': hasActiveColumnFilter('title') }"
                :aria-label="getColumnFilterTooltip('title')"
                :aria-expanded="columnFilters.title.open"
                v-tooltip.top="getColumnFilterTooltip('title')"
                @click.stop="toggleColumnFilter('title')"
                @mousedown.stop
                @keydown.stop
              />
              <div
                v-if="columnFilters.title.open"
                :ref="el => setColumnFilterBoxRef('title', el)"
                class="column-filter-box"
                @click.stop
                @mousedown.stop
                @keydown.stop
              >
                <Textarea
                  :modelValue="columnFilters.title.query"
                  autoResize
                  rows="1"
                  class="column-filter-textarea"
                  :placeholder="getColumnFilterPlaceholder('title')"
                  :aria-label="getColumnFilterPlaceholder('title')"
                  @update:modelValue="val => updateColumnFilterQuery('title', val)"
                  @keydown="e => handleColumnFilterKeydown(e, 'title')"
                />
                <Button
                  v-if="columnFilters.title.query"
                  type="button"
                  icon="pi pi-times"
                  severity="secondary"
                  text
                  rounded
                  size="small"
                  class="column-filter-clear-btn"
                  :aria-label="t('clearColumnFilterTooltip') || 'Clear filter'"
                  v-tooltip.top="t('clearColumnFilterTooltip') || 'Clear filter'"
                  @click.stop="clearColumnFilter('title')"
                />
              </div>
            </template>
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
          <Column
            field="url"
            sortable
            :pt="{ columnHeaderContent: { class: 'filterable-header-content' } }"
          >
            <template #header>
              <span class="p-datatable-column-title" data-pc-section="columntitle">
                {{ t('urlLabel') || 'URL' }}
              </span>
              <Button
                type="button"
                :icon="hasActiveColumnFilter('url') ? 'pi pi-filter-fill' : 'pi pi-filter'"
                :severity="hasActiveColumnFilter('url') || columnFilters.url.open ? 'primary' : 'secondary'"
                text
                rounded
                size="small"
                class="column-filter-toggle-btn"
                :class="{ 'is-active': hasActiveColumnFilter('url') }"
                :aria-label="getColumnFilterTooltip('url')"
                :aria-expanded="columnFilters.url.open"
                v-tooltip.top="getColumnFilterTooltip('url')"
                @click.stop="toggleColumnFilter('url')"
                @mousedown.stop
                @keydown.stop
              />
              <div
                v-if="columnFilters.url.open"
                :ref="el => setColumnFilterBoxRef('url', el)"
                class="column-filter-box"
                @click.stop
                @mousedown.stop
                @keydown.stop
              >
                <Textarea
                  :modelValue="columnFilters.url.query"
                  autoResize
                  rows="1"
                  class="column-filter-textarea"
                  :placeholder="getColumnFilterPlaceholder('url')"
                  :aria-label="getColumnFilterPlaceholder('url')"
                  @update:modelValue="val => updateColumnFilterQuery('url', val)"
                  @keydown="e => handleColumnFilterKeydown(e, 'url')"
                />
                <Button
                  v-if="columnFilters.url.query"
                  type="button"
                  icon="pi pi-times"
                  severity="secondary"
                  text
                  rounded
                  size="small"
                  class="column-filter-clear-btn"
                  :aria-label="t('clearColumnFilterTooltip') || 'Clear filter'"
                  v-tooltip.top="t('clearColumnFilterTooltip') || 'Clear filter'"
                  @click.stop="clearColumnFilter('url')"
                />
              </div>
            </template>
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
            @keydown="handleFolderRenameKeydown"
            @compositionstart="handleNicknameCompositionStart"
            @compositionend="e => handleNicknameCompositionEnd(e, val => { newFolderName = val; })"
            @input="e => handleNicknameInput(e, val => { newFolderName = val; })"
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

    <!-- ブックマークインポート確認ダイアログ -->
    <Dialog
      v-model:visible="showImportDialog"
      modal
      :header="t('importDialogTitle') || 'Import Bookmarks'"
      :closable="!isImporting"
      :style="{ width: '560px', maxWidth: '92vw' }"
    >
      <div v-if="importPreview" class="import-dialog-body">
        <div class="import-summary-card">
          <div class="import-summary-row">
            <span class="import-summary-label">{{ t('importFileInfoLabel') || 'Source File' }}</span>
            <span class="import-summary-value import-filename">{{ importPreview.fileName }}</span>
          </div>
          <div class="import-summary-row">
            <span class="import-summary-label">{{ t('importFormatLabel') || 'Detected Format' }}</span>
            <span class="import-summary-value">
              {{
                importPreview.result.format === 'chrome_html'
                  ? (t('importFormatChromeHtml') || 'Chrome Bookmarks HTML')
                  : (t('importFormatJson') || 'Nickmark JSON')
              }}
            </span>
          </div>
          <div class="import-summary-row">
            <span class="import-summary-label">{{ t('manageNickmarksTitle') || 'Bookmarks' }}</span>
            <span class="import-summary-value">
              {{
                t('importSummaryCount', [
                  String(importPreview.result.bookmarkCount),
                  String(importPreview.result.nicknameCount)
                ]) ||
                `${importPreview.result.bookmarkCount} bookmarks (${importPreview.result.nicknameCount} nicknames)`
              }}
            </span>
          </div>
          <div v-if="importPreview.result.skippedCount > 0" class="import-skipped-note">
            <i class="pi pi-info-circle" aria-hidden="true"></i>
            <span>
              {{
                t('importSkippedSummary', [String(importPreview.result.skippedCount)]) ||
                `${importPreview.result.skippedCount} non-navigable item(s) will be skipped`
              }}
            </span>
          </div>
        </div>

        <div class="import-field">
          <label for="import-base-folder" class="import-field-label">
            {{ t('importBaseFolderLabel') || 'Destination Folder (Optional)' }}
          </label>
          <InputText
            id="import-base-folder"
            v-model="importBaseFolder"
            :placeholder="t('importBaseFolderPlaceholder') || 'e.g. imported (keep original hierarchy if empty)'"
            :disabled="isImporting"
            class="w-full"
            @keydown="handleNoSpaceKeydown"
            @compositionstart="handleNicknameCompositionStart"
            @compositionend="e => handleNicknameCompositionEnd(e, val => { importBaseFolder = val; })"
            @input="e => handleNicknameInput(e, val => { importBaseFolder = val; })"
          />
        </div>

        <div class="import-field">
          <span class="import-field-label">{{ t('importModeLabel') || 'Import Mode' }}</span>
          <div class="import-mode-group">
            <label for="import-mode-merge" class="import-mode-option">
              <RadioButton
                inputId="import-mode-merge"
                v-model="importMode"
                name="importMode"
                value="merge"
                :disabled="isImporting"
              />
              <span>{{ t('importModeMergeLabel') || 'Merge (keep existing & add/combine)' }}</span>
            </label>
            <label for="import-mode-overwrite" class="import-mode-option">
              <RadioButton
                inputId="import-mode-overwrite"
                v-model="importMode"
                name="importMode"
                value="overwrite"
                :disabled="isImporting"
              />
              <span>{{ t('importModeOverwriteLabel') || 'Overwrite (replace all existing bookmarks)' }}</span>
            </label>
          </div>
        </div>

        <Message v-if="importMode === 'overwrite' && flatBookmarks.length > 0" severity="warn" :closable="false">
          {{
            t('importOverwriteWarning', [String(flatBookmarks.length)]) ||
            `Overwriting will replace all ${flatBookmarks.length} existing bookmark(s) with the imported data.`
          }}
        </Message>
      </div>

      <template #footer>
        <Button
          :label="t('cancelBtn') || 'Cancel'"
          icon="pi pi-times"
          severity="secondary"
          text
          :disabled="isImporting"
          @click="closeImportDialog"
        />
        <Button
          :label="t('importExecuteBtn') || 'Run Import'"
          :icon="isImporting ? 'pi pi-spin pi-spinner' : 'pi pi-check'"
          :severity="importMode === 'overwrite' ? 'danger' : 'primary'"
          :loading="isImporting"
          @click="executeImport"
        />
      </template>
    </Dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue';
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
import RadioButton from 'primevue/radiobutton';

import {
  BookmarkEntry,
  ColumnFiltersState,
  DEFAULT_LIST_SORT_OPTION,
  FilterableColumnField,
  ImportApplyMode,
  ListSortOption,
  ParsedImportResult,
  THEME_COLOR_STORAGE_KEY
} from './shared/types';
import {
  applyBaseFolderPrefix,
  BookmarkImportError,
  countBookmarksSummary,
  mergeBookmarksDictionaries,
  parseImportFileContent
} from './shared/bookmarkImport';
import {
  getFaviconUrl,
  hasForbiddenNicknameChars,
  isBookmarkletUrl,
  isDynamicUrl,
  isSameUrl,
  isUserScriptsAvailable,
  normalizeNicknamePath,
  resolveNavigableUrl,
  stripNicknameWhitespace
} from './shared/url';
import { renderToastInDocument } from './shared/toast';
import {
  filterBookmarkRowsByColumns,
  parseValidListSortOption,
  sortBookmarkRows
} from './shared/listSort';
import {
  createBookmarkEntry,
  deleteFolder,
  extractFolders,
  getListSortOrder,
  getMaxBatchOpenTabs,
  getSaveErrorMessage,
  getThemeColor,
  loadBookmarksData,
  openFolderUrls,
  renameFolder,
  saveBookmarksData,
  setListSortOrder
} from './shared/storage';
import { applyThemeColor } from './shared/theme';
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

const i18nVersion = ref(0);
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
    stripNicknameWhitespace(event.query || ''),
    bookmarksData.value
  );
};

// ニックネーム系入力欄ごとの IME 変換中状態（DOM 要素単位で管理）
const composingInputElements = new WeakSet<EventTarget>();

/**
 * テキスト入力系 DOM 要素から空白文字（半角・全角スペース等）を除去し、キャレット位置を保持します。
 * @param target - 対象の HTMLInputElement または HTMLTextAreaElement
 * @returns 空白除去後の文字列
 */
const sanitizeInputElementWhitespace = (
  target: HTMLInputElement | HTMLTextAreaElement
): string => {
  const original = target.value;
  const sanitized = stripNicknameWhitespace(original);
  if (sanitized !== original) {
    const selectionStart = target.selectionStart ?? original.length;
    const selectionEnd = target.selectionEnd ?? selectionStart;
    const nextStart = stripNicknameWhitespace(original.slice(0, selectionStart)).length;
    const nextEnd = stripNicknameWhitespace(original.slice(0, selectionEnd)).length;
    target.value = sanitized;
    try {
      target.setSelectionRange(nextStart, nextEnd);
    } catch {
      // 選択範囲の設定に対応していない入力状態では無視する
    }
  }
  return sanitized;
};

/**
 * キーボードイベントが空白文字（半角スペース・全角スペース）の直接入力であるかを判定します。
 * IME 変換中の Space キーおよび修飾キー併用ショートカットは抑止対象外とします。
 * @param event - キーボードイベント
 * @returns 抑止すべき空白入力であれば true
 */
const isBlockedNicknameSpaceKey = (event: KeyboardEvent): boolean => {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.isComposing || event.keyCode === 229) return false;
  if (event.target && composingInputElements.has(event.target)) return false;
  return (
    event.key === ' ' ||
    event.key === 'Spacebar' ||
    event.key === '\u3000' ||
    event.code === 'Space'
  );
};

/**
 * ニックネーム系入力欄でスペースキー押下を抑止します。
 * @param event - キーボードイベント
 * @returns なし
 */
const handleNoSpaceKeydown = (event: KeyboardEvent): void => {
  if (isBlockedNicknameSpaceKey(event)) {
    event.preventDefault();
  }
};

/**
 * ニックネーム系入力欄で IME 変換が開始されたことを記録します。
 * @param event - CompositionEvent
 * @returns なし
 */
const handleNicknameCompositionStart = (event: CompositionEvent): void => {
  if (event.target) {
    composingInputElements.add(event.target);
  }
};

/**
 * ニックネーム系入力欄で IME 変換が確定した際、確定文字列から空白文字を除去して状態へ反映します。
 * @param event - CompositionEvent
 * @param applyValue - サニタイズ済み文字列を状態へ反映するコールバック
 * @returns なし
 */
const handleNicknameCompositionEnd = (
  event: CompositionEvent,
  applyValue: (value: string) => void
): void => {
  const target = event.target;
  if (target) {
    composingInputElements.delete(target);
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    applyValue(sanitizeInputElementWhitespace(target));
  }
};

/**
 * ニックネーム系入力欄の input イベント時に、IME 変換中でなければ空白文字を除去して状態へ反映します。
 * @param event - 入力イベント
 * @param applyValue - サニタイズ済み文字列を状態へ反映するコールバック
 * @returns なし
 */
const handleNicknameInput = (
  event: Event,
  applyValue: (value: string) => void
): void => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }
  if (
    (event instanceof InputEvent && event.isComposing) ||
    composingInputElements.has(target)
  ) {
    return;
  }
  applyValue(sanitizeInputElementWhitespace(target));
};

// インライン編集状態（同時に1セルのみアクティブ）
const inlineEdit = ref<InlineEditState | null>(null);
const inlineEditWrapperRef = ref<HTMLElement | null>(null);
const isClosingInlineEdit = ref(false);

// JSON 編集ダイアログの状態
const showJsonDialog = ref(false);
const jsonEditText = ref('');

/**
 * インポート確認ダイアログに表示する解析済みプレビュー状態
 */
interface ImportPreviewState {
  fileName: string;
  result: ParsedImportResult;
}

// インポートダイアログ・ファイル選択状態
const importFileInputRef = ref<HTMLInputElement | null>(null);
const showImportDialog = ref(false);
const importPreview = ref<ImportPreviewState | null>(null);
const importMode = ref<ImportApplyMode>('merge');
const importBaseFolder = ref('');
const isImporting = ref(false);

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

// 列別フィルター状態（ニックネーム・タイトル・URL）
const columnFilters = reactive<ColumnFiltersState>({
  nickname: { open: false, query: '' },
  title: { open: false, query: '' },
  url: { open: false, query: '' }
});
const columnFilterBoxRefs = new Map<FilterableColumnField, HTMLElement>();

/**
 * 列フィールド名からローカライズ済みの列見出し文字列を取得します。
 * @param field - 対象の列フィールド
 * @returns ローカライズされた列見出し
 */
const getColumnHeaderLabel = (field: FilterableColumnField): string => {
  switch (field) {
    case 'nickname':
      return t('nicknameLabel') || 'Nickname';
    case 'title':
      return t('titleLabel') || 'Title';
    case 'url':
      return t('urlLabel') || 'URL';
  }
};

/**
 * 列ヘッダーのフィルターボタンに表示するツールチップ文言を取得します。
 * @param field - 対象の列フィールド
 * @returns ツールチップ文字列
 */
const getColumnFilterTooltip = (field: FilterableColumnField): string => {
  const label = getColumnHeaderLabel(field);
  return t('columnFilterBtnTooltip', [label]) || `Filter by ${label}`;
};

/**
 * 列フィルター入力欄のプレースホルダー文言を取得します。
 * @param field - 対象の列フィールド
 * @returns プレースホルダー文字列
 */
const getColumnFilterPlaceholder = (field: FilterableColumnField): string => {
  const label = getColumnHeaderLabel(field);
  return t('columnFilterPlaceholder', [label]) || `Filter ${label}...`;
};

/**
 * 指定された列に有効な検索クエリが入力されているかを判定します。
 * @param field - 対象の列フィールド
 * @returns 空白以外の検索ワードが入力されている場合は true
 */
const hasActiveColumnFilter = (field: FilterableColumnField): boolean => {
  return columnFilters[field].query.trim().length > 0;
};

/**
 * 列フィルター入力ボックスの DOM 要素参照を記録または解除します。
 * @param field - 対象の列フィールド
 * @param el - DOM 要素または null
 * @returns なし
 */
const setColumnFilterBoxRef = (field: FilterableColumnField, el: unknown): void => {
  if (el instanceof HTMLElement) {
    columnFilterBoxRefs.set(field, el);
  } else {
    columnFilterBoxRefs.delete(field);
  }
};

/**
 * 指定された列のフィルター入力テキストエリアへフォーカスを当てます。
 * @param field - 対象の列フィールド
 * @returns フォーカス適用完了を示す Promise
 */
const focusColumnFilterInput = async (field: FilterableColumnField): Promise<void> => {
  await nextTick();
  const boxEl = columnFilterBoxRefs.get(field);
  const textareaEl = boxEl?.querySelector('textarea');
  if (textareaEl && typeof textareaEl.focus === 'function') {
    textareaEl.focus();
  }
};

/**
 * 指定された列のフィルター入力欄の表示／非表示を切り替えます。
 * 閉じる際に検索クエリが残っている場合は自動的にクリアして絞り込みを解除します。
 * @param field - 対象の列フィールド
 * @returns 処理完了を示す Promise
 */
const toggleColumnFilter = async (field: FilterableColumnField): Promise<void> => {
  const state = columnFilters[field];
  if (state.open) {
    state.open = false;
    if (state.query) {
      state.query = '';
      tableFirst.value = 0;
    }
    return;
  }
  state.open = true;
  await focusColumnFilterInput(field);
};

/**
 * 列フィルターの検索クエリを更新し、ページネーションを 1 ページ目へリセットします。
 * テキストエリア内の改行文字は空白へ正規化して 1 行クエリとして扱います。
 * @param field - 対象の列フィールド
 * @param value - 更新後の入力文字列
 * @returns なし
 */
const updateColumnFilterQuery = (
  field: FilterableColumnField,
  value: string | undefined
): void => {
  const sanitized = (value ?? '').replace(/[\r\n]+/g, ' ');
  columnFilters[field].query = sanitized;
  tableFirst.value = 0;
};

/**
 * 指定された列のフィルター検索クエリをクリアし、入力欄へフォーカスを維持します。
 * @param field - 対象の列フィールド
 * @returns 処理完了を示す Promise
 */
const clearColumnFilter = async (field: FilterableColumnField): Promise<void> => {
  columnFilters[field].query = '';
  tableFirst.value = 0;
  await focusColumnFilterInput(field);
};

/**
 * 列フィルターのテキストエリア上でのキー操作（Enter 改行抑止・Escape クリア／クローズ）を処理します。
 * @param event - キーボードイベント
 * @param field - 対象の列フィールド
 * @returns なし
 */
const handleColumnFilterKeydown = (
  event: KeyboardEvent,
  field: FilterableColumnField
): void => {
  if (event.isComposing || event.keyCode === 229) return;

  if (event.key === 'Enter') {
    event.preventDefault();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    if (columnFilters[field].query) {
      columnFilters[field].query = '';
      tableFirst.value = 0;
    } else {
      columnFilters[field].open = false;
    }
  }
};

/**
 * ツールバーの並び替えセレクト用選択肢配列を算出します。
 * @returns 並び替え選択肢オブジェクトの配列
 */
const sortOptions = computed((): Array<{ label: string; value: ListSortOption }> => {
  void i18nVersion.value;
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
  void i18nVersion.value;
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
 * 選択中フォルダおよび列別フィルター（ニックネーム・タイトル・URL）に応じてテーブルに表示するブックマーク行を絞り込みます。
 * @returns 絞り込み済みのブックマーク行配列
 */
const filteredBookmarks = computed((): FlatBookmarkRow[] => {
  let folderFiltered: FlatBookmarkRow[];
  if (selectedFolder.value === '__ALL__') {
    folderFiltered = flatBookmarks.value;
  } else if (selectedFolder.value === '__ROOT__') {
    folderFiltered = flatBookmarks.value.filter(
      item => !normalizeNicknamePath(item.nickname).includes('/')
    );
  } else {
    const folderPath = normalizeNicknamePath(selectedFolder.value);
    const prefix = folderPath + '/';
    folderFiltered = flatBookmarks.value.filter(item =>
      normalizeNicknamePath(item.nickname).startsWith(prefix)
    );
  }

  return filterBookmarkRowsByColumns(folderFiltered, {
    nickname: columnFilters.nickname.query,
    title: columnFilters.title.query,
    url: columnFilters.url.query
  });
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
 * フォルダ名変更ダイアログ入力欄のキー操作（スペース入力抑止・Enter 確定）を処理します。
 * @param event - キーボードイベント
 * @returns なし
 */
const handleFolderRenameKeydown = (event: KeyboardEvent): void => {
  if (isBlockedNicknameSpaceKey(event)) {
    event.preventDefault();
    return;
  }
  if (event.key === 'Enter') {
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    void executeRenameFolder();
  }
};

/**
 * ニックネームまたはフォルダ名に使用不可文字が含まれる場合のエラーメッセージを返します。
 * @param nickname - 対象ニックネーム文字列（指定時は対象名入りの詳細メッセージを返します）
 * @returns ローカライズ済みのエラーメッセージ文字列
 */
const getForbiddenNicknameErrorMessage = (nickname?: string): string => {
  if (nickname) {
    return (
      t('errorImportForbiddenNicknameChars', [nickname]) ||
      `ニックネーム「${nickname}」に使用できない文字（空白、: ; \\ % ? # & = * " ' \` < > | など）が含まれています。`
    );
  }
  return (
    t('errorNicknameForbiddenChars') ||
    'ニックネームに使用できない文字（空白、: ; \\ % ? # & = * " \' ` < > | など）が含まれています。'
  );
};

/**
 * フォルダ名の一括変更を実行します。
 * @returns 処理完了を示す Promise
 */
const executeRenameFolder = async (): Promise<void> => {
  const oldPath = selectedFolder.value;
  const newPath = normalizeNicknamePath(stripNicknameWhitespace(newFolderName.value));
  if (hasForbiddenNicknameChars(newPath)) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: getForbiddenNicknameErrorMessage(),
      life: 4000
    });
    return;
  }
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
  if (inlineEdit.value !== null || showJsonDialog.value || showRenameDialog.value || showImportDialog.value) {
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

/**
 * 他タブや同期経由で言語設定・テーマカラー・同期設定が変更された際に一覧画面の表示を即座に同期します。
 * @param changes - 変更されたストレージキーの辞書
 * @param area - 変更が発生したストレージ領域
 * @returns 処理完了を示す Promise
 */
const handleListStorageChanged = async (
  changes: { [key: string]: chrome.storage.StorageChange },
  area: string
): Promise<void> => {
  if (area === 'local' && changes.language) {
    const updated = await initI18n(changes.language.newValue ?? null);
    if (updated) {
      i18nVersion.value += 1;
    }
  }
  if (changes[THEME_COLOR_STORAGE_KEY] || changes.isSyncEnabled) {
    const nextThemeColor = await getThemeColor(true);
    applyThemeColor(nextThemeColor);
  }
};

onMounted(async () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleListStorageChanged);
  }
  await initI18n();
  const initialThemeColor = await getThemeColor(true);
  applyThemeColor(initialThemeColor);
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
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(handleListStorageChanged);
  }
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
  const trimmedNickname = normalizeNicknamePath(stripNicknameWhitespace(nickname));
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

  if (hasForbiddenNicknameChars(trimmedNickname)) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: getForbiddenNicknameErrorMessage(),
      life: 4000
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
 * 隠しファイル選択インプットをクリックしてインポート用ファイル選択ダイアログを開きます。
 * @returns なし
 */
const triggerImportFile = (): void => {
  importFileInputRef.value?.click();
};

/**
 * インポート解析エラーに応じたローカライズ済みメッセージを解決します。
 * @param err - キャッチされたエラーオブジェクト
 * @returns ユーザーへ表示するエラーメッセージ文字列
 */
const getImportErrorMessage = (err: unknown): string => {
  if (err instanceof BookmarkImportError) {
    switch (err.code) {
      case 'EMPTY_FILE':
        return t('errorImportEmptyFile') || 'The selected file is empty.';
      case 'INVALID_JSON_FORMAT':
        return t('errorInvalidJsonFormat') || 'Invalid JSON format.';
      case 'INVALID_JSON_STRUCTURE':
        return t('errorInvalidJsonStructure') || 'Invalid JSON structure. Missing "bookmarks" root key.';
      case 'INVALID_HTML_BOOKMARKS':
        return t('errorImportInvalidHtml') || 'Could not parse as a valid bookmark HTML file.';
      case 'NO_VALID_BOOKMARKS':
        return t('errorImportNoValidBookmarks') || 'No valid bookmarks found to import.';
      case 'INVALID_BOOKMARK_ENTRY':
        return (
          t('errorImportInvalidEntry', [err.detailParam || '']) ||
          `Invalid bookmark entry data (${err.detailParam || ''}).`
        );
      case 'FORBIDDEN_NICKNAME_CHARS':
        return getForbiddenNicknameErrorMessage(err.detailParam);
    }
  }
  return getSaveErrorMessage(err);
};

/**
 * ファイル選択ダイアログで選択されたファイルを読み込み、形式判別・解析を行って確認ダイアログを開きます。
 * 同じファイルを続けて再選択できるよう、処理完了後に input の値をリセットします。
 * @param event - input[type="file"] の change イベント
 * @returns 処理完了を示す Promise
 */
const handleImportFileSelected = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;

  if (inlineEdit.value && !isClosingInlineEdit.value) {
    cancelInlineEdit();
  }

  try {
    const content = await file.text();
    const parsed = parseImportFileContent(content, file.name);
    importPreview.value = {
      fileName: file.name,
      result: parsed
    };
    importMode.value = 'merge';
    importBaseFolder.value = '';
    showImportDialog.value = true;
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: getImportErrorMessage(err),
      life: 4000
    });
  } finally {
    if (input) {
      input.value = '';
    }
  }
};

/**
 * インポート確認ダイアログを閉じて一時プレビュー状態を初期化します。
 * @returns なし
 */
const closeImportDialog = (): void => {
  if (isImporting.value) return;
  showImportDialog.value = false;
  importPreview.value = null;
  importBaseFolder.value = '';
  importMode.value = 'merge';
};

/**
 * 確認ダイアログで選択されたモード（マージまたは上書き）とベースフォルダ設定に従い、
 * インポートデータをストレージへ保存して一覧を更新します。
 * @returns インポート完了を示す Promise
 */
const executeImport = async (): Promise<void> => {
  if (!importPreview.value || isImporting.value) return;

  const cleanedBaseFolder = normalizeNicknamePath(stripNicknameWhitespace(importBaseFolder.value));
  if (hasForbiddenNicknameChars(cleanedBaseFolder)) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: getForbiddenNicknameErrorMessage(),
      life: 4000
    });
    return;
  }

  isImporting.value = true;

  try {
    const preparedIncoming = applyBaseFolderPrefix(
      importPreview.value.result.bookmarks,
      cleanedBaseFolder
    );
    const nextBookmarks =
      importMode.value === 'merge'
        ? mergeBookmarksDictionaries(bookmarksData.value, preparedIncoming)
        : preparedIncoming;

    await saveBookmarksData(nextBookmarks);
    await loadBookmarks(true);

    // 上書き等により選択中フォルダが消滅した場合は全体表示へ戻す
    if (
      selectedFolder.value !== '__ALL__' &&
      selectedFolder.value !== '__ROOT__' &&
      !extractFolders(bookmarksData.value).has(selectedFolder.value)
    ) {
      selectedFolder.value = '__ALL__';
    }
    tableFirst.value = 0;

    const importedSummary = countBookmarksSummary(preparedIncoming);
    const totalSummary = countBookmarksSummary(bookmarksData.value);

    showImportDialog.value = false;
    importPreview.value = null;
    importBaseFolder.value = '';
    importMode.value = 'merge';

    toast.add({
      severity: 'success',
      summary: t('successImported') || 'Imported',
      detail:
        t('successImportedDetail', [
          String(importedSummary.bookmarkCount),
          String(totalSummary.bookmarkCount)
        ]) ||
        `Imported ${importedSummary.bookmarkCount} bookmark(s) (Total: ${totalSummary.bookmarkCount}).`,
      life: 4000
    });
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: getSaveErrorMessage(err),
      life: 4500
    });
  } finally {
    isImporting.value = false;
  }
};

/**
 * JSON エディタで編集されたブックマークデータの構造を検証します。
 * @param bookmarks - パースされた bookmarks オブジェクト
 * @returns 構造が妥当な場合は true、不正な場合は false
 */
const validateBookmarksJson = (bookmarks: unknown): bookmarks is Record<string, BookmarkEntry[]> => {
  if (!bookmarks || typeof bookmarks !== 'object' || Array.isArray(bookmarks)) return false;
  const record = bookmarks as Record<string, unknown>;
  for (const nickname of Object.keys(record)) {
    const normalizedNick = normalizeNicknamePath(nickname);
    if (normalizedNick === '') {
      toast.add({ severity: 'error', summary: 'Error', detail: 'Nickname cannot be empty.', life: 3000 });
      return false;
    }
    if (hasForbiddenNicknameChars(normalizedNick)) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: getForbiddenNicknameErrorMessage(normalizedNick),
        life: 4000
      });
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
      ? current.draftValue === current.originalNickname
        ? normalizedOrigNickname
        : normalizeNicknamePath(stripNicknameWhitespace(current.draftValue))
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

  // ニックネーム編集時は変更の有無にかかわらず使用不可文字が含まれていないかを検証し、既存データのまま再登録されることを防ぐ
  if (current.field === 'nickname' && hasForbiddenNicknameChars(newNickname)) {
    inlineEdit.value = null;
    inlineEditWrapperRef.value = null;
    isClosingInlineEdit.value = false;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: getForbiddenNicknameErrorMessage(),
      life: 4000
    });
    return;
  }

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
 * インライン編集中のキーボードイベント（Enter による保存確定、Escape によるキャンセル、ニックネーム列でのスペース抑止）を処理します。
 * 日本語 IME 変換確定中の Enter は誤確定を防ぐため無視し、Shift+Enter を含め改行入力は行いません。
 * @param event - キーボードイベント
 * @returns なし
 */
const handleInlineKeydown = (event: KeyboardEvent): void => {
  if (inlineEdit.value?.field === 'nickname' && isBlockedNicknameSpaceKey(event)) {
    event.preventDefault();
    return;
  }
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
 * ニックネーム列のインライン編集で IME 変換開始を記録します。
 * @param event - CompositionEvent
 * @returns なし
 */
const handleInlineNicknameCompositionStart = (event: CompositionEvent): void => {
  handleNicknameCompositionStart(event);
};

/**
 * ニックネーム列のインライン編集で IME 変換確定時に空白文字を除去します。
 * @param event - CompositionEvent
 * @returns なし
 */
const handleInlineNicknameCompositionEnd = (event: CompositionEvent): void => {
  handleNicknameCompositionEnd(event, val => {
    if (inlineEdit.value && inlineEdit.value.field === 'nickname') {
      inlineEdit.value.draftValue = val;
    }
  });
};

/**
 * ニックネーム列のインライン編集で入力値から空白文字を除去します。
 * @param event - 入力イベント
 * @returns なし
 */
const handleInlineNicknameInput = (event: Event): void => {
  handleNicknameInput(event, val => {
    if (inlineEdit.value && inlineEdit.value.field === 'nickname') {
      inlineEdit.value.draftValue = val;
    }
  });
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

.header-actions-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.hidden-file-input {
  display: none;
}

/* インポート確認ダイアログ */
.import-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.import-summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-radius: var(--p-border-radius-md, 6px);
  border: 1px solid var(--p-content-border-color);
  background-color: var(--p-content-background);
}

.import-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  font-size: 0.9rem;
}

.import-summary-label {
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.import-summary-value {
  color: var(--p-text-color);
  font-weight: 500;
  text-align: right;
  word-break: break-all;
}

.import-filename {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
}

.import-skipped-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.25rem;
  font-size: 0.82rem;
  color: var(--p-text-muted-color);
}

.import-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.import-field-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.import-mode-group {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.import-mode-option {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  font-size: 0.92rem;
  color: var(--p-text-color);
}

/* 列ヘッダー内のフィルターボタンおよび展開テキストエリア */
:deep(.filterable-header-content) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  gap: 0.25rem;
}

.column-filter-toggle-btn {
  order: 2;
  margin-left: auto;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  flex-shrink: 0;
}

.column-filter-toggle-btn.is-active {
  background-color: var(--p-highlight-background);
  color: var(--p-highlight-color);
}

.column-filter-box {
  order: 3;
  flex: 0 0 100%;
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 0.35rem;
  font-weight: normal;
}

.column-filter-textarea {
  width: 100%;
  font-size: 0.82rem;
  line-height: 1.35;
  padding: 0.3rem 1.75rem 0.3rem 0.5rem;
  resize: none;
  overflow: hidden;
}

.column-filter-clear-btn {
  position: absolute;
  right: 0.15rem;
  width: 1.4rem;
  height: 1.4rem;
  padding: 0;
}
</style>
