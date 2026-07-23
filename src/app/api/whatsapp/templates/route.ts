import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

const COMMON_FOOTER = `-----------------------------------------
📱 *Aplikasi Pelanggan:* {{link_download_aplikasi}}
📢 *WA Channel Info & Promo:* https://whatsapp.com/channel/0029Vb80GhZ1CYoX3FVC4m2v

Ada kendala? Balas chat ini untuk informasi lebih lanjut.
Salam hangat, *{{companyName}}*.`;

const UNIVERSAL_INVOICE_MSG = `📄 *INVOICE TAGIHAN INTERNET*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}
• *No. Invoice:* {{invoiceNumber}}
• *Paket:* {{profileName}}

⚠️ _Mohon lakukan pembayaran sebelum *{{expiredAt}}* agar layanan internet tetap aktif dan lancar._

-----------------------------------------
*Cara Bayar Instan (Otomatis Lunas):*
1. Klik link: {{paymentLink}}
2. Pilih metode pembayaran (QRIS, VA, atau E-Wallet).

${COMMON_FOOTER}`;

const PAID_SUCCESS_MSG = `✅ *PEMBAYARAN BERHASIL & LUNAS*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}
• *No. Invoice:* {{invoiceNumber}}
• *Paket:* {{profileName}}

🎉 *Terima kasih!* Pembayaran Anda telah berhasil dikonfirmasi. Layanan internet Anda aktif dan dapat digunakan kembali.

-----------------------------------------
📄 *Unduh Bukti Bayar / Invoice PDF:*
{{invoicePdfLink}}

${COMMON_FOOTER}`;

const AUTO_RENEWAL_MSG = `🔄 *PERPANJANGAN OTOMATIS BERHASIL*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}
• *Paket:* {{profileName}}
• *Masa Aktif Baru:* s/d {{expiredAt}}

🎉 _Paket internet Anda telah berhasil diperpanjang secara otomatis. Terima kasih telah setia memilih {{companyName}}._

${COMMON_FOOTER}`;

const BROADCAST_MSG = `📢 *PEMBERITAHUAN PELANGGAN*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}

📌 _[Tuliskan pengumuman, promo, atau informasi umum di sini]_

${COMMON_FOOTER}`;

