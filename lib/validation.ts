export type ValidationResult = { ok: true } | { ok: false; message: string };

export function validateEmail(value: string): ValidationResult {
  const email = value.trim();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  return { ok: true };
}

export function validatePassword(value: string): ValidationResult {
  if (value.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  return { ok: true };
}

export function validateWorkspaceName(value: string): ValidationResult {
  const name = value.trim();
  if (!name || name.length > 120) return { ok: false, message: "Enter a workspace name (1–120 characters)." };
  return { ok: true };
}

export function validateInvitationToken(value: string): ValidationResult {
  if (!value.trim() || value.length > 512) return { ok: false, message: "Paste a valid invitation token." };
  return { ok: true };
}
