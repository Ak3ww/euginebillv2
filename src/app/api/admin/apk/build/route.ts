import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import {
  mkdirSync, writeFileSync, existsSync, chmodSync,
  openSync, copyFileSync, statSync, readdirSync, readFileSync,
} from 'fs';
import { join } from 'path';
import { spawn, execSync } from 'child_process';

export const dynamic = 'force-dynamic';

const ROLES = {
  admin:      { label: 'EugineBill Admin',     pkg: 'net.EugineBill.admin',      color: '#1e40af', pathSuffix: '/admin' },
  customer:   { label: 'EugineBill Customer',  pkg: 'net.EugineBill.customer',   color: '#0891b2', pathSuffix: '/customer' },
  technician: { label: 'EugineBill Teknisi',   pkg: 'net.EugineBill.technician', color: '#059669', pathSuffix: '/technician' },
  agent:      { label: 'EugineBill Agent',     pkg: 'net.EugineBill.agent',      color: '#7c3aed', pathSuffix: '/agent' },
} as const;
type RoleKey = keyof typeof ROLES;

const APK_DIR       = '/var/data/EugineBill/apk';
const GRADLE_CACHE  = '/var/data/EugineBill/gradle-cache';
const ANDROID_HOME  = process.env.ANDROID_HOME || '/opt/android';
const WRAPPER_JAR   = join(process.cwd(), 'public', 'android-template', 'gradle-wrapper.jar');

// ─── file generators ─────────────────────────────────────────────────────────

function mainActivity(pkg: string, startUrl: string, baseUrl: string): string {
  return `package ${pkg}

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooser = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        fileCallback?.onReceiveValue(
            if (result.resultCode == Activity.RESULT_OK)
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            else null
        )
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webView)
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        with(webView.settings) {
            javaScriptEnabled    = true
            domStorageEnabled    = true
            databaseEnabled      = true
            loadWithOverviewMode = true
            useWideViewPort      = true
            allowFileAccess      = true
            allowContentAccess   = true
            setSupportZoom(false)
            builtInZoomControls  = false
            displayZoomControls  = false
            cacheMode            = WebSettings.LOAD_DEFAULT
            mixedContentMode     = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString      = userAgentString + " EugineBillApp/2.0"
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                val isInternal = url.startsWith("${baseUrl}") || url.startsWith("blob:")
                if (!isInternal) { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))); return true }
                return false
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                fileCallback = callback
                val intent = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply { type = "*/*" }
                fileChooser.launch(intent); return true
            }
        }
        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl("${startUrl}")
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (webView.canGoBack()) webView.goBack() else super.onBackPressed() }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); webView.saveState(outState) }
}
`;
}

function appBuildGradle(pkg: string): string {
  return `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}
android {
    namespace '${pkg}'
    compileSdk 34
    defaultConfig {
        applicationId "${pkg}"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.debug
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = '17' }
}
dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
}
`;
}

const rootBuildGradle = () => `plugins {
    id 'com.android.application' version '8.2.2' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.22' apply false
}
`;

const settingsGradle = (appName: string) => `pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "${appName.replace(/\s+/g, '')}"
include ':app'
`;

const gradleProperties = () =>
  `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nkotlin.code.style=official\n`;

const gradleWrapperProperties = () =>
  `distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-8.4-bin.zip\nnetworkTimeout=10000\nvalidateDistributionUrl=true\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n`;

const androidManifest = (pkg: string) => `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <application
        android:allowBackup="true"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="false">
        <activity android:name=".MainActivity" android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;

const activityMainXml = () => `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    <WebView android:id="@+id/webView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</FrameLayout>
`;

const stringsXml = (appName: string) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">${appName}</string>\n</resources>\n`;

const colorsXml = (color: string) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="colorPrimary">${color}</color>\n    <color name="colorPrimaryDark">${color}</color>\n    <color name="colorAccent">${color}</color>\n    <color name="statusBar">${color}</color>\n</resources>\n`;

const themesXml = () => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:statusBarColor">@color/statusBar</item>
        <item name="android:windowBackground">@color/colorPrimary</item>
    </style>
</resources>
`;

const gradlewScript = () => `#!/bin/sh
set -e
APP_HOME="$(cd "$(dirname "$0")" && pwd -P)"
CLASSPATH="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"
[ -n "$JAVA_HOME" ] && JAVACMD="$JAVA_HOME/bin/java" || JAVACMD="java"
exec "$JAVACMD" "-Dorg.gradle.appname=$(basename "$0")" -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"
`;

