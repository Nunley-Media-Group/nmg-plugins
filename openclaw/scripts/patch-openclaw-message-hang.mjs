#!/usr/bin/env node

/**
 * Patches the openclaw CLI to fix the message-send hang bug.
 * See: https://github.com/openclaw/openclaw/issues/16460
 *
 * Root cause: `openclaw message send` delivers the Discord message but the
 * Node process never exits because the Discord.js WebSocket stays open
 * (no process.exit() call in the runMessageAction helper).
 *
 * This script adds process.exit(0) to the runMessageAction function so all
 * message subcommands exit cleanly after completion.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Find openclaw installation
let openclawBin;
try {
  openclawBin = execSync('which openclaw', { encoding: 'utf8', timeout: 5_000 }).trim();
} catch {
  console.log('openclaw not found on PATH. Skipping patch.');
  process.exit(0);
}

// Resolve symlinks to find the actual package directory
// The binary (openclaw.mjs) lives at the package root, so dirname gives us the package dir
const resolved = fs.realpathSync(openclawBin);
const packageDir = path.dirname(resolved);
const distIndex = path.join(packageDir, 'dist', 'index.js');

if (!fs.existsSync(distIndex)) {
  console.log(`Could not find dist/index.js at ${distIndex}. Skipping patch.`);
  process.exit(0);
}

let source = fs.readFileSync(distIndex, 'utf8');

// The unpatched runMessageAction ends like:
//     defaultRuntime.exit(1);
//     });
//   };
//
// The patch adds process.exit(0) before the closing };
const UNPATCHED = 'defaultRuntime.exit(1);\n\t\t});\n\t};';
const PATCHED = 'defaultRuntime.exit(1);\n\t\t});\n\t\tprocess.exit(0);\n\t};';

if (source.includes(PATCHED)) {
  console.log('openclaw CLI already patched (message-send hang fix). No action needed.');
  process.exit(0);
}

if (!source.includes(UNPATCHED)) {
  console.log('Could not find expected pattern in openclaw dist/index.js.');
  console.log('The bug may already be fixed upstream or the code structure changed. Skipping patch.');
  process.exit(0);
}

source = source.replace(UNPATCHED, PATCHED);
fs.writeFileSync(distIndex, source);
console.log(`Patched openclaw CLI: added process.exit(0) to runMessageAction (${distIndex})`);
