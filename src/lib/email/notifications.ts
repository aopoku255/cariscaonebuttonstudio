import "server-only";

import { NotificationStatus, NotificationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { sendMail } from "@/lib/email/mailer";
import {
  type BookingEmailData,
  type CorporateInquiryEmailData,
  type RenderedEmail,
  renderBookingCancelled,
  renderBookingCompleted,
  renderBookingCreated,
  renderBookingReminder,
  renderCorporateInquiryAdmin,
  renderPaymentSuccessful,
} from "@/lib/email/templates";
import { getSettings, settingBool } from "@/lib/settings";

/**
 * Every outbound message is recorded in the `Notification` table before it is sent, so
 * the admin dashboard shows exactly what went out, what failed and why: including
 * when mail is not configured at all.
 */

async function deliver(params: {
  type: NotificationType;
  recipient: string;
  email: RenderedEmail;
  bookingId?: string | null;
  replyTo?: string;
}): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      type: params.type,
      recipient: params.recipient,
      subject: params.email.subject,
      body: params.email.html,
      bookingId: params.bookingId ?? null,
      status: NotificationStatus.QUEUED,
    },
  });

  const result = await sendMail({
    to: params.recipient,
    subject: params.email.subject,
    html: params.email.html,
    text: params.email.text,
    replyTo: params.replyTo,
  });

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: result.delivered ? NotificationStatus.SENT : NotificationStatus.FAILED,
      sentAt: result.delivered ? new Date() : null,
      attempts: { increment: 1 },
      error: result.delivered ? null : result.reason,
    },
  });
}

/**
 * Notifications must never break the flow that triggered them: a booking is still a
 * valid booking if the mail server is down. Failures are recorded, not thrown.
 */
async function safely(label: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`[notifications] ${label} failed:`, error);
  }
}

async function loadBookingEmailData(bookingId: string): Promise<{
  data: BookingEmailData;
  email: string;
} | null> {
  const [booking, settings] = await Promise.all([
    prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, addOns: true },
    }),
    getSettings(),
  ]);

  if (!booking) return null;

  return {
    email: booking.customer.email,
    data: {
      reference: booking.reference,
      customerName: booking.customer.name.split(" ")[0] || booking.customer.name,
      packageName: booking.packageNameSnapshot ?? "Studio session",
      bookingDate: booking.bookingDate,
      startMinute: booking.startMinute,
      endMinute: booking.endMinute,
      durationMinutes: booking.durationMinutes,
      totalMinor: booking.totalMinor,
      currency: booking.currency,
      addOns: booking.addOns.map((addOn) => ({
        name: addOn.nameSnapshot,
        quantity: addOn.quantity,
      })),
      studioName: settings["studio.name"],
      studioLocation: settings["studio.location"],
      studioPhone: settings["studio.phone"],
      studioEmail: settings["studio.email"],
    },
  };
}

export async function notifyBookingCreated(bookingId: string): Promise<void> {
  await safely("booking created", async () => {
    const settings = await getSettings();
    if (!settingBool(settings, "notifications.sendBookingConfirmation")) return;

    const loaded = await loadBookingEmailData(bookingId);
    if (!loaded) return;

    await deliver({
      type: NotificationType.BOOKING_CREATED,
      recipient: loaded.email,
      email: renderBookingCreated(loaded.data),
      bookingId,
      replyTo: settings["studio.email"],
    });
  });
}

export async function notifyPaymentSuccessful(bookingId: string): Promise<void> {
  await safely("payment successful", async () => {
    const settings = await getSettings();
    const loaded = await loadBookingEmailData(bookingId);
    if (!loaded) return;

    await deliver({
      type: NotificationType.PAYMENT_SUCCESSFUL,
      recipient: loaded.email,
      email: renderPaymentSuccessful(loaded.data),
      bookingId,
      replyTo: settings["studio.email"],
    });

    // Copy the studio inbox so staff see new confirmed bookings without logging in.
    const adminEmail = settings["notifications.adminEmail"] || serverEnv.adminEmail;
    if (adminEmail) {
      await deliver({
        type: NotificationType.PAYMENT_SUCCESSFUL,
        recipient: adminEmail,
        email: renderPaymentSuccessful(loaded.data),
        bookingId,
      });
    }
  });
}

export async function notifyBookingCancelled(
  bookingId: string,
  reason: string | null,
): Promise<void> {
  await safely("booking cancelled", async () => {
    const settings = await getSettings();
    const loaded = await loadBookingEmailData(bookingId);
    if (!loaded) return;

    await deliver({
      type: NotificationType.BOOKING_CANCELLED,
      recipient: loaded.email,
      email: renderBookingCancelled(loaded.data, reason),
      bookingId,
      replyTo: settings["studio.email"],
    });
  });
}

export async function notifyBookingReminder(bookingId: string): Promise<void> {
  await safely("booking reminder", async () => {
    const settings = await getSettings();
    if (!settingBool(settings, "notifications.sendReminders")) return;

    const loaded = await loadBookingEmailData(bookingId);
    if (!loaded) return;

    await deliver({
      type: NotificationType.BOOKING_REMINDER,
      recipient: loaded.email,
      email: renderBookingReminder(loaded.data),
      bookingId,
      replyTo: settings["studio.email"],
    });
  });
}

export async function notifyBookingCompleted(bookingId: string): Promise<void> {
  await safely("booking completed", async () => {
    const settings = await getSettings();
    const loaded = await loadBookingEmailData(bookingId);
    if (!loaded) return;

    await deliver({
      type: NotificationType.BOOKING_COMPLETED,
      recipient: loaded.email,
      email: renderBookingCompleted(loaded.data),
      bookingId,
      replyTo: settings["studio.email"],
    });
  });
}

export async function notifyCorporateInquiry(inquiryId: string): Promise<void> {
  await safely("corporate inquiry", async () => {
    const [inquiry, settings] = await Promise.all([
      prisma.corporateInquiry.findUnique({ where: { id: inquiryId } }),
      getSettings(),
    ]);
    if (!inquiry) return;

    const data: CorporateInquiryEmailData = {
      organisation: inquiry.organisation,
      contactName: inquiry.contactName,
      email: inquiry.email,
      phone: inquiry.phone,
      sessionsRequired: inquiry.sessionsRequired,
      estimatedHours: inquiry.estimatedHours,
      contentType: inquiry.contentType,
      requirements: inquiry.requirements,
      studioName: settings["studio.name"],
    };

    const adminEmail = settings["notifications.adminEmail"] || serverEnv.adminEmail;
    if (!adminEmail) return;

    await deliver({
      type: NotificationType.CORPORATE_INQUIRY,
      recipient: adminEmail,
      email: renderCorporateInquiryAdmin(data),
      replyTo: inquiry.email,
    });
  });
}

/**
 * Send reminders for sessions starting inside the configured window. Idempotent:
 * `reminderSentAt` stops a booking being reminded twice.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const settings = await getSettings();
  if (!settingBool(settings, "notifications.sendReminders")) return 0;

  const hoursBefore = Number.parseInt(settings["notifications.reminderHoursBefore"], 10) || 24;
  const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60_000);

  const due = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "PENDING_APPROVAL"] },
      reminderSentAt: null,
      startsAt: { gt: now, lte: windowEnd },
    },
    select: { id: true },
    take: 100,
  });

  for (const booking of due) {
    await notifyBookingReminder(booking.id);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return due.length;
}