// ─── write project to disk ───────────────────────────────────────────────────

function writeProjectToDisk(
  projectDir: string,
  role: RoleKey,
  appName: string,
  startUrl: string,
  baseUrl: string,
) {
  const cfg = ROLES[role];
  const pkgPath = cfg.pkg.replace(/\./g, '/');

  // Create directories
  for (const d of [
    'gradle/wrapper',
    `app/src/main/java/${pkgPath}`,
    'app/src/main/res/layout',
    'app/src/main/res/values',
    ...['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].map(d => `app/src/main/res/mipmap-${d}`),
  ]) {
    mkdirSync(join(projectDir, d), { recursive: true });
  }

  // Root files
  writeFileSync(join(projectDir, 'build.gradle'), rootBuildGradle());
  writeFileSync(join(projectDir, 'settings.gradle'), settingsGradle(appName));
  writeFileSync(join(projectDir, 'gradle.properties'), gradleProperties());
  writeFileSync(join(projectDir, 'local.properties'), `sdk.dir=${ANDROID_HOME}\n`);

  // Gradle wrapper
  writeFileSync(join(projectDir, 'gradle/wrapper/gradle-wrapper.properties'), gradleWrapperProperties());
  if (existsSync(WRAPPER_JAR)) {
    copyFileSync(WRAPPER_JAR, join(projectDir, 'gradle/wrapper/gradle-wrapper.jar'));
  }
  const gradlew = join(projectDir, 'gradlew');
  writeFileSync(gradlew, gradlewScript());
  chmodSync(gradlew, '755');

  // App module
  writeFileSync(join(projectDir, 'app/build.gradle'), appBuildGradle(cfg.pkg));
  writeFileSync(join(projectDir, 'app/proguard-rules.pro'), '# ProGuard rules\n');
  writeFileSync(join(projectDir, 'app/src/main/AndroidManifest.xml'), androidManifest(cfg.pkg));
  writeFileSync(join(projectDir, `app/src/main/java/${pkgPath}/MainActivity.kt`), mainActivity(cfg.pkg, startUrl, baseUrl));
  writeFileSync(join(projectDir, 'app/src/main/res/layout/activity_main.xml'), activityMainXml());
  writeFileSync(join(projectDir, 'app/src/main/res/values/strings.xml'), stringsXml(appName));
  writeFileSync(join(projectDir, 'app/src/main/res/values/colors.xml'), colorsXml(cfg.color));
  writeFileSync(join(projectDir, 'app/src/main/res/values/themes.xml'), themesXml());

  // Placeholder icons
  const iconPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADklEQVQI12NgYGD4DwABBAEAwS2OUQAAAABJRU5ErkJggg==',
    'base64',
  );
  for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    writeFileSync(join(projectDir, `app/src/main/res/mipmap-${density}/ic_launcher.png`), iconPng);
    writeFileSync(join(projectDir, `app/src/main/res/mipmap-${density}/ic_launcher_round.png`), iconPng);
  }
}

// ─── detect JAVA_HOME ────────────────────────────────────────────────────────

function detectJavaHome(): string {
  try {
    const out = execSync('java -XshowSettings:property -version 2>&1', { timeout: 8000 }).toString();
    const m = out.match(/java\.home\s*=\s*(.+)/);
    if (m) return m[1].trim();
  } catch { /* ignore */ }
  for (const p of [
    '/usr/lib/jvm/java-17-openjdk-amd64',
    '/usr/lib/jvm/java-21-openjdk-amd64',
    '/usr/lib/jvm/java-11-openjdk-amd64',
    '/usr/lib/jvm/temurin-17',
  ]) {
    if (existsSync(join(p, 'bin/java'))) return p;
  }
  return '';
}

// ─── GET: check environment ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let java = false;
  let javaVersion = '';
  try {
    const out = execSync('java -version 2>&1', { timeout: 10000 }).toString();
    java = true;
    javaVersion = out.match(/version "([^"]+)"/)?.[1] ?? 'detected';
  } catch { /* java not found */ }

  const androidSdk =
    existsSync(join(ANDROID_HOME, 'build-tools')) &&
    existsSync(join(ANDROID_HOME, 'platforms'));

  return NextResponse.json({
    ready: java && androidSdk,
    java,
    javaVersion,
    androidSdk,
    androidHome: ANDROID_HOME,
  });
}

