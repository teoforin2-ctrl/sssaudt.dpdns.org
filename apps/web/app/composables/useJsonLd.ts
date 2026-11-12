/** Attach JSON-LD script tags. Skips empty / null payloads (no empty ld+json). */
export function useJsonLd(
  schema: MaybeRefOrGetter<Record<string, unknown> | Record<string, unknown>[] | null | undefined>,
) {
  useHead(() => {
    const value = toValue(schema);
    if (!value) return {};
    const graph = (Array.isArray(value) ? value : [value]).filter((item) => {
      if (!item || typeof item !== "object") return false;
      if (!Object.keys(item).length) return false;
      try {
        JSON.parse(JSON.stringify(item));
        return true;
      } catch {
        return false;
      }
    });
    if (!graph.length) return {};
    return {
      script: graph.map((item, i) => ({
        key: `jsonld-${i}-${String((item as { "@type"?: string })["@type"] || i)}`,
        type: "application/ld+json",
        // Nuxt 4 / Unhead: innerHTML puts JSON in the script body (not a `children` attr)
        innerHTML: JSON.stringify(item),
      })),
    };
  });
}
