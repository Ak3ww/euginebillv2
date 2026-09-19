#!/usr/bin/env node

/**
 * Patch node-routeros for MikroTik RouterOS v7.18+ Compatibility
 * 
 * Issue: RouterOS 7.18+ returns '!empty' when a query or command returns 0 items.
 * node-routeros does not recognize '!empty' and throws RosException: Tried to process unknown reply: !empty.
 * 
 * This script modifies node_modules/node-routeros/dist/Channel.js to add 'case !empty: break;'.
 */

const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'node-routeros', 'dist', 'Channel.js');

if (!fs.existsSync(targetFile)) {
  console.log('[patch-node-routeros] node-routeros not found at', targetFile, '- skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(targetFile, 'utf8');

if (content.includes("case '!empty':")) {
  console.log('[patch-node-routeros] node-routeros is already patched for RouterOS 7.18+ (!empty reply).');
  process.exit(0);
}

const targetPattern = "switch (reply) {";
const replacement = "switch (reply) {\n            case '!empty':\n                break;";

if (content.includes(targetPattern)) {
  content = content.replace(targetPattern, replacement);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-node-routeros] Successfully patched node-routeros/dist/Channel.js for RouterOS 7.18+ (!empty reply)!');
} else {
  console.warn('[patch-node-routeros] Could not find switch (reply) in Channel.js to patch.');
}
