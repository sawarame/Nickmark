const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 変換元のSVGファイルと出力先ディレクトリのパス設定
const svgPath = path.join(__dirname, 'icon.svg');
const iconDir = path.join(__dirname, 'package', 'icons');
const sizes = [16, 48, 128];

/**
 * 指定されたSVGファイルから複数サイズのPNGアイコン画像を生成する関数
 * @param {string} inputSvgPath - 変換元となるSVGファイルのパス
 * @param {string} outputDir - 生成したアイコン画像の出力先ディレクトリパス
 * @param {number[]} iconSizes - 生成するアイコンサイズ（ピクセル）の配列
 * @returns {Promise<void>} アイコン生成処理の完了を表すPromise
 */
async function generateIcons(inputSvgPath, outputDir, iconSizes) {
  try {
    // 出力先ディレクトリが存在しない場合は作成する
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // SVGファイルを読み込む
    const svgBuffer = await fs.promises.readFile(inputSvgPath);

    // 各サイズにリサイズしてPNGファイルとして出力する
    const tasks = [];
    for (const size of iconSizes) {
      const outputPath = path.join(outputDir, `icon${size}.png`);
      tasks.push(sharp(svgBuffer).resize(size, size).toFile(outputPath));
    }
    await Promise.all(tasks);

    console.log('Icons generated successfully');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exitCode = 1;
  }
}

generateIcons(svgPath, iconDir, sizes);
