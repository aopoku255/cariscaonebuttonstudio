import { appUrl } from "@/lib/env";
import { bookingPath } from "@/lib/booking/access";
import { formatLongDate, formatTimeRange } from "@/lib/booking/time";
import { formatDuration, formatMoney } from "@/lib/utils";

/**
 * Email templates.
 *
 * Kept as plain string builders rather than a rendering library: these messages are
 * simple, and inline-styled tables are what mail clients actually render reliably.
 * Every template returns both an HTML and a plain-text body.
 */

export interface BookingEmailData {
  reference: string;
  customerName: string;
  packageName: string;
  bookingDate: Date;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  totalMinor: number;
  currency: string;
  addOns: { name: string; quantity: number }[];
  studioName: string;
  studioLocation: string;
  studioPhone: string;
  studioEmail: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = "#0A2961";
const ACCENT = "#0F3B8F";
const INK = "#0F172A";
const MUTED = "#64748B";
const LINE = "#E1E7F0";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(options: {
  heading: string;
  intro: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote: string;
  studioName: string;
}): string {
  const cta =
    options.ctaLabel && options.ctaUrl
      ? `<tr><td style="padding:8px 32px 32px;">
           <a href="${options.ctaUrl}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:6px;font-weight:600;font-size:15px;">${escapeHtml(options.ctaLabel)}</a>
         </td></tr>`
      : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#F6F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden;">
    <tr><td style="background:${BRAND};padding:24px 32px;">
      <div style="color:#ffffff;font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;">${escapeHtml(options.studioName)}</div>
      <div style="color:${ACCENT};font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-top:4px;">Create. Record. Share.</div>
    </td></tr>
    <tr><td style="padding:32px 32px 8px;">
      <h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;color:${INK};">${escapeHtml(options.heading)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">${escapeHtml(options.intro)}</p>
      ${options.body}
    </td></tr>
    ${cta}
    <tr><td style="padding:20px 32px 28px;border-top:1px solid ${LINE};">
      <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">${options.footerNote}</p>
    </td></tr>
  </table>
</body></html>`;
}

function detailsTable(data: BookingEmailData): string {
  const rows: [string, string][] = [
    ["Booking reference", data.reference],
    ["Package", data.packageName],
    ["Date", formatLongDate(data.bookingDate)],
    ["Time", formatTimeRange(data.startMinute, data.endMinute)],
    ["Duration", formatDuration(data.durationMinutes)],
  ];

  if (data.addOns.length) {
    rows.push([
      "Add-ons",
      data.addOns
        .map((addOn) => (addOn.quantity > 1 ? `${addOn.name} ×${addOn.quantity}` : addOn.name))
        .join(", "),
    ]);
  }

  rows.push(["Total", formatMoney(data.totalMinor, data.currency)]);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:8px;margin:0 0 8px;">
    ${rows
      .map(
        ([label, value], index) => `<tr>
        <td style="padding:12px 16px;font-size:13px;color:${MUTED};border-top:${index === 0 ? "none" : `1px solid ${LINE}`};width:42%;">${escapeHtml(label)}</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:600;color:${INK};border-top:${index === 0 ? "none" : `1px solid ${LINE}`};">${escapeHtml(value)}</td>
      </tr>`,
      )
      .join("")}
  </table>`;
}

function detailsText(data: BookingEmailData): string {
  const lines = [
    `Booking reference: ${data.reference}`,
    `Package: ${data.packageName}`,
    `Date: ${formatLongDate(data.bookingDate)}`,
    `Time: ${formatTimeRange(data.startMinute, data.endMinute)}`,
    `Duration: ${formatDuration(data.durationMinutes)}`,
  ];
  if (data.addOns.length) {
    lines.push(
      `Add-ons: ${data.addOns.map((a) => (a.quantity > 1 ? `${a.name} x${a.quantity}` : a.name)).join(", ")}`,
    );
  }
  lines.push(`Total: ${formatMoney(data.totalMinor, data.currency)}`);
  return lines.join("\n");
}

function signature(data: BookingEmailData): string {
  return `${data.studioName}\n${data.studioLocation}\n${data.studioPhone} · ${data.studioEmail}`;
}

function footerHtml(data: BookingEmailData): string {
  return `${escapeHtml(data.studioName)} · ${escapeHtml(data.studioLocation)}<br>${escapeHtml(data.studioPhone)} · <a href="mailto:${escapeHtml(data.studioEmail)}" style="color:${BRAND};">${escapeHtml(data.studioEmail)}</a>`;
}

/** Full link to a booking, carrying the access token so the recipient can open it. */
function bookingUrl(reference: string): string {
  return `${appUrl()}${bookingPath(reference)}`;
}

export function renderBookingCreated(data: BookingEmailData): RenderedEmail {
  return {
    subject: `Your booking has been received: ${data.reference}`,
    html: layout({
      studioName: data.studioName,
      heading: "Your booking has been received",
      intro: `Hi ${data.customerName}, we have your session details. It is held for you while your payment is completed.`,
      body:
        detailsTable(data) +
        `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">This slot is reserved for a short window. Once payment goes through, you will get a confirmation email with your final booking details.</p>`,
      ctaLabel: "View your booking",
      ctaUrl: bookingUrl(data.reference),
      footerNote: footerHtml(data),
    }),
    text: `Hi ${data.customerName},

Your booking has been received and is held while payment is completed.

${detailsText(data)}

View your booking: ${bookingUrl(data.reference)}

${signature(data)}`,
  };
}

export function renderPaymentSuccessful(data: BookingEmailData): RenderedEmail {
  return {
    subject: `Your ${data.studioName} booking is confirmed: ${data.reference}`,
    html: layout({
      studioName: data.studioName,
      heading: "Your booking is confirmed",
      intro: `Thanks ${data.customerName}: your payment went through and the studio is booked for you.`,
      body:
        detailsTable(data) +
        `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">Please arrive about ten minutes early so we can get you set up and start on time. Bring any files, scripts or props you plan to use.</p>`,
      ctaLabel: "View booking & receipt",
      ctaUrl: bookingUrl(data.reference),
      footerNote: footerHtml(data),
    }),
    text: `Hi ${data.customerName},

Your payment was successful and your booking is confirmed.

${detailsText(data)}

View your booking and receipt: ${bookingUrl(data.reference)}

Please arrive about ten minutes early.

${signature(data)}`,
  };
}

export function renderBookingCancelled(
  data: BookingEmailData,
  reason: string | null,
): RenderedEmail {
  const reasonBlock = reason
    ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${MUTED};"><strong style="color:${INK};">Reason:</strong> ${escapeHtml(reason)}</p>`
    : "";
  return {
    subject: `Your booking has been cancelled: ${data.reference}`,
    html: layout({
      studioName: data.studioName,
      heading: "Your booking has been cancelled",
      intro: `Hi ${data.customerName}, the session below is no longer scheduled.`,
      body:
        detailsTable(data) +
        reasonBlock +
        `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">If a refund is due under our cancellation policy, it will be processed to your original payment method. You are welcome to book another session whenever suits you.</p>`,
      ctaLabel: "Book another session",
      ctaUrl: `${appUrl()}/book`,
      footerNote: footerHtml(data),
    }),
    text: `Hi ${data.customerName},

Your booking has been cancelled.

${detailsText(data)}
${reason ? `\nReason: ${reason}\n` : ""}
Book another session: ${appUrl()}/book

${signature(data)}`,
  };
}

export function renderBookingReminder(data: BookingEmailData): RenderedEmail {
  return {
    subject: `Reminder: your studio session on ${formatLongDate(data.bookingDate)}`,
    html: layout({
      studioName: data.studioName,
      heading: "Your session is coming up",
      intro: `Hi ${data.customerName}, this is a reminder about your upcoming studio session.`,
      body:
        detailsTable(data) +
        `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">We are at ${escapeHtml(data.studioLocation)}. Arrive about ten minutes early to set up. If anything has changed, call us on ${escapeHtml(data.studioPhone)}.</p>`,
      ctaLabel: "View your booking",
      ctaUrl: bookingUrl(data.reference),
      footerNote: footerHtml(data),
    }),
    text: `Hi ${data.customerName},

A reminder about your upcoming studio session.

${detailsText(data)}

We are at ${data.studioLocation}. Please arrive about ten minutes early.

${signature(data)}`,
  };
}

export function renderBookingCompleted(data: BookingEmailData): RenderedEmail {
  return {
    subject: `Thanks for creating with us: ${data.reference}`,
    html: layout({
      studioName: data.studioName,
      heading: "Thanks for creating with us",
      intro: `Hi ${data.customerName}, we hope the session went well.`,
      body:
        detailsTable(data) +
        `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">If you have a moment, reply to this email and tell us how it went: what worked, and what would make the studio better for your next session. It genuinely shapes what we do next.</p>`,
      ctaLabel: "Book your next session",
      ctaUrl: `${appUrl()}/book`,
      footerNote: footerHtml(data),
    }),
    text: `Hi ${data.customerName},

Thanks for creating with us: we hope the session went well.

${detailsText(data)}

Reply to this email and tell us how it went; it shapes what we do next.

Book your next session: ${appUrl()}/book

${signature(data)}`,
  };
}

export interface CorporateInquiryEmailData {
  organisation: string;
  contactName: string;
  email: string;
  phone: string;
  sessionsRequired: number | null;
  estimatedHours: number | null;
  contentType: string | null;
  requirements: string | null;
  studioName: string;
}

export function renderCorporateInquiryAdmin(
  data: CorporateInquiryEmailData,
): RenderedEmail {
  const rows: [string, string][] = [
    ["Organisation", data.organisation],
    ["Contact", data.contactName],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Sessions required", data.sessionsRequired ? `${data.sessionsRequired}` : "Not specified"],
    ["Estimated hours", data.estimatedHours ? `${data.estimatedHours}` : "Not specified"],
    ["Content type", data.contentType || "Not specified"],
  ];

  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:8px;">
    ${rows
      .map(
        ([label, value], index) => `<tr>
          <td style="padding:12px 16px;font-size:13px;color:${MUTED};border-top:${index === 0 ? "none" : `1px solid ${LINE}`};width:42%;">${escapeHtml(label)}</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:600;color:${INK};border-top:${index === 0 ? "none" : `1px solid ${LINE}`};">${escapeHtml(value)}</td>
        </tr>`,
      )
      .join("")}
  </table>${
    data.requirements
      ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${MUTED};"><strong style="color:${INK};">Requirements:</strong><br>${escapeHtml(data.requirements)}</p>`
      : ""
  }`;

  return {
    subject: `Corporate package request: ${data.organisation}`,
    html: layout({
      studioName: data.studioName,
      heading: "New corporate package request",
      intro: `${data.contactName} from ${data.organisation} has asked about a custom studio package.`,
      body: table,
      ctaLabel: "Open in dashboard",
      ctaUrl: `${appUrl()}/admin/inquiries`,
      footerNote: `Sent automatically by the ${escapeHtml(data.studioName)} booking platform.`,
    }),
    text: `New corporate package request

${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}
${data.requirements ? `\nRequirements:\n${data.requirements}\n` : ""}
Open in dashboard: ${appUrl()}/admin/inquiries`,
  };
}
