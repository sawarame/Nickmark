#!/usr/bin/env node
/**
 * Chrome ウェブストア用 多言語プロモーション画像自動生成スクリプト
 *
 * 使い方:
 *   node scripts/generate_promo_images.js                            # package/_locales/ の全対応言語を 1280x800 PNG で生成
 *   node scripts/generate_promo_images.js --lang=ja,en               # 指定した言語のみ生成（--langs= も互換サポート）
 *   node scripts/generate_promo_images.js --size=640x400             # 640x400 サイズで生成（デフォルト: 1280x800）
 *   node scripts/generate_promo_images.js --format=jpg               # JPEG 形式で生成（デフォルト: 透過なし 24-bit PNG）
 *   node scripts/generate_promo_images.js --all                      # 全対応言語を生成（後方互換オプション）
 *
 * 前提条件:
 *   - ローカルに Google Chrome（または環境変数 CHROME_PATH で指定した実行ファイル）が存在すること。
 *   - devDependencies の sharp がインストールされていること（24-bit RGB PNG 変換に使用）。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const { PROMO_LOCALES } = require('./promo_locales');
const { SLIDE_RENDERERS } = require('./promo_templates');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'images');
const LOCALES_DIR = path.join(ROOT_DIR, 'package', '_locales');
const ICON_SVG_PATH = path.join(ROOT_DIR, 'icon.svg');

/** サポートする出力サイズ定義 */
const SUPPORTED_SIZES = {
  '1280x800': { width: 1280, height: 800, scale: 1 },
  '640x400': { width: 640, height: 400, scale: 0.5 },
};

/** 透過除去時のフォールバック背景色（スライドのベース背景色と統一） */
const FLATTEN_BG = '#f8fafc';

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
 * package/_locales/ ディレクトリから有効な対応言語コードを自動検出します。
 * messages.json を含み、かつ PROMO_LOCALES に定義がある言語を返します。
 * @returns {string[]} 検出された言語コード配列
 */
function detectProjectLocales() {
  if (!fs.existsSync(LOCALES_DIR)) {
    return ['en', 'ja'];
  }

  const entries = fs.readdirSync(LOCALES_DIR, { withFileTypes: true });
  const detected = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((dirName) => fs.existsSync(path.join(LOCALES_DIR, dirName, 'messages.json')))
    .filter((dirName) => Boolean(PROMO_LOCALES[dirName]))
    .sort();

  return detected.length > 0 ? detected : ['en', 'ja'];
}

/**
 * 入力された言語コード表記（例: zh-CN / zh_CN）を PROMO_LOCALES のキーへ正規化します。
 * @param {string} rawCode - コマンドライン引数で指定された言語コード
 * @returns {string} PROMO_LOCALES 上のキー
 */
function normalizeLangKey(rawCode) {
  if (PROMO_LOCALES[rawCode]) {
    return rawCode;
  }
  const underscored = rawCode.replace(/-/g, '_');
  if (PROMO_LOCALES[underscored]) {
    return underscored;
  }
  throw new Error(
    `未対応の言語コードです: ${rawCode}（利用可能: ${Object.keys(PROMO_LOCALES).join(', ')}）`
  );
}

/**
 * コマンドライン引数を解析し、生成オプションを返します。
 * @param {string[]} argv - コマンドライン引数配列
 * @returns {{ targetLangs: string[], sizeKey: string, width: number, height: number, scale: number, format: 'png' | 'jpg' }}
 */
function parseCliOptions(argv) {
  // 対象言語の決定（--lang= / --langs= 優先、未指定時は package/_locales/ 自動判定）
  const langsArg = argv.find((arg) => arg.startsWith('--lang=') || arg.startsWith('--langs='));
  let targetLangs;
  if (argv.includes('--all') || !langsArg) {
    targetLangs = detectProjectLocales();
  } else {
    const rawValue = langsArg.slice(langsArg.indexOf('=') + 1);
    targetLangs = rawValue
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalizeLangKey);
  }

  // 出力サイズの決定（デフォルト: 1280x800）
  const sizeArg = argv.find((arg) => arg.startsWith('--size='));
  const sizeKey = sizeArg ? sizeArg.slice('--size='.length).trim() : '1280x800';
  const sizeConfig = SUPPORTED_SIZES[sizeKey];
  if (!sizeConfig) {
    throw new Error(
      `未対応のサイズ指定です: ${sizeKey}（利用可能: ${Object.keys(SUPPORTED_SIZES).join(', ')}）`
    );
  }

  // 出力形式の決定（デフォルト: png）
  const formatArg = argv.find((arg) => arg.startsWith('--format='));
  const format = formatArg ? formatArg.slice('--format='.length).trim().toLowerCase() : 'png';
  if (format !== 'png' && format !== 'jpg') {
    throw new Error(`未対応の出力形式です: ${format}（利用可能: png, jpg）`);
  }

  return {
    targetLangs,
    sizeKey,
    width: sizeConfig.width,
    height: sizeConfig.height,
    scale: sizeConfig.scale,
    format,
  };
}

