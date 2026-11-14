<template>
  <div class="palette-container" @keydown="handleGlobalKeyDown">
    <!-- 検索入力ヘッダーエリア -->
    <div class="palette-search-bar">
      <i
        :class="['pi', isCommandInput ? 'pi-terminal' : 'pi-search', 'search-leading-icon']"
        aria-hidden="true"
      />
      <InputText
        ref="searchInputRef"
        v-model="query"
        class="palette-input"
        :placeholder="tr('popupPlaceholder') || 'ニックネーム検索 または :add / :open / :rm ...'"
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="shouldShowList"
        :aria-activedescendant="activeOptionId"
        @input="handleUserInput"
        @keydown="handleInputKeyDown"
      />
      <!-- 一覧・設定画面への控えめなクイックアクセスアイコン（Tab移動対象外） -->
      <div class="palette-header-actions">
        <Button
          type="button"
          icon="pi pi-list"
          severity="secondary"
          text
          rounded
          size="small"
          tabindex="-1"
          :aria-label="tr('openOptionsTooltip') || 'ブックマーク一覧画面を開く'"
          v-tooltip.bottom="tr('openOptionsTooltip') || 'ブックマーク一覧画面を開く'"
          @click="openOptions"
        />
        <Button
          type="button"
          icon="pi pi-cog"
          severity="secondary"
          text
          rounded
          size="small"
          tabindex="-1"
          :aria-label="tr('openPreferencesTooltip') || '設定画面を開く'"
          v-tooltip.bottom="tr('openPreferencesTooltip') || '設定画面を開く'"
          @click="openPreferences"
        />
      </div>
    </div>

    <!-- ポップアップ完結型のフィードバック通知バナー -->
    <div v-if="feedback" class="palette-feedback">
      <Message :severity="feedback.severity" :closable="false">
        {{ feedback.message }}
      </Message>
    </div>

    <!-- フォルダ一括オープン安全上限超過時の確認 UI -->
    <div v-if="pendingBatchConfirm" class="batch-confirm-box" role="alertdialog" aria-modal="true">
      <div class="batch-confirm-header">
        <i class="pi pi-exclamation-triangle batch-confirm-icon" aria-hidden="true" />
        <span class="batch-confirm-title">
          {{ t('confirmBatchOpenTitle') || '大量タブオープンの確認' }}
        </span>
      </div>
      <p class="batch-confirm-message">
        {{
          t('confirmBatchOpenMessage', [
            pendingBatchConfirm.folderPath,
            String(pendingBatchConfirm.urls.length),
            String(pendingBatchConfirm.maxLimit)
          ]) ||
          `フォルダ「${pendingBatchConfirm.folderPath}」には ${pendingBatchConfirm.urls.length} 件のタブが含まれています。安全上限（${pendingBatchConfirm.maxLimit}件）を超えていますが、すべて開きますか？`
        }}
      </p>
      <div class="batch-confirm-actions">
        <Button
          type="button"
          :label="`${t('cancelBtn') || 'キャンセル'} (Esc)`"
          severity="secondary"
          text
          size="small"
          @click="cancelBatchOpen"
        />
        <Button
          type="button"
          :label="`${t('confirmBatchOpenBtn') || 'すべて開く'} (Enter)`"
          severity="warn"
          size="small"
          :loading="isExecuting"
          @click="confirmBatchOpen"
        />
      </div>
    </div>

    <!-- 候補リスト（入力が空でない場合のみ表示） -->
    <div
      v-else-if="shouldShowList"
      ref="listContainerRef"
      class="palette-list"
      role="listbox"
    >
      <div v-if="items.length === 0" class="palette-empty">
        <i class="pi pi-info-circle" aria-hidden="true" />
        <span>{{ t('popupNoMatches') || '一致する候補が見つかりませんでした。' }}</span>
      </div>

      <div
        v-for="(item, index) in items"
        :id="`palette-option-${index}`"
        :key="item.id"
        :ref="el => setOptionRef(index, el)"
        class="palette-item"
        :class="{ 'is-selected': index === selectedIndex }"
        role="option"
        :aria-selected="index === selectedIndex"
        @mouseenter="selectedIndex = index"
        @click="handleItemClick($event, item)"
      >
        <!-- 左側種別アイコン / favicon -->
        <div class="item-icon-wrap">
          <span v-if="item.kind === 'folder'" class="item-emoji" aria-hidden="true">📁</span>
          <i
            v-else-if="item.kind === 'bookmarklet'"
            class="pi pi-code item-icon item-icon-code"
            aria-hidden="true"
          />
          <img
            v-else-if="item.faviconUrl && !failedFavicons.has(item.faviconUrl)"
            :src="item.faviconUrl"
            class="item-favicon"
            alt=""
            @error="markFaviconFailed(item.faviconUrl)"
          />
          <i
            v-else-if="item.kind === 'command' || item.kind === 'completion'"
            class="pi pi-terminal item-icon item-icon-cmd"
            aria-hidden="true"
          />
          <i v-else class="pi pi-globe item-icon" aria-hidden="true" />
        </div>

        <!-- 中央タイトル・バッジ・URL / 説明 -->
        <div class="item-body">
          <div class="item-top-row">
            <span v-if="item.badge" class="item-badge">{{ item.badge }}</span>
            <span class="item-title">{{ item.title }}</span>
            <i
              v-if="item.isPinned"
              class="pi pi-thumbtack item-pin-icon"
              aria-hidden="true"
            />
            <span v-if="item.typeTag" class="item-type-tag">{{ item.typeTag }}</span>
          </div>
          <div class="item-subtitle">{{ item.subtitle }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { initI18n, t } from './i18n';
import {
  BatchOpenConfirmationData,
  BookmarkEntry,
  BookmarkletExecutionResult,
  PaletteItem,
  RuntimeMessage,
  TabDisposition
} from './shared/types';
import { executeNickmarkCommand, navigateWithDisposition } from './shared/commands';
import { buildPaletteSuggestions } from './shared/search';
import { loadBookmarksData, openFolderUrls } from './shared/storage';

/**
 * ポップアップ内フィードバック通知の状態インターフェース
 */
interface FeedbackState {
  severity: 'success' | 'info' | 'warn' | 'error';
  message: string;
}

// 検索・候補状態
const query = ref('');
const selectedIndex = ref(0);
const bookmarksSnapshot = ref<Record<string, BookmarkEntry[]>>({});
const currentTab = ref<chrome.tabs.Tab | undefined>(undefined);

// UI 状態
const i18nVersion = ref(0);
const isExecuting = ref(false);
const feedback = ref<FeedbackState | null>(null);
const pendingBatchConfirm = ref<BatchOpenConfirmationData | null>(null);
const failedFavicons = ref<Set<string>>(new Set());

/**
 * initI18n 完了後にもテンプレート上の翻訳テキストを再評価するためのラッパー関数です。
 * @param key - メッセージキー
 * @returns 翻訳済み文字列
 */
const tr = (key: string): string => {
  void i18nVersion.value;
  return t(key);
};

// DOM 参照
const searchInputRef = ref<any>(null);
const listContainerRef = ref<HTMLElement | null>(null);
const optionRefs = ref<Map<number, HTMLElement>>(new Map());
let feedbackDismissTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 現在の入力がコマンドモード（`:` 開始）かどうかを判定します。
 * @returns コマンド入力中の場合は true
 */
const isCommandInput = computed((): boolean => {
  return query.value.trimStart().startsWith(':');
});

/**
 * 検索入力文字列に基づいて表示すべき候補リストを算出します。
 * 入力が空の場合は空配列を返します。
 * @returns パレット候補アイテム配列
 */
const items = computed((): PaletteItem[] => {
  return buildPaletteSuggestions(query.value, bookmarksSnapshot.value, {
    url: currentTab.value?.url,
    title: currentTab.value?.title
  });
});

/**
 * 候補リストエリアを表示すべきかどうかを判定します。
 * 入力が 1 文字以上あり、確認ダイアログ表示中でない場合に true を返します。
 * @returns リスト表示条件を満たす場合は true
 */
const shouldShowList = computed((): boolean => {
  return query.value.trim().length > 0 && !pendingBatchConfirm.value;
});

/**
 * スクリーンリーダー向けのアクティブ選択肢 ID を算出します。
 * @returns 選択中オプション要素の ID または undefined
 */
const activeOptionId = computed((): string | undefined => {
  if (!shouldShowList.value || items.value.length === 0) return undefined;
  return `palette-option-${selectedIndex.value}`;
});

// 候補リストの変化時に選択インデックスを先頭へリセットする
watch(items, newItems => {
  optionRefs.value.clear();
  selectedIndex.value = newItems.length > 0 ? 0 : -1;
});

/**
 * 選択中オプション要素の参照を登録します。
 * @param index - 候補配列内のインデックス
 * @param el - DOM 要素またはコンポーネントインスタンス
 * @returns なし
 */
const setOptionRef = (index: number, el: unknown): void => {
  if (el instanceof HTMLElement) {
    optionRefs.value.set(index, el);
  } else {
    optionRefs.value.delete(index);
  }
};

/**
 * 成功フィードバック自動消去タイマーをキャンセルします。
 * @returns なし
 */
const clearFeedbackDismissTimer = (): void => {
  if (feedbackDismissTimer !== null) {
    clearTimeout(feedbackDismissTimer);
    feedbackDismissTimer = null;
  }
};

/**
 * ポップアップを閉じます。
 * @returns なし
 */
const closePopup = (): void => {
  clearFeedbackDismissTimer();
  window.close();
};

/**
 * 検索入力欄へフォーカスを移動します。
 * @returns フォーカス適用後の Promise
 */
const focusSearchInput = async (): Promise<void> => {
  await nextTick();
  const rootEl = searchInputRef.value?.$el ?? searchInputRef.value;
  const inputEl: HTMLInputElement | null =
    rootEl?.tagName === 'INPUT' ? rootEl : rootEl?.querySelector?.('input') ?? null;
  if (inputEl && typeof inputEl.focus === 'function') {
    inputEl.focus();
  }
};

/**
 * Favicon 画像の読み込み失敗を記録し、代替アイコンへ切り替えます。
 * @param url - 読み込みに失敗したファビコン URL
 * @returns なし
 */
const markFaviconFailed = (url?: string): void => {
  if (!url) return;
  const next = new Set(failedFavicons.value);
  next.add(url);
  failedFavicons.value = next;
};

/**
 * ユーザーによる直接入力時に、進行中の自動クローズおよび過去フィードバックをクリアします。
 * @returns なし
 */
const handleUserInput = (): void => {
  clearFeedbackDismissTimer();
  feedback.value = null;
};

/**
 * ブックマーク一覧画面（管理画面）を開き、ポップアップを閉じます。
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
 * 設定画面を開き、ポップアップを閉じます。
 * @returns なし
 */
const openPreferences = (): void => {
  chrome.tabs.create({ url: chrome.runtime.getURL('preferences.html') });
  closePopup();
};

/**
 * 候補リスト内のハイライトインデックスを指定方向へ移動し、表示領域内へ追従スクロールさせます。
 * @param delta - 移動量（+1 で下、-1 で上）
 * @returns なし
 */
const moveSelection = (delta: number): void => {
  const len = items.value.length;
  if (len === 0) return;

  const current = selectedIndex.value < 0 ? 0 : selectedIndex.value;
  selectedIndex.value = (current + delta + len) % len;

  nextTick(() => {
    const el = optionRefs.value.get(selectedIndex.value);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  });
};

/**
 * 現在ハイライトされている候補の補完文字列（`fillText`）を検索入力欄へ反映します。
 * @returns なし
 */
const applyTabCompletion = (): void => {
  const target = items.value[selectedIndex.value] ?? items.value[0];
  if (!target || !target.fillText) return;

  clearFeedbackDismissTimer();
  feedback.value = null;
  query.value = target.fillText;
  focusSearchInput();
};

/**
 * キーボードまたはマウスイベントの修飾キーからタブの開き方（disposition）を判定します。
 * @param event - KeyboardEvent または MouseEvent
 * @returns タブの開き方
 */
const getDispositionFromEvent = (event: KeyboardEvent | MouseEvent): TabDisposition => {
  if (event.shiftKey) return 'newBackgroundTab';
  if (event.metaKey || event.ctrlKey || event.altKey) return 'newForegroundTab';
  return 'currentTab';
};

/**
 * ポップアップ内に一時的な成功メッセージを表示し、一定時間後にメッセージのみ自動で消去します。
 * @param message - 表示する成功メッセージ
 * @returns なし
 */
const showSuccessFeedback = (message: string): void => {
  clearFeedbackDismissTimer();
  feedback.value = { severity: 'success', message };
  feedbackDismissTimer = setTimeout(() => {
    feedback.value = null;
    feedbackDismissTimer = null;
  }, 2500);
};

/**
 * コマンド文字列を共有コマンドエンジン経由で実行し、戻り値に応じてポップアップ内の表示やクローズを制御します。
 * @param commandText - 実行するコマンド文字列
 * @returns 処理完了を示す Promise
 */
const runCommandInPopup = async (commandText: string): Promise<void> => {
  const result = await executeNickmarkCommand(commandText, currentTab.value, { source: 'popup' });

  switch (result.outcome) {
    case 'executed_close':
      closePopup();
      break;
    case 'executed_keep_open':
      await focusSearchInput();
      break;
    case 'success_toast':
      bookmarksSnapshot.value = await loadBookmarksData();
      query.value = '';
      showSuccessFeedback(result.message || '');
      await focusSearchInput();
      break;
    case 'info_prompt':
      feedback.value = {
        severity: 'info',
        message: result.message || ''
      };
      if (result.suggestedInput !== undefined) {
        query.value = result.suggestedInput;
      }
      await focusSearchInput();
      break;
    case 'needs_confirmation':
      if (result.confirmation) {
        pendingBatchConfirm.value = result.confirmation;
      }
      break;
    case 'error':
      feedback.value = {
        severity: 'error',
        message: result.message || ''
      };
      await focusSearchInput();
      break;
  }
};

/**
 * 指定された候補アイテムを実行します（URL 遷移、ブックマークレット、フォルダ一括オープン、補完またはコマンド）。
 * @param item - 実行対象の候補アイテム
 * @param disposition - 通常 URL 遷移時のタブの開き方
 * @returns 処理完了を示す Promise
 */
const executeItem = async (item: PaletteItem, disposition: TabDisposition): Promise<void> => {
  if (isExecuting.value) return;
  clearFeedbackDismissTimer();
  feedback.value = null;
  isExecuting.value = true;

  try {
    if (item.kind === 'completion') {
      // `:rm` の複数 URL 警告など確定不能な案内行はコマンド実行に流してメッセージを表示する
      if (item.id.startsWith('cmd:rm:multi:')) {
        await runCommandInPopup(item.executeValue);
      } else {
        query.value = item.fillText;
        await focusSearchInput();
      }
      return;
    }

    if (item.kind === 'bookmark') {
      await navigateWithDisposition(
        item.executeValue,
        disposition,
        currentTab.value?.id,
        item.matchTarget?.templateUrl,
        item.matchTarget?.nickname
      );
      if (disposition === 'newBackgroundTab') {
        await focusSearchInput();
      } else {
        closePopup();
      }
      return;
    }

    if (item.kind === 'bookmarklet') {
      const tabId = currentTab.value?.id;
      if (tabId === undefined) {
        feedback.value = {
          severity: 'error',
          message:
            t('errorBookmarkletRestrictedPage') ||
            'このページ（ブラウザ内部ページやストア等）ではブックマークレットを実行できません。'
        };
        return;
      }

      const messagePayload: RuntimeMessage = {
        action: 'EXECUTE_BOOKMARKLET',
        payload: {
          tabId,
          tabUrl: currentTab.value?.url,
          bookmarkletUrl: item.executeValue,
          matchedTemplateUrl: item.matchTarget?.templateUrl,
          matchedNickname: item.matchTarget?.nickname
        }
      };

      const res = (await chrome.runtime.sendMessage(messagePayload)) as BookmarkletExecutionResult;
      if (res && res.success) {
        closePopup();
      } else {
        feedback.value = {
          severity: 'error',
          message:
            res?.errorMessage ||
            t('errorBookmarkletExecutionFailed', ['']) ||
            'ブックマークレットの実行中にエラーが発生しました。'
        };
      }
      return;
    }

    if (item.kind === 'folder' && item.folderPath) {
      await runCommandInPopup(`:open ${item.folderPath}/`);
      return;
    }

    if (item.kind === 'command') {
      await runCommandInPopup(item.executeValue);
    }
  } catch (err: unknown) {
    console.error('コマンドパレット実行エラー:', err);
    feedback.value = {
      severity: 'error',
      message: err instanceof Error ? err.message : String(err)
    };
  } finally {
    isExecuting.value = false;
  }
};

/**
 * Enter キー押下時に選択中の候補（またはコマンド文字列）を実行します。
 * @param event - キーボードイベント
 * @returns 処理完了を示す Promise
 */
const executeSelectedOrQuery = async (event: KeyboardEvent): Promise<void> => {
  const target = items.value[selectedIndex.value] ?? items.value[0];
  if (target) {
    await executeItem(target, getDispositionFromEvent(event));
    return;
  }

  // 候補が存在しない場合の安全処理（閉じずにフィードバックを表示）
  const trimmed = query.value.trim();
  if (!trimmed) return;

  if (trimmed.startsWith(':')) {
    await runCommandInPopup(trimmed);
  } else {
    feedback.value = {
      severity: 'warn',
      message: t('popupNoMatches') || '一致する候補が見つかりませんでした。'
    };
  }
};

/**
 * 候補行クリック時のハンドラです。修飾キーに応じて開き方を切り替えて実行します。
 * @param event - マウスイベント
 * @param item - クリックされた候補アイテム
 * @returns 処理完了を示す Promise
 */
const handleItemClick = async (event: MouseEvent, item: PaletteItem): Promise<void> => {
  await executeItem(item, getDispositionFromEvent(event));
};

/**
 * 大量タブオープン確認ダイアログで「すべて開く」が選択された場合の処理を実行します。
 * @returns 処理完了を示す Promise
 */
const confirmBatchOpen = async (): Promise<void> => {
  if (!pendingBatchConfirm.value || isExecuting.value) return;
  isExecuting.value = true;

  try {
    const folderPath = pendingBatchConfirm.value.folderPath;
    pendingBatchConfirm.value = null;
    await openFolderUrls(folderPath, true, undefined);
    await focusSearchInput();
  } catch (err: unknown) {
    feedback.value = {
      severity: 'error',
      message: err instanceof Error ? err.message : String(err)
    };
  } finally {
    isExecuting.value = false;
  }
};

/**
 * 大量タブオープン確認をキャンセルし、検索入力へ戻ります。
 * @returns 処理完了を示す Promise
 */
const cancelBatchOpen = async (): Promise<void> => {
  pendingBatchConfirm.value = null;
  await focusSearchInput();
};

/**
 * 検索入力欄上のキー操作（IME ガード、候補移動、Tab 補完、Enter 実行）を処理します。
 * @param event - キーボードイベント
 * @returns なし
 */
const handleInputKeyDown = (event: KeyboardEvent): void => {
  // 日本語 IME 変換確定中の Enter による誤実行を防止する
  if (event.isComposing || event.keyCode === 229) return;

  if (event.key === 'ArrowDown' || (event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'n' || event.key === 'N'))) {
    event.preventDefault();
    moveSelection(1);
    return;
  }

  if (event.key === 'ArrowUp' || (event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'p' || event.key === 'P'))) {
    event.preventDefault();
    moveSelection(-1);
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    applyTabCompletion();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    void executeSelectedOrQuery(event);
  }
};

