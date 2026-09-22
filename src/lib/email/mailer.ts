import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { isEmailConfigured, serverEnv } from "@/lib/env";

/**
 * Mail transport.
 *
 * Configuration is a single `EMAIL_SERVER` connection string, so swapping provider
 * (SMTP relay, Resend's SMTP bridge, Mailgun, SES…) is a change of environment
 * variable rather than a change of code.
 *
 * When no transport is configured the message is logged instead of sent, and the
 * caller records that plainly on the notification row: mail is never reported as
 * delivered when it was not.
 */

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport(serverEnv.emailServer);
  }
  return cachedTransport;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type MailResult =
  | { delivered: true }
  | { delivered: false; reason: string; configured: boolean };

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const transport = getTransport();

  if (!transport) {
    console.info(
      `[email] EMAIL_SERVER is not configured: "${message.subject}" to ${message.to} was not sent.`,
    );
    return {
      delivered: false,
      configured: false,
      reason: "EMAIL_SERVER is not configured, so this message was logged but not sent.",
    };
  }

  try {
    await transport.sendMail({
      from: serverEnv.emailFrom,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    });
    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      configured: true,
      reason: error instanceof Error ? error.message : "Unknown mail transport error",
    };
  }
}

/** Used by the admin settings screen to confirm SMTP credentials actually work. */
export async function verifyTransport(): Promise<{ ok: boolean; message: string }> {
  const transport = getTransport();
  if (!transport) {
    return { ok: false, message: "EMAIL_SERVER is not configured." };
  }
  try {
    await transport.verify();
    return { ok: true, message: "Connected to the mail server successfully." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not connect to the mail server.",
    };
  }
}