// Default 14 Master WhatsApp Templates (EUGBILL V2.0 Specification)
export const defaultTemplates = [
  // 1️⃣ Konfirmasi Pendaftaran
  {
    name: '✅ Konfirmasi Pendaftaran',
    type: 'registration-confirmation',
    message: `✅ *KONFIRMASI PENDAFTARAN*

Yth. Bapak/Ibu *{{customerName}}*
• *No. HP:* {{phone}}
• *Paket:* {{profileName}}
• *Alamat Pasang:* {{address}}

📌 _Data pendaftaran Anda telah kami terima dan sedang diproses oleh tim. Kami akan menginformasikan kembali untuk jadwal pemasangan di lokasi._

${COMMON_FOOTER}`,
    isActive: true,
  },

  // 2️⃣ Persetujuan Pendaftaran
  {
    name: '🎉 Persetujuan Pendaftaran',
    type: 'registration-approval',
    message: `🎉 *PENDAFTARAN DISETUJUI*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}
• *Paket Layanan:* {{profileName}}

📌 _Selamat! Pendaftaran Anda telah disetujui. Tim teknisi kami akan segera menghubungi Anda untuk koordinasi jadwal pemasangan._

${COMMON_FOOTER}`,
    isActive: true,
  },

  // 3️⃣ Penagihan / Invoice Universal (3 Menu Targets)
  {
    name: '🔧 Invoice Instalasi',
    type: 'installation-invoice',
    message: UNIVERSAL_INVOICE_MSG,
    isActive: true,
  },
  {
    name: '📅 Invoice Bulanan / Jatuh Tempo',
    type: 'invoice-reminder',
    message: UNIVERSAL_INVOICE_MSG,
    isActive: true,
  },
  {
    name: '📄 Notifikasi Invoice Baru',
    type: 'invoice-created',
    message: UNIVERSAL_INVOICE_MSG,
    isActive: true,
  },

  // 4️⃣ Overdue / Peringatan Isolir
  {
    name: '⚠️ Invoice Overdue Reminder',
    type: 'invoice-overdue',
    message: `⚠️ *PERINGATAN PENANGGUHAN LAYANAN*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}
• *No. Invoice:* {{invoiceNumber}}

🚨 _Layanan Anda saat ini diisolir/ditangguhkan sementara karena melewati batas waktu pembayaran._

-----------------------------------------
*Aktifkan Kembali Sekarang (Otomatis Aktif):*
1. Klik link: {{paymentLink}}
2. Selesaikan pembayaran.

_Sistem akan mengaktifkan koneksi Anda secara otomatis dalam 1 detik setelah pembayaran berhasil._

${COMMON_FOOTER}`,
    isActive: true,
  },

  // 5️⃣ Pembayaran Lunas (2 Menu Targets)
  {
    name: '✅ Pembayaran Berhasil',
    type: 'payment-success',
    message: PAID_SUCCESS_MSG,
    isActive: true,
  },
  {
    name: '✅ Pembayaran Manual Disetujui',
    type: 'manual-payment-approval',
    message: PAID_SUCCESS_MSG,
    isActive: true,
  },

  // 6️⃣ Pembayaran Manual Ditolak
  {
    name: '❌ Pembayaran Manual Ditolak',
    type: 'manual-payment-rejection',
    message: `❌ *PEMBAYARAN MANUAL DITOLAK*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}
• *No. Invoice:* {{invoiceNumber}}

Mohon maaf, bukti transfer pembayaran manual Anda *ditolak* oleh admin.

-----------------------------------------
*Silakan Unggah Ulang Bukti Bayar:*
{{paymentLink}}

${COMMON_FOOTER}`,
    isActive: true,
  },

  // 7️⃣ Informasi Gangguan Jaringan
  {
    name: '⚠️ Informasi Gangguan',
    type: 'maintenance-outage',
    message: `⚠️ *INFORMASI GANGGUAN JARINGAN*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}
• *Wilayah:* {{address}}

📢 _Saat ini sedang terjadi gangguan jaringan di wilayah Anda. Tim teknisi kami sedang dalam proses penanganan di lapangan._

📌 _Kami memohon maaf atas ketidaknyamanan ini dan berupaya agar koneksi kembali normal secepatnya._

${COMMON_FOOTER}`,
    isActive: true,
  },

  // 8️⃣ Perbaikan Selesai
  {
    name: '✅ Perbaikan Selesai',
    type: 'maintenance-resolved',
    message: `✅ *PERBAIKAN JARINGAN SELESAI*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}
• *Paket:* {{profileName}}

🎉 _Penanganan gangguan jaringan telah selesai dilaksanakan. Layanan internet Anda saat ini sudah kembali normal._

📌 _Jika koneksi belum terhubung, mohon coba restart (matikan dan nyalakan kembali) perangkat router Anda selama 1-2 menit._

${COMMON_FOOTER}`,
    isActive: true,
  },

  // 9️⃣ Pembelian Voucher Hotspot
  {
    name: '🎫 Pembelian Voucher',
    type: 'voucher-purchase',
    message: `🎫 *PEMBELIAN VOUCHER BERHASIL*

Yth. Bapak/Ibu *{{customerName}}*
• *No. HP:* {{phone}}
• *Paket:* {{profileName}}

🔑 *KREDENSIAL LOGIN WI-FI:*
• *Username:* {{username}}
• *Password:* {{password}}

-----------------------------------------
*Cara Menggunakan:*
1. Hubungkan ke Wi-Fi *{{companyName}}*.
2. Masukkan Username & Password di atas pada halaman login.

${COMMON_FOOTER}`,
    isActive: true,
  },

  // 🔟 Auto-Renewal & Manual Extension (2 Menu Targets)
  {
    name: '🎉 Perpanjangan Manual',
    type: 'manual-extension',
    message: AUTO_RENEWAL_MSG,
    isActive: true,
  },
  {
    name: '🔄 Auto-Renewal Berhasil',
    type: 'auto-renewal-success',
    message: AUTO_RENEWAL_MSG,
    isActive: true,
  },

  // 1️⃣1️⃣ Link Pembayaran Voucher
  {
    name: '💳 Link Pembayaran Voucher',
    type: 'voucher-payment-link',
    message: `💳 *LINK PEMBAYARAN VOUCHER*

Yth. Bapak/Ibu *{{customerName}}*
• *No. HP:* {{phone}}
• *Paket:* {{profileName}}

📌 _Satu langkah lagi untuk mengaktifkan voucher Anda. Silakan selesaikan pembayaran melalui tautan berikut:_

-----------------------------------------
*Link Pembayaran:*
{{paymentLink}}

${COMMON_FOOTER}`,
    isActive: true,
  },

  // 1️⃣2️⃣ Pemberitahuan Maintenance
  {
    name: '🔧 Pemberitahuan Maintenance',
    type: 'maintenance-info',
    message: `🔧 *PEMBERITAHUAN PEMELIHARAAN JARINGAN*

Yth. Bapak/Ibu *{{customerName}}*
• *ID Pelanggan:* {{customerId}}
• *Wilayah:* {{address}}

📢 _Kami menginformasikan bahwa akan dilakukan pemeliharaan sistem/jaringan berkala untuk meningkatkan kualitas layanan internet Anda._

📌 _Selama proses pemeliharaan berlangsung, layanan internet Anda mungkin akan mengalami gangguan singkat. Kami berupaya agar pemeliharaan selesai secepatnya._

${COMMON_FOOTER}`,
    isActive: true,
  },

  // 1️⃣3️⃣ Broadcast & Promo (2 Menu Targets)
  {
    name: '📢 Broadcast Umum ke Pelanggan',
    type: 'general-broadcast',
    message: BROADCAST_MSG,
    isActive: true,
  },
  {
    name: '🎁 Promo & Penawaran Khusus',
    type: 'promo-offer',
    message: BROADCAST_MSG,
    isActive: true,
  },

  // 1️⃣4️⃣ Admin Create User (DISABLED BY DEFAULT)
  {
    name: '👤 Admin Create User',
    type: 'admin-create-user',
    message: '',
    isActive: false,
  },
];

