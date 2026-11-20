<template>
  <div class="palette-container" @keydown="handleGlobalKeyDown">
    <!-- 検索入力ヘッダーエリア -->
    <div class="palette-search-bar">
      <!-- コマンド入力モード時は >_ アイコン、通常検索時は虫眼鏡アイコンを表示する -->
      <CommandPromptIcon
        v-if="isCommandInput"
        class="search-leading-icon"
      />
      <i
        v-else
        class="pi pi-search search-leading-icon"
        aria-hidden="true"
      />
      <InputText
        ref="searchInputRef"
        v-model="query"
        class="palette-input"
        :placeholder="tr('popupPlaceholder') || 'ニックネーム検索 または :add / :rm ...'"
        autofocus
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

    <!-- :add 入力時に現在のページがすでに登録済みであることを知らせるバナー -->
    <div v-if="alreadyBookmarkedNotice" class="palette-feedback">
      <Message severity="info" :closable="false">
        {{ alreadyBookmarkedNotice }}
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
      <div v-if="items.length === 0 && !isHistorySearchPending" class="palette-empty">
        <i class="pi pi-info-circle" aria-hidden="true" />
        <span>{{ t('popupNoMatches') || '一致する候補が見つかりませんでした。' }}</span>
      </div>

      <template v-for="(item, index) in items" :key="item.id">
        <!-- ブラウザ履歴候補セクション見出し（ブックマーク候補との境界に表示） -->
        <div
          v-if="index === bookmarkItems.length && historyItems.length > 0"
          class="palette-section-header"
          role="presentation"
        >
          <i class="pi pi-history section-header-icon" aria-hidden="true" />
          <span>{{ tr('popupHistorySectionTitle') || 'ブラウザ履歴' }}</span>
        </div>

        <div
          :id="`palette-option-${index}`"
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
            <CommandPromptIcon
              v-else-if="item.kind === 'command' || item.kind === 'completion'"
              class="item-icon item-icon-cmd"
            />
            <i
              v-else-if="item.kind === 'history'"
              class="pi pi-history item-icon item-icon-history"
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
      </template>
    </div>

    <!-- 起動直後など入力が空の空白領域に表示するクリック切替可能な Tips エリア -->
    <div
      v-else-if="shouldShowTips"
      class="palette-tips"
      role="button"
      tabindex="-1"
      :aria-label="tr('popupTipsNextHint') || 'クリックで次のヒントを表示'"
      v-tooltip.bottom="tr('popupTipsNextHint') || 'クリックで次のヒントを表示'"
      @mousedown.prevent
      @click="cycleTip"
    >
      <i
        :class="['pi', currentTip?.icon || 'pi-lightbulb', 'tips-leading-icon']"
        aria-hidden="true"
      />
      <div class="tips-content">
        <span class="tips-badge">{{ tr('popupTipsBadge') || 'TIP' }}</span>
        <span class="tips-text">{{ currentTipText }}</span>
      </div>
      <i class="pi pi-refresh tips-next-icon" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Message from 'primevue/message';
import CommandPromptIcon from './components/CommandPromptIcon.vue';
import { getCurrentLocale, hasI18nMessagesReady, initI18n, t } from './i18n';
import {
  BatchOpenConfirmationData,
  BookmarkEntry,
  BookmarkletExecutionResult,
  ENABLED_PRESETS_STORAGE_KEY,
  OPEN_IN_CURRENT_IF_NEW_TAB_STORAGE_KEY,
  OPEN_IN_NEW_TAB_STORAGE_KEY,
  PaletteItem,
  PresetId,
  RuntimeMessage,
  TabDisposition,
  TipEntry
} from './shared/types';
import {
  executeNickmarkCommand,
  navigateWithDisposition,
  openUrlWithDisposition,
  resolvePopupTabDisposition
} from './shared/commands';
import {
  hasHistoryPermission,
  searchHistoryPaletteItems,
  shouldSearchHistoryForQuery
} from './shared/history';
import {
  mergeBookmarksWithPresets,
  formatHtmlLink,
  formatMarkdownLink,
  isPresetHtmllinkUrl,
  isPresetMdlinkUrl
} from './shared/presets';
import { buildPaletteSuggestions, findNicknamesForUrl } from './shared/search';
import {
  getEnabledPresetIds,
  getMaxBatchOpenTabs,
  getOpenInCurrentIfNewTab,
  getOpenInNewTab,
  loadBookmarksData,
  loadPopupInitialData,
  openFolderUrls,
  updateScore
} from './shared/storage';
import { formatTipMessage, pickRandomTipIndex, POPUP_TIPS } from './shared/tips';
import { showInPageToastOnly } from './shared/toast';
import { isChromeNewTab, isRestrictedTabUrl } from './shared/url';

