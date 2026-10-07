export function validateUnlockPdfPassword(password: string, requiresPassword: boolean): string | null {
  if (requiresPassword && password.length === 0) return "Enter the current PDF password.";
  if (password.length > 127) return "Use a password no longer than 127 characters.";
  return null;
}

export function unlockedPdfName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "").trim() || "document";
  return `${base}-unlocked.pdf`;
}
