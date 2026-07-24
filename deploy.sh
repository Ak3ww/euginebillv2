#!/bin/bash
set -e

echo "[*] Deploying EugineBill RADIUS..."

APP_DIR="/var/www/EugineBill-radius"
APP_USER="$(stat -c '%U' "$APP_DIR" 2>/dev/null || echo EugineBill)"
SOURCE_DIR=""
DEFAULT_BRANCH=""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "[ERROR] This script must be run as root"
    echo "Run with: sudo $0"
    exit 1
fi

for candidate in "$APP_DIR" "/root/EugineBill-radius" "/root/EugineBill-RADIUS-main"; do
    if [ -f "$candidate/package.json" ]; then
        SOURCE_DIR="$candidate"
        break
    fi
done

if [ -z "$SOURCE_DIR" ]; then
    echo "[ERROR] Source directory not found"
    exit 1
fi

echo ">> Source directory: $SOURCE_DIR"
echo ">> Active directory: $APP_DIR"

# Pull latest code from source repo if available
if [ -d "$SOURCE_DIR/.git" ]; then
    echo ">> Pulling latest code from git source..."
    DEFAULT_BRANCH=$(git -C "$SOURCE_DIR" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')

    if [ -z "$DEFAULT_BRANCH" ]; then
        if git -C "$SOURCE_DIR" show-ref --verify --quiet refs/heads/master; then
            DEFAULT_BRANCH="master"
        elif git -C "$SOURCE_DIR" show-ref --verify --quiet refs/heads/main; then
            DEFAULT_BRANCH="main"
        else
            DEFAULT_BRANCH="master"
        fi
    fi

    git -C "$SOURCE_DIR" fetch origin
    git -C "$SOURCE_DIR" checkout "$DEFAULT_BRANCH"
    git -C "$SOURCE_DIR" pull --ff-only origin "$DEFAULT_BRANCH"
fi

# Sync latest source into active app dir when source repo is separate
if [ "$SOURCE_DIR" != "$APP_DIR" ]; then
    echo ">> Syncing source into active app directory..."
    if command -v rsync >/dev/null 2>&1; then
        rsync -a --delete \
            --exclude='.git' \
            --exclude='node_modules' \
            --exclude='.next' \
            --exclude='logs' \
            "$SOURCE_DIR/" "$APP_DIR/"
    else
        cp -a "$SOURCE_DIR/." "$APP_DIR/"
    fi
fi

cd ${APP_DIR}

# Install dependencies
echo ">> Installing dependencies..."
npm install --production=false

# Generate Prisma Client
echo "[>] Generating Prisma Client..."
node_modules/.bin/prisma generate

# Push database schema
echo "[>] Updating database schema..."
node_modules/.bin/prisma db push --accept-data-loss

# Build application
echo "[>] Building application..."
NODE_OPTIONS="--max-old-space-size=1536" npm run build

# Copy public assets into standalone bundle (required for PWA manifests + sw.js)
if [ -d ".next/standalone" ]; then
    echo "[>] Copying public assets into standalone bundle..."
    [ -d "public" ] && { mkdir -p .next/standalone/public; cp -r public/. .next/standalone/public/; } || true
    if [ -d ".next/static" ]; then
        mkdir -p .next/standalone/.next
        cp -r .next/static .next/standalone/.next/static/ || true
    fi
    echo "[OK] Standalone assets copied"
fi

# Fix ownership
echo "[>] Fixing permissions..."
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

# Refresh ecosystem.config.js from production/ (rsync --delete erases root copy)
if [ -f "${APP_DIR}/production/ecosystem.config.js" ]; then
    cp "${APP_DIR}/production/ecosystem.config.js" "${APP_DIR}/ecosystem.config.js"
    echo "[>] ecosystem.config.js refreshed from production/"
fi

# Restart PM2 as EugineBill user
echo "[>] Restarting application..."
sudo su - ${APP_USER} -c "cd ${APP_DIR} && pm2 reload ecosystem.config.js --update-env || pm2 start ${APP_DIR}/ecosystem.config.js"
sudo su - ${APP_USER} -c 'pm2 save'

echo "[OK] Deployment completed!"
echo ">> Note: PM2 may show 2 EugineBill-radius processes because cluster instances=2 is intentional."
echo ""
echo ">> Application status:"
sudo su - ${APP_USER} -c 'pm2 list'