// 連続入力時の履歴検索過多を抑えるデバウンス待機時間（ミリ秒）
const HISTORY_SEARCH_DEBOUNCE_MS = 80;

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
const enabledPresetIds = ref<PresetId[]>([]);
const currentTab = ref<chrome.tabs.Tab | undefined>(undefined);
const isHistorySearchActive = ref(false);
const openInNewTabByDefault = ref(false);
const openInCurrentIfNewTab = ref(false);
const historyItems = ref<PaletteItem[]>([]);
const isHistorySearchPending = ref(false);

// UI 状態
const i18nVersion = ref(0);
const i18nReady = ref<boolean>(hasI18nMessagesReady());
const isExecuting = ref(false);
const feedback = ref<FeedbackState | null>(null);
const pendingBatchConfirm = ref<BatchOpenConfirmationData | null>(null);
const failedFavicons = ref<Set<string>>(new Set());
const currentTipIndex = ref<number>(pickRandomTipIndex(POPUP_TIPS.length));

/**
 * initI18n 完了後にもテンプレート上の翻訳テキストを再評価するためのラッパー関数です。
 * @param key - メッセージキー
 * @param substitutions - プレースホルダー（$1 等）へ埋め込む置換文字列配列（任意）
 * @returns 翻訳済み文字列
 */
const tr = (key: string, substitutions?: string[]): string => {
  void i18nVersion.value;
  return t(key, substitutions);
};

// DOM 参照・非同期制御
const searchInputRef = ref<any>(null);
const listContainerRef = ref<HTMLElement | null>(null);
const optionRefs = ref<Map<number, HTMLElement>>(new Map());
let feedbackDismissTimer: ReturnType<typeof setTimeout> | null = null;
let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let historyRequestSeq = 0;

/**
 * 現在の入力がコマンドモード（`:` 開始）かどうかを判定します。
 * @returns コマンド入力中の場合は true
 */
const isCommandInput = computed((): boolean => {
  return query.value.trimStart().startsWith(':');
});

/**
 * ユーザー登録ブックマークに現在有効なプリセットを仮想合成した通常検索用の辞書を算出します。
 * 言語設定や有効プリセットの変更時にリアクティブに再評価されます。
 * @returns プリセット合成済みの検索用ブックマーク辞書
 */
const searchableBookmarks = computed((): Record<string, BookmarkEntry[]> => {
  void i18nVersion.value;
  return mergeBookmarksWithPresets(
    bookmarksSnapshot.value,
    enabledPresetIds.value,
    getCurrentLocale()
  );
});

/**
 * 検索入力文字列に基づいて同期算出されるブックマーク・コマンド候補リストを返します。
 * 通常検索時はプリセットを合成した辞書を用い、`:` コマンド入力時はユーザー登録ブックマークのみを参照します。
 * 入力が空の場合は空配列を返します。
 * @returns ブックマーク・コマンド系パレット候補アイテム配列
 */
const bookmarkItems = computed((): PaletteItem[] => {
  const targetBookmarks = isCommandInput.value
    ? bookmarksSnapshot.value
    : searchableBookmarks.value;
  return buildPaletteSuggestions(query.value, targetBookmarks, {
    url: currentTab.value?.url,
    title: currentTab.value?.title
  });
});

