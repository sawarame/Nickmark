<template>
  <div class="popup-container" @keydown.esc="closePopup">
    <!-- ヘッダーエリア -->
    <header class="popup-header">
      <div class="header-title">
        <i class="pi pi-bookmark" style="font-size: 1.1rem; color: var(--p-primary-color, #10b981);"></i>
        <span class="title-text">{{ t('popupTitle') || 'ブックマーク登録' }}</span>
      </div>
      <div class="header-actions">
        <Button
          icon="pi pi-list"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('openOptionsTooltip') || '一覧画面を開く'"
          v-tooltip.bottom="t('openOptionsTooltip') || '一覧画面を開く'"
          @click="openOptions"
        />
        <Button
          icon="pi pi-cog"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('openPreferencesTooltip') || '設定画面を開く'"
          v-tooltip.bottom="t('openPreferencesTooltip') || '設定画面を開く'"
          @click="openPreferences"
        />
      </div>
    </header>

    <!-- 入力フォームエリア -->
    <form class="popup-form" @submit.prevent="saveBookmark">
      <!-- エラーメッセージ表示 -->
      <div v-if="errorMessage" class="error-banner">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- ニックネーム入力（自動補完付き） -->
      <div class="form-field">
        <label for="nickname-input" class="field-label">
          {{ t('nicknameLabel') || 'ニックネーム' }} <span class="required">*</span>
        </label>
        <AutoComplete
          id="nickname-input"
          ref="nicknameInputRef"
          v-model="form.nickname"
          :suggestions="filteredNicknames"
          class="w-full"
          inputClass="w-full"
          placeholder="e.g. gh"
          autocomplete="off"
          @complete="searchNicknames"
          @keydown.enter.prevent="saveBookmark"
        />
      </div>

      <!-- タイトル入力 -->
      <div class="form-field">
        <label for="title-input" class="field-label">
          {{ t('titleLabel') || 'タイトル（任意）' }}
        </label>
        <InputText
          id="title-input"
          v-model="form.title"
          class="w-full"
          placeholder="e.g. GitHub"
          @keydown.enter.prevent="saveBookmark"
        />
      </div>

      <!-- URL入力 -->
      <div class="form-field">
        <label for="url-input" class="field-label">
          {{ t('urlLabel') || 'URL' }} <span class="required">*</span>
        </label>
        <InputText
          id="url-input"
          v-model="form.url"
          class="w-full"
          placeholder="https://... or javascript:..."
          @keydown.enter.prevent="saveBookmark"
        />
      </div>

      <!-- 動的URL用デフォルト値入力（URLに %s が含まれる場合のみ表示） -->
      <div v-if="hasDynamicPlaceholder" class="form-field">
        <label for="default-value-input" class="field-label">
          {{ t('defaultValueLabel') || '引数省略時のデフォルト値（任意）' }}
        </label>
        <InputText
          id="default-value-input"
          v-model="form.defaultValue"
          class="w-full"
          :placeholder="t('defaultValuePlaceholder') || 'Default value for %s'"
          @keydown.enter.prevent="saveBookmark"
        />
      </div>

      <!-- アクションボタン -->
      <footer class="popup-footer">
        <Button
          type="button"
          :label="t('closeBtn') || '閉じる'"
          severity="secondary"
          text
          size="small"
          @click="closePopup"
        />
        <Button
          type="submit"
          :label="t('registerBtn') || '登録'"
          icon="pi pi-check"
          size="small"
          :loading="isSubmitting"
        />
      </footer>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import InputText from 'primevue/inputtext';
import AutoComplete, { AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import Button from 'primevue/button';
import { initI18n, t } from './i18n';
import { BookmarkEntry } from './shared/types';
import { isDynamicUrl, isSameUrl, normalizeNicknamePath } from './shared/url';
import { showToast } from './shared/toast';
import {
  createBookmarkEntry,
  getSaveErrorMessage,
  loadBookmarksData,
  saveBookmarksData
} from './shared/storage';
import { filterNicknameSuggestions } from './shared/search';

/**
 * フォーム入力値の状態インターフェース
 */
interface PopupForm {
  nickname: string;
  title: string;
  url: string;
  defaultValue: string;
}

// フォーム入力データ
const form = ref<PopupForm>({
  nickname: '',
  title: '',
  url: '',
  defaultValue: ''
});

// UI状態
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const activeTabId = ref<number | null>(null);
const nicknameInputRef = ref<any>(null);

// ニックネーム補完用データ
const bookmarksSnapshot = ref<Record<string, BookmarkEntry[]>>({});
const filteredNicknames = ref<string[]>([]);

/**
 * URL に動的プレースホルダー（%s）が含まれているかを判定します。
 * @returns %s を含む通常 URL の場合は true
 */
const hasDynamicPlaceholder = computed((): boolean => {
  return isDynamicUrl(form.value.url.trim());
});

/**
 * ポップアップを閉じます。
 * @returns なし
 */
const closePopup = (): void => {
  window.close();
};

/**
 * ブックマーク一覧管理画面を開きます。
 * @returns なし
 */
const openOptions = (): void => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('list.html') });
  }
  closePopup();
};