// ─── POST: start build ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const role = req.nextUrl.searchParams.get('role') as RoleKey;
  if (!role || !ROLES[role]) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Verify Java
  try {
    execSync('java -version 2>&1', { timeout: 10000 });
  } catch {
    return NextResponse.json(
      { error: 'Java tidak terinstall. Jalankan: apt-get install -y openjdk-17-jdk' },
      { status: 503 },
    );
  }

  // Verify Android SDK
  if (!existsSync(join(ANDROID_HOME, 'build-tools'))) {
    return NextResponse.json(
      { error: `Android SDK tidak ditemukan di ${ANDROID_HOME}. Jalankan setup terlebih dahulu.` },
      { status: 503 },
    );
  }

  const roleDir = join(APK_DIR, role);
  mkdirSync(roleDir, { recursive: true });
  mkdirSync(GRADLE_CACHE, { recursive: true });

  const statusFile = join(roleDir, 'status.json');

  // Prevent concurrent build for same role
  if (existsSync(statusFile)) {
    try {
      const s = JSON.parse(readFileSync(statusFile, 'utf-8'));
      if (s.status === 'building') {
        const elapsed = Date.now() - new Date(s.startedAt).getTime();
        if (elapsed < 15 * 60 * 1000) {
          return NextResponse.json({ status: 'building', message: 'Build sedang berjalan' });
        }
      }
    } catch { /* ignore */ }
  }

  // Fetch company name and base URL
  let baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://your-vps.com').replace(/\/$/, '');
  let appName: string = ROLES[role].label;
  try {
    const company = await prisma.company.findFirst({ select: { name: true } });
    if (company?.name) {
      appName = `${company.name} ${role.charAt(0).toUpperCase() + role.slice(1)}`;
    }
  } catch { /* use default */ }

  const startUrl   = `${baseUrl}${ROLES[role].pathSuffix}`;
  const startedAt  = new Date().toISOString();
  const projectDir = `/tmp/EugineBill-build-${role}-${Date.now()}`;

  // Mark as building
  writeFileSync(statusFile, JSON.stringify({ status: 'building', startedAt, role, appName, url: startUrl }));

  // Write project files
  try {
    writeProjectToDisk(projectDir, role, appName, startUrl, baseUrl);
  } catch (err) {
    writeFileSync(statusFile, JSON.stringify({
      status: 'failed', startedAt, finishedAt: new Date().toISOString(),
      error: `Gagal generate project: ${err}`,
    }));
    return NextResponse.json({ error: 'Gagal generate project' }, { status: 500 });
  }

  // Spawn Gradle build in background
  const logFile = join(roleDir, 'build.log');
  const logFd   = openSync(logFile, 'w');
  const javaHome = detectJavaHome();
  const env: NodeJS.ProcessEnv = {
    ...(process.env),
    ANDROID_HOME,
    GRADLE_USER_HOME: GRADLE_CACHE,
    TERM: 'dumb',
  };
  if (javaHome) env.JAVA_HOME = javaHome;

  const proc = spawn('./gradlew', ['assembleRelease', '--no-daemon', '-q'], {
    cwd: projectDir,
    env,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  proc.on('exit', (code: number | null) => {
    try {
      if (code === 0) {
        const releaseDir = join(projectDir, 'app/build/outputs/apk/release');
        const apkFiles   = existsSync(releaseDir)
          ? readdirSync(releaseDir).filter(f => f.endsWith('.apk'))
          : [];

        if (apkFiles.length > 0) {
          const src  = join(releaseDir, apkFiles[0]);
          const dst  = join(roleDir, 'app.apk');
          copyFileSync(src, dst);
          writeFileSync(statusFile, JSON.stringify({
            status: 'done', startedAt, finishedAt: new Date().toISOString(),
            appName, url: startUrl, apkSize: statSync(dst).size,
          }));
        } else {
          writeFileSync(statusFile, JSON.stringify({
            status: 'failed', startedAt, finishedAt: new Date().toISOString(),
            error: 'File APK tidak ditemukan setelah build selesai.',
          }));
        }
      } else {
        writeFileSync(statusFile, JSON.stringify({
          status: 'failed', startedAt, finishedAt: new Date().toISOString(),
          error: `Gradle exit code ${code}. Cek: /var/data/EugineBill/apk/${role}/build.log`,
        }));
      }
    } catch { /* ignore */ }

    // Cleanup project dir
    try { execSync(`rm -rf "${projectDir}"`, { timeout: 30000 }); } catch { /* ignore */ }
  });

  proc.unref();

  return NextResponse.json({ status: 'building', startedAt });
}
