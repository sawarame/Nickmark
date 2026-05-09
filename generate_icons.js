const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, 'Nickmark', 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

const svg = `
<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" rx="32" fill="#007bff" />
  <text x="128" y="150" font-family="sans-serif" font-size="120" font-weight="bold" fill="white" text-anchor="middle">N</text>
</svg>
`;

const sizes = [16, 48, 128];
Promise.all(sizes.map(size => 
  sharp(Buffer.from(svg))
    .resize(size, size)
    .toFile(path.join(iconDir, `icon${size}.png`))
)).then(() => console.log('Icons generated successfully'))
  .catch(err => console.error('Error generating icons:', err));