/**
 * 上部のブックマーク・コマンド候補と下部のブラウザ履歴候補を結合した全候補リストを算出します。
 * @returns パレット表示用の結合候補アイテム配列
 */
const items = computed((): PaletteItem[] => {
  if (historyItems.value.length === 0) return bookmarkItems.value;
  return [...bookmarkItems.value, ...historyItems.value];
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
 * `:add` / `:a` コマンド入力時に現在開いているタブがすでにブックマーク登録済みである場合、
 * その登録済みニックネーム一覧を含むお知らせメッセージを算出します。
 * 単独の `:` 入力時や直接 URL／ブックマークレット指定時、または別コマンド入力時は null を返します。
 * @returns 既登録通知メッセージ文字列（未該当時は null）
 */
const alreadyBookmarkedNotice = computed((): string | null => {
  if (!shouldShowList.value) return null;

  const firstToken = query.value.trimStart().split(/\s+/)[0] || '';
  if (firstToken.length < 2) return null;

  const addExecItem = bookmarkItems.value.find(item => item.id === 'cmd:add:exec');
  if (!addExecItem?.previewMeta || addExecItem.previewMeta.mode !== 'currentTab') {
    return null;
  }

  const targetUrl = addExecItem.previewMeta.targetUrl;
  if (!targetUrl) return null;

  const existingNicknames = findNicknamesForUrl(targetUrl, bookmarksSnapshot.value);
  if (existingNicknames.length === 0) return null;

  const joinedNicknames = existingNicknames.join(', ');
  return (
    tr('popupAddAlreadyBookmarkedNotice', [joinedNicknames]) ||
    `このページはすでにブックマークに登録されています（ニックネーム: ${joinedNicknames}）`
  );
});

/**
 * 現在選択されている Tip エントリを返します。
 * @returns 現在の Tip エントリ（存在しない場合は null）
 */
const currentTip = computed((): TipEntry | null => {
  return POPUP_TIPS[currentTipIndex.value] ?? null;
});

/**
 * 現在の言語設定および実行 OS に応じて解決された Tip 本文を返します。
 * @returns ローカライズ済みの Tip 本文文字列
 */
const currentTipText = computed((): string => {
  if (!currentTip.value) return '';
  return formatTipMessage(currentTip.value, tr);
});

/**
 * 空白状態向けの Tips エリアを表示すべきかどうかを判定します。
 * 多言語辞書の読み込みが完了し、検索欄が空で、通知および確認ダイアログが表示されていない場合に true を返します。
 * @returns Tips 表示条件を満たす場合は true
 */
const shouldShowTips = computed((): boolean => {
  return (
    query.value.trim().length === 0 &&
    !pendingBatchConfirm.value &&
    !feedback.value &&
    i18nReady.value &&
    currentTip.value !== null
  );
});

/**
 * スクリーンリーダー向けのアクティブ選択肢 ID を算出します。
 * @returns 選択中オプション要素の ID または undefined
 */
const activeOptionId = computed((): string | undefined => {
  if (!shouldShowList.value || items.value.length === 0) return undefined;
  return `palette-option-${selectedIndex.value}`;
});

/**
 * 待機中の履歴検索デバウンスタイマーをキャンセルします。
 * @returns なし
 */
const clearHistoryDebounceTimer = (): void => {
  if (historyDebounceTimer !== null) {
    clearTimeout(historyDebounceTimer);
    historyDebounceTimer = null;
  }
};

// 同期候補（ブックマーク・コマンド）の変化時は選択インデックスを先頭へリセットする
watch(bookmarkItems, newBookmarks => {
  optionRefs.value.clear();
  selectedIndex.value = newBookmarks.length > 0 ? 0 : -1;
});

// 通常検索入力に応じて非同期でブラウザ履歴を検索し、レースコンディションを防ぎつつ候補下部に結合する
watch(
  [query, isHistorySearchActive, pendingBatchConfirm, bookmarkItems],
  ([newQuery, historyActive, batchConfirm, currentBookmarks]) => {
    clearHistoryDebounceTimer();

    if (!historyActive || !!batchConfirm || !shouldSearchHistoryForQuery(newQuery)) {
      historyRequestSeq += 1;
      isHistorySearchPending.value = false;
      if (historyItems.value.length > 0) {
        historyItems.value = [];
      }
      return;
    }

    const seq = ++historyRequestSeq;
    isHistorySearchPending.value = true;
    const excludeUrls = currentBookmarks
      .filter(item => item.kind === 'bookmark')
      .map(item => item.executeValue);

    historyDebounceTimer = setTimeout(async () => {
      historyDebounceTimer = null;
      const fetched = await searchHistoryPaletteItems(newQuery, excludeUrls);
      if (seq !== historyRequestSeq) return;
      if (
        !isHistorySearchActive.value ||
        pendingBatchConfirm.value ||
        !shouldSearchHistoryForQuery(query.value)
      ) {
        isHistorySearchPending.value = false;
        historyItems.value = [];
        return;
      }

      // 履歴到着前にユーザーが移動したハイライト位置を可能な限り維持する
      const prevSelectedId =
        selectedIndex.value >= 0 ? items.value[selectedIndex.value]?.id : undefined;

      optionRefs.value.clear();
      isHistorySearchPending.value = false;
      historyItems.value = fetched;

      if (prevSelectedId) {
        const nextIdx = items.value.findIndex(item => item.id === prevSelectedId);
        selectedIndex.value = nextIdx !== -1 ? nextIdx : items.value.length > 0 ? 0 : -1;
      } else {
        selectedIndex.value = items.value.length > 0 ? 0 : -1;
      }
    }, HISTORY_SEARCH_DEBOUNCE_MS);
  }
);

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
 * 既に DOM 要素が存在する場合は nextTick を待たずに同期的にフォーカスを適用します。
 * @returns フォーカス適用後の Promise
 */
const focusSearchInput = async (): Promise<void> => {
  const getInputEl = (): HTMLInputElement | null => {
    const rootEl = searchInputRef.value?.$el ?? searchInputRef.value;
    return rootEl?.tagName === 'INPUT' ? rootEl : rootEl?.querySelector?.('input') ?? null;
  };

  const tryFocus = (): boolean => {
    const inputEl = getInputEl();
    if (inputEl && typeof inputEl.focus === 'function') {
      inputEl.focus();
      return document.activeElement === inputEl;
    }
    return false;
  };

  if (tryFocus()) return;
  await nextTick();
  if (tryFocus()) return;

  // Chrome ポップアップ生成直後で初回フレーム前に focus() が効かない場合に備え、次フレームで未フォーカス時のみ補完する
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) {
        tryFocus();
      }
    });
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
 * 表示中の Tip とは異なる別の Tip へ切り替え、検索入力欄へのフォーカスを維持します。
 * @returns フォーカス適用完了を示す Promise
 */
