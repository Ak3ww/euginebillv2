/**
 * EugineBill Postbuild Synchronization Script
 * Copies required production assets to .next/standalone
 * Ensures .next/static, public, and prisma are in place for standalone server.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

console.log('[postbuild] Synchronizing standalone production assets...');

if (!fs.existsSync(standaloneDir)) {
  console.log('[postbuild] .next/standalone does not exist. Skipping standalone asset synchronization.');
  process.exit(0);
}

function copyRecursiveSync(src, dest, excludeNames = []) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    const baseName = path.basename(src);
    if (excludeNames.includes(baseName)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, item), path.join(dest, item), excludeNames);
    }
  } else {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

try {
  // 1. Copy public/ -> .next/standalone/public/ (exclude runtime uploads to save memory/time)
  const publicSrc = path.join(rootDir, 'public');
  const publicDest = path.join(standaloneDir, 'public');
  if (fs.existsSync(publicSrc)) {
    copyRecursiveSync(publicSrc, publicDest, ['uploads']);
    console.log('[postbuild] public/ -> .next/standalone/public/ (done)');
  }

  // 2. Copy .next/static/ -> .next/standalone/.next/static/ (CRITICAL for chunk loading)
  const staticSrc = path.join(rootDir, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    copyRecursiveSync(staticSrc, staticDest);
    console.log('[postbuild] .next/static/ -> .next/standalone/.next/static/ (done)');
  }

  // 3. Copy .env -> .next/standalone/.env
  const envSrc = path.join(rootDir, '.env');
  const envDest = path.join(standaloneDir, '.env');
  if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, envDest);
    console.log('[postbuild] .env -> .next/standalone/.env (done)');
  }

  // 4. Copy node_modules/.prisma -> .next/standalone/node_modules/.prisma
  const prismaClientSrc = path.join(rootDir, 'node_modules', '.prisma');
  const prismaClientDest = path.join(standaloneDir, 'node_modules', '.prisma');
  if (fs.existsSync(prismaClientSrc)) {
    copyRecursiveSync(prismaClientSrc, prismaClientDest);
    console.log('[postbuild] node_modules/.prisma -> .next/standalone/node_modules/.prisma (done)');
  }

  // 5. Copy prisma/ -> .next/standalone/prisma/
  const prismaSrc = path.join(rootDir, 'prisma');
  const prismaDest = path.join(standaloneDir, 'prisma');
  if (fs.existsSync(prismaSrc)) {
    copyRecursiveSync(prismaSrc, prismaDest);
    console.log('[postbuild] prisma/ -> .next/standalone/prisma/ (done)');
  }

  console.log('[postbuild] All standalone production assets successfully synchronized!');
} catch (err) {
  console.error('[postbuild] Error during standalone asset synchronization:', err);
  process.exit(1);
}
