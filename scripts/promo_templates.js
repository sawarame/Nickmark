/**
 * プロモーション画像（1280×800）用の HTML/CSS テンプレート生成モジュール
 *
 * 既存の日本語・英語版（promo_ja_*.png / promo_en_*.png）のビジュアルデザインを忠実に再現し、
 * 各言語の文言を差し込んで HTML 文字列を生成します。
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
 * UI モック内で使用する軽量な SVG アイコン群
 */
const ICONS = {
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  lock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  list: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>`,
  settings: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  github: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>`,
  doc: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  pin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`,
  plusCircle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  checkCircle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  terminal: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  upload: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  sparkle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/></svg>`,
  bolt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  folder: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  mail: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>`,
  board: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  code: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  trend: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  filter: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  cloud: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
  sort: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`,
  arrowRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
};

/**
 * 全スライド共通のベース CSS とページ枠組みを生成します。
 * @param {object} params
 * @param {string} params.htmlLang - HTML の lang 属性
 * @param {string} params.fontFamily - 言語に応じたフォントファミリー
 * @param {string} params.iconDataUri - Nickmark アイコンの Data URI
 * @param {string} params.extraCss - スライド固有 CSS
 * @param {string} params.bodyHtml - スライド本文 HTML
 * @returns {string} 完全な HTML ドキュメント文字列
 */
