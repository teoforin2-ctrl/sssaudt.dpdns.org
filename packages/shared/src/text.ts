/**
 * Import artifact: bonus descriptions were stored as JSON text with \uXXXX escapes,
 * e.g. `["\\u0411\\u043E\\u043D\\u0443\\u0441 ..."]` instead of plain UTF-8.
 */
export function decodeStoredText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw);
  if (!s) return s;

  const trimmed = s.trim();
  if (
    !(
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    )
  ) {
    return s;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return (parsed as string[]).join("\n\n");
    }
  } catch {
    /* keep original */
  }

  return s;
}