/**
 * 設定画面を開きます。
 * @returns なし
 */
const openPreferences = (): void => {
  chrome.tabs.create({ url: chrome.runtime.getURL('preferences.html') });
  closePopup();
};

/**
 * 入力されたニックネームからフォルダプレフィックスおよび既存ニックネームの補完候補を検索します。
 * @param event - AutoComplete の入力完了イベント
 * @returns なし
 */
const searchNicknames = (event: AutoCompleteCompleteEvent): void => {
  filteredNicknames.value = filterNicknameSuggestions(event.query || '', bookmarksSnapshot.value);
};

/**
 * 初期化処理: 多言語設定、アクティブタブ情報、既存ニックネームおよびフォルダ一覧を読み込みます。
 * @returns 初期化完了を示す Promise
 */
onMounted(async (): Promise<void> => {
  await initI18n();

  try {
    bookmarksSnapshot.value = await loadBookmarksData();
  } catch (error) {
    console.warn('ブックマークデータの読み込みに失敗しました:', error);
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      const currentTab = tabs[0];
      activeTabId.value = currentTab.id ?? null;
      form.value.url = currentTab.url ?? '';
      form.value.title = currentTab.title ?? '';
    }
  } catch (error) {
    console.warn('アクティブタブ情報の取得に失敗しました:', error);
  }

  // ニックネーム入力欄に自動フォーカスする
  await nextTick();
  if (nicknameInputRef.value) {
    const inputElement = nicknameInputRef.value.$el?.querySelector('input') || nicknameInputRef.value;
    if (inputElement && typeof inputElement.focus === 'function') {
      inputElement.focus();
    }
  }
});

/**
 * ブックマークを保存し、トースト通知を表示してダイアログを閉じます。
 * @returns 処理完了を示す Promise
 */
const saveBookmark = async (): Promise<void> => {
  errorMessage.value = null;

  const trimmedNickname = normalizeNicknamePath(form.value.nickname);
  const trimmedUrl = form.value.url.trim();
  const trimmedTitle = form.value.title.trim();
  const trimmedDefault = hasDynamicPlaceholder.value ? form.value.defaultValue.trim() : '';

  if (!trimmedNickname || !trimmedUrl) {
    errorMessage.value = t('errorNicknameUrlRequired') || 'ニックネームとURLを入力してください。';
    return;
  }

  isSubmitting.value = true;

  try {
    const bookmarks = await loadBookmarksData();
    if (!bookmarks[trimmedNickname]) {
      bookmarks[trimmedNickname] = [];
    }

    const existingEntry = bookmarks[trimmedNickname].find((b: BookmarkEntry) =>
      isSameUrl(b.url, trimmedUrl)
    );
    let toastMessage = '';

    if (!existingEntry) {
      bookmarks[trimmedNickname].push(
        createBookmarkEntry(trimmedUrl, trimmedTitle, trimmedDefault)
      );
      toastMessage =
        t('bookmarkAddedMessage', [trimmedNickname]) || `'${trimmedNickname}' として登録しました！`;
    } else {
      const isTitleChanged = !!trimmedTitle && trimmedTitle !== existingEntry.title;
      const isDefaultChanged = trimmedDefault !== (existingEntry.default_value || '');

      if (isTitleChanged || isDefaultChanged) {
        if (trimmedTitle) {
          existingEntry.title = trimmedTitle;
        }
        if (trimmedDefault) {
          existingEntry.default_value = trimmedDefault;
        } else if (existingEntry.default_value && !hasDynamicPlaceholder.value) {
          delete existingEntry.default_value;
        }
        toastMessage =
          t('bookmarkUpdatedMessage', [trimmedNickname]) ||
          `'${trimmedNickname}' のタイトルを更新しました！`;
      } else {
        toastMessage =
          t('bookmarkAlreadyExistsMessage', [trimmedNickname]) ||
          `'${trimmedNickname}' は既に登録されています。`;
      }
    }

    await saveBookmarksData(bookmarks);

    if (activeTabId.value !== null) {
      try {
        await showToast(activeTabId.value, toastMessage);
      } catch (toastErr) {
        console.warn('トースト通知の表示をスキップしました:', toastErr);
      }
    }

    closePopup();
  } catch (err: unknown) {
    console.error('ブックマーク登録中にエラーが発生しました:', err);
    errorMessage.value = getSaveErrorMessage(err, '登録に失敗しました。');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.popup-container {
  padding: 1rem;
  background-color: var(--p-surface-900, #18181b);
  color: var(--p-text-color, #ffffff);
  box-sizing: border-box;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--p-surface-700, #3f3f46);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color, #ffffff);
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.popup-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--p-text-muted-color, #a1a1aa);
}

.required {
  color: var(--p-red-400, #f87171);
}

.w-full {
  width: 100%;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--p-red-500, #ef4444);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 0.8rem;
}

.popup-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--p-surface-800, #27272a);
}
</style>
