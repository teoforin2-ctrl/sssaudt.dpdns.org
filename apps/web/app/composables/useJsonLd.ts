/** Attach JSON-LD script tags for key templates. */
export function useJsonLd(
  schema: MaybeRefOrGetter<Record<string, unknown> | Record<string, unknown>[] | null | undefined>,
) {
  useHead(() => {
    const value = toValue(schema);
    if (!value) return {};
    const graph = Array.isArray(value) ? value : [value];
    return {
      script: graph.map((item, i) => ({
        key: `jsonld-${i}-${String((item as { "@type"?: string })["@type"] || i)}`,
        type: "application/ld+json",
        children: JSON.stringify(item),
      })),
    };
  });
}
