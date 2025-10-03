// Simple script to generate placeholder icons
const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const createSVGIcon = (size) => {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="#4F46E5"/>
  <g stroke="white" stroke-width="${Math.max(1, size/32)}" stroke-linecap="round" fill="none">
    <line x1="${size/2 - size/3}" y1="${size/2}" x2="${size/2 + size/3}" y2="${size/2}"/>
    <line x1="${size/2}" y1="${size/2 - size/3}" x2="${size/2}" y2="${size/2 + size/3}"/>
    <line x1="${size/2 - size/4}" y1="${size/2 - size/4}" x2="${size/2 + size/4}" y2="${size/2 + size/4}"/>
    <line x1="${size/2 + size/4}" y1="${size/2 - size/4}" x2="${size/2 - size/4}" y2="${size/2 + size/4}"/>
  </g>
  <circle cx="${size/2}" cy="${size/2}" r="${Math.max(2, size/16)}" fill="white"/>
</svg>`;
};

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
}

// Generate SVG icons for different sizes
const sizes = [16, 32, 48, 128];
sizes.forEach(size => {
    const svg = createSVGIcon(size);
    const filename = path.join(iconsDir, `icon${size}.svg`);
    fs.writeFileSync(filename, svg);
    console.log(`Generated ${filename}`);
});

console.log('Icons generated successfully!');
console.log('Note: Chrome extensions typically use PNG icons. You may want to convert these SVG files to PNG format.');