/**
 * ポップアップ全体のグローバルキー操作（Esc クローズ、確認ダイアログ上の Enter/Esc）を処理します。
 * @param event - キーボードイベント
 * @returns なし
 */
const handleGlobalKeyDown = (event: KeyboardEvent): void => {
  if (event.isComposing || event.keyCode === 229) return;

  if (pendingBatchConfirm.value) {
    if (event.key === 'Escape') {
      event.preventDefault();
      void cancelBatchOpen();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void confirmBatchOpen();
    }
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closePopup();
  }
};

/**
 * 初期化処理: 多言語設定、ブックマークデータ、およびアクティブタブ情報を読み込み入力欄へフォーカスします。
 * @returns 初期化完了を示す Promise
 */
onMounted(async (): Promise<void> => {
  await initI18n();
  i18nVersion.value += 1;

  const [bookmarksResult, tabsResult] = await Promise.allSettled([
    loadBookmarksData(),
    chrome.tabs.query({ active: true, currentWindow: true })
  ]);

  if (bookmarksResult.status === 'fulfilled') {
    bookmarksSnapshot.value = bookmarksResult.value;
  } else {
    console.warn('ブックマークデータの読み込みに失敗しました:', bookmarksResult.reason);
  }

  if (tabsResult.status === 'fulfilled' && tabsResult.value.length > 0) {
    currentTab.value = tabsResult.value[0];
  } else if (tabsResult.status === 'rejected') {
    console.warn('アクティブタブ情報の取得に失敗しました:', tabsResult.reason);
  }

  await focusSearchInput();
});

