/**
 * 言語共通プロモーションタイル（小: 440×280 / マーキー: 1400×560）用の HTML/CSS テンプレート生成モジュール
 *
 * Chrome ウェブストアの仕様上、プロモーションタイルは全言語共通で表示されるため、
 * 文章を入れず、Nickmark のアイコン・ブランド名と極力シンプルなコマンドパレットの
 * ビジュアルのみで「検索してブックマークを瞬時に開く」体験を直感的に伝えます。
 */

'use strict';

/** プロモーションタイル用のサイズ定義 */
const PROMO_TILE_SIZES = {
  'promo-small': { width: 440, height: 280 },
  'promo-marquee': { width: 1400, height: 560 },
};

/** 言語非依存で使用するシンプルなインライン SVG アイコン群 */
const TILE_ICONS = {
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3a2 2 0 0 0-2 2v16l8-4.5L20 21V5a2 2 0 0 0-2-2H6z"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  returnKey: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>`,
};

/**
 * プロモーションタイル共通の HTML 枠組みを生成します。
 * 装飾ノイズを排したクリーンな不透明グラデーション背景をキャンバス端まで敷き詰めます。
 * @param {object} params
 * @param {number} params.width - キャンバス幅（px）
 * @param {number} params.height - キャンバス高さ（px）
 * @param {string} params.extraCss - タイル固有の CSS
 * @param {string} params.bodyHtml - タイル本文 HTML
 * @returns {string} 完全な HTML ドキュメント文字列
 */
