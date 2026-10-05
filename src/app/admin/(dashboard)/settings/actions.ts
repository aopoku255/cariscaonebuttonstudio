"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { SETTING_DEFAULTS, type SettingKey, updateSettings } from "@/lib/settings";
import { verifyTransport } from "@/lib/email/mailer";
import { type ActionResult, actionError, actionOk } from "@/lib/validation/common";

/**
 * Studio settings.
 *
 * Only keys that exist in `SETTING_DEFAULTS` are accepted, so a crafted payload cannot
 * write arbitrary rows into the settings table.
 */
export async function saveSettings(
  values: Record<string, string>,
): Promise<ActionResult> {
  const admin = await requireAdmin("settings:manage");

  const accepted: Partial<Record<SettingKey, string>> = {};
  const rejected: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (key in SETTING_DEFAULTS) {
      accepted[key as SettingKey] = String(value).slice(0, 4000);
    } else {
      rejected.push(key);
    }
  }

  if (Object.keys(accepted).length === 0) {
    return actionError("There was nothing to save.");
  }

  // Sanity-check the numeric policy values before they reach the booking engine.
  const numericKeys: SettingKey[] = [
    "booking.intervalMinutes",
    "booking.minDurationMinutes",
    "booking.maxDurationMinutes",
    "booking.leadTimeHours",
    "booking.maxAdvanceDays",
    "booking.pendingExpiryMinutes",
    "pricing.taxPercent",
    "cancellation.freeCancellationHours",
    "cancellation.lateRefundPercent",
    "cancellation.partialRefundHours",
    "cancellation.partialRefundPercent",
    "notifications.reminderHoursBefore",
  ];

  for (const key of numericKeys) {
    if (accepted[key] === undefined) continue;
    const parsed = Number(accepted[key]);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return actionError(`"${key}" must be a number of zero or more.`, {
        [key]: "Enter a number",
      });
    }
  }

  const percentKeys: SettingKey[] = [
    "cancellation.lateRefundPercent",
    "cancellation.partialRefundPercent",
    "cancellation.noShowRefundPercent",
  ];
  for (const key of percentKeys) {
    const raw = accepted[key];
    // The no-show refund may be left blank, meaning "same as the late refund".
    if (raw === undefined || (key === "cancellation.noShowRefundPercent" && raw.trim() === "")) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return actionError("A refund percentage must be between 0 and 100.", {
        [key]: "Enter a number from 0 to 100",
      });
    }
  }

  const freeWindow = Number(
    accepted["cancellation.freeCancellationHours"] ??
      SETTING_DEFAULTS["cancellation.freeCancellationHours"],
  );
  const partialWindow = Number(accepted["cancellation.partialRefundHours"] ?? 0);
  if (partialWindow > 0 && partialWindow >= freeWindow) {
    return actionError(
      "The partial refund window must be shorter than the free cancellation window.",
      { "cancellation.partialRefundHours": "Must be below the free window, or 0" },
    );
  }

  if (accepted["legal.dpcStatus"] && !["NOT_CONFIRMED", "REGISTERED"].includes(accepted["legal.dpcStatus"])) {
    return actionError("Choose a registration status.", { "legal.dpcStatus": "Choose one" });
  }

  const interval = Number(accepted["booking.intervalMinutes"] ?? SETTING_DEFAULTS["booking.intervalMinutes"]);
  if (interval % 30 !== 0) {
    return actionError(
      "The booking interval must be a multiple of 30 minutes, because slots are held on a half-hour grid.",
      { "booking.intervalMinutes": "Use 30, 60, 90…" },
    );
  }

  const minDuration = Number(
    accepted["booking.minDurationMinutes"] ?? SETTING_DEFAULTS["booking.minDurationMinutes"],
  );
  const maxDuration = Number(
    accepted["booking.maxDurationMinutes"] ?? SETTING_DEFAULTS["booking.maxDurationMinutes"],
  );
  if (maxDuration < minDuration) {
    return actionError("The maximum booking length cannot be below the minimum.", {
      "booking.maxDurationMinutes": "Must be at least the minimum",
    });
  }

  await updateSettings(accepted);

  await recordAudit(admin, {
    action: "settings.update",
    entity: "StudioSetting",
    summary: `Updated ${Object.keys(accepted).length} setting(s)`,
    metadata: { keys: Object.keys(accepted) },
  });

  // Settings feed almost every page, so refresh the public site too.
  for (const path of ["/admin/settings", "/", "/book", "/packages", "/students", "/faq", "/contact"]) {
    revalidatePath(path);
  }
  // The policy pages quote settings directly, so they must pick up the change too.
  revalidatePath("/", "layout");

  return actionOk(
    undefined,
    rejected.length
      ? `Settings saved. ${rejected.length} unknown setting(s) were ignored.`
      : "Settings saved.",
  );
}

/** Check the configured SMTP credentials actually connect. */
export async function testEmailConnection(): Promise<ActionResult> {
  await requireAdmin("settings:manage");
  const result = await verifyTransport();
  return result.ok ? actionOk(undefined, result.message) : actionError(result.message);
}