onUnmounted(() => {
  clearFeedbackDismissTimer();
});
</script>

<style scoped>
.palette-container {
  width: 600px;
  min-height: 120px;
  background-color: var(--p-content-background);
  color: var(--p-text-color);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.palette-search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--p-content-border-color);
  background-color: var(--p-content-background);
}

.search-leading-icon {
  font-size: 1rem;
  color: var(--p-primary-color, #10b981);
  flex-shrink: 0;
  margin-left: 0.25rem;
}

.palette-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  color: var(--p-text-color);
  font-size: 0.95rem;
  padding: 0.35rem 0.25rem;
}

.palette-input::placeholder {
  color: var(--p-text-muted-color);
  opacity: 1;
}

.palette-input:focus {
  outline: none;
  box-shadow: none;
}

.palette-header-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-shrink: 0;
  opacity: 0.75;
  transition: opacity 0.15s ease;
}

.palette-header-actions:hover {
  opacity: 1;
}

.palette-feedback {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.batch-confirm-box {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background-color: var(--p-content-background);
}

.batch-confirm-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.batch-confirm-icon {
  color: var(--p-amber-500, #f59e0b);
  font-size: 1.1rem;
}

.batch-confirm-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.batch-confirm-message {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--p-text-muted-color);
}

.batch-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.palette-list {
  max-height: 440px;
  overflow-y: auto;
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.palette-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 0.75rem;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.65rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.palette-item:hover {
  background-color: var(--p-content-hover-background);
}

.palette-item.is-selected {
  background-color: var(--p-highlight-background);
  color: var(--p-highlight-color);
}

.item-icon-wrap {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-favicon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.item-emoji {
  font-size: 1rem;
  line-height: 1;
}

.item-icon {
  font-size: 0.95rem;
  color: var(--p-text-muted-color);
}

.item-icon-code {
  color: var(--p-amber-500, #f59e0b);
}

.item-icon-cmd {
  color: var(--p-primary-color, #10b981);
}

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.item-top-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.item-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--p-primary-color) 16%, transparent);
  color: var(--p-primary-color);
  flex-shrink: 0;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-title {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-pin-icon {
  font-size: 0.72rem;
  color: var(--p-primary-color, #10b981);
  flex-shrink: 0;
}

.item-type-tag {
  font-size: 0.7rem;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  background-color: var(--p-content-hover-background);
  color: var(--p-text-muted-color);
  border: 1px solid var(--p-content-border-color);
  flex-shrink: 0;
}

.item-subtitle {
  font-size: 0.76rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