function wrapDocument({ htmlLang, fontFamily, iconDataUri, extraCss, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(htmlLang)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1280, initial-scale=1.0" />
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    width: 1280px;
    height: 800px;
    overflow: hidden;
    font-family: ${fontFamily};
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* 韓国語は単語の途中で不自然に改行されないよう keep-all を適用 */
  html[lang="ko"] body {
    word-break: keep-all;
  }

  .canvas {
    position: relative;
    width: 1280px;
    height: 800px;
    overflow: hidden;
    background:
      radial-gradient(ellipse 680px 420px at 52% 4%, rgba(16, 185, 129, 0.14) 0%, rgba(16, 185, 129, 0.0) 70%),
      radial-gradient(ellipse 620px 440px at 78% 18%, rgba(59, 130, 246, 0.11) 0%, rgba(59, 130, 246, 0.0) 70%),
      radial-gradient(ellipse 560px 420px at 14% 88%, rgba(16, 185, 129, 0.07) 0%, rgba(16, 185, 129, 0.0) 70%),
      linear-gradient(180deg, #f8fafc 0%, #f5f9ff 50%, #f8fafc 100%);
  }

  /* 背景の微細なドットグリッド */
  .canvas::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(15, 23, 42, 0.055) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: radial-gradient(ellipse 80% 75% at 50% 45%, rgba(0, 0, 0, 0.65) 0%, transparent 100%);
    -webkit-mask-image: radial-gradient(ellipse 80% 75% at 50% 45%, rgba(0, 0, 0, 0.65) 0%, transparent 100%);
    pointer-events: none;
  }

  .brand {
    position: absolute;
    top: 26px;
    left: 44px;
    display: flex;
    align-items: center;
    gap: 11px;
    z-index: 10;
  }

  .brand-icon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    box-shadow: 0 5px 14px rgba(15, 23, 42, 0.22);
    display: block;
  }

  .brand-name {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
  }

  .gradient-text {
    background: linear-gradient(90deg, #059669 0%, #0d9488 42%, #2563eb 100%);
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
    gap: 7px;
  }

  .tl {
    width: 11px;
    height: 11px;
    border-radius: 50%;
  }
  .tl-red { background: #ff5f56; }
  .tl-yellow { background: #ffbd2e; }
  .tl-green { background: #27c93f; }

  .nick-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 6px;
    background: #d1fae5;
    color: #047857;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.3;
    white-space: nowrap;
  }

  .enter-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 10px;
    border-radius: 7px;
    border: 1px solid #a7f3d0;
    background: #ecfdf5;
    color: #047857;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .key-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 9px;
    border-radius: 7px;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #0f172a;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .cursor-bar {
    display: inline-block;
    width: 2px;
    height: 18px;
    background: #10b981;
    vertical-align: -3px;
    margin-left: 1px;
    border-radius: 1px;
  }

  .toolbar-ext-icon {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    padding: 3px;
    border: 1.5px solid rgba(52, 211, 153, 0.7);
    background: rgba(16, 185, 129, 0.16);
    box-shadow: 0 0 14px rgba(16, 185, 129, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-ext-icon img {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    display: block;
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
 */
function renderSlide01(locale, iconDataUri) {
  const t = locale.slides['01_launcher'];
  const extraCss = `
    .hero-header {
      position: relative;
      z-index: 2;
      text-align: center;
      padding-top: 66px;
    }
    .hero-title {
      font-size: 46px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.025em;
      color: #0f172a;
    }
    .hero-subtitle {
      margin-top: 12px;
      font-size: 16.5px;
      font-weight: 500;
      color: #475569;
    }

    .browser-window {
      position: relative;
      z-index: 2;
      width: 1090px;
      height: 500px;
      margin: 26px auto 0;
      border-radius: 16px;
      overflow: hidden;
      background: #0b1120;
      box-shadow:
        0 28px 60px rgba(15, 23, 42, 0.28),
        0 6px 18px rgba(15, 23, 42, 0.14),
        0 0 0 1px rgba(148, 163, 184, 0.18);
      display: flex;
      flex-direction: column;
    }

    .browser-top {
      height: 44px;
      background: #0f172a;
      display: flex;
      align-items: center;
      padding: 0 18px;
      gap: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .browser-tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 30px;
      padding: 0 14px;
      border-radius: 8px;
      background: #1e293b;
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 600;
    }

    .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #1e293b;
      color: #94a3b8;
      font-size: 11.5px;
      font-weight: 700;
    }

    .browser-omnibox {
      height: 46px;
      background: #0d1526;
      display: flex;
      align-items: center;
      padding: 0 18px;
      gap: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .url-bar {
      flex: 1;
      height: 30px;
      border-radius: 999px;
      background: #172033;
      border: 1px solid rgba(148, 163, 184, 0.14);
      display: flex;
      align-items: center;
      padding: 0 14px;
      gap: 8px;
      color: #94a3b8;
      font-size: 13px;
    }

    .browser-viewport {
      flex: 1;
      position: relative;
      background:
        radial-gradient(ellipse 640px 380px at 22% 46%, rgba(16, 185, 129, 0.34) 0%, rgba(6, 78, 59, 0.0) 70%),
        linear-gradient(135deg, #064234 0%, #072c2a 48%, #071422 100%);
      padding: 36px 34px;
    }

    .mock-site-card {
      position: absolute;
      left: 34px;
      top: 78px;
      width: 444px;
      padding: 26px 28px 28px;
      border-radius: 16px;
      background: rgba(7, 26, 28, 0.68);
      border: 1px solid rgba(148, 163, 184, 0.16);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.25);
    }

    .mock-site-nav {
      display: flex;
      align-items: center;
      gap: 20px;
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .mock-site-brand {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #34d399;
      font-weight: 700;
      margin-right: 4px;
    }
    .mock-site-nav .active {
      color: #f8fafc;
      font-weight: 600;
      padding-bottom: 4px;
      border-bottom: 2px solid #10b981;
    }

    .mock-site-pill {
      display: inline-flex;
      align-items: center;
      padding: 5px 13px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.14);
      border: 1px solid rgba(52, 211, 153, 0.38);
      color: #6ee7b7;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .mock-site-title {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
    }

    .mock-site-desc {
      font-size: 13.5px;
      line-height: 1.65;
      color: #cbd5e1;
      margin-bottom: 22px;
    }

    .mock-site-actions {
      display: flex;
      gap: 12px;
    }
    .btn-primary-green {
      padding: 9px 18px;
      border-radius: 999px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
    }
    .btn-outline-dark {
      padding: 9px 18px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(148, 163, 184, 0.28);
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 600;
    }

    /* コマンドパレットポップアップ */
    .palette-popup {
      position: absolute;
      right: 30px;
      top: 18px;
      width: 556px;
      border-radius: 14px;
      background: #ffffff;
      box-shadow:
        0 26px 54px rgba(0, 0, 0, 0.42),
        0 0 0 1px rgba(255, 255, 255, 0.65);
      overflow: hidden;
    }

    .palette-input-row {
      height: 54px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #e2e8f0;
    }

    .palette-input-icon {
      color: #10b981;
      display: flex;
    }

    .palette-query {
      flex: 1;
      font-size: 17px;
      font-weight: 600;
      color: #0f172a;
    }

    .palette-action-icons {
      display: flex;
      gap: 7px;
    }
    .circle-icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .palette-list {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .palette-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 12px;
      border-radius: 10px;
      border: 1px solid transparent;
    }

    .palette-item.selected {
      background: #ecfdf5;
      border-color: #6ee7b7;
    }

    .item-fav {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #f1f5f9;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .palette-item.selected .item-fav {
      background: #d1fae5;
      color: #059669;
    }
    .item-fav.blue {
      background: #eff6ff;
      color: #3b82f6;
    }

    .item-body {
      flex: 1;
      min-width: 0;
    }

    .item-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 3px;
    }

    .item-title {
      font-size: 14px;
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
      font-size: 12px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tag-muted {
      padding: 3px 9px;
      border-radius: 6px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
    }

    .bottom-hints {
      position: relative;
      z-index: 2;
      margin-top: 20px;
      display: flex;
      justify-content: center;
      gap: 20px;
    }

    .hint-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      border-radius: 999px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
      font-size: 13.5px;
      font-weight: 600;
      color: #334155;
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

    <div class="browser-window">
      <div class="browser-top">
        <div class="traffic-lights">
          <span class="tl tl-red"></span>
          <span class="tl tl-yellow"></span>
          <span class="tl tl-green"></span>
        </div>
        <div class="browser-tab">
          ${ICONS.globe}
          <span>Nickmark — sawara.me</span>
        </div>
        <span class="tab-count">3</span>
      </div>

      <div class="browser-omnibox">
        <div class="url-bar">
          ${ICONS.lock}
          <span>https://sawara.me/nickmark</span>
        </div>
        <div class="toolbar-ext-icon">
          <img src="${iconDataUri}" alt="Nickmark" />
        </div>
      </div>

      <div class="browser-viewport">
        <div class="mock-site-card">
          <div class="mock-site-nav">
            <span class="mock-site-brand">${ICONS.globe} sawara.me</span>
            <span>Tools</span>
            <span class="active">Extensions</span>
            <span>About</span>
          </div>
          <div class="mock-site-pill">${escapeHtml(t.sitePill)}</div>
          <div class="mock-site-title">Nickmark — sawara.me</div>
          <div class="mock-site-desc">${escapeHtml(t.siteDesc)}</div>
          <div class="mock-site-actions">
            <span class="btn-primary-green">Chrome Web Store</span>
            <span class="btn-outline-dark">Docs &amp; GitHub</span>
          </div>
        </div>

        <div class="palette-popup">
          <div class="palette-input-row">
            <span class="palette-input-icon">${ICONS.search}</span>
            <div class="palette-query">gh<span class="cursor-bar"></span></div>
            <div class="palette-action-icons">
              <span class="circle-icon-btn">${ICONS.list}</span>
              <span class="circle-icon-btn">${ICONS.settings}</span>
            </div>
          </div>
          <div class="palette-list">
            <div class="palette-item selected">
              <div class="item-fav">${ICONS.github}</div>
              <div class="item-body">
                <div class="item-top">
                  <span class="nick-badge">gh</span>
                  <span class="item-title">sawarame/Nickmark — GitHub</span>
                  <span class="item-pin">${ICONS.pin}</span>
                </div>
                <div class="item-url mono">https://github.com/sawarame/Nickmark</div>
              </div>
            </div>

            <div class="palette-item">
              <div class="item-fav">${ICONS.github}</div>
              <div class="item-body">
                <div class="item-top">
                  <span class="nick-badge">gh/pr</span>
                  <span class="item-title">Pull Requests · sawarame/Nickmark</span>
                </div>
                <div class="item-url mono">https://github.com/sawarame/Nickmark/pulls</div>
              </div>
            </div>

            <div class="palette-item">
              <div class="item-fav blue">${ICONS.doc}</div>
              <div class="item-body">
                <div class="item-top">
                  <span class="nick-badge">gh/actions</span>
                  <span class="item-title">${escapeHtml(t.docActionsTitle)}</span>
                </div>
                <div class="item-url mono">https://docs.github.com/en/actions</div>
              </div>
            </div>

            <div class="palette-item">
              <div class="item-fav">${ICONS.search}</div>
              <div class="item-body">
                <div class="item-top">
                  <span class="nick-badge">g</span>
                  <span class="item-title">${escapeHtml(t.googleSearchTitle)}</span>
                </div>
                <div class="item-url mono">https://www.google.com/search?q=%s</div>
              </div>
              <span class="tag-muted">${escapeHtml(t.dynamicUrlBadge)}</span>
            </div>
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
        <span class="key-chip">⌘ / Ctrl + Enter</span>
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
  });
}

/**
 * Slide 2・3 共通の左カラム（アイブロー・見出し・説明・ステップ 1〜3）CSS を返します。
 */
const SPLIT_LAYOUT_CSS = `
  .split-container {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 48px;
    height: 100%;
    gap: 44px;
  }

  .left-col {
    width: 474px;
    padding-top: 34px;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #059669;
    margin-bottom: 14px;
  }

  .split-title {
    font-size: 42px;
    font-weight: 800;
    line-height: 1.22;
    letter-spacing: -0.025em;
    color: #0f172a;
    margin-bottom: 16px;
  }

  .split-lead {
    font-size: 15px;
    line-height: 1.7;
    color: #475569;
    margin-bottom: 26px;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 13px;
  }

  .step-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 15px 18px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid #e2e8f0;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.045);
  }

  .step-num {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #ffffff;
    font-size: 13px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .step-title {
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 4px;
  }

  .step-desc {
    font-size: 13px;
    line-height: 1.55;
    color: #475569;
  }

  .right-col {
    width: 668px;
    padding-top: 26px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
`;

/**
 * Slide 2: 簡単登録（02_quick_register）
 */
function renderSlide02(locale, iconDataUri) {
  const t = locale.slides['02_quick_register'];
  const extraCss = `
    ${SPLIT_LAYOUT_CSS}

    .reg-browser {
      border-radius: 16px;
      overflow: hidden;
      background: #0b1120;
      box-shadow:
        0 26px 52px rgba(15, 23, 42, 0.24),
        0 0 0 1px rgba(148, 163, 184, 0.16);
    }

    .reg-top {
      height: 44px;
      background: #0f172a;
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .reg-tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 29px;
      padding: 0 13px;
      border-radius: 8px;
      background: #1e293b;
      color: #e2e8f0;
      font-size: 12.5px;
      font-weight: 600;
    }

    .reg-omnibox {
      height: 46px;
      background: #0d1526;
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .reg-url {
      flex: 1;
      height: 30px;
      border-radius: 999px;
      background: #172033;
      border: 1px solid rgba(148, 163, 184, 0.14);
      display: flex;
      align-items: center;
      padding: 0 14px;
      gap: 8px;
      color: #94a3b8;
      font-size: 12.5px;
    }

    .reg-body {
      padding: 20px 24px 24px;
      background:
        radial-gradient(ellipse 460px 260px at 50% 0%, rgba(16, 185, 129, 0.22) 0%, transparent 72%),
        linear-gradient(180deg, #071b20 0%, #07121e 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
    }

    .toast-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      border-radius: 999px;
      background: rgba(6, 28, 28, 0.92);
      border: 1px solid rgba(52, 211, 153, 0.55);
      color: #ecfdf5;
      font-size: 13.5px;
      font-weight: 700;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    }
    .toast-pill svg { color: #34d399; }

    .reg-palette {
      width: 100%;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 18px 36px rgba(0, 0, 0, 0.32);
      overflow: hidden;
    }

    .reg-input-row {
      height: 52px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #e2e8f0;
    }

    .reg-input-icon {
      color: #059669;
      display: flex;
    }

    .reg-cmd-text {
      flex: 1;
      font-size: 16.5px;
      font-weight: 700;
      color: #0f172a;
    }

    .reg-items {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .preview-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
    }

    .preview-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #065f46;
      margin-bottom: 3px;
    }

    .preview-url {
      font-size: 12px;
      color: #047857;
    }

    .preview-tag {
      padding: 4px 10px;
      border-radius: 6px;
      background: #ffffff;
      border: 1px solid #a7f3d0;
      color: #047857;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
    }

    .cmd-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid transparent;
    }

    .cmd-row.selected {
      background: #e6faef;
      border-color: #6ee7b7;
    }

    .cmd-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: #f1f5f9;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .cmd-row.selected .cmd-icon {
      background: #d1fae5;
      color: #059669;
    }

    .cmd-main {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 2px;
    }

    .cmd-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
    }

    .cmd-sub {
      font-size: 12px;
      color: #64748b;
    }

    .other-methods-card {
      padding: 14px 18px;
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .other-label {
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      white-space: nowrap;
    }

    .other-pills {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .pill-neutral {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 13px;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      font-size: 12.5px;
      font-weight: 700;
      white-space: nowrap;
    }

    .pill-green {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 13px;
      border-radius: 999px;
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      color: #047857;
      font-size: 12.5px;
      font-weight: 700;
      white-space: nowrap;
    }
  `;

  const bodyHtml = `
    <div class="split-container">
      <div class="left-col">
        <div class="eyebrow">${ICONS.plusCircle}<span>${escapeHtml(t.eyebrow)}</span></div>
        <h1 class="split-title">
          ${escapeHtml(t.titleLine1)}<br />
          <span class="gradient-text">${escapeHtml(t.titleLine2)}</span>
        </h1>
        <p class="split-lead">${escapeHtml(t.lead)}</p>
        <div class="steps">
          <div class="step-card">
            <span class="step-num">1</span>
            <div>
              <div class="step-title">${escapeHtml(t.step1Title)}</div>
              <div class="step-desc">${escapeHtml(t.step1Desc)}</div>
            </div>
          </div>
          <div class="step-card">
            <span class="step-num">2</span>
            <div>
              <div class="step-title">${escapeHtml(t.step2Title)}</div>
              <div class="step-desc">${escapeHtml(t.step2Desc)}</div>
            </div>
          </div>
          <div class="step-card">
            <span class="step-num">3</span>
            <div>
              <div class="step-title">${escapeHtml(t.step3Title)}</div>
              <div class="step-desc">${escapeHtml(t.step3Desc)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="right-col">
        <div class="reg-browser">
          <div class="reg-top">
            <div class="traffic-lights">
              <span class="tl tl-red"></span>
              <span class="tl tl-yellow"></span>
              <span class="tl tl-green"></span>
            </div>
            <div class="reg-tab">
              ${ICONS.github}
              <span>sawarame/Nickmark — GitHub</span>
            </div>
          </div>

          <div class="reg-omnibox">
            <div class="reg-url">
              ${ICONS.lock}
              <span>https://github.com/sawarame/Nickmark</span>
            </div>
            <div class="toolbar-ext-icon">
              <img src="${iconDataUri}" alt="Nickmark" />
            </div>
          </div>

          <div class="reg-body">
            <div class="toast-pill">
              ${ICONS.checkCircle}
              <span>${escapeHtml(t.toastSaved)}</span>
            </div>

            <div class="reg-palette">
              <div class="reg-input-row">
                <span class="reg-input-icon">${ICONS.terminal}</span>
                <div class="reg-cmd-text mono">:add gh<span class="cursor-bar"></span></div>
                <span class="enter-chip">Enter</span>
              </div>
              <div class="reg-items">
                <div class="preview-box">
                  <div>
                    <div class="preview-title">${escapeHtml(t.previewTitle)}</div>
                    <div class="preview-url mono">https://github.com/sawarame/Nickmark</div>
                  </div>
                  <span class="preview-tag">${escapeHtml(t.previewBadge)}</span>
                </div>

                <div class="cmd-row selected">
                  <div class="cmd-icon">${ICONS.plusCircle}</div>
                  <div>
                    <div class="cmd-main">
                      <span class="nick-badge">:add gh</span>
                      <span class="cmd-title">${escapeHtml(t.cmdAddTitle)}</span>
                    </div>
                    <div class="cmd-sub">sawarame/Nickmark — GitHub</div>
                  </div>
                </div>

                <div class="cmd-row">
                  <div class="cmd-icon">${ICONS.terminal}</div>
                  <div>
                    <div class="cmd-main">
                      <span class="nick-badge">:addall</span>
                      <span class="cmd-title">${escapeHtml(t.cmdAddallTitle)}</span>
                    </div>
                    <div class="cmd-sub mono">${escapeHtml(t.cmdAddallSub)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="other-methods-card">
          <span class="other-label">${escapeHtml(t.otherMethodsLabel)}</span>
          <div class="other-pills">
            <span class="pill-neutral">${ICONS.upload}<span>${escapeHtml(t.importHtmlPill)}</span></span>
            <span class="pill-green">${ICONS.sparkle}<span>${escapeHtml(t.presetsPill)}</span></span>
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
  });
}

/**
 * Slide 3: 簡単呼び出し＆動的 URL（03_quick_launch）
 */
function renderSlide03(locale, iconDataUri) {
  const t = locale.slides['03_quick_launch'];
  const extraCss = `
    ${SPLIT_LAYOUT_CSS}

    .launch-card {
      padding: 20px 22px 22px;
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 20px 44px rgba(15, 23, 42, 0.085);
    }

    .card-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .card-top-left {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 13.5px;
      font-weight: 800;
      color: #059669;
    }

    .card-top-right {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }

    .launch-palette {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      background: #ffffff;
    }

    .launch-input-row {
      height: 50px;
      padding: 0 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #e2e8f0;
    }

    .launch-input-icon {
      color: #10b981;
      display: flex;
    }

    .launch-query {
      flex: 1;
      font-size: 16.5px;
      font-weight: 700;
      color: #0f172a;
    }

    .launch-list {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .launch-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
    }

    .launch-item.active {
      background: linear-gradient(90deg, #059669 0%, #10b981 100%);
      color: #ffffff;
      box-shadow: 0 8px 18px rgba(16, 185, 129, 0.28);
    }

    .launch-fav {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #f1f5f9;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .launch-item.active .launch-fav {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }
    .launch-fav.blue {
      background: #eff6ff;
      color: #3b82f6;
    }

    .launch-item-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 2px;
    }

    .launch-item.active .nick-badge {
      background: rgba(255, 255, 255, 0.24);
      color: #ffffff;
    }

    .launch-item-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .launch-item.active .launch-item-title {
      color: #ffffff;
    }

    .launch-item-url {
      font-size: 12px;
      color: #64748b;
    }
    .launch-item.active .launch-item-url {
      color: rgba(255, 255, 255, 0.85);
    }

    .key-grid {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .key-box {
      padding: 12px 10px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 7px;
      text-align: center;
    }

    .key-box-label {
      font-size: 12.5px;
      font-weight: 700;
      color: #334155;
    }

    .dynamic-card {
      padding: 18px 22px;
      border-radius: 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.065);
    }

    .dynamic-flow {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
    }

    .dynamic-input-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #0f172a;
      font-size: 13.5px;
      font-weight: 700;
      white-space: nowrap;
    }

    .dynamic-arrow {
      color: #10b981;
      display: flex;
      flex-shrink: 0;
    }

    .dynamic-output-pill {
      flex: 1;
      padding: 10px 14px;
      border-radius: 10px;
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      color: #0f172a;
      font-size: 13.5px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dynamic-arg {
      color: #059669;
    }
  `;

  const bodyHtml = `
    <div class="split-container">
      <div class="left-col">
        <div class="eyebrow">${ICONS.bolt}<span>${escapeHtml(t.eyebrow)}</span></div>
        <h1 class="split-title">
          ${escapeHtml(t.titleLine1)}<br />
          <span class="gradient-text">${escapeHtml(t.titleLine2)}</span>
        </h1>
        <p class="split-lead">${escapeHtml(t.lead)}</p>
        <div class="steps">
          <div class="step-card">
            <span class="step-num">1</span>
            <div>
              <div class="step-title">${escapeHtml(t.step1Title)}</div>
              <div class="step-desc">${escapeHtml(t.step1Desc)}</div>
            </div>
          </div>
          <div class="step-card">
            <span class="step-num">2</span>
            <div>
              <div class="step-title">${escapeHtml(t.step2Title)}</div>
              <div class="step-desc">${escapeHtml(t.step2Desc)}</div>
            </div>
          </div>
          <div class="step-card">
            <span class="step-num">3</span>
            <div>
              <div class="step-title">${escapeHtml(t.step3Title)}</div>
              <div class="step-desc">${escapeHtml(t.step3Desc)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="right-col">
        <div class="launch-card">
          <div class="card-top-bar">
            <div class="card-top-left">${ICONS.search}<span>${escapeHtml(t.cardHeaderLeft)}</span></div>
            <div class="card-top-right mono">${escapeHtml(t.cardHeaderRight)}</div>
          </div>

          <div class="launch-palette">
            <div class="launch-input-row">
              <span class="launch-input-icon">${ICONS.search}</span>
              <div class="launch-query">gh<span class="cursor-bar"></span></div>
              <span class="enter-chip">Enter</span>
            </div>
            <div class="launch-list">
              <div class="launch-item active">
                <div class="launch-fav">${ICONS.github}</div>
                <div>
                  <div class="launch-item-top">
                    <span class="nick-badge">gh</span>
                    <span class="launch-item-title">sawarame/Nickmark — GitHub</span>
                  </div>
                  <div class="launch-item-url mono">https://github.com/sawarame/Nickmark</div>
                </div>
              </div>

              <div class="launch-item">
                <div class="launch-fav">${ICONS.github}</div>
                <div>
                  <div class="launch-item-top">
                    <span class="nick-badge">gh/pr</span>
                    <span class="launch-item-title">Open Pull Requests</span>
                  </div>
                  <div class="launch-item-url mono">https://github.com/sawarame/Nickmark/pulls</div>
                </div>
              </div>

              <div class="launch-item">
                <div class="launch-fav blue">${ICONS.doc}</div>
                <div>
                  <div class="launch-item-top">
                    <span class="nick-badge">docs</span>
                    <span class="launch-item-title">GitHub Actions Docs</span>
                  </div>
                  <div class="launch-item-url mono">https://docs.github.com/en/actions</div>
                </div>
              </div>
            </div>
          </div>

          <div class="key-grid">
            <div class="key-box">
              <span class="enter-chip">Enter</span>
              <span class="key-box-label">${escapeHtml(t.keyCurrent)}</span>
            </div>
            <div class="key-box">
              <span class="key-chip">⌘ / Ctrl + Enter</span>
              <span class="key-box-label">${escapeHtml(t.keyNew)}</span>
            </div>
            <div class="key-box">
              <span class="key-chip">Shift + Enter</span>
              <span class="key-box-label">${escapeHtml(t.keyBackground)}</span>
            </div>
          </div>
        </div>

        <div class="dynamic-card">
          <div class="card-top-bar" style="margin-bottom: 0;">
            <div class="card-top-left"><span>${escapeHtml(t.dynamicHeaderLeft)}</span></div>
            <div class="card-top-right">${escapeHtml(t.dynamicHeaderRight)}</div>
          </div>
          <div class="dynamic-flow">
            <div class="dynamic-input-pill mono">
              ${ICONS.search}
              <span>gh sawarame/Nickmark</span>
            </div>
            <span class="dynamic-arrow">${ICONS.arrowRight}</span>
            <div class="dynamic-output-pill mono">
              https://github.com/<span class="dynamic-arg">sawarame/Nickmark</span>
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
  });
}

/**
 * Slide 4: フォルダ一括起動＆ブックマークレット（04_folders_bookmarklets）
 */
function renderSlide04(locale, iconDataUri) {
  const t = locale.slides['04_folders_bookmarklets'];
  const extraCss = `
    .top-header {
      position: relative;
      z-index: 2;
      text-align: center;
      padding-top: 66px;
    }

    .top-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #059669;
      margin-bottom: 10px;
    }

    .top-title {
      font-size: 40px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.025em;
      color: #0f172a;
    }

    .two-col-cards {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 516px 634px;
      gap: 28px;
      justify-content: center;
      margin-top: 26px;
    }

    .feature-card {
      height: 604px;
      padding: 24px 26px 26px;
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 20px 44px rgba(15, 23, 42, 0.075);
      display: flex;
      flex-direction: column;
    }

    .card-heading {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 17.5px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 10px;
    }
    .card-heading .icon-green { color: #059669; display: flex; }
    .card-heading .icon-amber { color: #d97706; display: flex; }

    .card-desc {
      font-size: 13.5px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 18px;
      min-height: 44px;
    }

    /* 左カード：ダークブラウザモック */
    .dark-folder-stage {
      flex: 1;
      border-radius: 14px;
      background:
        radial-gradient(ellipse 360px 220px at 50% 100%, rgba(16, 185, 129, 0.14) 0%, transparent 72%),
        #0b1220;
      border: 1px solid rgba(148, 163, 184, 0.18);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .stage-tabbar {
      height: 44px;
      padding: 0 14px;
      background: #0f172a;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .mini-tab {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 7px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(52, 211, 153, 0.35);
      color: #a7f3d0;
      font-size: 11.5px;
      font-weight: 600;
    }

    .stage-body {
      flex: 1;
      padding: 18px 18px 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 14px;
    }

    .stage-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .status-green-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.14);
      border: 1px solid rgba(52, 211, 153, 0.42);
      color: #6ee7b7;
      font-size: 12px;
      font-weight: 700;
    }

    .stage-note {
      font-size: 11.5px;
      color: #94a3b8;
      font-weight: 500;
    }

    .folder-palette {
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }

    .fp-input {
      height: 46px;
      padding: 0 14px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .fp-input-icon { color: #10b981; display: flex; }
    .fp-query { flex: 1; font-size: 15.5px; font-weight: 700; color: #0f172a; }

    .fp-list {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .fp-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 11px;
      border-radius: 9px;
    }

    .fp-row.primary {
      background: linear-gradient(90deg, #059669 0%, #10b981 100%);
      color: #ffffff;
      padding: 10px 12px;
    }
    .fp-row.primary .nick-badge {
      background: rgba(255, 255, 255, 0.24);
      color: #ffffff;
    }

    .fp-icon {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .fp-row.primary .fp-icon { background: rgba(255, 255, 255, 0.2); color: #ffffff; }
    .fp-icon.indigo { background: #eef2ff; color: #4f46e5; }
    .fp-icon.emerald { background: #ecfdf5; color: #059669; }
    .fp-icon.amber { background: #fef3c7; color: #d97706; }

    .fp-row-label {
      font-size: 13.5px;
      font-weight: 700;
    }

    /* 右カード：ブックマークレット */
    .bm-cmd-bar {
      height: 44px;
      padding: 0 14px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .bm-cmd-text {
      flex: 1;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .bm-preview-card {
      padding: 13px 15px;
      border-radius: 12px;
      background: #fefce8;
      border: 1px solid #fde68a;
      margin-bottom: 14px;
    }

    .bm-preview-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 7px;
    }

    .js-badge {
      padding: 2px 7px;
      border-radius: 5px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #b45309;
      font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 800;
    }

    .bm-preview-title {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }

    .bm-code {
      font-size: 11px;
      letter-spacing: -0.02em;
      color: #78350f;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dark-bm-stage {
      flex: 1;
      border-radius: 14px;
      padding: 16px 18px 20px;
      background:
        radial-gradient(ellipse 380px 240px at 50% 60%, rgba(16, 185, 129, 0.16) 0%, transparent 72%),
        linear-gradient(180deg, #071922 0%, #051316 100%);
      border: 1px solid rgba(148, 163, 184, 0.18);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
    }

    .bm-stage-top {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .bm-palette-mini {
      width: 100%;
      padding: 10px;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bm-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 9px;
      border: 1px solid transparent;
    }

    .bm-row.selected {
      background: #ecfdf5;
      border-color: #6ee7b7;
    }

    .bm-row-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .bm-icon-box {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      background: #ffedd5;
      color: #ea580c;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bm-row-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
    }

    .js-pill-muted {
      padding: 2px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
    }

    .bm-toast {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 999px;
      background: rgba(6, 28, 28, 0.92);
      border: 1px solid rgba(52, 211, 153, 0.52);
      color: #ecfdf5;
      font-size: 13px;
      font-weight: 700;
    }
    .bm-toast svg { color: #34d399; }
  `;

  const bodyHtml = `
    <div class="top-header">
      <div class="top-eyebrow">${ICONS.folder}<span>${escapeHtml(t.eyebrow)}</span></div>
      <h1 class="top-title">
        ${escapeHtml(t.titlePart1)}<span class="gradient-text">${escapeHtml(t.titlePart2)}</span>
      </h1>
    </div>

    <div class="two-col-cards">
      <div class="feature-card">
        <div class="card-heading">
          <span class="icon-green">${ICONS.folder}</span>
          <span>${escapeHtml(t.leftTitle)}</span>
        </div>
        <p class="card-desc">${escapeHtml(t.leftDesc)}</p>

        <div class="dark-folder-stage">
          <div class="stage-tabbar">
            <div class="traffic-lights">
              <span class="tl tl-red"></span>
              <span class="tl tl-yellow"></span>
              <span class="tl tl-green"></span>
            </div>
            <span class="mini-tab">${ICONS.mail}<span>Webmail</span></span>
            <span class="mini-tab">${ICONS.doc}<span>Arch Docs</span></span>
            <span class="mini-tab">${ICONS.board}<span>Board</span></span>
          </div>

          <div class="stage-body">
            <div class="stage-meta-row">
              <span class="status-green-pill">${ICONS.checkCircle}<span>${escapeHtml(t.launchedBadge)}</span></span>
              <span class="stage-note">${escapeHtml(t.safetyNote)}</span>
            </div>

            <div class="folder-palette">
              <div class="fp-input">
                <span class="fp-input-icon">${ICONS.search}</span>
                <span class="fp-query mono">work/<span class="cursor-bar"></span></span>
                <span class="enter-chip">Enter</span>
              </div>
              <div class="fp-list">
                <div class="fp-row primary">
                  <span class="fp-icon">${ICONS.folder}</span>
                  <span class="nick-badge">work/</span>
                  <span class="fp-row-label">${escapeHtml(t.folderOpenRow)}</span>
                </div>
                <div class="fp-row">
                  <span class="fp-icon indigo">${ICONS.mail}</span>
                  <span class="nick-badge">work/mail</span>
                  <span class="fp-row-label">Team Webmail</span>
                </div>
                <div class="fp-row">
                  <span class="fp-icon emerald">${ICONS.doc}</span>
                  <span class="nick-badge">work/docs</span>
                  <span class="fp-row-label">Architecture Docs</span>
                </div>
                <div class="fp-row">
                  <span class="fp-icon amber">${ICONS.board}</span>
                  <span class="nick-badge">work/board</span>
                  <span class="fp-row-label">Sprint Board</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="feature-card">
        <div class="card-heading">
          <span class="icon-amber">${ICONS.code}</span>
          <span>${escapeHtml(t.rightTitle)}</span>
        </div>
        <p class="card-desc">${escapeHtml(t.rightDesc)}</p>

        <div class="bm-cmd-bar">
          <span style="color:#059669; display:flex;">${ICONS.terminal}</span>
          <span class="bm-cmd-text mono">:add mdlink javascript:...<span class="cursor-bar"></span></span>
          <span class="enter-chip">Enter</span>
        </div>

        <div class="bm-preview-card">
          <div class="bm-preview-top">
            <span class="js-badge">JS</span>
            <span class="nick-badge">mdlink</span>
            <span class="bm-preview-title">${escapeHtml(t.mdlinkTitle)}</span>
          </div>
          <div class="bm-code mono">javascript:navigator.clipboard.writeText(\`[\${document.title}](\${location.href})\`)</div>
        </div>

        <div class="dark-bm-stage">
          <div class="bm-stage-top">
            <span class="status-green-pill">${ICONS.code}<span>${escapeHtml(t.apiBadge)}</span></span>
            <span class="stage-note">${escapeHtml(t.apiNote)}</span>
          </div>

          <div class="bm-palette-mini">
            <div class="bm-row selected">
              <div class="bm-row-left">
                <span class="bm-icon-box">${ICONS.code}</span>
                <span class="nick-badge">mdlink</span>
                <span class="bm-row-title">${escapeHtml(t.mdlinkTitle)}</span>
              </div>
              <span class="js-pill-muted">JS</span>
            </div>
            <div class="bm-row">
              <div class="bm-row-left">
                <span class="bm-icon-box">${ICONS.code}</span>
                <span class="nick-badge">wayback</span>
                <span class="bm-row-title">${escapeHtml(t.waybackTitle)}</span>
              </div>
              <span class="js-pill-muted">JS</span>
            </div>
          </div>

          <div class="bm-toast">
            ${ICONS.checkCircle}
            <span>${escapeHtml(t.toastCopied)}</span>
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
  });
}

/**
 * Slide 5: スマートランキング＆管理画面（05_dashboard_ranking）
 */
function renderSlide05(locale, iconDataUri) {
  const t = locale.slides['05_dashboard_ranking'];
  const extraCss = `
    .top-header {
      position: relative;
      z-index: 2;
      text-align: center;
      padding-top: 64px;
    }

    .top-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #059669;
      margin-bottom: 10px;
    }

    .top-title {
      font-size: 40px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.025em;
      color: #0f172a;
    }

    .dashboard-stage {
      position: relative;
      z-index: 2;
      width: 1176px;
      height: 530px;
      margin: 24px auto 0;
    }

    .dash-window {
      position: absolute;
      left: 0;
      top: 0;
      width: 1020px;
      height: 492px;
      border-radius: 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 24px 54px rgba(15, 23, 42, 0.11);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .dash-titlebar {
      height: 42px;
      padding: 0 18px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .dash-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
    }

    .dash-filename {
      font-size: 12px;
      color: #94a3b8;
    }

    .dash-toolbar {
      padding: 14px 20px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .tool-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 34px;
      padding: 0 13px;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      font-size: 12.5px;
      font-weight: 700;
      white-space: nowrap;
    }

    .tool-btn.primary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-color: transparent;
      color: #ffffff;
    }

    .dash-table {
      width: 100%;
      border-collapse: collapse;
    }

    .dash-table th {
      text-align: left;
      padding: 11px 16px;
      font-size: 12px;
      font-weight: 800;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      background: #fcfdff;
    }

    .th-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .th-filter-active { color: #10b981; display: flex; }
    .th-filter-muted { color: #cbd5e1; display: flex; }

    .dash-table td {
      padding: 12px 16px;
      font-size: 13px;
      color: #0f172a;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    .dash-table tr.editing-row td {
      padding-top: 10px;
      padding-bottom: 24px;
    }

    .cell-title {
      font-weight: 700;
      color: #0f172a;
    }

    .cell-url {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: #475569;
      font-size: 12px;
    }
    .cell-url.js-url {
      color: #d97706;
    }

    .inline-edit-wrap {
      position: relative;
      display: inline-block;
      width: 214px;
    }

    .inline-edit-input {
      width: 100%;
      padding: 6px 10px;
      border-radius: 7px;
      border: 2px solid #10b981;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.14);
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }

    .inline-tooltip {
      position: absolute;
      left: 0;
      top: 37px;
      padding: 4px 10px;
      border-radius: 6px;
      background: #1e293b;
      color: #f8fafc;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
      z-index: 5;
    }

    .pin-active { color: #10b981; display: inline-flex; justify-content: center; width: 100%; }
    .pin-muted { color: #cbd5e1; display: inline-flex; justify-content: center; width: 100%; }
    .trash-icon { color: #ef4444; display: inline-flex; justify-content: center; width: 100%; }

    /* 右下フローティング：指数減衰ランキングカード */
    .ranking-card {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 358px;
      padding: 20px 22px;
      border-radius: 16px;
      background: #ffffff;
      border: 1.5px solid #a7f3d0;
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.14);
      z-index: 8;
    }

    .ranking-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }

    .ranking-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }

    .ranking-desc {
      font-size: 12px;
      line-height: 1.55;
      color: #64748b;
      margin-bottom: 12px;
    }

    .formula-badge {
      display: inline-flex;
      padding: 5px 11px;
      border-radius: 7px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #047857;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 14px;
    }

    .ranking-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rank-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 11px;
      border-radius: 9px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    .rank-row.pinned {
      background: #ecfdf5;
      border-color: #a7f3d0;
    }

    .rank-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }

    .rank-score {
      font-size: 12.5px;
      font-weight: 800;
      color: #475569;
    }
    .rank-row.pinned .rank-score {
      color: #059669;
    }

    .bottom-pills {
      position: relative;
      z-index: 2;
      margin-top: 22px;
      display: flex;
      justify-content: center;
      gap: 18px;
    }

    .bottom-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 999px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }
    .bottom-pill svg { color: #059669; }
  `;

  const bodyHtml = `
    <div class="top-header">
      <div class="top-eyebrow">${ICONS.trend}<span>${escapeHtml(t.eyebrow)}</span></div>
      <h1 class="top-title">
        ${escapeHtml(t.titlePart1)}<span class="gradient-text">${escapeHtml(t.titlePart2)}</span>
      </h1>
    </div>

    <div class="dashboard-stage">
      <div class="dash-window">
        <div class="dash-titlebar">
          <div class="traffic-lights">
            <span class="tl tl-red"></span>
            <span class="tl tl-yellow"></span>
            <span class="tl tl-green"></span>
          </div>
          <div class="dash-title">${escapeHtml(t.windowTitle)}</div>
          <div class="dash-filename mono">list.html</div>
        </div>

        <div class="dash-toolbar">
          <div class="toolbar-left">
            <span class="tool-btn">${ICONS.folder}<span>${escapeHtml(t.allFolders)} ▾</span></span>
            <span class="tool-btn">${ICONS.sort}<span>${escapeHtml(t.sortScore)} ▾</span></span>
          </div>
          <div class="toolbar-right">
            <span class="tool-btn">${ICONS.upload}<span>${escapeHtml(t.btnImport)}</span></span>
            <span class="tool-btn">${ICONS.download}<span>${escapeHtml(t.btnExport)}</span></span>
            <span class="tool-btn primary">${ICONS.code}<span>${escapeHtml(t.btnJson)}</span></span>
          </div>
        </div>

        <table class="dash-table">
          <thead>
            <tr>
              <th style="width: 155px;"><div class="th-inner"><span>${escapeHtml(t.colNickname)}</span><span class="th-filter-active">${ICONS.filter}</span></div></th>
              <th style="width: 245px;"><div class="th-inner"><span>${escapeHtml(t.colTitle)}</span><span class="th-filter-muted">${ICONS.filter}</span></div></th>
              <th><div class="th-inner"><span>${escapeHtml(t.colUrl)}</span><span class="th-filter-muted">${ICONS.filter}</span></div></th>
              <th style="width: 72px; text-align: center;">${escapeHtml(t.colPin)}</th>
              <th style="width: 72px; text-align: center;">${escapeHtml(t.colActions)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="nick-badge">gh</span></td>
              <td class="cell-title">sawarame/Nickmark</td>
              <td><span class="cell-url mono">${ICONS.github}<span>https://github.com/sawarame/Nickmark</span></span></td>
              <td><span class="pin-active">${ICONS.pin}</span></td>
              <td><span class="trash-icon">${ICONS.trash}</span></td>
            </tr>
            <tr>
              <td><span class="nick-badge">work/mail</span></td>
              <td class="cell-title">Team Webmail</td>
              <td><span class="cell-url mono">${ICONS.mail}<span>https://mail.example.com/inbox</span></span></td>
              <td><span class="pin-active">${ICONS.pin}</span></td>
              <td><span class="trash-icon">${ICONS.trash}</span></td>
            </tr>
            <tr class="editing-row">
              <td><span class="nick-badge">g</span></td>
              <td>
                <div class="inline-edit-wrap">
                  <div class="inline-edit-input">Google Search (%s)<span class="cursor-bar" style="height:14px;"></span></div>
                  <div class="inline-tooltip">${escapeHtml(t.inlineTooltip)}</div>
                </div>
              </td>
              <td><span class="cell-url mono">${ICONS.search}<span>https://www.google.com/search?q=%s</span></span></td>
              <td><span class="pin-muted">${ICONS.pin}</span></td>
              <td><span class="trash-icon">${ICONS.trash}</span></td>
            </tr>
            <tr>
              <td><span class="nick-badge">work/docs</span></td>
              <td class="cell-title">Architecture Docs</td>
              <td><span class="cell-url mono">${ICONS.doc}<span>https://docs.example.com/architecture</span></span></td>
              <td><span class="pin-muted">${ICONS.pin}</span></td>
              <td><span class="trash-icon">${ICONS.trash}</span></td>
            </tr>
            <tr>
              <td><span class="nick-badge">aws/prod</span></td>
              <td class="cell-title">AWS Production Console</td>
              <td><span class="cell-url mono">${ICONS.cloud}<span>https://console.aws.amazon.com/</span></span></td>
              <td><span class="pin-muted">${ICONS.pin}</span></td>
              <td><span class="trash-icon">${ICONS.trash}</span></td>
            </tr>
            <tr>
              <td><span class="nick-badge">mdlink</span></td>
              <td class="cell-title">Copy Markdown Link</td>
              <td><span class="cell-url js-url mono">${ICONS.code}<span>javascript:navigator.clipboard.writeText(...)</span></span></td>
              <td><span class="pin-muted">${ICONS.pin}</span></td>
              <td><span class="trash-icon">${ICONS.trash}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="ranking-card">
        <div class="ranking-head">
          <span class="ranking-title">${escapeHtml(t.rankingTitle)}</span>
          <span style="color:#059669; display:flex;">${ICONS.trend}</span>
        </div>
        <div class="ranking-desc">${escapeHtml(t.rankingDesc)}</div>
        <div class="formula-badge mono">Score × 0.95^days + 1.0</div>
        <div class="ranking-list">
          <div class="rank-row pinned">
            <div class="rank-left">
              <span class="nick-badge">gh</span>
              <span>GitHub</span>
            </div>
            <span class="rank-score mono">${escapeHtml(t.pinnedLabel)} · 26.4</span>
          </div>
          <div class="rank-row">
            <div class="rank-left">
              <span class="nick-badge">g</span>
              <span>Google</span>
            </div>
            <span class="rank-score mono">21.0</span>
          </div>
          <div class="rank-row">
            <div class="rank-left">
              <span class="nick-badge">work/mail</span>
              <span>Webmail</span>
            </div>
            <span class="rank-score mono">18.7</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-pills">
      <div class="bottom-pill">${ICONS.pin}<span>${escapeHtml(t.bottomPill1)}</span></div>
      <div class="bottom-pill">${ICONS.filter}<span>${escapeHtml(t.bottomPill2)}</span></div>
      <div class="bottom-pill">${ICONS.cloud}<span>${escapeHtml(t.bottomPill3)}</span></div>
    </div>
  `;

  return wrapDocument({
    htmlLang: locale.htmlLang,
    fontFamily: locale.fontFamily,
    iconDataUri,
    extraCss,
    bodyHtml,
  });
}

/** スライド ID とレンダラー関数の対応表 */
const SLIDE_RENDERERS = {
  '01_launcher': renderSlide01,
  '02_quick_register': renderSlide02,
  '03_quick_launch': renderSlide03,
  '04_folders_bookmarklets': renderSlide04,
  '05_dashboard_ranking': renderSlide05,
};

module.exports = { SLIDE_RENDERERS };
