// ============================================================
// DIFUSED TIERS — 3D Minecraft skin rendering.
// Generates isometric 3D skin renders for embed display.
// ============================================================

const { createCanvas } = require("canvas");

const STEVE_UUID = "8667ba71b85a4004af54457a9734eed7";
const SKIN_SIZE = 64;
const CANVAS_SIZE = 128;

/**
 * Generates a 3D isometric view of a Minecraft skin.
 * Returns a Buffer (PNG) ready to attach to a Discord message.
 * @param {string} uuid - Player UUID (used to fetch their skin from Crafatar)
 * @param {boolean} cracked - If true, renders the default Steve skin
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function render3DSkin(uuid, cracked = false) {
  const skinUuid = cracked ? STEVE_UUID : uuid;
  const skinUrl = `https://crafatar.com/skins/${skinUuid}`;

  let skinImage;
  try {
    const res = await fetch(skinUrl);
    if (!res.ok) throw new Error(`Crafatar returned ${res.status}`);
    const buffer = await res.arrayBuffer();
    const canvas = createCanvas(SKIN_SIZE, SKIN_SIZE);
    const ctx = canvas.getContext("2d");
    const img = new (require("canvas").Image)();
    img.src = Buffer.from(buffer);
    ctx.drawImage(img, 0, 0);
    skinImage = canvas.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE);
  } catch (err) {
    console.error("Failed to fetch skin:", err);
    return null;
  }

  // Create isometric 3D render canvas
  const renderCanvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const renderCtx = renderCanvas.getContext("2d");

  // White background
  renderCtx.fillStyle = "#ffffff";
  renderCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw isometric cube faces with skin texture
  drawIsometricSkin(renderCtx, skinImage);

  return renderCanvas.toBuffer("image/png");
}

/**
 * Draws an isometric 3D skin on the canvas using the provided skin texture.
 */
function drawIsometricSkin(ctx, skinData) {
  const data = skinData.data;
  const scale = 2;
  const offsetX = 32;
  const offsetY = 16;

  // Helper: get pixel color from skin texture
  function getPixel(x, y) {
    const idx = (y * SKIN_SIZE + x) * 4;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3],
    };
  }

  // Draw front face (head)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const pixel = getPixel(x + 8, y);
      ctx.fillStyle = `rgba(${pixel.r},${pixel.g},${pixel.b},${pixel.a / 255})`;
      const canvasX = offsetX + x * scale;
      const canvasY = offsetY + y * scale;
      ctx.fillRect(canvasX, canvasY, scale, scale);
    }
  }

  // Draw right side (head side)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const pixel = getPixel(x, y);
      ctx.fillStyle = `rgba(${pixel.r},${pixel.g},${pixel.b},${pixel.a / 255})`;
      const canvasX = offsetX + 16 + x * scale;
      const canvasY = offsetY + y * scale - x * scale;
      ctx.fillRect(canvasX, canvasY, scale, scale);
    }
  }

  // Draw top (head top)
  for (let x = 0; x < 8; x++) {
    for (let z = 0; z < 4; z++) {
      const pixel = getPixel(x + 8, z);
      ctx.fillStyle = `rgba(${pixel.r},${pixel.g},${pixel.b},${pixel.a / 255})`;
      const canvasX = offsetX + x * scale - z * scale;
      const canvasY = offsetY - z * scale;
      ctx.fillRect(canvasX, canvasY, scale, scale);
    }
  }
}

module.exports = { render3DSkin };

