import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { prisma } from '@/server/db/client'
import { randomBytes } from 'crypto'
import { sendInvoiceReminder } from '@/server/services/notifications/whatsapp-templates.service'
import { EmailService } from '@/server/services/notifications/email.service'

/**
 * POST /api/invoices/send-reminder - Send invoice reminder via WhatsApp and/or Email
 * 
 * Body parameters:
 * - invoiceId: string (required)
 * - channel: 'whatsapp' | 'email' | 'both' (optional, defaults to 'both')
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { invoiceId, channel = 'both' } = body

    if (!invoiceId) {
      return NextResponse.json({
        success: false,
        error: 'Invoice ID is required'
      }, { status: 400 })
    }

    // Get invoice with user details
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: {
          include: {
            profile: true,
            area: true
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({
        success: false,
        error: 'Invoice not found'
      }, { status: 404 })
    }

    // Protect against duplicate sends for the SAME invoice number if already notified within 60 minutes
    if (invoice.waNotifiedAt) {
      const minsSince = (Date.now() - new Date(invoice.waNotifiedAt).getTime()) / (1000 * 60);
      if (minsSince < 60) {
        return NextResponse.json({
          success: false,
          error: `Pesan WA untuk tagihan ${invoice.invoiceNumber} sudah terkirim (${Math.round(minsSince)} menit yang lalu).`
        }, { status: 400 });
      }
    }

    const totalRetryCount = (invoice as any).waRetryCount || 0;
    if (totalRetryCount >= 3 && !invoice.waNotifiedAt) {
      return NextResponse.json({
        success: false,
        error: `Batas maksimal 3x percobaan gagal telah tercapai untuk tagihan ${invoice.invoiceNumber}.`
      }, { status: 400 });
    }

    // Get company info
    const company = await prisma.company.findFirst()

    if (!company) {
      return NextResponse.json({
        success: false,
        error: 'Company information not found. Please configure company settings.'
      }, { status: 500 })
    }

    // Safely convert dueDate to Date object
    let dueDate: Date;
    if (invoice.dueDate instanceof Date) {
      dueDate = invoice.dueDate;
    } else if (typeof invoice.dueDate === 'string') {
      dueDate = new Date(invoice.dueDate);
    } else {
      dueDate = new Date();
    }

    // Auto-detect if invoice is overdue based on status or due date
    const now = new Date()
    const isOverdue = invoice.status === 'OVERDUE' || dueDate < now

    // Calculate days overdue if applicable
    let daysOverdue = 0
    if (isOverdue) {
      const diffTime = now.getTime() - dueDate.getTime()
      daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    // Auto-generate paymentLink if missing (for invoices created without one)
    let paymentLink = invoice.paymentLink || '';
    if (!paymentLink) {
      const baseUrl = company.baseUrl || 'http://localhost:3000';
      const paymentToken = randomBytes(32).toString('hex');
      paymentLink = `${baseUrl}/pay/${paymentToken}`;
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { paymentToken, paymentLink },
      });
    }

    // Prepare common data
    const reminderData = {
      customerName: invoice.customerName || invoice.customerUsername || 'Customer',
      customerId: (invoice.user as any)?.customerId || undefined,
      customerUsername: invoice.customerUsername || invoice.user?.username,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      dueDate: dueDate,
      paymentLink,
      companyName: company.name,
      companyPhone: company.phone || '',
      isOverdue,
      daysOverdue,
      profileName: invoice.user?.profile?.name,
      area: invoice.user?.area?.name
    }

    const results: { whatsapp?: { success: boolean; error?: string }; email?: { success: boolean; error?: string } } = {}
    let hasSuccess = false
    const errors: string[] = []

    // Send WhatsApp reminder
    if (channel === 'whatsapp' || channel === 'both') {
      if (invoice.customerPhone) {
        try {
          const activeProviders = await prisma.whatsapp_providers.findMany({
            where: { isActive: true },
          })

          if (activeProviders.length > 0) {
            // sendInvoiceReminder handles DB updates internally:
            // - Success → sets waNotifiedAt + increments waRetryCount
            // - Failure → only increments waRetryCount (so UI shows "WA Gagal")
            const waResult = await sendInvoiceReminder({
              phone: invoice.customerPhone,
              ...reminderData
            })

            if (waResult && waResult.success === false) {
              // sendInvoiceReminder already incremented waRetryCount on failure
              results.whatsapp = { success: false, error: waResult.error || 'Gagal mengirim WA' }
              if (channel === 'whatsapp') {
                errors.push(waResult.error || 'Gagal mengirim WA')
              }
            } else {
              // sendInvoiceReminder already updated waNotifiedAt + waRetryCount on success
              results.whatsapp = { success: true }
              hasSuccess = true
            }
          } else {
            // No provider - increment waRetryCount so UI shows "WA Gagal"
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { waRetryCount: { increment: 1 } }
            }).catch(() => {})
            results.whatsapp = { success: false, error: 'Tidak ada provider WhatsApp aktif' }
            if (channel === 'whatsapp') {
              errors.push('Tidak ada provider WhatsApp aktif')
            }
          }
        } catch (waError: any) {
          console.error('[Send Reminder] WhatsApp error:', waError)
          // Increment waRetryCount so UI shows "WA Gagal" not "Belum WA"
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { waRetryCount: { increment: 1 } }
          }).catch(() => {})
          results.whatsapp = { success: false, error: waError.message || 'Gagal mengirim WA' }
          if (channel === 'whatsapp') {
            errors.push(waError.message || 'Gagal mengirim WA')
          }
        }
      } else {
        results.whatsapp = { success: false, error: 'Nomor telepon pelanggan tidak ditemukan' }
        if (channel === 'whatsapp') {
          errors.push('Nomor telepon pelanggan tidak ditemukan')
        }
      }
    }

    // Send Email reminder
    if (channel === 'email' || channel === 'both') {
      const customerEmail = invoice.customerEmail || invoice.user?.email

      if (customerEmail) {
        try {
          const emailResult = await EmailService.sendInvoiceReminder({
            email: customerEmail,
            ...reminderData
          })

          if (emailResult.success) {
            results.email = { success: true }
            hasSuccess = true
          } else {
            results.email = { success: false, error: emailResult.error || 'Failed to send email' }
            if (channel === 'email') {
              errors.push(emailResult.error || 'Failed to send email')
            }
          }
        } catch (emailError: any) {
          console.error('[Send Reminder] Email error:', emailError)
          results.email = { success: false, error: emailError.message || 'Failed to send email' }
          if (channel === 'email') {
            errors.push(emailError.message || 'Failed to send email')
          }
        }
      } else {
        results.email = { success: false, error: 'Customer email not found' }
        if (channel === 'email') {
          errors.push('Customer email not found')
        }
      }
    }

    // Determine response
    if (hasSuccess) {
      const successMessages: string[] = []
      if (results.whatsapp?.success) successMessages.push('WhatsApp')
      if (results.email?.success) successMessages.push('Email')

      return NextResponse.json({
        success: true,
        message: `Reminder sent successfully via ${successMessages.join(' and ')}`,
        results
      })
    } else {
      return NextResponse.json({
        success: false,
        error: errors.length > 0 ? errors.join('. ') : 'Failed to send reminder',
        results
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Send reminder error:', error)

    let errorMessage = 'Failed to send reminder';

    if (error.message?.includes('No active WhatsApp providers')) {
      errorMessage = 'No active WhatsApp provider configured. Please configure WhatsApp settings.';
    } else if (error.message?.includes('All WhatsApp providers failed')) {
      errorMessage = 'WhatsApp service unavailable. Please check provider settings.';
    } else if (error.message?.includes('session not ready')) {
      errorMessage = 'WhatsApp session not connected. Please scan QR code to connect.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}
