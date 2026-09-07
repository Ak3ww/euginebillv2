import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { prisma } from '@/server/db/client'
import { WhatsAppService } from '@/server/services/notifications/whatsapp.service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { phone, vouchers } = await request.json()

    if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
      return NextResponse.json({ error: 'No vouchers selected' }, { status: 400 })
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Get company info
    const company = await prisma.company.findFirst()
    const companyName = company?.name || 'EugineBill'
    const companyPhone = company?.phone || ''

    // Fetch vouchers from DB to ensure passwords and profiles are accurate even if client omitted them
    const codes = vouchers.map((v: any) => v.code).filter(Boolean)
    const dbVouchers = codes.length > 0
      ? await prisma.hotspotVoucher.findMany({
          where: { code: { in: codes } },
          include: { profile: true },
        })
      : []
    const dbVoucherMap = new Map(dbVouchers.map((dv) => [dv.code, dv]))

    let hasDualMode = false

    // Build voucher message
    let message = '🎟️ *Voucher Hotspot Internet*\n\n'
    message += `Halo! Berikut adalah voucher internet Anda:\n\n`
    message += `━━━━━━━━━━━━━━━━━━\n\n`

    vouchers.forEach((v: any, idx: number) => {
      const dbV = dbVoucherMap.get(v.code)
      const password = v.password !== undefined ? v.password : dbV?.password
      const isDual = Boolean(password && password !== v.code)
      if (isDual) hasDualMode = true

      const profileName = v.profileName || dbV?.profile?.name || '-'
      const price = v.price !== undefined ? v.price : (dbV?.profile?.sellingPrice || 0)
      const validity = v.validity || (dbV?.profile ? `${dbV.profile.validityValue} ${dbV.profile.validityUnit.toLowerCase()}` : '-')

      message += `*Voucher ${idx + 1}*\n`
      if (isDual) {
        message += `👤 Username: *${v.code}*\n`
        message += `🔑 Password: *${password}*\n`
      } else {
        message += `🔑 Kode Voucher: *${v.code}*\n`
      }
      message += `📦 Paket: ${profileName}\n`
      message += `💰 Harga: Rp ${Number(price).toLocaleString('id-ID')}\n`
      message += `⏳ Masa Aktif: ${validity}\n\n`
    })

    message += `━━━━━━━━━━━━━━━━━━\n\n`
    message += `📌 *Cara Menggunakan:*\n`
    message += `1. Hubungkan ke WiFi hotspot kami\n`
    message += `2. Buka browser, akan muncul halaman login\n`
    if (hasDualMode) {
      message += `3. Masuk ke tab *"Member / Langganan"*\n`
      message += `4. Masukkan Username dan Password sesuai di atas\n`
    } else {
      message += `3. Masukkan kode voucher pada tab *"Voucher"*\n`
    }
    message += `5. Klik Login dan nikmati internet!\n\n`
    message += `⚠️ *Penting:*\n`
    message += `• Voucher akan aktif setelah login pertama\n`
    message += `• Simpan kode voucher dengan baik\n`
    message += `• Masa aktif dihitung sejak login pertama\n\n`
    message += `📞 Butuh bantuan? Hubungi: ${companyPhone}\n\n`
    message += `Terima kasih! 🙏\n${companyName}`

    // Send WhatsApp
    await WhatsAppService.sendMessage({
      phone,
      message
    })

    return NextResponse.json({
      success: true,
      message: 'WhatsApp sent successfully'
    })
  } catch (error) {
    console.error('Send WhatsApp error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
