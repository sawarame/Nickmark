const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, 'Nickmark', 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

const svg = `
<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="256" height="256" rx="48" fill="#2d2d2d" />
  
  <!-- Star -->
  <g transform="translate(100, 110) scale(0.9)">
    <polygon points="0,-90 28,-25 95,-25 40,15 60,85 0,40 -60,85 -40,15 -95,-25 -28,-25" fill="#b0b0b0" stroke="#e0e0e0" stroke-width="8" stroke-linejoin="round" />
  </g>

  <!-- Sticky Note -->
  <g transform="translate(125, 125) rotate(-8)">
    <!-- Drop Shadow -->
    <rect x="0" y="0" width="110" height="110" rx="6" fill="#000000" opacity="0.3" transform="translate(6, 8)" />
    <!-- Paper -->
    <rect x="0" y="0" width="110" height="110" rx="6" fill="#f5f5f5" />
    
    <!-- Nickname text lines -->
    <rect x="20" y="25" width="70" height="12" rx="6" fill="#a0a0a0" />
    <rect x="20" y="50" width="45" height="12" rx="6" fill="#a0a0a0" />
    
    <!-- Initials -->
    <text x="55" y="90" font-family="sans-serif" font-size="32" font-weight="900" fill="#777777" text-anchor="middle">nm</text>
  </g>
</svg>
`;

const sizes = [16, 48, 128];
Promise.all(sizes.map(size => 
  sharp(Buffer.from(svg))
    .resize(size, size)
    .toFile(path.join(iconDir, `icon${size}.png`))
)).then(() => console.log('Icons generated successfully'))
  .catch(err => console.error('Error generating icons:', err));
