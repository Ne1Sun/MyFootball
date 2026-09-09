import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function sRgbChannelToLinear(c) {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getRelativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  const r = sRgbChannelToLinear(rgb.r);
  const g = sRgbChannelToLinear(rgb.g);
  const b = sRgbChannelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getCieLabLightness(y) {
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

function getContrastRatio(hex1, hex2) {
  const y1 = getRelativeLuminance(hex1);
  const y2 = getRelativeLuminance(hex2);
  const lighter = Math.max(y1, y2);
  const darker = Math.min(y1, y2);
  return (lighter + 0.05) / (darker + 0.05);
}

test("Theme Contrast Invariant: globals.css has no duplicate :root or dark blocks", () => {
  const globalsPath = path.resolve(process.cwd(), "app/globals.css");
  const content = fs.readFileSync(globalsPath, "utf-8");

  const rootMatches = content.match(/:root\s*\{/g);
  assert.equal(rootMatches ? rootMatches.length : 0, 1, "There must be exactly ONE canonical :root block");

  const darkMatches = content.match(/html\[data-theme="dark"\]\s*\{/g);
  assert.equal(darkMatches ? darkMatches.length : 0, 1, "There must be exactly ONE canonical html[data-theme='dark'] variable block");
});

test("Theme Ergonomics: Light mode canvas eliminates whiteout glare while ensuring card emergence", () => {
  const paperHex = "#f1f4f9";
  const cardHex = "#ffffff";
  const inkHex = "#0f172a";
  const mutedHex = "#475569";
  const saffronHex = "#b95000";

  const paperY = getRelativeLuminance(paperHex);
  const cardY = getRelativeLuminance(cardHex);
  assert.ok(paperY < 0.95, "Paper luminance must be < 95% to eliminate 100% white glare");
  assert.ok(cardY - paperY >= 0.05, "Card must have distinct optical emergence above paper");

  const inkOnCard = getContrastRatio(inkHex, cardHex);
  assert.ok(inkOnCard >= 7.0, `Ink on card (${inkOnCard.toFixed(2)}:1) must satisfy WCAG AAA (>= 7:1)`);

  const mutedOnCard = getContrastRatio(mutedHex, cardHex);
  assert.ok(mutedOnCard >= 4.5, `Muted text on card (${mutedOnCard.toFixed(2)}:1) must satisfy WCAG AA (>= 4.5:1)`);

  const saffronOnWhite = getContrastRatio(saffronHex, cardHex);
  assert.ok(saffronOnWhite >= 4.5, `Saffron accent on white (${saffronOnWhite.toFixed(2)}:1) must satisfy WCAG AA (>= 4.5:1)`);
});

test("Theme Ergonomics: Dark mode eliminates OLED black-crush and astigmatic halation", () => {
  const paperHex = "#0f141c";
  const cardHex = "#18202c";
  const inkHex = "#f1f5f9";
  const mutedHex = "#94a3b8";
  const saffronHex = "#f59e0b";

  const paperY = getRelativeLuminance(paperHex);
  const cardY = getRelativeLuminance(cardHex);
  assert.ok(paperY >= 0.006, "Paper luminance must be >= 0.6% to eliminate OLED pixel shutdown & black smearing");
  assert.ok(cardY > paperY, "Card must be physically elevated above canvas");

  const paperL = getCieLabLightness(paperY);
  const cardL = getCieLabLightness(cardY);
  const deltaL = cardL - paperL;
  assert.ok(deltaL >= 5.0, `Card must have distinct physical elevation delta (Delta L* = ${deltaL.toFixed(2)}% >= 5%)`);

  const inkOnCard = getContrastRatio(inkHex, cardHex);
  assert.ok(inkOnCard >= 7.0, `Ink on card (${inkOnCard.toFixed(2)}:1) must satisfy WCAG AAA`);
  assert.ok(inkOnCard <= 16.5, `Ink on card (${inkOnCard.toFixed(2)}:1) must stay <= 16.5:1 to eliminate astigmatic halation`);

  const mutedOnCard = getContrastRatio(mutedHex, cardHex);
  assert.ok(mutedOnCard >= 4.5, `Muted text on card (${mutedOnCard.toFixed(2)}:1) must satisfy WCAG AA`);

  const saffronOnCard = getContrastRatio(saffronHex, cardHex);
  assert.ok(saffronOnCard >= 7.0, `Saffron accent on dark card (${saffronOnCard.toFixed(2)}:1) must satisfy WCAG AAA`);
});
