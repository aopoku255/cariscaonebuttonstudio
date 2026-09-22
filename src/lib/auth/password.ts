import "server-only";

import bcrypt from "bcryptjs";

/** Work factor for bcrypt. 12 is the current sensible default for interactive logins. */
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Burn roughly the same time as a real comparison when the account does not exist, so
 * response timing does not reveal which email addresses are registered.
 */
export async function fakeVerify(): Promise<void> {
  await bcrypt.compare(
    "not-a-real-password",
    "$2a$12$C6UzMDM.H6dfI/f/IKcEe.3Q0Bq9SqOQkYy5GkQ1n0kEHkJQZ1s8e",
  );
}

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

export function checkPasswordStrength(password: string): PasswordCheck {
  if (password.length < 10) {
    return { ok: false, message: "Password must be at least 10 characters." };
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return { ok: false, message: "Password must include both upper and lower case letters." };
  }
  if (!/\d/.test(password)) {
    return { ok: false, message: "Password must include at least one number." };
  }
  return { ok: true };
}
