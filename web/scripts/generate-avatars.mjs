import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, "public", "avatars");
fs.mkdirSync(output, { recursive: true });

const palettes = [
  ["#c96a4e", "#9a4431", "#fbeadf"],
  ["#d2a04b", "#9f7028", "#fff3d6"],
  ["#5da58f", "#397966", "#e8fbf3"],
  ["#6f95c7", "#466a9c", "#eef5ff"],
  ["#a37bbd", "#75509a", "#f8efff"],
  ["#cd7692", "#a14967", "#ffeff5"],
  ["#94a95f", "#687c3b", "#f6fbe7"],
  ["#7c8b96", "#525f69", "#f2f6f8"],
];

const patterns = [
  (ink) => `
    <circle cx="48" cy="48" r="26" fill="none" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="48" cy="48" r="16" fill="none" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="48" cy="48" r="5" fill="${ink}"/>`,
  (ink) => `
    <g stroke="${ink}" stroke-width="5" stroke-linecap="round">
      <path d="M24 30 L70 30"/><path d="M18 46 L76 46"/><path d="M24 62 L70 62"/>
    </g>
    <circle cx="72" cy="76" r="4" fill="${ink}"/>`,
  (ink) => `
    <g fill="${ink}">
      ${[0, 1, 2].flatMap((row) => [0, 1, 2].map((col) =>
        `<circle cx="${31 + col * 17}" cy="${31 + row * 17}" r="${row === 1 && col === 1 ? 4.5 : 3}"/>`,
      )).join("")}
    </g>`,
  (ink) => `
    <circle cx="48" cy="48" r="23" fill="none" stroke="${ink}" stroke-width="2.5"/>
    <ellipse cx="48" cy="48" rx="35" ry="13" fill="none" stroke="${ink}" stroke-width="2.2" transform="rotate(-30 48 48)"/>
    <circle cx="76" cy="27" r="5" fill="${ink}"/>`,
  (ink) => `
    <g fill="none" stroke="${ink}" stroke-linecap="round">
      <path d="M27 72 A30 30 0 0 1 27 24" stroke-width="5"/>
      <path d="M39 62 A18 18 0 0 1 39 34" stroke-width="3.5"/>
      <path d="M50 55 A10 10 0 0 1 50 41" stroke-width="2.5"/>
    </g>
    <circle cx="70" cy="47" r="5" fill="${ink}"/>`,
  (ink) => `
    <g fill="${ink}">
      <rect x="22" y="40" width="10" height="34" rx="5"/>
      <rect x="36" y="28" width="10" height="46" rx="5"/>
      <rect x="50" y="46" width="10" height="28" rx="5"/>
      <rect x="64" y="22" width="10" height="52" rx="5" opacity="0.6"/>
    </g>`,
  (ink) => `
    <path d="M48 22 L76 70 L20 70 Z" fill="none" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="48" cy="53" r="7" fill="${ink}"/>`,
  (ink) => `
    <g fill="none" stroke="${ink}" stroke-width="3.5">
      <path d="M34 38 A14 14 0 0 1 62 38"/>
      <path d="M30 50 A22 22 0 0 0 66 50"/>
      <path d="M62 58 A14 14 0 0 1 34 58"/>
      <path d="M66 70 A22 22 0 0 0 30 70"/>
    </g>`,
  (ink) => `
    <g fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round">
      <path d="M18 38 C30 24, 42 52, 54 38 S78 24, 80 38"/>
      <path d="M18 56 C30 42, 42 70, 54 56 S78 42, 80 56"/>
    </g>
    <circle cx="48" cy="73" r="3" fill="${ink}"/>`,
  (ink) => `
    <path d="M48 24 V72 M24 48 H72" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>
    <g fill="${ink}" opacity="0.75">
      <circle cx="26" cy="26" r="2.3"/><circle cx="70" cy="26" r="2.3"/>
      <circle cx="26" cy="70" r="2.3"/><circle cx="70" cy="70" r="2.3"/>
    </g>`,
  (ink) => `
    <g fill="${ink}">
      <rect x="24" y="24" width="22" height="22" rx="5"/>
      <rect x="50" y="24" width="10" height="10" rx="3" opacity="0.55"/>
      <rect x="50" y="38" width="22" height="22" rx="5"/>
      <rect x="24" y="50" width="10" height="10" rx="3" opacity="0.55"/>
      <rect x="38" y="50" width="10" height="22" rx="3" opacity="0.55"/>
      <rect x="62" y="64" width="10" height="8" rx="3" opacity="0.35"/>
    </g>`,
  (ink) => `
    <g fill="${ink}">
      <circle cx="48" cy="31" r="10"/><circle cx="48" cy="65" r="10"/>
      <circle cx="31" cy="48" r="10"/><circle cx="65" cy="48" r="10"/>
    </g>
    <circle cx="48" cy="48" r="7" fill="${ink}"/>`,
  (ink) => `
    <path d="M22 74 L74 22 L74 74 Z" fill="${ink}"/>
    <path d="M22 74 L22 46 L52 74 Z" fill="${ink}" opacity="0.4"/>`,
  (ink) => `
    <g fill="${ink}">
      <circle cx="48" cy="26" r="3"/><circle cx="39" cy="40" r="3"/><circle cx="57" cy="40" r="3"/>
      <circle cx="30" cy="54" r="3"/><circle cx="48" cy="54" r="3"/><circle cx="66" cy="54" r="3"/>
      <circle cx="21" cy="68" r="3"/><circle cx="39" cy="68" r="3"/><circle cx="57" cy="68" r="3"/><circle cx="75" cy="68" r="3"/>
    </g>`,
  (ink) => `
    <g fill="none" stroke="${ink}" stroke-width="2.5">
      <rect x="27" y="27" width="42" height="42" rx="4"/>
      <rect x="34" y="34" width="28" height="28" rx="2" transform="rotate(12 48 48)"/>
      <circle cx="48" cy="48" r="5" fill="${ink}" stroke="none"/>
    </g>`,
  (ink) => `
    <g fill="none" stroke="${ink}" stroke-width="2.5">
      <circle cx="48" cy="48" r="25"/><circle cx="48" cy="48" r="15"/><circle cx="48" cy="48" r="5"/>
    </g>
    <circle cx="70" cy="31" r="5" fill="${ink}"/>`,
  (ink) => `
    <g stroke="${ink}" stroke-width="4" stroke-linecap="round">
      <path d="M28 28 V68"/><path d="M40 34 V62"/><path d="M52 24 V72"/><path d="M64 38 V58"/><path d="M72 45 V51"/>
    </g>`,
  (ink) => `
    <path d="M62 26 A24 24 0 1 0 62 70 A20 20 0 1 1 62 26 Z" fill="${ink}"/>
    <circle cx="36" cy="36" r="3" fill="${ink}" opacity="0.6"/>`,
  (ink) => `
    <g stroke="${ink}" stroke-width="1.8" opacity="0.8">
      <path d="M24 36 H72 M24 48 H72 M24 60 H72 M36 24 V72 M48 24 V72 M60 24 V72"/>
    </g>
    <rect x="44" y="44" width="14" height="14" rx="2" fill="${ink}" stroke="none"/>`,
  (ink) => `
    <path d="M20 62 L34 36 L48 60 L62 30 L76 56" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="76" cy="56" r="4" fill="${ink}"/>`,
  (ink) => `
    <circle cx="48" cy="49" r="12" fill="${ink}"/>
    <g stroke="${ink}" stroke-width="3" stroke-linecap="round">
      <path d="M48 21 V29"/><path d="M48 69 V77"/><path d="M20 49 H28"/><path d="M68 49 H76"/>
      <path d="M29 30 L35 36"/><path d="M61 62 L67 68"/><path d="M67 30 L61 36"/><path d="M35 62 L29 68"/>
    </g>`,
  (ink) => `
    <g fill="${ink}">
      <rect x="22" y="54" width="26" height="20" rx="6"/>
      <rect x="34" y="37" width="26" height="20" rx="6" opacity="0.65"/>
      <rect x="46" y="20" width="26" height="20" rx="6" opacity="0.4"/>
    </g>`,
  (ink) => `
    <g fill="none" stroke="${ink}" stroke-width="3">
      <circle cx="38" cy="49" r="17"/>
      <circle cx="58" cy="49" r="17"/>
    </g>
    <circle cx="48" cy="49" r="4" fill="${ink}"/>`,
  (ink) => `
    <g fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round">
      <path d="M48 22 A26 26 0 0 1 48 74"/>
      <path d="M48 30 A18 18 0 0 1 48 66"/>
      <path d="M48 38 A10 10 0 0 1 48 58"/>
    </g>
    <circle cx="31" cy="34" r="3.5" fill="${ink}"/>`,
];

for (let index = 0; index < 24; index += 1) {
  const [from, to, ink] = palettes[index % palettes.length];
  const pattern = patterns[index % patterns.length];
  const number = String(index + 1).padStart(2, "0");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none">
  <defs>
    <linearGradient id="bg${number}" x1="12" y1="8" x2="88" y2="92" gradientUnits="userSpaceOnUse">
      <stop stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <clipPath id="clip${number}">
      <rect width="96" height="96" rx="22"/>
    </clipPath>
  </defs>
  <g clip-path="url(#clip${number})">
    <rect width="96" height="96" rx="22" fill="url(#bg${number})"/>
    <path d="M-20 32 L32 -20" stroke="#fff" stroke-opacity="0.08" stroke-width="26"/>
    <path d="M70 116 L116 70" stroke="#000" stroke-opacity="0.06" stroke-width="30"/>
    <g opacity="0.92">${pattern(ink)}</g>
    <rect x="0.75" y="0.75" width="94.5" height="94.5" rx="21.25" stroke="#fff" stroke-opacity="0.16" stroke-width="1.5"/>
  </g>
</svg>
`;
  fs.writeFileSync(path.join(output, `avatar-${number}.svg`), svg);
}

console.log(`Generated ${24} avatars in ${output}`);