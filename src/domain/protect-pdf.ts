export interface ProtectPdfPermissions {
  readonly printing: boolean;
  readonly copying: boolean;
  readonly editing: boolean;
}

export interface PasswordAssessment {
  readonly score: 0 | 1 | 2 | 3 | 4;
  readonly label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  readonly suggestions: readonly string[];
}

export const DEFAULT_PROTECT_PDF_PERMISSIONS: ProtectPdfPermissions = {
  printing: true,
  copying: true,
  editing: true,
};

export function assessPdfPassword(password: string): PasswordAssessment {
  const suggestions: string[] = [];
  if (password.length < 8) suggestions.push("Use at least 8 characters.");
  if (password.length < 12) suggestions.push("A longer passphrase is safer.");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) suggestions.push("Mix uppercase and lowercase letters.");
  if (!/\d/.test(password)) suggestions.push("Add a number.");
  if (!/[^\p{L}\p{N}\s]/u.test(password)) suggestions.push("Add a symbol.");

  if (password.length < 8) return { score: 0, label: "Too short", suggestions };
  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^\p{L}\p{N}\s]/u.test(password)) score += 1;
  const normalizedScore = Math.min(4, score) as 1 | 2 | 3 | 4;
  const labels = ["Weak", "Fair", "Good", "Strong"] as const;
  return { score: normalizedScore, label: labels[normalizedScore - 1]!, suggestions };
}

export function validateProtectPdfPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return "Use a password with at least 8 characters.";
  if (password.length > 127) return "Use a password no longer than 127 characters.";
  if (password !== confirmation) return "The passwords do not match.";
  return null;
}