const cycleTip = async (): Promise<void> => {
  currentTipIndex.value = pickRandomTipIndex(POPUP_TIPS.length, currentTipIndex.value);
  await focusSearchInput();
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
 * キーボードまたはマウスイベントの修飾キーと設定値からタブの開き方（disposition）を判定します。
 * @param event - KeyboardEvent または MouseEvent
 * @returns タブの開き方
 */
const getDispositionFromEvent = (event: KeyboardEvent | MouseEvent): TabDisposition => {
  return resolvePopupTabDisposition(
    event,
    openInNewTabByDefault.value,
    openInCurrentIfNewTab.value,
    isChromeNewTab(currentTab.value)
  );
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
  const result = await executeNickmarkCommand(commandText, currentTab.value);

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
 * 指定されたフォルダパスのブックマークを一括で開き、安全上限超過時は確認ダイアログを表示します。
 * @param folderPath - 開く対象のフォルダパス
 * @returns 処理完了を示す Promise
 */
const executeFolderBatchOpenInPopup = async (folderPath: string): Promise<void> => {
  const result = await openFolderUrls(folderPath, false, undefined);
  if (result.requiresConfirmation && result.folderPath && result.urls) {
    const maxLimit = await getMaxBatchOpenTabs();
    pendingBatchConfirm.value = {
      folderPath: result.folderPath,
      urls: result.urls,
      nicknames: result.nicknames || [],
      maxLimit
    };
    return;
  }

  if (!result.success) {
    feedback.value = {
      severity: 'error',
      message:
        result.error === 'NO_OPENABLE_URLS'
          ? t('errorBatchOpenZeroUrls', [folderPath]) ||
            `フォルダ「${folderPath}」には開く対象のURLがありません。`
          : t('errorNicknameNotFound', [folderPath]) ||
            `フォルダ「${folderPath}」が見つかりませんでした。`
    };
  }

  await focusSearchInput();
};

/**
 * 一時 `textarea` と `document.execCommand('copy')` を用いたフォールバックコピーを実行します。
 * `onCopy` を指定すると `copy` イベント経由で複数 MIME タイプ（`text/html` 等）を書き込めます。
 * @param plainText - 選択用テキストエリアに設定するプレーンテキスト
 * @param onCopy - 任意指定の `copy` イベントハンドラ
 * @returns コピーに成功した場合は true、失敗した場合は false
 */
const execCommandCopyFallback = (
  plainText: string,
  onCopy?: (event: ClipboardEvent) => void
): boolean => {
  let textarea: HTMLTextAreaElement | null = null;
  try {
    textarea = document.createElement('textarea');
    textarea.value = plainText;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    if (onCopy) {
      document.addEventListener('copy', onCopy, true);
    }
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    if (onCopy) {
      document.removeEventListener('copy', onCopy, true);
    }
    textarea?.remove();
  }
};

/**
 * ポップアップ自身のドキュメントフォーカスと User Activation を用いてプレーンテキストをクリップボードへ書き込みます。
 * `navigator.clipboard.writeText` を優先し、失敗時は一時 `textarea` と `document.execCommand('copy')` へフォールバックします。
 * @param text - クリップボードへコピーする文字列
 * @returns コピーに成功した場合は true、失敗した場合は false
 */
const copyTextInPopup = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API が利用不可または拒否された場合は execCommand フォールバックへ進む
    }
  }

  return execCommandCopyFallback(text);
};