/**
 * HTML ファイルを Headless Chrome で撮影し、sharp で確実に透過なし 24-bit PNG（または JPEG）へ書き出します。
 * @param {object} params
 * @param {string} params.chromePath - Chrome 実行ファイルパス
 * @param {string} params.htmlPath - 入力 HTML ファイルパス
 * @param {string} params.rawPngPath - Chrome 撮影用の一時 PNG パス
 * @param {string} params.outputPath - 最終出力ファイルパス
 * @param {number} params.width - 出力幅（px）
 * @param {number} params.height - 出力高さ（px）
 * @param {'png' | 'jpg'} params.format - 出力画像形式
 * @returns {Promise<void>}
 */
async function renderHtmlToImage({
  chromePath,
  htmlPath,
  rawPngPath,
  outputPath,
  width,
  height,
  format,
}) {
  const fileUrl = `file://${htmlPath}`;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--screenshot=${rawPngPath}`,
    fileUrl,
  ];

  execFileSync(chromePath, args, { stdio: 'pipe' });

  // Chrome の出力からアルファチャンネルを確実に除去し、指定サイズと完全一致させて書き出す
  const pipeline = sharp(rawPngPath)
    .resize(width, height, { fit: 'cover' })
    .flatten({ background: FLATTEN_BG })
    .removeAlpha();

  if (format === 'jpg') {
    await pipeline.jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(outputPath);
  } else {
    await pipeline.png({ compressionLevel: 9, palette: false }).toFile(outputPath);
  }
}

/**
 * メイン処理：対象言語 × 全スライドのプロモーション画像を順次生成します。
 * @returns {Promise<void>}
 */
async function main() {
  const chromePath = findChromeExecutable();
  const options = parseCliOptions(process.argv.slice(2));
  const slideIds = Object.keys(SLIDE_RENDERERS);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Nickmark アイコンを Base64 Data URI として読み込み、外部通信なしで HTML へ埋め込む
  const iconSvgRaw = fs.readFileSync(ICON_SVG_PATH, 'utf8');
  const iconDataUri = `data:image/svg+xml;base64,${Buffer.from(iconSvgRaw, 'utf8').toString('base64')}`;

  // 一時 HTML および中間 PNG 用のディレクトリを作成（処理完了後に必ず削除）
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nickmark-promo-'));

  console.log(
    `対象言語: ${options.targetLangs.join(', ')} / サイズ: ${options.sizeKey} / 形式: ${options.format.toUpperCase()}`
  );

  try {
    const total = options.targetLangs.length * slideIds.length;
    let generatedCount = 0;

    for (const lang of options.targetLangs) {
      const locale = PROMO_LOCALES[lang];
      for (const slideId of slideIds) {
        const renderer = SLIDE_RENDERERS[slideId];
        const html = renderer(locale, iconDataUri, {
          width: options.width,
          height: options.height,
          scale: options.scale,
        });
        const baseName = `promo_${lang}_${slideId}`;
        const htmlPath = path.join(tempDir, `${baseName}.html`);
        const rawPngPath = path.join(tempDir, `${baseName}_raw.png`);
        const outputFileName = `${baseName}.${options.format}`;
        const outputPath = path.join(OUTPUT_DIR, outputFileName);

        fs.writeFileSync(htmlPath, html, 'utf8');
        await renderHtmlToImage({
          chromePath,
          htmlPath,
          rawPngPath,
          outputPath,
          width: options.width,
          height: options.height,
          format: options.format,
        });

        generatedCount += 1;
        console.log(`[${generatedCount}/${total}] 生成完了: images/${outputFileName}`);
      }
    }

    console.log(`\n全 ${generatedCount} 枚のプロモーション画像を生成しました。`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('プロモーション画像の生成に失敗しました:', error.message);
  process.exit(1);
});
