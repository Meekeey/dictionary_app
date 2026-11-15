// make_icons.js
// Draws the app icons (PNG) for the PWA: a pixel anvil on a teal tile.
// Run:  node build/make_icons.js     (needs Playwright with Chromium)

const path = require("path");
const { chromium } = require("playwright");

const ICON_DIR = path.join(__dirname, "..", "app", "icons");

// The anvil, drawn as a grid ("#" = filled pixel).
const ANVIL = [
  "..###########",
  "###########..",
  ".#########...",
  "...######....",
  "....####.....",
  "....####.....",
  "...######....",
  "..########...",
  ".##########..",
  ".##########.."
];

// Builds an HTML page that shows the icon.
// "padding" is the empty space around the anvil, in grid pixels.
function iconPage(size, padding) {
  const columns = ANVIL[0].length + padding * 2;
  const rows = columns; // square
  const offsetY = Math.floor((rows - ANVIL.length) / 2);

  let rects = "";
  for (let y = 0; y < ANVIL.length; y++) {
    for (let x = 0; x < ANVIL[y].length; x++) {
      if (ANVIL[y][x] === "#") {
        rects = rects + '<rect x="' + (x + padding) + '" y="' + (y + offsetY) + '" width="1" height="1" fill="#fff4d2"/>';
        // a dark shadow one pixel below
        rects = rects + '<rect x="' + (x + padding) + '" y="' + (y + offsetY + 1) + '" width="1" height="1" fill="#17605d" opacity="0.55"/>';
      }
    }
  }
  // Draw the shadows first, then the light pixels on top.
  const shadows = rects.match(/<rect[^>]*opacity[^>]*>/g).join("");
  const lights = rects.match(/<rect[^>]*fill="#fff4d2"\/>/g).join("");

  return '<body style="margin:0">' +
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + columns + ' ' + rows + '" shape-rendering="crispEdges">' +
    '<rect width="100%" height="100%" fill="#2a968e"/>' +
    shadows + lights +
    "</svg></body>";
}

async function main() {
  const browser = await chromium.launch();
  const icons = [
    { file: "icon-192.png", size: 192, padding: 3 },
    { file: "icon-512.png", size: 512, padding: 3 },
    { file: "icon-maskable-512.png", size: 512, padding: 6 } // more space for round masks
  ];

  for (const icon of icons) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    await page.setContent(iconPage(icon.size, icon.padding));
    await page.screenshot({ path: path.join(ICON_DIR, icon.file) });
    await page.close();
    console.log("Made", icon.file);
  }
  await browser.close();
}

main();
