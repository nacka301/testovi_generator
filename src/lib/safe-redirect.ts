// Dopušta samo relativne putanje na istom izvoru (sprječava open redirect nakon prijave).
export function safeNextPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