function wrapTileDocument({ width, height, extraCss, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${width}, initial-scale=1.0" />
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    background: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .tile-canvas {
    position: relative;
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    background:
      radial-gradient(ellipse 75% 80% at 18% 12%, rgba(16, 185, 129, 0.16) 0%, rgba(16, 185, 129, 0.0) 70%),
      radial-gradient(ellipse 70% 75% at 88% 88%, rgba(59, 130, 246, 0.13) 0%, rgba(59, 130, 246, 0.0) 72%),
      linear-gradient(150deg, #ffffff 0%, #f1f7fd 55%, #ecfdf5 100%);
  }

  ${extraCss}
</style>
</head>
<body>
  <div class="tile-canvas">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

/**
 * プロモーションタイル（小: 440×280）の HTML を生成します。
 * 大きなアイコン＋「Nickmark」ロゴと、検索→ブックマーク起動を表すミニマルな白いパレット1点のみで構成します。
 * @param {string} iconDataUri - Nickmark アイコンの Data URI
 * @returns {string} HTML ドキュメント
 */
function renderSmallPromoTile(iconDataUri) {
  const { width, height } = PROMO_TILE_SIZES['promo-small'];
  const extraCss = `
    .small-wrap {
      width: 100%;
      height: 100%;
      padding: 28px 34px 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
    }

    .small-brand {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .small-brand-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.22);
      display: block;
    }

    .small-brand-name {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #0f172a;
      line-height: 1;
    }

    .small-palette {
      width: 372px;
      border-radius: 18px;
      background: #ffffff;
      border: 1.5px solid #d1fae5;
      box-shadow:
        0 18px 38px rgba(15, 23, 42, 0.11),
        0 4px 12px rgba(16, 185, 129, 0.08);
      overflow: hidden;
    }

    .small-search {
      height: 62px;
      padding: 0 16px 0 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 1.5px solid #f1f5f9;
    }

    .small-search-icon {
      width: 24px;
      height: 24px;
      color: #10b981;
      flex-shrink: 0;
    }

    .small-input-area {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .small-query-bar {
      width: 112px;
      height: 12px;
      border-radius: 999px;
      background: #0f172a;
    }

    .small-cursor {
      width: 3px;
      height: 24px;
      border-radius: 2px;
      background: #10b981;
    }

    .small-enter-btn {
      width: 44px;
      height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 6px 14px rgba(16, 185, 129, 0.28);
    }

    .small-enter-btn svg {
      width: 18px;
      height: 18px;
    }

    .small-result-wrap {
      padding: 12px;
    }

    .small-result-row {
      height: 54px;
      padding: 0 16px;
      border-radius: 12px;
      background: #ecfdf5;
      border: 2px solid #34d399;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .small-bookmark-icon {
      width: 24px;
      height: 24px;
      color: #059669;
      flex-shrink: 0;
    }

    .small-result-bar {
      width: 156px;
      height: 11px;
      border-radius: 999px;
      background: #065f46;
      margin-right: auto;
    }

    .small-arrow-icon {
      width: 22px;
      height: 22px;
      color: #10b981;
      flex-shrink: 0;
    }
  `;

  const bodyHtml = `
    <div class="small-wrap">
      <div class="small-brand">
        <img class="small-brand-icon" src="${iconDataUri}" alt="Nickmark" />
        <span class="small-brand-name">Nickmark</span>
      </div>

      <div class="small-palette">
        <div class="small-search">
          <span class="small-search-icon">${TILE_ICONS.search}</span>
          <div class="small-input-area">
            <span class="small-query-bar"></span>
            <span class="small-cursor"></span>
          </div>
          <span class="small-enter-btn">${TILE_ICONS.returnKey}</span>
        </div>

        <div class="small-result-wrap">
          <div class="small-result-row">
            <span class="small-bookmark-icon">${TILE_ICONS.bookmark}</span>
            <span class="small-result-bar"></span>
            <span class="small-arrow-icon">${TILE_ICONS.arrowRight}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return wrapTileDocument({ width, height, extraCss, bodyHtml });
}

/**
 * マーキー プロモーションタイル（1400×560）の HTML を生成します。
 * 左側に大きなアイコン＋「Nickmark」ロゴ、右側にミニマルな白いコマンドパレット1点のみを
 * たっぷりとした余白で配置します。
 * @param {string} iconDataUri - Nickmark アイコンの Data URI
 * @returns {string} HTML ドキュメント
 */
function renderMarqueePromoTile(iconDataUri) {
  const { width, height } = PROMO_TILE_SIZES['promo-marquee'];
  const extraCss = `
    .marquee-wrap {
      width: 100%;
      height: 100%;
      padding: 64px 96px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 72px;
    }

    /* 左カラム: アイコンと拡張機能名のみの潔いブランドロックアップ */
    .marquee-brand {
      display: flex;
      align-items: center;
      gap: 28px;
      flex-shrink: 0;
    }

    .marquee-brand-icon {
      width: 124px;
      height: 124px;
      border-radius: 30px;
      box-shadow:
        0 24px 48px rgba(15, 23, 42, 0.24),
        0 6px 16px rgba(16, 185, 129, 0.14);
      display: block;
      flex-shrink: 0;
    }

    .marquee-brand-text {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .marquee-brand-name {
      font-size: 76px;
      font-weight: 800;
      letter-spacing: -0.035em;
      color: #0f172a;
      line-height: 1;
    }

    .marquee-accent-line {
      width: 120px;
      height: 8px;
      border-radius: 999px;
      background: linear-gradient(90deg, #10b981 0%, #2563eb 100%);
    }

    /* 右カラム: シンプルな白いコマンドパレット1点 */
    .marquee-palette {
      width: 636px;
      border-radius: 28px;
      background: #ffffff;
      border: 2px solid #d1fae5;
      box-shadow:
        0 32px 68px rgba(15, 23, 42, 0.13),
        0 8px 24px rgba(16, 185, 129, 0.08);
      overflow: hidden;
      flex-shrink: 0;
    }

    .marquee-search {
      height: 102px;
      padding: 0 28px 0 32px;
      display: flex;
      align-items: center;
      gap: 22px;
      border-bottom: 2px solid #f1f5f9;
    }

    .marquee-search-icon {
      width: 36px;
      height: 36px;
      color: #10b981;
      flex-shrink: 0;
    }

    .marquee-input-area {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .marquee-query-bar {
      width: 210px;
      height: 18px;
      border-radius: 999px;
      background: #0f172a;
    }

    .marquee-cursor {
      width: 4px;
      height: 38px;
      border-radius: 3px;
      background: #10b981;
    }

    .marquee-enter-btn {
      width: 72px;
      height: 54px;
      border-radius: 16px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 10px 22px rgba(16, 185, 129, 0.30);
    }

    .marquee-enter-btn svg {
      width: 28px;
      height: 28px;
    }

    .marquee-rows {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .marquee-row {
      height: 92px;
      padding: 0 24px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      gap: 22px;
      border: 2.5px solid transparent;
    }

    .marquee-row.active {
      background: #ecfdf5;
      border-color: #34d399;
    }

    .marquee-row.subtle {
      background: #f8fafc;
      border-color: #e2e8f0;
    }

    .marquee-row-icon {
      width: 50px;
      height: 50px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .marquee-row-icon svg {
      width: 26px;
      height: 26px;
    }

    .marquee-row-icon.emerald {
      background: #d1fae5;
      color: #059669;
    }

    .marquee-row-icon.slate {
      background: #e2e8f0;
      color: #475569;
    }

    .marquee-row-bar {
      height: 16px;
      border-radius: 999px;
      margin-right: auto;
    }

    .marquee-row-bar.active {
      width: 270px;
      background: #065f46;
    }

    .marquee-row-bar.subtle {
      width: 210px;
      background: #94a3b8;
    }

    .marquee-row-arrow {
      width: 30px;
      height: 30px;
      color: #10b981;
      flex-shrink: 0;
    }
  `;

  const bodyHtml = `
    <div class="marquee-wrap">
      <div class="marquee-brand">
        <img class="marquee-brand-icon" src="${iconDataUri}" alt="Nickmark" />
        <div class="marquee-brand-text">
          <div class="marquee-brand-name">Nickmark</div>
          <div class="marquee-accent-line"></div>
        </div>
      </div>

      <div class="marquee-palette">
        <div class="marquee-search">
          <span class="marquee-search-icon">${TILE_ICONS.search}</span>
          <div class="marquee-input-area">
            <span class="marquee-query-bar"></span>
            <span class="marquee-cursor"></span>
          </div>
          <span class="marquee-enter-btn">${TILE_ICONS.returnKey}</span>
        </div>

        <div class="marquee-rows">
          <div class="marquee-row active">
            <span class="marquee-row-icon emerald">${TILE_ICONS.bookmark}</span>
            <span class="marquee-row-bar active"></span>
            <span class="marquee-row-arrow">${TILE_ICONS.arrowRight}</span>
          </div>

          <div class="marquee-row subtle">
            <span class="marquee-row-icon slate">${TILE_ICONS.folder}</span>
            <span class="marquee-row-bar subtle"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  return wrapTileDocument({ width, height, extraCss, bodyHtml });
}

/** プロモーションタイル ID と描画関数の対応表 */
const PROMO_TILE_RENDERERS = {
  'promo-small': {
    ...PROMO_TILE_SIZES['promo-small'],
    render: renderSmallPromoTile,
  },
  'promo-marquee': {
    ...PROMO_TILE_SIZES['promo-marquee'],
    render: renderMarqueePromoTile,
  },
};

module.exports = { PROMO_TILE_RENDERERS, PROMO_TILE_SIZES };