/**
 * ポップアップ自身のドキュメントフォーカスと User Activation を用いて `text/html` と `text/plain` の両方を同時にクリップボードへ書き込みます。
 * `navigator.clipboard.write`（`ClipboardItem`）を優先し、失敗時は `copy` イベントの `clipboardData.setData` を用いた
 * `document.execCommand('copy')` フォールバックで両 MIME タイプを書き込みます。
 * @param html - `text/html` として書き込む HTML 文字列
 * @param plain - `text/plain` として書き込むプレーンテキスト文字列
 * @returns コピーに成功した場合は true、失敗した場合は false
 */
const copyMultiMimeInPopup = async (html: string, plain: string): Promise<boolean> => {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.write &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' })
      });
      await navigator.clipboard.write([clipboardItem]);
      return true;
    } catch {
      // ClipboardItem が利用不可または拒否された場合は copy イベント経由の execCommand フォールバックへ進む
    }
  }

  return execCommandCopyFallback(plain, (event: ClipboardEvent) => {
    event.preventDefault();
    if (event.clipboardData) {
      event.clipboardData.setData('text/html', html);
      event.clipboardData.setData('text/plain', plain);
    }
  });
};

/**
 * クリップボードコピー系プリセット（`mdlink` / `htmllink`）をポップアップ内で直接実行します。
 * 通常ページでは対象タブ上部に完了トーストを表示してポップアップを閉じ、
 * スクリプト注入不可ページ等ではポップアップ内フィードバックで完了を通知します。
 * @param item - 実行対象のパレット候補アイテム
 * @param mode - 実行するコピー種別（`'mdlink'` または `'htmllink'`）
 * @returns 処理完了を示す Promise
 */
