import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { nanoid } from 'nanoid'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'

/**
 * GET /api/whatsapp/reminder-settings - Get current reminder settings
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the first (and only) settings record
    let settings = await prisma.whatsapp_reminder_settings.findFirst()
    
    // If no settings exist, create default
    if (!settings) {
      settings = await prisma.whatsapp_reminder_settings.create({
        data: {
          id: nanoid(),
          enabled: true,
          reminderDays: JSON.stringify([-6, -1]), // Default: H-6 and H-1
          reminderTime: '09:00', // Default: 9 AM WIB
          batchSize: 10,
          batchDelay: 120, // Default: 120s
          randomize: true,
          isolationDelayDays: 7,
          maxInvoiceReminders: 2,
          maxTotalMessagesPerCycle: 3,
        }
      })
    }
    
    const isStrict = !(
      ((settings as any).maxTotalMessagesPerCycle ?? 3) >= 99 ||
      ((settings as any).maxInvoiceReminders ?? 2) >= 99
    );

    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        enabled: settings.enabled,
        reminderDays: JSON.parse(settings.reminderDays),
        reminderTime: settings.reminderTime,
        otpEnabled: settings.otpEnabled,
        otpExpiry: settings.otpExpiry,
        batchSize: settings.batchSize ?? 10,
        batchDelay: settings.batchDelay ?? 120,
        randomize: settings.randomize ?? true,
        isolationDelayDays: (settings as any).isolationDelayDays ?? 7,
        maxInvoiceReminders: (settings as any).maxInvoiceReminders ?? 2,
        maxTotalMessagesPerCycle: (settings as any).maxTotalMessagesPerCycle ?? 3,
        strictQuotaEnabled: isStrict,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
      }
    })
  } catch (error: any) {
    console.error('Get reminder settings error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * PUT /api/whatsapp/reminder-settings - Update reminder settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      enabled,
      reminderDays,
      reminderTime,
      otpEnabled,
      otpExpiry,
      batchSize,
      batchDelay,
      randomize,
      isolationDelayDays,
      maxInvoiceReminders,
      maxTotalMessagesPerCycle,
      strictQuotaEnabled,
    } = body
    
    // Validation
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'enabled must be a boolean'
      }, { status: 400 })
    }
    
    if (!Array.isArray(reminderDays)) {
      return NextResponse.json({
        success: false,
        error: 'reminderDays must be an array'
      }, { status: 400 })
    }

    // Determine strict mode status
    const isStrict = typeof strictQuotaEnabled === 'boolean'
      ? strictQuotaEnabled
      : !(
          (typeof maxTotalMessagesPerCycle === 'number' && maxTotalMessagesPerCycle >= 99) ||
          (typeof maxInvoiceReminders === 'number' && maxInvoiceReminders >= 99)
        );

    const effectiveMaxReminders = isStrict ? 2 : 99;
    const effectiveMaxTotal = isStrict ? 3 : 99;

    if (isStrict) {
      if (reminderDays.length > 2) {
        return NextResponse.json({
          success: false,
          error: 'Dalam mode aturan ketat, maksimal 2 jadwal pengingat invoice sebelum jatuh tempo (cth: H-6 dan H-1)'
        }, { status: 400 })
      }
      
      // Validate reminderDays values (must be negative or 0)
      for (const day of reminderDays) {
        if (typeof day !== 'number' || day > 0) {
          return NextResponse.json({
            success: false,
            error: 'Dalam mode aturan ketat, jadwal pengingat hanya boleh bernilai <= 0 (cth: -6, -1)'
          }, { status: 400 })
        }
      }
    } else {
      // Flexible mode: allow before and/or after due date
      for (const day of reminderDays) {
        if (typeof day !== 'number') {
          return NextResponse.json({
            success: false,
            error: 'reminderDays harus berisi angka yang valid'
          }, { status: 400 })
        }
      }
    }
    
    // Validate reminderTime format (HH:mm)
    if (!/^\d{2}:\d{2}$/.test(reminderTime)) {
      return NextResponse.json({
        success: false,
        error: 'reminderTime must be in HH:mm format (e.g., 09:00)'
      }, { status: 400 })
    }
    
    // Get existing settings or create new
    let settings = await prisma.whatsapp_reminder_settings.findFirst()
    
    // Prepare update data
    const updateData: any = {
      enabled,
      reminderDays: JSON.stringify(reminderDays),
      reminderTime,
      maxInvoiceReminders: effectiveMaxReminders,
      maxTotalMessagesPerCycle: effectiveMaxTotal,
    }

    if (typeof isolationDelayDays === 'number' && isolationDelayDays >= 0) {
      updateData.isolationDelayDays = Math.round(isolationDelayDays)
    }
    
    // Add OTP fields if provided
    if (typeof otpEnabled === 'boolean') {
      updateData.otpEnabled = otpEnabled
    }
    if (typeof otpExpiry === 'number' && otpExpiry > 0) {
      updateData.otpExpiry = Math.round(otpExpiry)
    }
    
    // Add batch processing fields if provided
    if (typeof batchSize === 'number' && batchSize > 0) {
      updateData.batchSize = Math.round(batchSize)
    }
    if (typeof batchDelay === 'number' && batchDelay > 0) {
      updateData.batchDelay = Math.round(batchDelay)
    }
    if (typeof randomize === 'boolean') {
      updateData.randomize = randomize
    }
    
    if (settings) {
      // Update existing
      settings = await prisma.whatsapp_reminder_settings.update({
        where: { id: settings.id },
        data: updateData
      })
    } else {
      // Create new
      settings = await prisma.whatsapp_reminder_settings.create({
        data: {
          id: nanoid(),
          ...updateData
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Reminder settings updated successfully',
      settings: {
        id: settings.id,
        enabled: settings.enabled,
        reminderDays: JSON.parse(settings.reminderDays),
        reminderTime: settings.reminderTime,
        otpEnabled: settings.otpEnabled,
        otpExpiry: settings.otpExpiry,
        batchSize: settings.batchSize,
        batchDelay: settings.batchDelay,
        randomize: settings.randomize,
        isolationDelayDays: (settings as any).isolationDelayDays ?? 7,
        maxInvoiceReminders: (settings as any).maxInvoiceReminders ?? effectiveMaxReminders,
        maxTotalMessagesPerCycle: (settings as any).maxTotalMessagesPerCycle ?? effectiveMaxTotal,
        strictQuotaEnabled: isStrict,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
      }
    })
  } catch (error: any) {
    console.error('Update reminder settings error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
