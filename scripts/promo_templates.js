/**
 * プロモーション画像（1280×800 基準・640×400 スケール対応）用の HTML/CSS テンプレート生成モジュール
 *
 * Chrome ウェブストアの縮小表示時でも視認性を損なわないよう、
 * 情報量を絞ったシンプルな構成と大きめのタイポグラフィで各スライドを描画します。
 */

'use strict';

/**
 * HTML の特殊文字をエスケープします。
 * @param {string} text - エスケープ対象の文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * UI モック内で使用する軽量なインライン SVG アイコン群
 */
const ICONS = {
  search: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  lock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  doc: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  board: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  pin: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`,
  plusCircle: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  checkCircle: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  terminal: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  folder: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  mail: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>`,
  code: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  trend: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  palette: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
  cloud: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
  arrowDown: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  keyboard: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/></svg>`,
  upload: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  download: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
};

/**
 * 全スライド共通のベース CSS とページ枠組みを生成します。
 * 1280×800 の基準キャンバスを描画し、640×400 指定時は transform: scale(0.5) で崩れなく縮小します。
 * @param {object} params
 * @param {string} params.htmlLang - HTML の lang 属性
 * @param {string} params.fontFamily - 言語に応じたフォントファミリー
 * @param {string} params.iconDataUri - Nickmark アイコンの Data URI
 * @param {string} params.extraCss - スライド固有 CSS
 * @param {string} params.bodyHtml - スライド本文 HTML
 * @param {{ width?: number, height?: number, scale?: number }} [params.viewport] - 出力サイズ情報
 * @returns {string} 完全な HTML ドキュメント文字列
 */
function wrapDocument({ htmlLang, fontFamily, iconDataUri, extraCss, bodyHtml, viewport = {} }) {
  const outWidth = viewport.width || 1280;
  const outHeight = viewport.height || 800;
  const scale = viewport.scale || 1;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(htmlLang)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${outWidth}, initial-scale=1.0" />
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    width: ${outWidth}px;
    height: ${outHeight}px;
    overflow: hidden;
    background: #f8fafc;
    font-family: ${fontFamily};
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* 韓国語は単語途中での不自然な改行を防止 */
  html[lang="ko"] body {
    word-break: keep-all;
  }

  .canvas {
    position: relative;
    width: 1280px;
    height: 800px;
    transform-origin: top left;
    transform: scale(${scale});
    overflow: hidden;
    background:
      radial-gradient(ellipse 760px 460px at 50% 0%, rgba(16, 185, 129, 0.14) 0%, rgba(16, 185, 129, 0.0) 70%),
      radial-gradient(ellipse 680px 460px at 85% 22%, rgba(59, 130, 246, 0.10) 0%, rgba(59, 130, 246, 0.0) 70%),
      linear-gradient(180deg, #f8fafc 0%, #f1f7fd 55%, #f8fafc 100%);
  }

  .brand {
    position: absolute;
    top: 28px;
    left: 44px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10;
  }

  .brand-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.22);
    display: block;
  }

  .brand-name {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
  }

  .gradient-text {
    background: linear-gradient(90deg, #059669 0%, #0d9488 45%, #2563eb 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .mono {
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
  }

  .traffic-lights {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tl {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .tl-red { background: #ff5f56; }
  .tl-yellow { background: #ffbd2e; }
  .tl-green { background: #27c93f; }

  .nick-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 8px;
    background: #d1fae5;
    color: #047857;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 19px;
    font-weight: 800;
    line-height: 1.25;
    white-space: nowrap;
  }

  .enter-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border-radius: 9px;
    border: 1.5px solid #6ee7b7;
    background: #ecfdf5;
    color: #047857;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 18px;
    font-weight: 800;
    white-space: nowrap;
  }

  .key-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border-radius: 9px;
    border: 1.5px solid #cbd5e1;
    background: #f8fafc;
    color: #0f172a;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 18px;
    font-weight: 800;
    white-space: nowrap;
  }

  .cursor-bar {
    display: inline-block;
    width: 3px;
    height: 28px;
    background: #10b981;
    vertical-align: -4px;
    margin-left: 2px;
    border-radius: 2px;
  }

  ${extraCss}
</style>
</head>
<body>
  <div class="canvas">
    <div class="brand">
      <img class="brand-icon" src="${iconDataUri}" alt="Nickmark" />
      <span class="brand-name">Nickmark</span>
    </div>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

/**
 * Slide 1: ランチャー全体紹介（01_launcher）
 * 大きな見出し＋中央に大きく拡大したコマンドパレット＋シンプルなキーヒント3点で構成します。
 * @param {object} locale - 言語辞書
 * @param {string} iconDataUri - アイコン Data URI
 * @param {object} viewport - 出力サイズ情報
 * @returns {string} HTML ドキュメント
 */
function renderSlide01(locale, iconDataUri, viewport) {
  const t = locale.slides['01_launcher'];
  const extraCss = `
    .hero-header {
      text-align: center;
      padding: 44px 56px 0;
    }

    .hero-title {
      font-size: 54px;
      font-weight: 800;
      line-height: 1.16;
      letter-spacing: -0.025em;
      color: #0f172a;
    }

    .hero-subtitle {
      margin-top: 10px;
      font-size: 22px;
      font-weight: 600;
      color: #475569;
    }

    .stage-frame {
      width: 980px;
      margin: 20px auto 0;
      padding: 16px 22px 20px;
      border-radius: 22px;
      background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%);
      box-shadow:
        0 24px 50px rgba(15, 23, 42, 0.24),
        0 0 0 1px rgba(148, 163, 184, 0.22);
    }

    .stage-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding: 0 4px;
    }

    .stage-ext-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 4px 14px 4px 8px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.16);
      border: 1px solid rgba(52, 211, 153, 0.45);
      color: #a7f3d0;
      font-size: 16px;
      font-weight: 700;
    }

    .stage-ext-badge img {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: block;
    }

    .palette-card {
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }

    .palette-input-row {
      height: 66px;
      padding: 0 22px;
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 1.5px solid #e2e8f0;
    }

    .palette-input-icon {
      color: #10b981;
      display: flex;
    }

    .palette-query {
      flex: 1;
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
    }

    .palette-list {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .palette-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 11px 16px;
      border-radius: 12px;
      border: 2px solid transparent;
    }

    .palette-item.selected {
      background: #ecfdf5;
      border-color: #34d399;
    }

    .item-icon {
      width: 44px;
      height: 44px;
      border-radius: 11px;
      background: #f1f5f9;
      color: #475569;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .palette-item.selected .item-icon {
      background: #d1fae5;
      color: #059669;
    }

    .item-icon.blue {
      background: #eff6ff;
      color: #2563eb;
    }

    .item-body {
      flex: 1;
      min-width: 0;
    }

    .item-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 4px;
    }

    .item-title {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-pin {
      color: #10b981;
      display: inline-flex;
      flex-shrink: 0;
    }

    .item-url {
      font-size: 16.5px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tag-dynamic {
      padding: 6px 14px;
      border-radius: 8px;
      background: #eff6ff;
      border: 1.5px solid #bfdbfe;
      color: #1d4ed8;
      font-size: 17px;
      font-weight: 700;
      white-space: nowrap;
    }

    .bottom-hints {
      margin-top: 18px;
      display: flex;
      justify-content: center;
      gap: 18px;
    }

    .hint-pill {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 9px 18px;
      border-radius: 999px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
      font-size: 19px;
      font-weight: 700;
      color: #1e293b;
    }
  `;

  const bodyHtml = `
    <div class="hero-header">
      <h1 class="hero-title">
        ${escapeHtml(t.titleLine1)}<br />
        <span class="gradient-text">${escapeHtml(t.titleLine2)}</span>
      </h1>
      <p class="hero-subtitle">${escapeHtml(t.subtitle)}</p>
    </div>

    <div class="stage-frame">
      <div class="stage-topbar">
        <div class="traffic-lights">
          <span class="tl tl-red"></span>
          <span class="tl tl-yellow"></span>
          <span class="tl tl-green"></span>
        </div>
        <div class="stage-ext-badge mono">
          <img src="${iconDataUri}" alt="Nickmark" />
          <span>Option + Shift + D</span>
        </div>
      </div>

      <div class="palette-card">
        <div class="palette-input-row">
          <span class="palette-input-icon">${ICONS.search}</span>
          <div class="palette-query mono">docs<span class="cursor-bar"></span></div>
          <span class="enter-chip">Enter</span>
        </div>

        <div class="palette-list">
          <div class="palette-item selected">
            <div class="item-icon">${ICONS.doc}</div>
            <div class="item-body">
              <div class="item-top">
                <span class="nick-badge">docs</span>
                <span class="item-title">${escapeHtml(t.item1Title)}</span>
                <span class="item-pin">${ICONS.pin}</span>
              </div>
              <div class="item-url mono">https://docs.example.com/guide</div>
            </div>
          </div>

          <div class="palette-item">
            <div class="item-icon blue">${ICONS.board}</div>
            <div class="item-body">
              <div class="item-top">
                <span class="nick-badge">work/tasks</span>
                <span class="item-title">${escapeHtml(t.item2Title)}</span>
              </div>
              <div class="item-url mono">https://tasks.example.com/sprint</div>
            </div>
          </div>

          <div class="palette-item">
            <div class="item-icon">${ICONS.search}</div>
            <div class="item-body">
              <div class="item-top">
                <span class="nick-badge">s</span>
                <span class="item-title">${escapeHtml(t.item3Title)}</span>
              </div>
              <div class="item-url mono">https://search.example.com/?q=%s</div>
            </div>
            <span class="tag-dynamic">${escapeHtml(t.dynamicBadge)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-hints">
      <div class="hint-pill">
        <span class="enter-chip">Enter</span>
        <span>${escapeHtml(t.hintEnter)}</span>
      </div>
      <div class="hint-pill">
        <span class="key-chip">⌘/Ctrl + Enter</span>
        <span>${escapeHtml(t.hintCmdEnter)}</span>
      </div>
      <div class="hint-pill">
        <span class="key-chip">Shift + Enter</span>
        <span>${escapeHtml(t.hintShiftEnter)}</span>
      </div>
    </div>
  `;

  return wrapDocument({
    htmlLang: locale.htmlLang,
    fontFamily: locale.fontFamily,
    iconDataUri,
    extraCss,
    bodyHtml,
    viewport,
  });
}

/**
 * Slide 2: その場で簡単登録（02_quick_register）
 * 左側に簡潔な見出しと3つの短い操作ポイント、右側に拡大した :add パレットを配置します。
 * @param {object} locale - 言語辞書
 * @param {string} iconDataUri - アイコン Data URI
 * @param {object} viewport - 出力サイズ情報
 * @returns {string} HTML ドキュメント
 */
function renderSlide02(locale, iconDataUri, viewport) {
  const t = locale.slides['02_quick_register'];
  const extraCss = `
    .split-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
      padding: 40px 52px 24px;
      gap: 44px;
    }

    .left-col {
      width: 490px;
      padding-top: 32px;
    }

    .section-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 999px;
      background: #ecfdf5;
      border: 1.5px solid #a7f3d0;
      color: #047857;
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 20px;
    }

    .split-title {
      font-size: 54px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.025em;
      color: #0f172a;
      margin-bottom: 32px;
    }

    .point-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .point-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border-radius: 16px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
    }

    .point-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #ecfdf5;
      color: #059669;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .point-text {
      font-size: 21px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.35;
    }

    .point-sub {
      display: block;
      margin-top: 2px;
      font-size: 17px;
      font-weight: 600;
      color: #475569;
    }

    .cmd-inline {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 7px;
      background: #ecfdf5;
      color: #047857;
      font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
      font-size: 20px;
      font-weight: 800;
      margin-right: 6px;
    }

    .right-col {
      flex: 1;
      min-width: 0;
    }

    .mock-frame {
      padding: 26px;
      border-radius: 22px;
      background: linear-gradient(145deg, #0b192c 0%, #064234 100%);
      box-shadow:
        0 26px 56px rgba(15, 23, 42, 0.25),
        0 0 0 1px rgba(148, 163, 184, 0.2);
    }

    .mock-bar {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 22px;
    }

    .mock-url-pill {
      flex: 1;
      height: 38px;
      padding: 0 16px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.22);
      color: #cbd5e1;
      font-size: 16.5px;
      display: flex;
      align-items: center;
      gap: 10px;
      overflow: hidden;
      white-space: nowrap;
    }

    .toast-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: fit-content;
      margin: 0 auto 20px;
      padding: 12px 24px;
      border-radius: 999px;
      background: #064e3b;
      border: 1.5px solid #34d399;
      color: #ecfdf5;
      font-size: 21px;
      font-weight: 700;
      box-shadow: 0 10px 26px rgba(0, 0, 0, 0.28);
    }

    .toast-banner svg {
      color: #34d399;
      flex-shrink: 0;
    }

    .add-palette {
      border-radius: 16px;
      background: #ffffff;
      overflow: hidden;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
    }

    .add-input-row {
      height: 78px;
      padding: 0 22px;
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 1.5px solid #e2e8f0;
    }

    .add-input-icon {
      color: #059669;
      display: flex;
    }

    .add-query {
      flex: 1;
      font-size: 30px;
      font-weight: 800;
      color: #0f172a;
    }

    .add-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .preview-box {
      padding: 18px 20px;
      border-radius: 13px;
      background: #ecfdf5;
      border: 2px solid #34d399;
    }

    .preview-title {
      font-size: 22px;
      font-weight: 800;
      color: #065f46;
      margin-bottom: 6px;
    }

    .preview-url {
      font-size: 17px;
      font-weight: 600;
      color: #047857;
    }

    .cmd-option {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
    }

    .cmd-option-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }
  `;

  const bodyHtml = `
    <div class="split-wrap">
      <div class="left-col">
        <div class="section-pill">
          ${ICONS.plusCircle}
          <span>${escapeHtml(t.badge)}</span>
        </div>
        <h1 class="split-title">
          ${escapeHtml(t.titleLine1)}<br />
          <span class="gradient-text">${escapeHtml(t.titleLine2)}</span>
        </h1>

        <div class="point-list">
          <div class="point-row">
            <div class="point-icon">${ICONS.keyboard}</div>
            <div class="point-text">
              <span class="mono">${escapeHtml(t.point1Key)}</span>
              <span class="point-sub">${escapeHtml(t.point1Sub)}</span>
            </div>
          </div>

          <div class="point-row">
            <div class="point-icon">${ICONS.terminal}</div>
            <div class="point-text">
              <span class="cmd-inline">:add docs</span>
              <span class="point-sub">${escapeHtml(t.point2Text)}</span>
            </div>
          </div>

          <div class="point-row">
            <div class="point-icon">${ICONS.folder}</div>
            <div class="point-text">
              <span class="cmd-inline">:addall work</span>
              <span class="point-sub">${escapeHtml(t.point3Text)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="right-col">
        <div class="mock-frame">
          <div class="mock-bar">
            <div class="traffic-lights">
              <span class="tl tl-red"></span>
              <span class="tl tl-yellow"></span>
              <span class="tl tl-green"></span>
            </div>
            <div class="mock-url-pill mono">
              ${ICONS.lock}
              <span>https://docs.example.com/guide</span>
            </div>
          </div>

          <div class="toast-banner">
            ${ICONS.checkCircle}
            <span>${escapeHtml(t.toastSaved)}</span>
          </div>

          <div class="add-palette">
            <div class="add-input-row">
              <span class="add-input-icon">${ICONS.terminal}</span>
              <div class="add-query mono">:add docs<span class="cursor-bar"></span></div>
              <span class="enter-chip">Enter</span>
            </div>

            <div class="add-body">
              <div class="preview-box">
                <div class="preview-title">${escapeHtml(t.previewTitle)}</div>
                <div class="preview-url mono">https://docs.example.com/guide</div>
              </div>

              <div class="cmd-option">
                <span class="nick-badge">:addall</span>
                <span class="cmd-option-title">${escapeHtml(t.cmdAddallTitle)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  return wrapDocument({
    htmlLang: locale.htmlLang,
    fontFamily: locale.fontFamily,
    iconDataUri,
    extraCss,
    bodyHtml,
    viewport,
  });
}

/**
 * Slide 3: 動的 URL（%s）検索（03_quick_launch）
 * 「ニックネーム＋検索語 → URL の %s に展開」を大きな2段フローで直感的に見せます。
 * @param {object} locale - 言語辞書
 * @param {string} iconDataUri - アイコン Data URI
 * @param {object} viewport - 出力サイズ情報
 * @returns {string} HTML ドキュメント
 */
function renderSlide03(locale, iconDataUri, viewport) {
  const t = locale.slides['03_quick_launch'];
  const extraCss = `
    .header {
      text-align: center;
      padding: 66px 56px 0;
    }

    .title {
      font-size: 60px;
      font-weight: 800;
      line-height: 1.18;
      letter-spacing: -0.025em;
      color: #0f172a;
    }

    .subtitle {
      margin-top: 14px;
      font-size: 24px;
      font-weight: 600;
      color: #475569;
    }

    .flow-stage {
      width: 980px;
      margin: 40px auto 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 22px;
    }

    .input-card {
      width: 100%;
      height: 112px;
      padding: 0 32px;
      border-radius: 22px;
      background: #ffffff;
      border: 2.5px solid #34d399;
      box-shadow: 0 22px 48px rgba(15, 23, 42, 0.12);
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .input-icon {
      color: #10b981;
      display: flex;
      transform: scale(1.25);
    }

    .input-tokens {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 36px;
      font-weight: 800;
    }

    .token-nick {
      padding: 6px 18px;
      border-radius: 12px;
      background: #d1fae5;
      color: #047857;
    }

    .token-arg {
      padding: 6px 18px;
      border-radius: 12px;
      background: #dbeafe;
      color: #1d4ed8;
    }

    .flow-arrow-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .arrow-circle {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981 0%, #2563eb 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 24px rgba(16, 185, 129, 0.3);
    }

    .expand-pill {
      padding: 8px 20px;
      border-radius: 999px;
      background: #ffffff;
      border: 1.5px solid #bfdbfe;
      color: #1d4ed8;
      font-size: 20px;
      font-weight: 800;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
    }

    .result-card {
      width: 100%;
      padding: 26px 32px;
      border-radius: 22px;
      background: linear-gradient(135deg, #0f172a 0%, #0b2938 100%);
      box-shadow: 0 24px 52px rgba(15, 23, 42, 0.24);
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .result-lock {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(16, 185, 129, 0.16);
      color: #34d399;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .result-url {
      font-size: 30px;
      font-weight: 700;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .result-url-arg {
      display: inline-block;
      padding: 2px 12px;
      margin-left: 2px;
      border-radius: 9px;
      background: rgba(59, 130, 246, 0.28);
      border: 1.5px solid #60a5fa;
      color: #bfdbfe;
      font-weight: 800;
    }

    .feature-pills {
      margin-top: 38px;
      display: flex;
      justify-content: center;
      gap: 20px;
    }

    .feature-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 22px;
      border-radius: 999px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }

    .feature-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #10b981;
      flex-shrink: 0;
    }
  `;

  const bodyHtml = `
    <div class="header">
      <h1 class="title">
        ${escapeHtml(t.titleLine1)}<br />
        <span class="gradient-text">${escapeHtml(t.titleLine2)}</span>
      </h1>
      <p class="subtitle">${escapeHtml(t.subtitle)}</p>
    </div>

    <div class="flow-stage">
      <div class="input-card">
        <span class="input-icon">${ICONS.search}</span>
        <div class="input-tokens mono">
          <span class="token-nick">docs</span>
          <span class="token-arg">routing</span><span class="cursor-bar"></span>
        </div>
        <span class="enter-chip" style="font-size: 21px; padding: 10px 20px;">Enter</span>
      </div>

      <div class="flow-arrow-row">
        <div class="arrow-circle">${ICONS.arrowDown}</div>
        <div class="expand-pill">${escapeHtml(t.expandBadge)}</div>
      </div>

      <div class="result-card">
        <div class="result-lock">${ICONS.lock}</div>
        <div class="result-url mono">
          https://docs.example.com/search?q=<span class="result-url-arg">routing</span>
        </div>
      </div>
    </div>

    <div class="feature-pills">
      <div class="feature-pill">
        <span class="feature-dot"></span>
        <span>${escapeHtml(t.pill1)}</span>
      </div>
      <div class="feature-pill">
        <span class="feature-dot"></span>
        <span>${escapeHtml(t.pill2)}</span>
      </div>
      <div class="feature-pill">
        <span class="feature-dot"></span>
        <span>${escapeHtml(t.pill3)}</span>
      </div>
    </div>
  `;

  return wrapDocument({
    htmlLang: locale.htmlLang,
    fontFamily: locale.fontFamily,
    iconDataUri,
    extraCss,
    bodyHtml,
    viewport,
  });
}

/**
 * Slide 4: フォルダ一括起動 ＆ ブックマークレット（04_folders_bookmarklets）
 * 2枚のクリーンなカードに絞り、細かな注釈を省いて文字サイズを大きく確保します。
 * @param {object} locale - 言語辞書
 * @param {string} iconDataUri - アイコン Data URI
 * @param {object} viewport - 出力サイズ情報
 * @returns {string} HTML ドキュメント
 */
function renderSlide04(locale, iconDataUri, viewport) {
  const t = locale.slides['04_folders_bookmarklets'];
  const extraCss = `
    .header {
      text-align: center;
      padding: 72px 56px 0;
    }

    .title {
      font-size: 52px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.025em;
      color: #0f172a;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      padding: 36px 52px 0;
    }

    .feature-card {
      height: 560px;
      padding: 28px;
      border-radius: 24px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      box-shadow: 0 22px 46px rgba(15, 23, 42, 0.10);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .card-heading {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
    }

    .heading-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .heading-icon.emerald {
      background: #ecfdf5;
      color: #059669;
    }

    .heading-icon.amber {
      background: #fef3c7;
      color: #d97706;
    }

    .mini-input {
      height: 64px;
      padding: 0 20px;
      border-radius: 14px;
      background: #f8fafc;
      border: 2px solid #cbd5e1;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .mini-input-icon {
      color: #10b981;
      display: flex;
    }

    .mini-query {
      flex: 1;
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
    }

    .folder-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }

    .folder-primary-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 15px 18px;
      border-radius: 13px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      font-size: 21px;
      font-weight: 800;
    }

    .folder-primary-badge {
      padding: 4px 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.22);
      font-size: 19px;
      font-weight: 800;
    }

    .folder-sub-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
    }

    .folder-sub-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }

    .status-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 20px;
      border-radius: 14px;
      background: #0f172a;
      color: #ecfdf5;
      font-size: 20px;
      font-weight: 700;
    }

    .status-footer svg {
      color: #34d399;
      flex-shrink: 0;
    }

    .bm-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
    }

    .bm-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      border-radius: 14px;
      background: #f8fafc;
      border: 2px solid #e2e8f0;
    }

    .bm-row.active {
      background: #ecfdf5;
      border-color: #34d399;
    }

    .bm-title {
      flex: 1;
      font-size: 21px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .js-chip {
      padding: 5px 12px;
      border-radius: 8px;
      background: #fef3c7;
      border: 1.5px solid #fcd34d;
      color: #b45309;
      font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
      font-size: 17px;
      font-weight: 800;
    }

    .inplace-note {
      margin-top: auto;
      padding: 14px 18px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      text-align: center;
      font-size: 19px;
      font-weight: 700;
      color: #334155;
    }
  `;

  const bodyHtml = `
    <div class="header">
      <h1 class="title">
        ${escapeHtml(t.titlePart1)}<span class="gradient-text">${escapeHtml(t.titlePart2)}</span>
      </h1>
    </div>

    <div class="cards-grid">
      <div class="feature-card">
        <div class="card-heading">
          <span class="heading-icon emerald">${ICONS.folder}</span>
          <span>${escapeHtml(t.leftHeading)}</span>
        </div>

        <div class="mini-input">
          <span class="mini-input-icon">${ICONS.search}</span>
          <div class="mini-query mono">work/<span class="cursor-bar"></span></div>
          <span class="enter-chip">Enter</span>
        </div>

        <div class="folder-list">
          <div class="folder-primary-row">
            <span class="folder-primary-badge mono">work/</span>
            <span>${escapeHtml(t.folderOpenRow)}</span>
          </div>
          <div class="folder-sub-row">
            <span class="nick-badge">work/mail</span>
            <span class="folder-sub-title">${escapeHtml(t.folderRow1)}</span>
          </div>
          <div class="folder-sub-row">
            <span class="nick-badge">work/docs</span>
            <span class="folder-sub-title">${escapeHtml(t.folderRow2)}</span>
          </div>
          <div class="folder-sub-row">
            <span class="nick-badge">work/board</span>
            <span class="folder-sub-title">${escapeHtml(t.folderRow3)}</span>
          </div>
        </div>

        <div class="status-footer">
          ${ICONS.checkCircle}
          <span>${escapeHtml(t.launchedBadge)}</span>
        </div>
      </div>

      <div class="feature-card">
        <div class="card-heading">
          <span class="heading-icon amber">${ICONS.code}</span>
          <span>${escapeHtml(t.rightHeading)}</span>
        </div>

        <div class="mini-input">
          <span class="mini-input-icon">${ICONS.search}</span>
          <div class="mini-query mono">mdlink<span class="cursor-bar"></span></div>
          <span class="enter-chip">Enter</span>
        </div>

        <div class="bm-list">
          <div class="bm-row active">
            <span class="nick-badge">mdlink</span>
            <span class="bm-title">${escapeHtml(t.mdlinkTitle)}</span>
            <span class="js-chip">JS</span>
          </div>
          <div class="bm-row">
            <span class="nick-badge">htmllink</span>
            <span class="bm-title">${escapeHtml(t.htmllinkTitle)}</span>
            <span class="js-chip">JS</span>
          </div>
          <div class="inplace-note">${escapeHtml(t.inPlaceNote)}</div>
        </div>

        <div class="status-footer">
          ${ICONS.checkCircle}
          <span>${escapeHtml(t.toastCopied)}</span>
        </div>
      </div>
    </div>
  `;

  return wrapDocument({
    htmlLang: locale.htmlLang,
    fontFamily: locale.fontFamily,
    iconDataUri,
    extraCss,
    bodyHtml,
    viewport,
  });
}

/**
 * Slide 5: 管理画面 ＆ スマート順位・カスタマイズ（05_dashboard_ranking）
 * 3行に厳選した見やすい管理テーブルと、下部の大きな3枚のポイントカードで構成します。
 * @param {object} locale - 言語辞書
 * @param {string} iconDataUri - アイコン Data URI
 * @param {object} viewport - 出力サイズ情報
 * @returns {string} HTML ドキュメント
 */
function renderSlide05(locale, iconDataUri, viewport) {
  const t = locale.slides['05_dashboard_ranking'];
  const extraCss = `
    .header {
      text-align: center;
      padding: 68px 56px 0;
    }

    .title {
      font-size: 52px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.025em;
      color: #0f172a;
    }

    .dashboard-window {
      width: 1176px;
      margin: 28px auto 0;
      border-radius: 22px;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      box-shadow: 0 24px 52px rgba(15, 23, 42, 0.13);
      overflow: hidden;
    }

    .dash-topbar {
      height: 62px;
      padding: 0 24px;
      background: #f8fafc;
      border-bottom: 1.5px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .dash-topbar-left {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .dash-title {
      font-size: 21px;
      font-weight: 800;
      color: #0f172a;
    }

    .dash-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dash-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 10px;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      color: #1e293b;
      font-size: 17px;
      font-weight: 700;
    }

    .dash-btn.primary {
      background: #10b981;
      border-color: #059669;
      color: #ffffff;
    }

    .dash-table {
      width: 100%;
      border-collapse: collapse;
    }

    .dash-table th {
      text-align: left;
      padding: 15px 24px;
      font-size: 17px;
      font-weight: 800;
      color: #64748b;
      background: #f8fafc;
      border-bottom: 1.5px solid #e2e8f0;
    }

    .dash-table td {
      padding: 18px 24px;
      font-size: 21px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    .dash-table tr:last-child td {
      border-bottom: none;
    }

    .url-cell {
      font-size: 19px;
      font-weight: 600;
      color: #475569;
    }

    .inline-edit-box {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: 10px;
      background: #ecfdf5;
      border: 2px solid #10b981;
      color: #065f46;
      font-size: 21px;
      font-weight: 800;
    }

    .pin-on {
      color: #10b981;
      display: inline-flex;
    }

    .pin-off {
      color: #cbd5e1;
      display: inline-flex;
    }

    .bottom-cards {
      width: 1176px;
      margin: 26px auto 0;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 22px;
    }

    .highlight-card {
      padding: 20px 18px;
      border-radius: 18px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .highlight-icon {
      width: 50px;
      height: 50px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .highlight-icon.green {
      background: #ecfdf5;
      color: #059669;
    }

    .highlight-icon.blue {
      background: #eff6ff;
      color: #2563eb;
    }

    .highlight-icon.indigo {
      background: #eef2ff;
      color: #4f46e5;
    }

    .highlight-title {
      font-size: 21px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .highlight-desc {
      font-size: 16.5px;
      font-weight: 600;
      color: #475569;
      line-height: 1.35;
    }
  `;

  const bodyHtml = `
    <div class="header">
      <h1 class="title">
        ${escapeHtml(t.titlePart1)}<span class="gradient-text">${escapeHtml(t.titlePart2)}</span>
      </h1>
    </div>

    <div class="dashboard-window">
      <div class="dash-topbar">
        <div class="dash-topbar-left">
          <div class="traffic-lights">
            <span class="tl tl-red"></span>
            <span class="tl tl-yellow"></span>
            <span class="tl tl-green"></span>
          </div>
          <span class="dash-title">${escapeHtml(t.windowTitle)} <span class="mono" style="color:#059669;">(:ls)</span></span>
        </div>

        <div class="dash-actions">
          <span class="dash-btn">${ICONS.upload} ${escapeHtml(t.btnImport)}</span>
          <span class="dash-btn">${ICONS.download} ${escapeHtml(t.btnExport)}</span>
          <span class="dash-btn primary mono">JSON</span>
        </div>
      </div>

      <table class="dash-table">
        <thead>
          <tr>
            <th style="width: 220px;">${escapeHtml(t.colNickname)}</th>
            <th style="width: 340px;">${escapeHtml(t.colTitle)}</th>
            <th>${escapeHtml(t.colUrl)}</th>
            <th style="width: 100px; text-align: center;">${escapeHtml(t.colPin)}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="nick-badge">docs</span></td>
            <td>${escapeHtml(t.row1Title)}</td>
            <td class="url-cell mono">https://docs.example.com/guide</td>
            <td style="text-align: center;"><span class="pin-on">${ICONS.pin}</span></td>
          </tr>
          <tr>
            <td><span class="nick-badge">work/mail</span></td>
            <td>
              <span class="inline-edit-box">${escapeHtml(t.row2Title)}<span class="cursor-bar" style="height:22px;"></span></span>
            </td>
            <td class="url-cell mono">https://mail.example.com/inbox</td>
            <td style="text-align: center;"><span class="pin-on">${ICONS.pin}</span></td>
          </tr>
          <tr>
            <td><span class="nick-badge">s</span></td>
            <td>${escapeHtml(t.row3Title)}</td>
            <td class="url-cell mono">https://search.example.com/?q=%s</td>
            <td style="text-align: center;"><span class="pin-off">${ICONS.pin}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="bottom-cards">
      <div class="highlight-card">
        <div class="highlight-icon green">${ICONS.trend}</div>
        <div>
          <div class="highlight-title">${escapeHtml(t.card1Title)}</div>
          <div class="highlight-desc">${escapeHtml(t.card1Desc)}</div>
        </div>
      </div>

      <div class="highlight-card">
        <div class="highlight-icon indigo">${ICONS.palette}</div>
        <div>
          <div class="highlight-title">${escapeHtml(t.card2Title)}</div>
          <div class="highlight-desc">${escapeHtml(t.card2Desc)}</div>
        </div>
      </div>

      <div class="highlight-card">
        <div class="highlight-icon blue">${ICONS.cloud}</div>
        <div>
          <div class="highlight-title">${escapeHtml(t.card3Title)}</div>
          <div class="highlight-desc">${escapeHtml(t.card3Desc)}</div>
        </div>
      </div>
    </div>
  `;

  return wrapDocument({
    htmlLang: locale.htmlLang,
    fontFamily: locale.fontFamily,
    iconDataUri,
    extraCss,
    bodyHtml,
    viewport,
  });
}

/** スライド ID とレンダリング関数の対応表 */
const SLIDE_RENDERERS = {
  '01_launcher': renderSlide01,
  '02_quick_register': renderSlide02,
  '03_quick_launch': renderSlide03,
  '04_folders_bookmarklets': renderSlide04,
  '05_dashboard_ranking': renderSlide05,
};

module.exports = { SLIDE_RENDERERS };