const executeClipboardPresetInPopup = async (
  item: PaletteItem,
  mode: 'mdlink' | 'htmllink'
): Promise<void> => {
  const tab = currentTab.value;
  const tabUrl = tab?.url;
  if (!tabUrl) {
    feedback.value = {
      severity: 'error',
      message:
        t('popupNoOpenableTabUrl') ||
        '現在のタブから登録可能な URL を取得できませんでした。'
    };
    return;
  }

  // ポップアップにフォーカスと User Activation が残っている間にクリップボード書き込みを実行する
  const formattedLink =
    mode === 'htmllink'
      ? formatHtmlLink(tab.title, tabUrl)
      : formatMarkdownLink(tab.title, tabUrl);
  const copied =
    mode === 'htmllink'
      ? await copyMultiMimeInPopup(formattedLink, formattedLink)
      : await copyTextInPopup(formattedLink);

  if (!copied) {
    feedback.value = {
      severity: 'error',
      message:
        t('errorMdlinkCopyFailed') || 'クリップボードへのコピーに失敗しました。'
    };
    return;
  }

  await updateScore(
    item.executeValue,
    item.matchTarget?.templateUrl,
    item.matchTarget?.nickname
  );

  const copiedMsg =
    t('presetMdlinkCopiedToast', [formattedLink]) || `Copied: ${formattedLink}`;
  const toastElementId =
    mode === 'htmllink' ? 'nickmark-htmllink-toast' : 'nickmark-mdlink-toast';

  if (tab.id !== undefined && !isRestrictedTabUrl(tabUrl)) {
    const toastShown = await showInPageToastOnly(
      tab.id,
      copiedMsg,
      2200,
      toastElementId
    );
    if (toastShown) {
      closePopup();
      return;
    }
  }

  // 特殊ページ等でページ内トーストを注入できない場合はポップアップ内で完了を通知する
  query.value = '';
  showSuccessFeedback(copiedMsg);
  await focusSearchInput();
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

    if (item.kind === 'history') {
      await openUrlWithDisposition(item.executeValue, disposition, currentTab.value?.id);
      if (disposition === 'newBackgroundTab') {
        await focusSearchInput();
      } else {
        closePopup();
      }
      return;
    }

    if (item.kind === 'bookmarklet') {
      if (isPresetMdlinkUrl(item.executeValue)) {
        await executeClipboardPresetInPopup(item, 'mdlink');
        return;
      }
      if (isPresetHtmllinkUrl(item.executeValue)) {
        await executeClipboardPresetInPopup(item, 'htmllink');
        return;
      }

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
      await executeFolderBatchOpenInPopup(item.folderPath);
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
 * ストレージ変更イベントに応じて言語設定、有効化プリセット、別タブ開き方設定をリアクティブに同期します。
 * @param changes - 変更されたストレージキーの辞書
 * @returns 処理完了を示す Promise
 */
const handlePopupStorageChanged = async (
  changes: { [key: string]: chrome.storage.StorageChange }
): Promise<void> => {
  if (changes.language) {
    await initI18n(changes.language.newValue ?? null);
    i18nReady.value = true;
    i18nVersion.value += 1;
  }
  if (changes[ENABLED_PRESETS_STORAGE_KEY] || changes.isSyncEnabled) {
    enabledPresetIds.value = await getEnabledPresetIds(true);
  }
  if (changes[OPEN_IN_NEW_TAB_STORAGE_KEY] || changes.isSyncEnabled) {
    openInNewTabByDefault.value = await getOpenInNewTab(true);
  }
  if (changes[OPEN_IN_CURRENT_IF_NEW_TAB_STORAGE_KEY] || changes.isSyncEnabled) {
    openInCurrentIfNewTab.value = await getOpenInCurrentIfNewTab(true);
  }
};

/**
 * 初期化処理: 即時入力フォーカスを行ったうえで、ストレージデータ・アクティブタブ情報・多言語設定を
 * 最小限の IPC で並列読み込みして反映します。
 * @returns 初期化完了を示す Promise
 */
onMounted(async (): Promise<void> => {
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handlePopupStorageChanged);
  }

  // 非同期データの到着を待たず、ポップアップ起動直後に検索欄へフォーカスを適用する
  void focusSearchInput();

  // ストレージ＋i18n 初期化とアクティブタブ取得を互いにブロックせず独立して並列実行する
  const initStorageAndI18n = async (): Promise<void> => {
    try {
      const initial = await loadPopupInitialData();
      bookmarksSnapshot.value = initial.bookmarks;
      if (initial.bookmarksError) {
        console.warn('ブックマークデータの読み込みに失敗しました:', initial.bookmarksError);
      }
      enabledPresetIds.value = initial.enabledPresetIds;
      openInNewTabByDefault.value = initial.openInNewTab;
      openInCurrentIfNewTab.value = initial.openInCurrentIfNewTab;

      // 取得済みの言語設定と同期キャッシュを突き合わせ、必要な場合のみ辞書読込と再描画を行う
      // 履歴検索が OFF の場合は permissions.contains の呼び出し自体を省く
      const [i18nUpdatedResult, historyPermissionResult] = await Promise.allSettled([
        initI18n(initial.language ?? null),
        initial.historySearchEnabled ? hasHistoryPermission() : Promise.resolve(false)
      ]);

      i18nReady.value = true;
      if (i18nUpdatedResult.status === 'fulfilled' && i18nUpdatedResult.value) {
        i18nVersion.value += 1;
      }

      isHistorySearchActive.value =
        historyPermissionResult.status === 'fulfilled' && historyPermissionResult.value;
    } catch (err: unknown) {
      console.warn('初期ストレージデータの読み込みに失敗しました:', err);
      await initI18n().catch(() => false);
      i18nReady.value = true;
      i18nVersion.value += 1;
    }
  };

  const initCurrentTab = async (): Promise<void> => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        currentTab.value = tabs[0];
      }
    } catch (err: unknown) {
      console.warn('アクティブタブ情報の取得に失敗しました:', err);
    }
  };

  await Promise.all([initStorageAndI18n(), initCurrentTab()]);
});

