#!/usr/bin/env node
// Gives every image of public/assets but the map a transparent background,
// so it sits on whatever surface shows it (tooltip, grid, map, a stream over
// footage) instead of in a black square, and draws every sprite at full
// opacity, so the app's one greyed style dims them all alike.
//
//   node scripts/transparent-icons.mjs [--check]
//
// Each image is rebuilt from what it shows, so running the script again
// changes nothing:
//
// - An item icon cut from a black backdrop (a 16 px sprite stored at 4x,
//   with a black edge against transparency) is read back onto black, as it
//   was drawn, and cut again on the sprite's own pixel grid: the backdrop is
//   the black flooded in from the border, and the backdrop pixels around the
//   sprite, diagonals included, become its 1-game-pixel black outline, the
//   one the sprites have in the game. A gap of one or two game pixels between
//   two parts of the sprite (inside the bow, between its string and its limb)
//   stays open: an outline there would close it.
// - A sprite listed in ADD_OUTLINE gets the same outline on its own pixel
//   grid, although it never had one.
// - Any other image loses the near-black region flooded in from its corners:
//   a backdrop is a rectangle behind the sprite, so it holds the corners. The
//   pixels of it touching a coloured one stay, as a 1 px black outline. Black
//   inside the sprite is never touched, nor black that reaches the border
//   between transparent corners: the disc behind a reward glyph, the dark
//   panes of Kholdstare's shell.
// - A sprite or badge drawn at one partial opacity throughout (the chest
//   counts, the missing sword and shield) is made opaque.
//
// Decoding and encoding go through Chromium's canvas (the Playwright browser
// already installed for the e2e suite), so no image library is needed.
//
// --check only reports which files processing would change, and exits 1 if
// any.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/assets",
);

// Every image but the map, which is a scene, not a sprite on a backdrop
const ICONS = readdirSync(ASSETS)
  .filter((file) => file.endsWith(".png") && file !== "map.png")
  .map((file) => file.slice(0, -".png".length))
  .sort();

// The digit of bottle1-4 breaks the bottle's outline, so a flood from the
// border would leak into the bottle. The empty bottle has the same outline:
// its backdrop bounds the flood instead.
const BOUNDED_BY = {
  bottle1: "bottle0",
  bottle2: "bottle0",
  bottle3: "bottle0",
  bottle4: "bottle0",
};

// Opt-in: sprites drawn on transparency, so nothing was ever cut from them,
// that get the same 1-game-pixel black outline as the item icons although
// their art never had one: the keysanity keys, gold on gold-ish grass, read
// poorly on a bright stream without it, and the dungeon map and compass
// (the game's 16 px sprites at 4x, as hutchch/ALTTPR-Tracker ships them:
// items/map1.png and items/compass1.png at 55a838e). Their darkest pixels
// are dark grey, never near-black, so the outline is told apart from the
// sprite and a second run draws the same one. Where a sprite touches its
// 16 px frame (the map's scroll ends), the frame clips the outline.
const ADD_OUTLINE = ["bigkey", "compass", "dungeonmap", "smallkey"];

const check = process.argv.includes("--check");

