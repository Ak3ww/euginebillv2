import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClientProviders } from "@/components/client-providers";
import { prisma } from "@/server/db/client";

export const dynamic = 'force-dynamic';

const geistSans = { variable: "font-geist-sans" };
const geistMono = { variable: "font-geist-mono" };
const outfit = { variable: "font-outfit" };
const spaceGrotesk = { variable: "font-display" };
const inter = { variable: "font-body" };
const jetbrainsMono = { variable: "font-mono" };
const hankenGrotesk = { variable: "font-hanken" };

export async function generateMetadata(): Promise<Metadata> {
  const company = await prisma.company.findFirst({ select: { name: true, logo: true } });
  let rawName = company?.name || 'Eugine Media Group';
  const name = rawName.replace(/^PT\.?\s*/i, '').trim();
  const logoUrl = company?.logo ? company.logo : '/api/pwa/icon?size=192';
  const description = `${name} | Integrated IT, Network, and Hardware Solutions for ISP/RTRW.NET and Enterprise.`;
  return {
    title: name,
    description: description,
    openGraph: {
      title: name,
      description: description,
      siteName: name,
      locale: 'id_ID',
      type: 'website',
    },
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: logoUrl, sizes: "192x192" },
        { url: "/api/pwa/icon?size=512", sizes: "512x512", type: "image/png" },
      ],
      shortcut: logoUrl,
      apple: [
        { url: logoUrl, sizes: "192x192" },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: name,
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#465fff",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const swScript = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(function (err) { console.warn('[SW] registration failed:', err); });
  });
  navigator.serviceWorker.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'PUSH_RECEIVED') return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) { /* silent fail */ }
  });
}
`;

const themeScript = `(() => {
  try {
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.theme = 'light';
  } catch (_) {
    // no-op
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
        <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png" />
        {/* Stitch Fonts & Icons */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <style>{`
          .bento-card { background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 0.125rem; }
          .dark .bento-card { background-color: var(--color-surface-container-low); border-color: var(--color-outline-variant); }
        `}</style>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${hankenGrotesk.variable} antialiased`}>
        {children}
        <ClientProviders />
      </body>
    </html>
  );
}