// GET - List all templates (auto-seed if empty or missing, syncs with defaultTemplates)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let templates = await prisma.whatsapp_templates.findMany({
      orderBy: { createdAt: 'asc' },
    });

    if (templates.length === 0) {
      for (const dt of defaultTemplates) {
        await prisma.whatsapp_templates.create({
          data: {
            id: crypto.randomUUID(),
            name: dt.name,
            type: dt.type,
            message: dt.message,
            isActive: dt.isActive,
          },
        });
      }
      templates = await prisma.whatsapp_templates.findMany({ orderBy: { createdAt: 'asc' } });
    } else {
      // Sync missing or updated default templates
      const existingTypes = templates.map(t => t.type);
      for (const dt of defaultTemplates) {
        if (!existingTypes.includes(dt.type)) {
          await prisma.whatsapp_templates.create({
            data: {
              id: crypto.randomUUID(),
              name: dt.name,
              type: dt.type,
              message: dt.message,
              isActive: dt.isActive,
            },
          });
        }
      }
      templates = await prisma.whatsapp_templates.findMany({ orderBy: { createdAt: 'asc' } });
    }

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST - Create or Reset Templates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, name, type, message, isActive } = body;

    // Reset Defaults Action
    if (action === 'reset_defaults') {
      console.log('[Templates] Resetting all templates to master defaults v2.0...');
      for (const dt of defaultTemplates) {
        const existing = await prisma.whatsapp_templates.findFirst({ where: { type: dt.type } });
        if (existing) {
          await prisma.whatsapp_templates.update({
            where: { id: existing.id },
            data: {
              name: dt.name,
              message: dt.message,
              isActive: dt.isActive,
            },
          });
        } else {
          await prisma.whatsapp_templates.create({
            data: {
              id: crypto.randomUUID(),
              name: dt.name,
              type: dt.type,
              message: dt.message,
              isActive: dt.isActive,
            },
          });
        }
      }
      const updated = await prisma.whatsapp_templates.findMany({ orderBy: { createdAt: 'asc' } });
      return NextResponse.json({ success: true, data: updated, message: 'Template berhasil di-reset ke master default v2.0!' });
    }

    if (!name || !type || message === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, type, and message are required' },
        { status: 400 }
      );
    }

    const template = await prisma.whatsapp_templates.create({
      data: {
        id: crypto.randomUUID(),
        name,
        type,
        message,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
