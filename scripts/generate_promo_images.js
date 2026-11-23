#!/usr/bin/env node
/**
 * 多言語プロモーション画像（1280×800 PNG）自動生成スクリプト
 *
 * 使い方:
 *   node scripts/generate_promo_images.js                       # 中国語（簡体字・繁体字）・韓国語の計15枚を生成
 *   node scripts/generate_promo_images.js --langs=zh_CN,ko      # 指定した言語のみ生成
 *   node scripts/generate_promo_images.js --all                 # 全5言語（en, ja, zh_CN, zh_TW, ko）を生成
 *
 * 前提条件:
 *   ローカルに Google Chrome（または環境変数 CHROME_PATH で指定した実行ファイル）が存在すること。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PROMO_LOCALES } = require('./promo_locales');
const { SLIDE_RENDERERS } = require('./promo_templates');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'images');
const ICON_SVG_PATH = path.join(ROOT_DIR, 'icon.svg');
const DEFAULT_LANGS = ['zh_CN', 'zh_TW', 'ko'];
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;

/**
 * 利用可能な Google Chrome / Chromium の実行ファイルパスを検出します。
 * @returns {string} 実行ファイルの絶対パス
 */
function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Google Chrome が見つかりませんでした。環境変数 CHROME_PATH に実行ファイルパスを指定してください。'
  );
}

/**
 * コマンドライン引数から対象言語リストを決定します。
 * @param {string[]} argv - コマンドライン引数
 * @returns {string[]} 対象言語コード配列
 */
function parseTargetLangs(argv) {
  if (argv.includes('--all')) {
    return Object.keys(PROMO_LOCALES);
  }

  const langsArg = argv.find((arg) => arg.startsWith('--langs='));
  if (!langsArg) {
    return DEFAULT_LANGS;
  }

  const requested = langsArg
    .slice('--langs='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const lang of requested) {
    if (!PROMO_LOCALES[lang]) {
      throw new Error(
        `未対応の言語コードです: ${lang}（利用可能: ${Object.keys(PROMO_LOCALES).join(', ')}）`
      );
    }
  }

  return requested;
}

/**
 * HTML 文字列を Headless Chrome で 1280×800 の PNG に書き出します。
 * @param {object} params
 * @param {string} params.chromePath - Chrome 実行ファイルパス
 * @param {string} params.htmlPath - 入力 HTML ファイルパス
 * @param {string} params.outputPath - 出力 PNG ファイルパス
 */
function renderHtmlToPng({ chromePath, htmlPath, outputPath }) {
  const fileUrl = `file://${htmlPath}`;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${VIEWPORT_WIDTH},${VIEWPORT_HEIGHT}`,
    `--screenshot=${outputPath}`,
    fileUrl,
  ];

  execFileSync(chromePath, args, { stdio: 'pipe' });
}

/**
 * メイン処理：対象言語 × 全スライドの PNG 画像を順次生成します。
 */
function main() {
  const chromePath = findChromeExecutable();
  const targetLangs = parseTargetLangs(process.argv.slice(2));
  const slideIds = Object.keys(SLIDE_RENDERERS);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Nickmark アイコンを Base64 Data URI として読み込み、HTML へインライン埋め込みする
  const iconSvgRaw = fs.readFileSync(ICON_SVG_PATH, 'utf8');
  const iconDataUri = `data:image/svg+xml;base64,${Buffer.from(iconSvgRaw, 'utf8').toString('base64')}`;

  // 一時 HTML 用のディレクトリを作成（処理完了後に必ず削除）
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nickmark-promo-'));

  try {
    let generatedCount = 0;
    for (const lang of targetLangs) {
      const locale = PROMO_LOCALES[lang];
      for (const slideId of slideIds) {
        const renderer = SLIDE_RENDERERS[slideId];
        const html = renderer(locale, iconDataUri);
        const htmlPath = path.join(tempDir, `promo_${lang}_${slideId}.html`);
        const outputPath = path.join(OUTPUT_DIR, `promo_${lang}_${slideId}.png`);

        fs.writeFileSync(htmlPath, html, 'utf8');
        renderHtmlToPng({ chromePath, htmlPath, outputPath });

        generatedCount += 1;
        console.log(`[${generatedCount}/${targetLangs.length * slideIds.length}] 生成完了: images/promo_${lang}_${slideId}.png`);
      }
    }

    console.log(`\n全 ${generatedCount} 枚のプロモーション画像を生成しました。`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error('プロモーション画像の生成に失敗しました:', error.message);
  process.exit(1);
}