onUnmounted(() => {
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(handlePopupStorageChanged);
  }
  clearFeedbackDismissTimer();
  clearHistoryDebounceTimer();
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
  width: 1rem;
  height: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.palette-section-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.65rem 0.25rem;
  margin-top: 0.25rem;
  border-top: 1px solid var(--p-content-border-color);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  user-select: none;
}

.palette-section-header:first-child {
  margin-top: 0;
  border-top: none;
}

.section-header-icon {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
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

.item-icon-history {
  color: var(--p-text-muted-color);
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

.palette-tips {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem 0.9rem;
  color: var(--p-text-muted-color);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
  box-sizing: border-box;
  min-width: 0;
}

.palette-tips:hover {
  background-color: var(--p-content-hover-background);
}

.tips-leading-icon {
  font-size: 0.95rem;
  color: var(--p-primary-color, #10b981);
  flex-shrink: 0;
}

.tips-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  font-size: 0.8rem;
  line-height: 1.45;
}

.tips-badge {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 0.08rem 0.38rem;
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--p-primary-color, #10b981) 14%, transparent);
  color: var(--p-primary-color, #10b981);
  flex-shrink: 0;
}

.tips-text {
  color: var(--p-text-muted-color);
  word-break: break-word;
}

.tips-next-icon {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  opacity: 0.45;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}

.palette-tips:hover .tips-next-icon {
  opacity: 0.9;
}
</style>
