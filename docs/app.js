/**
 * Nickmark 紹介ページ インタラクション制御スクリプト
 * - 5 言語動的切替（URL クエリ・localStorage・ブラウザ言語連動）
 * - ライト／ダークテーマ切替（OS 追従・手動永続化）
 * - 定番 6 色テーマカラープレビュー（src/shared/theme.ts 準拠）
 * - コマンドパレット体験デモ（検索・動的 URL・フォルダ一括起動・コマンド・ブックマークレット）
 * - コマンドコピーボタン・スクロールスパイ
 */
(function () {
  'use strict';

  var I18N = window.NickmarkI18n;
  if (!I18N) return;

  var STORAGE_LANG_KEY = 'nickmark-docs-lang';
  var STORAGE_THEME_KEY = 'nickmark-docs-theme';
  var STORAGE_ACCENT_KEY = 'nickmark-docs-accent';
  var VALID_ACCENTS = ['emerald', 'blue', 'slate', 'indigo', 'orange', 'rose'];

  /** 安全な localStorage 読み書きヘルパー */
  function safeGetStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeSetStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {
      // プライベートブラウジング等の制限時は無視して継続
    }
  }

  /** 現在の状態 */
  var state = {
    lang: I18N.detectInitialLang(
      window.location.search,
      safeGetStorage(STORAGE_LANG_KEY),
      navigator.language
    ),
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    accent: document.documentElement.getAttribute('data-accent') || 'emerald',
    tipIndex: 0,
    paletteOpen: true,
    selectedIndex: 0,
    activeTabId: 'tab-home',
    tabs: [],
    bookmarks: [],
    toastTimer: null
  };

  /** 翻訳メッセージ取得＆プレースホルダー置換 */
  function t(key, vars) {
    var dict = I18N.MESSAGES[state.lang] || I18N.MESSAGES.en;
    var val = dict[key];
    if (val === undefined) val = I18N.MESSAGES.en[key] || key;
    if (typeof val === 'string' && vars) {
      return val.replace(/\{(\w+)\}/g, function (_, k) {
        return vars[k] !== undefined ? String(vars[k]) : '';
      });
    }
    return val;
  }

  /** 初期デモデータ構築 */
  function createInitialBookmarks() {
    return [
      {
        id: 'bm-gh-nickmark',
        nickname: 'gh/Nickmark',
        title: 'sawarame/Nickmark — GitHub',
        url: 'https://github.com/sawarame/Nickmark',
        kind: 'bookmark',
        pinned: true,
        score: 26.4
      },
      {
        id: 'bm-gh-search',
        nickname: 'gh',
        title: 'GitHub Search (%s)',
        url: 'https://github.com/search?q=%s',
        defaultValue: 'nickmark',
        kind: 'dynamic',
        pinned: false,
        score: 18.2
      },
      {
        id: 'bm-work-mail',
        nickname: 'work/mail',
        title: 'Team Webmail',
        url: 'https://mail.example.com/inbox',
        kind: 'bookmark',
        pinned: false,
        score: 14.5
      },
      {
        id: 'bm-work-docs',
        nickname: 'work/docs',
        title: 'Architecture Docs',
        url: 'https://docs.example.com/architecture',
        kind: 'bookmark',
        pinned: false,
        score: 12.1
      },
      {
        id: 'bm-work-ci',
        nickname: 'work/ci',
        title: 'CI / CD Pipelines',
        url: 'https://ci.example.com/pipelines',
        kind: 'bookmark',
        pinned: false,
        score: 10.8
      },
      {
        id: 'bm-js-top',
        nickname: 'js/top',
        title: 'Scroll to Top (Bookmarklet)',
        url: 'javascript:window.scrollTo({top:0,behavior:"smooth"})',
        kind: 'bookmarklet',
        pinned: false,
        score: 9.4
      },
      {
        id: 'bm-mdlink',
        nickname: 'mdlink',
        title: 'Copy Markdown Link (Preset)',
        url: 'javascript:/* Copy [Title](URL) */',
        kind: 'bookmarklet',
        pinned: false,
        score: 8.6
      }
    ];
  }

  function createInitialTabs() {
    return [
      {
        id: 'tab-home',
        title: 'Nickmark — Docs',
        url: 'https://sawarame.github.io/Nickmark/',
        kicker: 'v2.2.2 · Chrome 135+ · MIT License',
        descKey: 'demoHomeDesc',
        unread: false
      }
    ];
  }

  /** 翻訳を DOM 全体へ適用 */
  function applyLanguage(lang, persist) {
    var normalized = I18N.normalizeLang(lang) || 'en';
    state.lang = normalized;
    if (persist) {
      safeSetStorage(STORAGE_LANG_KEY, normalized);
    }

    document.documentElement.lang = normalized;
    document.title = t('metaTitle');

    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t('metaDescription'));

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      var translated = t(key);
      if (typeof translated === 'string') {
        el.textContent = translated;
      }
    }

    var ariaNodes = document.querySelectorAll('[data-i18n-aria]');
    for (var j = 0; j < ariaNodes.length; j++) {
      var aEl = ariaNodes[j];
      aEl.setAttribute('aria-label', t(aEl.getAttribute('data-i18n-aria')));
    }

    var placeholderNodes = document.querySelectorAll('[data-i18n-placeholder]');
    for (var k = 0; k < placeholderNodes.length; k++) {
      var pEl = placeholderNodes[k];
      pEl.setAttribute('placeholder', t(pEl.getAttribute('data-i18n-placeholder')));
    }

    // 言語連動の sawara.me ドキュメントリンク更新
    var docsUrl = I18N.DOCS_URLS[normalized] || I18N.DOCS_URLS.en;
    var docsLinks = document.querySelectorAll('[data-docs-link]');
    for (var d = 0; d < docsLinks.length; d++) {
      docsLinks[d].setAttribute('href', docsUrl);
    }

    var langSelect = document.getElementById('lang-select');
    if (langSelect && langSelect.value !== normalized) {
      langSelect.value = normalized;
    }

    // デモ UI を新しい言語で再描画
    renderBrowserMock();
    renderPaletteResults();
  }

  /** ライト／ダークテーマ適用 */
  function applyTheme(theme, persist) {
    var next = theme === 'dark' ? 'dark' : 'light';
    state.theme = next;
    document.documentElement.setAttribute('data-theme', next);
    if (persist) {
      safeSetStorage(STORAGE_THEME_KEY, next);
    }
    var toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', String(next === 'dark'));
    }
  }

  /** 定番 6 色テーマカラープレビュー適用 */
  function applyAccent(accent, persist) {
    var next = VALID_ACCENTS.indexOf(accent) !== -1 ? accent : 'emerald';
    state.accent = next;
    document.documentElement.setAttribute('data-accent', next);
    if (persist) {
      safeSetStorage(STORAGE_ACCENT_KEY, next);
    }
    var swatches = document.querySelectorAll('[data-accent-swatch]');
    for (var i = 0; i < swatches.length; i++) {
      var btn = swatches[i];
      var isActive = btn.getAttribute('data-accent-swatch') === next;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    }
  }

  /** 疑似トースト表示 */
  function showToast(message) {
    var toastEl = document.getElementById('demo-toast');
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2800);
  }

  /** 現在のアクティブタブを取得 */
  function getActiveTab() {
    for (var i = 0; i < state.tabs.length; i++) {
      if (state.tabs[i].id === state.activeTabId) return state.tabs[i];
    }
    return state.tabs[0];
  }

  /** コマンドパレット候補の算出 */
  function computeCandidates(rawQuery) {
    var q = (rawQuery || '').trim();
    if (!q) return [];

    // コマンドモード（先頭 : または ;）
    if (q[0] === ':' || q[0] === ';') {
      var normalizedCmd = ':' + q.slice(1);
      var parts = normalizedCmd.split(/\s+/);
      var head = parts[0].toLowerCase();
      var arg = parts.slice(1).join(' ').trim();

      var commands = [
        {
          id: 'cmd-add',
          cmd: ':add',
          aliases: [':add', ':a'],
          nickname: arg ? ':add ' + arg : ':add [name]',
          title: arg ? t('demoCmdAddTitle', { name: arg }) : t('demoCmdAddDesc'),
          url: getActiveTab().url,
          badge: t('demoBadgeCommand'),
          kind: 'command',
          arg: arg
        },
        {
          id: 'cmd-addall',
          cmd: ':addall',
          aliases: [':addall', ':aa'],
          nickname: arg ? ':addall ' + arg : ':addall [name]',
          title: t('demoCmdAddAllDesc'),
          url: state.tabs.length + ' tabs',
          badge: t('demoBadgeCommand'),
          kind: 'command',
          arg: arg
        },
        {
          id: 'cmd-rm',
          cmd: ':rm',
          aliases: [':rm'],
          nickname: arg ? ':rm ' + arg : ':rm [name]',
          title: t('demoCmdRmDesc'),
          url: 'Remove bookmark entry',
          badge: t('demoBadgeCommand'),
          kind: 'command',
          arg: arg
        },
        {
          id: 'cmd-ls',
          cmd: ':ls',
          aliases: [':ls'],
          nickname: ':ls',
          title: t('demoCmdLsDesc'),
          url: 'chrome-extension://nickmark/list.html',
          badge: t('demoBadgeCommand'),
          kind: 'command',
          arg: ''
        },
        {
          id: 'cmd-prefs',
          cmd: ':prefs',
          aliases: [':prefs'],
          nickname: ':prefs',
          title: t('demoCmdPrefsDesc'),
          url: 'chrome-extension://nickmark/preferences.html',
          badge: t('demoBadgeCommand'),
          kind: 'command',
          arg: ''
        },
        {
          id: 'cmd-help',
          cmd: ':help',
          aliases: [':help'],
          nickname: ':help',
          title: t('demoCmdHelpDesc'),
          url: I18N.DOCS_URLS[state.lang] || I18N.DOCS_URLS.en,
          badge: t('demoBadgeCommand'),
          kind: 'command',
          arg: ''
        }
      ];

      return commands.filter(function (c) {
        return c.aliases.some(function (a) {
          return a.indexOf(head) === 0 || head === ':';
        });
      });
    }

    var results = [];
    var lower = q.toLowerCase();

    // 末尾スラッシュによるフォルダ一括オープン候補
    if (lower.slice(-1) === '/' && lower.replace(/\//g, '').length > 0) {
      var folderKey = lower.replace(/^\/+/, '').replace(/\/+$/, '');
      var folderItems = state.bookmarks.filter(function (bm) {
        return (
          bm.kind !== 'bookmarklet' &&
          bm.nickname.toLowerCase().indexOf(folderKey + '/') === 0
        );
      });
      if (folderItems.length > 0) {
        results.push({
          id: 'folder-' + folderKey,
          nickname: folderKey + '/',
          title: folderKey + '/ — ' + t('demoFolderDesc'),
          url: folderItems.map(function (b) { return b.nickname; }).join(', '),
          badge: t('demoBadgeFolder'),
          kind: 'folder',
          folderName: folderKey,
          items: folderItems
        });
      }
    }

    // 1 語目 + 引数（動的 URL 展開 or 横断検索）
    var tokens = q.split(/\s+/);
    var first = tokens[0].toLowerCase();
    var rest = tokens.slice(1).join(' ');

    for (var i = 0; i < state.bookmarks.length; i++) {
      var bm = state.bookmarks[i];
      var nickLower = bm.nickname.toLowerCase();
      var titleLower = bm.title.toLowerCase();
      var urlLower = bm.url.toLowerCase();

      // 動的 URL（%s）の展開マッチ
      if (bm.kind === 'dynamic' && nickLower.indexOf(first) === 0) {
        var argVal = rest || bm.defaultValue || '';
        var resolvedUrl = bm.url.replace('%s', encodeURIComponent(argVal));
        results.push({
          id: bm.id,
          nickname: rest ? bm.nickname + ' ' + rest : bm.nickname,
          title: rest ? bm.title.replace('(%s)', '— ' + rest) : bm.title,
          url: resolvedUrl,
          badge: t('demoBadgeDynamic'),
          kind: 'dynamic',
          raw: bm
        });
        continue;
      }

      // ニックネーム・タイトル・URL 横断マッチ
      var allMatch = tokens.every(function (tk) {
        var l = tk.toLowerCase();
        return (
          nickLower.indexOf(l) !== -1 ||
          titleLower.indexOf(l) !== -1 ||
          urlLower.indexOf(l) !== -1
        );
      });

      if (allMatch) {
        var badge = '';
        if (bm.kind === 'bookmarklet') badge = t('demoBadgeBookmarklet');
        else if (bm.pinned) badge = t('demoBadgePinned');
        else badge = bm.score.toFixed(1);

        results.push({
          id: bm.id,
          nickname: bm.nickname,
          title: bm.title,
          url: bm.url,
          badge: badge,
          kind: bm.kind,
          raw: bm
        });
      }
    }

    return results;
  }

  /** 候補を実行（mode: 'current' | 'newTab' | 'bgTab'） */
  function executeCandidate(item, mode) {
    if (!item) return;

    if (item.kind === 'folder') {
      item.items.forEach(function (bm, idx) {
        state.tabs.push({
          id: 'tab-' + Date.now() + '-' + idx,
          title: bm.title,
          url: bm.url,
          kicker: bm.nickname,
          descText: bm.url,
          unread: true
        });
      });
      showToast(
        t('demoToastFolderOpened', {
          name: item.folderName,
          count: item.items.length
        })
      );
      renderBrowserMock();
      return;
    }

    if (item.kind === 'bookmarklet') {
      showToast(t('demoToastBookmarklet', { name: item.nickname }));
      return;
    }

    if (item.kind === 'command') {
      if (item.cmd === ':add') {
        var targetName = item.arg || 'dev';
        var active = getActiveTab();
        var exists = state.bookmarks.some(function (b) {
          return b.nickname.toLowerCase() === targetName.toLowerCase();
        });
        if (!exists) {
          state.bookmarks.unshift({
            id: 'bm-custom-' + Date.now(),
            nickname: targetName,
            title: active.title,
            url: active.url,
            kind: 'bookmark',
            pinned: false,
            score: 1.0
          });
        }
        showToast(t('demoToastAdded', { name: targetName }));
      } else {
        showToast(t('demoToastCommand', { cmd: item.cmd }));
      }
      renderPaletteResults();
      return;
    }

    // 通常遷移・動的 URL 遷移
    if (mode === 'bgTab') {
      state.tabs.push({
        id: 'tab-' + Date.now(),
        title: item.title,
        url: item.url,
        kicker: item.nickname,
        descText: item.url,
        unread: true
      });
      showToast(t('demoToastBgTab', { title: item.title }));
      renderBrowserMock();
      return;
    }

    if (mode === 'newTab') {
      var newId = 'tab-' + Date.now();
      state.tabs.push({
        id: newId,
        title: item.title,
        url: item.url,
        kicker: item.nickname,
        descText: item.url,
        unread: false
      });
      state.activeTabId = newId;
      showToast(t('demoToastNewTab', { title: item.title }));
      renderBrowserMock();
      return;
    }

    // 現在タブで開く
    var current = getActiveTab();
    current.title = item.title;
    current.url = item.url;
    current.kicker = item.nickname;
    current.descText = item.url;
    current.descKey = null;
    current.unread = false;
    showToast(t('demoToastNavigated', { title: item.title }));
    renderBrowserMock();
  }

  /** ブラウザモック（タブバー・アドレスバー・ページ背景）の描画 */
  function renderBrowserMock() {
    var tabListEl = document.getElementById('demo-tab-list');
    var tabCountEl = document.getElementById('demo-tab-count');
    var addressEl = document.getElementById('demo-address');
    var kickerEl = document.getElementById('demo-page-kicker');
    var titleEl = document.getElementById('demo-page-title');
    var descEl = document.getElementById('demo-page-desc');

    if (!tabListEl) return;
    tabListEl.innerHTML = '';

    state.tabs.forEach(function (tab) {
      var isActive = tab.id === state.activeTabId;
      var btn = document.createElement('div');
      btn.className = 'browser-tab' + (isActive ? ' is-active' : '') + (tab.unread ? ' is-unread' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-selected', String(isActive));

      var titleSpan = document.createElement('span');
      titleSpan.className = 'browser-tab-title';
      titleSpan.textContent = tab.title;
      btn.appendChild(titleSpan);

      if (tab.unread) {
        var badge = document.createElement('span');
        badge.className = 'browser-tab-badge';
        badge.textContent = t('demoNewBadge');
        btn.appendChild(badge);
      }

      if (state.tabs.length > 1) {
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'browser-tab-close';
        closeBtn.setAttribute('aria-label', 'Close tab');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          state.tabs = state.tabs.filter(function (x) { return x.id !== tab.id; });
          if (state.activeTabId === tab.id && state.tabs.length > 0) {
            state.activeTabId = state.tabs[state.tabs.length - 1].id;
          }
          renderBrowserMock();
        });
        btn.appendChild(closeBtn);
      }

      btn.addEventListener('click', function () {
        state.activeTabId = tab.id;
        tab.unread = false;
        renderBrowserMock();
      });

      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          state.activeTabId = tab.id;
          tab.unread = false;
          renderBrowserMock();
        }
      });

      tabListEl.appendChild(btn);
    });

    if (tabCountEl) tabCountEl.textContent = String(state.tabs.length);

    var activeTab = getActiveTab();
    if (activeTab) {
      if (addressEl) addressEl.textContent = activeTab.url;
      if (kickerEl) kickerEl.textContent = activeTab.kicker || 'Nickmark';
      if (titleEl) {
        titleEl.textContent =
          activeTab.id === 'tab-home' && activeTab.descKey === 'demoHomeDesc'
            ? t('demoHomeTitle')
            : activeTab.title;
      }
      if (descEl) {
        descEl.textContent = activeTab.descKey
          ? t(activeTab.descKey)
          : activeTab.descText || activeTab.url;
      }
    }
  }

  /** パレット開閉状態の反映 */
  function setPaletteOpen(open) {
    state.paletteOpen = Boolean(open);
    var card = document.getElementById('palette-card');
    var reopenBtn = document.getElementById('reopen-palette-btn');
    if (card) card.classList.toggle('is-closed', !state.paletteOpen);
    if (reopenBtn) reopenBtn.hidden = state.paletteOpen;
    if (state.paletteOpen) {
      var input = document.getElementById('demo-input');
      if (input) input.focus({ preventScroll: true });
    }
  }

  /** パレット候補または空白 Tips の描画 */
  function renderPaletteResults() {
    var input = document.getElementById('demo-input');
    var clearBtn = document.getElementById('demo-clear-btn');
    var resultsEl = document.getElementById('palette-results');
    var tipBoxEl = document.getElementById('palette-tip-box');
    var tipTextEl = document.getElementById('palette-tip-text');
    if (!input || !resultsEl || !tipBoxEl) return;

    var q = input.value;
    if (clearBtn) clearBtn.hidden = q.length === 0;

    // プリセットチップのアクティブ状態同期
    var chips = document.querySelectorAll('[data-demo-example]');
    for (var c = 0; c < chips.length; c++) {
      chips[c].classList.toggle(
        'is-active',
        chips[c].getAttribute('data-demo-example') === q.trim()
      );
    }

    if (!q.trim()) {
      resultsEl.innerHTML = '';
      resultsEl.hidden = true;
      tipBoxEl.hidden = false;
      var tips = t('demoTips');
      if (Array.isArray(tips) && tips.length > 0 && tipTextEl) {
        tipTextEl.textContent = tips[state.tipIndex % tips.length];
      }
      return;
    }

    tipBoxEl.hidden = true;
    resultsEl.hidden = false;
    var candidates = computeCandidates(q);
    if (state.selectedIndex >= candidates.length) {
      state.selectedIndex = 0;
    }

    resultsEl.innerHTML = '';
    if (candidates.length === 0) {
      var emptyLi = document.createElement('li');
      emptyLi.className = 'palette-item';
      emptyLi.style.cursor = 'default';
      emptyLi.innerHTML = '<div class="palette-item-main"><div class="palette-url"></div></div>';
      emptyLi.querySelector('.palette-url').textContent = t('demoNoMatch');
      resultsEl.appendChild(emptyLi);
      return;
    }

    candidates.forEach(function (item, idx) {
      var li = document.createElement('li');
      li.className = 'palette-item' + (idx === state.selectedIndex ? ' is-selected' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(idx === state.selectedIndex));

      var iconSpan = document.createElement('span');
      iconSpan.className = 'palette-item-icon';
      iconSpan.setAttribute('aria-hidden', 'true');
      if (item.kind === 'folder') iconSpan.textContent = '📁';
      else if (item.kind === 'command') iconSpan.textContent = '>_';
      else if (item.kind === 'bookmarklet') iconSpan.textContent = 'JS';
      else if (item.kind === 'dynamic') iconSpan.textContent = '%s';
      else iconSpan.textContent = '★';

      var mainDiv = document.createElement('div');
      mainDiv.className = 'palette-item-main';

      var topDiv = document.createElement('div');
      topDiv.className = 'palette-item-top';

      var nickSpan = document.createElement('span');
      nickSpan.className = 'palette-nick';
      nickSpan.textContent = item.nickname;

      var titleSpan = document.createElement('span');
      titleSpan.className = 'palette-title';
      titleSpan.textContent = item.title;

      topDiv.appendChild(nickSpan);
      topDiv.appendChild(titleSpan);

      var urlDiv = document.createElement('div');
      urlDiv.className = 'palette-url';
      urlDiv.textContent = item.url;

      mainDiv.appendChild(topDiv);
      mainDiv.appendChild(urlDiv);

      li.appendChild(iconSpan);
      li.appendChild(mainDiv);

      if (item.badge) {
        var badgeSpan = document.createElement('span');
        badgeSpan.className =
          'palette-badge' +
          (item.kind === 'folder' || item.kind === 'command' || item.kind === 'dynamic'
            ? ' is-accent'
            : '');
        badgeSpan.textContent = item.badge;
        li.appendChild(badgeSpan);
      }

      li.addEventListener('click', function (e) {
        state.selectedIndex = idx;
        var mode = 'current';
        if (e.shiftKey) mode = 'bgTab';
        else if (e.metaKey || e.ctrlKey || e.altKey) mode = 'newTab';
        executeCandidate(item, mode);
        renderPaletteResults();
      });

      resultsEl.appendChild(li);
    });
  }

  /** デモ用アクションボタン・キーボード操作の実行 */
  function runSelected(mode) {
    var input = document.getElementById('demo-input');
    if (!input) return;
    var candidates = computeCandidates(input.value);
    if (candidates.length === 0) return;
    var target = candidates[state.selectedIndex] || candidates[0];
    executeCandidate(target, mode);
  }

  /** クリップボードコピー（フォールバック付き） */
  function copyText(text, buttonEl) {
    var onSuccess = function () {
      var labelSpan = buttonEl.querySelector('.copy-btn-label');
      buttonEl.classList.add('is-copied');
      if (labelSpan) labelSpan.textContent = t('copiedBtn');
      setTimeout(function () {
        buttonEl.classList.remove('is-copied');
        if (labelSpan) labelSpan.textContent = t('copyBtn');
      }, 1800);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(function () {
        fallbackCopy(text, onSuccess);
      });
    } else {
      fallbackCopy(text, onSuccess);
    }
  }

  function fallbackCopy(text, onSuccess) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      if (document.execCommand('copy')) onSuccess();
    } catch (_) {
      // コピー非対応環境では無害に終了
    }
    document.body.removeChild(area);
  }

  /** スクロールスパイ（現在表示中のセクションをナビで強調） */
  function setupScrollSpy() {
    var navLinks = document.querySelectorAll('.header-nav .nav-link[href^="#"]');
    if (!navLinks.length || typeof IntersectionObserver === 'undefined') return;

    var map = {};
    var targets = [];
    for (var i = 0; i < navLinks.length; i++) {
      var href = navLinks[i].getAttribute('href');
      var sec = document.querySelector(href);
      if (sec) {
        map[sec.id] = navLinks[i];
        targets.push(sec);
      }
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            Object.keys(map).forEach(function (id) {
              map[id].classList.toggle('is-active', id === entry.target.id);
            });
          }
        });
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: 0.01 }
    );

    targets.forEach(function (sec) {
      observer.observe(sec);
    });
  }

  /** 初期化 */
  function init() {
    state.bookmarks = createInitialBookmarks();
    state.tabs = createInitialTabs();

    // 言語セレクタ
    var langSelect = document.getElementById('lang-select');
    if (langSelect) {
      langSelect.addEventListener('change', function (e) {
        applyLanguage(e.target.value, true);
      });
    }

    // ライト／ダーク切替
    var themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', function () {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark', true);
      });
    }

    // OS テーマ変更追従（手動設定がない場合のみ）
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onMediaChange = function (e) {
        if (!safeGetStorage(STORAGE_THEME_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light', false);
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onMediaChange);
    }

    // 6 色テーマカラースウォッチ
    var swatches = document.querySelectorAll('[data-accent-swatch]');
    for (var s = 0; s < swatches.length; s++) {
      swatches[s].addEventListener('click', function () {
        applyAccent(this.getAttribute('data-accent-swatch'), true);
      });
    }

    // デモ: プリセット入力例チップ
    var input = document.getElementById('demo-input');
    var chips = document.querySelectorAll('[data-demo-example]');
    for (var c = 0; c < chips.length; c++) {
      chips[c].addEventListener('click', function () {
        var example = this.getAttribute('data-demo-example');
        setPaletteOpen(true);
        if (input) {
          input.value = example;
          state.selectedIndex = 0;
          renderPaletteResults();
          input.focus({ preventScroll: true });
        }
      });
    }

    // デモ: 入力イベント & キーボード操作
    if (input) {
      input.addEventListener('input', function () {
        state.selectedIndex = 0;
        renderPaletteResults();
      });

      input.addEventListener('keydown', function (e) {
        if (e.isComposing) return;
        var candidates = computeCandidates(input.value);

        if (e.key === 'ArrowDown' || (e.ctrlKey && e.key.toLowerCase() === 'n')) {
          if (candidates.length > 0) {
            e.preventDefault();
            state.selectedIndex = (state.selectedIndex + 1) % candidates.length;
            renderPaletteResults();
          }
          return;
        }
        if (e.key === 'ArrowUp' || (e.ctrlKey && e.key.toLowerCase() === 'p')) {
          if (candidates.length > 0) {
            e.preventDefault();
            state.selectedIndex = (state.selectedIndex - 1 + candidates.length) % candidates.length;
            renderPaletteResults();
          }
          return;
        }
        if (e.key === 'Tab' && candidates.length > 0) {
          e.preventDefault();
          var chosen = candidates[state.selectedIndex] || candidates[0];
          input.value = chosen.nickname;
          state.selectedIndex = 0;
          renderPaletteResults();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          if (input.value) {
            input.value = '';
            state.selectedIndex = 0;
            renderPaletteResults();
          } else {
            setPaletteOpen(false);
          }
          return;
        }
        if (e.key === 'Enter' && candidates.length > 0) {
          e.preventDefault();
          var mode = 'current';
          if (e.shiftKey) mode = 'bgTab';
          else if (e.metaKey || e.ctrlKey || e.altKey) mode = 'newTab';
          runSelected(mode);
        }
      });
    }

    // デモ: クリアボタン
    var clearBtn = document.getElementById('demo-clear-btn');
    if (clearBtn && input) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        state.selectedIndex = 0;
        renderPaletteResults();
        input.focus({ preventScroll: true });
      });
    }

    // デモ: 空白 Tip クリックで次の Tip へ切替
    var tipBox = document.getElementById('palette-tip-box');
    if (tipBox) {
      tipBox.addEventListener('click', function () {
        state.tipIndex += 1;
        renderPaletteResults();
        if (input) input.focus({ preventScroll: true });
      });
    }

    // デモ: パレット開閉・リセット
    var triggerBtn = document.getElementById('demo-trigger-btn');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', function () {
        setPaletteOpen(!state.paletteOpen);
      });
    }

    var reopenBtn = document.getElementById('reopen-palette-btn');
    if (reopenBtn) {
      reopenBtn.addEventListener('click', function () {
        setPaletteOpen(true);
      });
    }

    var resetBtn = document.getElementById('demo-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        state.bookmarks = createInitialBookmarks();
        state.tabs = createInitialTabs();
        state.activeTabId = 'tab-home';
        state.selectedIndex = 0;
        if (input) input.value = 'gh/Nickmark';
        setPaletteOpen(true);
        renderBrowserMock();
        renderPaletteResults();
      });
    }

    // デモ: 下部アクションボタン（Enter / Cmd+Enter / Shift+Enter）
    var actionBtns = document.querySelectorAll('[data-demo-action]');
    for (var a = 0; a < actionBtns.length; a++) {
      actionBtns[a].addEventListener('click', function () {
        runSelected(this.getAttribute('data-demo-action'));
      });
    }

    // 導入コマンドのコピーボタン
    var copyBtns = document.querySelectorAll('[data-copy-text]');
    for (var p = 0; p < copyBtns.length; p++) {
      copyBtns[p].addEventListener('click', function () {
        copyText(this.getAttribute('data-copy-text'), this);
      });
    }

    // 初期テーマ・アクセント・言語を反映
    applyTheme(state.theme, false);
    applyAccent(state.accent, false);
    if (input && !input.value) {
      input.value = 'gh/Nickmark';
    }
    applyLanguage(state.lang, false);
    setupScrollSpy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