/** A PNG of the assets folder as a data URL. */
const dataUrlOf = (name) =>
  `data:image/png;base64,${readFileSync(join(ASSETS, `${name}.png`)).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const results = [];
for (const name of ICONS) {
  const file = join(ASSETS, `${name}.png`);
  const bound = BOUNDED_BY[name] ? dataUrlOf(BOUNDED_BY[name]) : null;

  const { changed, png } = await page.evaluate(
    async ([dataUrl, boundUrl, addOutline]) => {
      const pixelsOf = async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return {
          canvas,
          context,
          pixels: context.getImageData(0, 0, image.width, image.height),
        };
      };
      const { canvas, context, pixels } = await pixelsOf(dataUrl);
      const { data, width, height } = pixels;
      const input = data.slice();

      const alpha = (d, i) => d[i * 4 + 3];
      const isOpaqueBlack = (d, i) =>
        alpha(d, i) > 240 &&
        d[i * 4] < 16 &&
        d[i * 4 + 1] < 16 &&
        d[i * 4 + 2] < 16;
      // Read onto black, as the icon was drawn before it was cut out
      const isBlack = (d, i) => alpha(d, i) === 0 || isOpaqueBlack(d, i);
      const neighbours8 = (x, y, w, h) => {
        const list = [];
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) {
              list.push(ny * w + nx);
            }
          }
        return list;
      };
      // A game pixel off the sprite, in a run of at most two between the
      // sprite on both sides along its row or its column, lies in a narrow
      // gap, which an outline would close. Not along a diagonal: that is an
      // inner corner, which the outline fills.
      const inNarrowGap = (isSprite, x, y) =>
        [
          [1, 0],
          [0, 1],
        ].some(([dx, dy]) => {
          const reach = (sign) => {
            for (let step = 1; step <= 2; step++) {
              if (isSprite(x + sign * step * dx, y + sign * step * dy)) {
                return step - 1;
              }
            }
            return Number.POSITIVE_INFINITY;
          };
          return reach(1) + reach(-1) + 1 <= 2;
        });

      // ---- An item icon cut from a black backdrop: a 16 px sprite at 4x ----
      const GRID = 16;
      const SCALE = width / GRID;
      const isSprite4x = (d) => {
        if (width !== 64 || height !== 64) return false;
        for (let by = 0; by < GRID; by++)
          for (let bx = 0; bx < GRID; bx++) {
            const first = by * SCALE * width + bx * SCALE;
            for (let y = 0; y < SCALE; y++)
              for (let x = 0; x < SCALE; x++) {
                const i = (by * SCALE + y) * width + bx * SCALE + x;
                const same = isBlack(d, first)
                  ? isBlack(d, i)
                  : [0, 1, 2, 3].every(
                      (c) => d[i * 4 + c] === d[first * 4 + c],
                    );
                if (!same) return false;
              }
          }
        return true;
      };
      const hasCutEdge = (d) => {
        for (let i = 0; i < width * height; i++) {
          if (!isOpaqueBlack(d, i)) continue;
          const x = i % width;
          const y = (i - x) / width;
          if (neighbours8(x, y, width, height).some((n) => alpha(d, n) === 0)) {
            return true;
          }
        }
        return false;
      };
      /** The game pixels of the black backdrop, flooded in from the border. */
      const backdropOf = (d, allowed) => {
        const black = (b) =>
          isBlack(d, Math.floor(b / GRID) * SCALE * width + (b % GRID) * SCALE);
        const inBackdrop = new Uint8Array(GRID * GRID);
        const stack = [];
        for (let i = 0; i < GRID; i++) {
          stack.push(i, (GRID - 1) * GRID + i, i * GRID, i * GRID + GRID - 1);
        }
        while (stack.length > 0) {
          const b = stack.pop();
          if (inBackdrop[b] || !black(b) || (allowed && !allowed[b])) continue;
          inBackdrop[b] = 1;
          const x = b % GRID;
          const y = (b - x) / GRID;
          if (x > 0) stack.push(b - 1);
          if (x < GRID - 1) stack.push(b + 1);
          if (y > 0) stack.push(b - GRID);
          if (y < GRID - 1) stack.push(b + GRID);
        }
        return inBackdrop;
      };

      if (addOutline) {
        // ---- A sprite given an outline it never had (ADD_OUTLINE) ----
        // Its colour, or nothing for transparency and black: the outline a
        // previous run drew is not the sprite
        const colourOf = (i) =>
          alpha(data, i) === 0 || isOpaqueBlack(data, i)
            ? ""
            : data.slice(i * 4, i * 4 + 4).join();
        // Its own pixel grid: the largest scale, at some offset, on which
        // every block is one colour
        const uniformAt = (scale, ox, oy) => {
          const first = new Map();
          for (let i = 0; i < width * height; i++) {
            const x = i % width;
            const y = (i - x) / width;
            const cell = `${Math.floor((x - ox) / scale)},${Math.floor((y - oy) / scale)}`;
            if (!first.has(cell)) first.set(cell, colourOf(i));
            else if (first.get(cell) !== colourOf(i)) return false;
          }
          return true;
        };
        const findGrid = () => {
          for (const scale of [4, 2]) {
            for (let oy = 0; oy < scale; oy++)
              for (let ox = 0; ox < scale; ox++) {
                if (uniformAt(scale, ox, oy)) return { ox, oy, scale };
              }
          }
          return { ox: 0, oy: 0, scale: 1 };
        };
        const { ox, oy, scale } = findGrid();
        const cellOf = (x, y) => [
          Math.floor((x - ox) / scale),
          Math.floor((y - oy) / scale),
        ];
        const cells = new Set();
        for (let i = 0; i < width * height; i++) {
          const x = i % width;
          if (colourOf(i)) cells.add(cellOf(x, (i - x) / width).join());
        }
        const sprite = (gx, gy) => cells.has(`${gx},${gy}`);
        for (let i = 0; i < width * height; i++) {
          if (colourOf(i)) continue; // the sprite stays as drawn
          const x = i % width;
          const [gx, gy] = cellOf(x, (i - x) / width);
          let touches = false;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if ((dx || dy) && sprite(gx + dx, gy + dy)) touches = true;
            }
          const outline = touches && !inNarrowGap(sprite, gx, gy);
          data[i * 4] = 0;
          data[i * 4 + 1] = 0;
          data[i * 4 + 2] = 0;
          data[i * 4 + 3] = outline ? 255 : 0;
        }
      } else if (isSprite4x(data) && hasCutEdge(data)) {
        const bounding = boundUrl
          ? backdropOf((await pixelsOf(boundUrl)).pixels.data)
          : null;
        const backdrop = backdropOf(data, bounding);
        const sprite = (x, y) =>
          x >= 0 && y >= 0 && x < GRID && y < GRID && !backdrop[y * GRID + x];
        const touchesSprite = (x, y) =>
          neighbours8(x, y, GRID, GRID).some((n) => !backdrop[n]);

        for (let by = 0; by < GRID; by++)
          for (let bx = 0; bx < GRID; bx++) {
            if (!backdrop[by * GRID + bx]) continue; // the sprite stays as drawn
            const outline =
              touchesSprite(bx, by) && !inNarrowGap(sprite, bx, by);
            for (let y = 0; y < SCALE; y++)
              for (let x = 0; x < SCALE; x++) {
                const px = bx * SCALE + x;
                const py = by * SCALE + y;
                const i = py * width + px;
                // In a gap, a 1 px ring against the sprite, as the cut left it
                const ring =
                  !outline &&
                  neighbours8(px, py, width, height).some((n) => {
                    const nx = n % width;
                    const ny = (n - nx) / width;
                    return !backdrop[
                      Math.floor(ny / SCALE) * GRID + Math.floor(nx / SCALE)
                    ];
                  });
                const black = outline || ring;
                data[i * 4] = 0;
                data[i * 4 + 1] = 0;
                data[i * 4 + 2] = 0;
                data[i * 4 + 3] = black ? 255 : 0;
              }
          }
      } else {
        // ---- Any other image: clear the backdrop flooded from the corners ----
        const inBackdrop = new Uint8Array(width * height);
        const stack = [0, width - 1, (height - 1) * width, height * width - 1];
        while (stack.length > 0) {
          const i = stack.pop();
          if (inBackdrop[i] || !isOpaqueBlack(data, i)) continue;
          inBackdrop[i] = 1;
          const x = i % width;
          const y = (i - x) / width;
          if (x > 0) stack.push(i - 1);
          if (x < width - 1) stack.push(i + 1);
          if (y > 0) stack.push(i - width);
          if (y < height - 1) stack.push(i + width);
        }
        for (let i = 0; i < width * height; i++) {
          if (!inBackdrop[i]) continue;
          const x = i % width;
          const y = (i - x) / width;
          const touchesSprite = neighbours8(x, y, width, height).some(
            (n) => !inBackdrop[n] && alpha(data, n) > 16,
          );
          if (!touchesSprite) data[i * 4 + 3] = 0;
        }
      }

      // ---- One partial opacity throughout: made opaque ----
      const partial = new Set();
      for (let i = 0; i < width * height; i++) {
        if (alpha(data, i) > 0) partial.add(alpha(data, i));
      }
      const [only] = partial;
      if (partial.size === 1 && only < 255) {
        for (let i = 0; i < width * height; i++) {
          if (alpha(data, i) > 0) data[i * 4 + 3] = 255;
        }
      }

      let changed = 0;
      for (let i = 0; i < data.length; i += 4) {
        // A transparent pixel's colour is not drawn: never a change
        if (data[i + 3] === 0 && input[i + 3] === 0) continue;
        if ([0, 1, 2, 3].some((c) => data[i + c] !== input[i + c])) changed++;
      }
      context.putImageData(pixels, 0, 0);
      return { changed, png: canvas.toDataURL("image/png") };
    },
    [dataUrlOf(name), bound, ADD_OUTLINE.includes(name)],
  );

  results.push({ changed, name });
  if (!check && changed > 0) {
    writeFileSync(file, Buffer.from(png.split(",")[1], "base64"));
  }
}

await browser.close();

const remaining = results.filter((result) => result.changed > 0);
for (const { name, changed } of remaining) {
  console.log(
    `${check ? "would change" : "changed"} ${name}.png: ${changed} px`,
  );
}
if (check && remaining.length > 0) process.exit(1);
console.log(
  `${results.length} images ${check ? "checked" : "processed"}, ${remaining.length} ${check ? "to change" : "changed"}`,
);
