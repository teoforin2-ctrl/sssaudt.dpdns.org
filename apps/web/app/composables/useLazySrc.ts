/**
 * Defer image src until near viewport — after mount, to avoid SSR/client hydration mismatches.
 */
export function useLazySrc(
  rawSrc: MaybeRefOrGetter<string | null | undefined>,
  opts: {
    eager?: MaybeRefOrGetter<boolean | undefined>;
    rootMargin?: string;
  } = {},
) {
  const el = ref<HTMLElement | null>(null);
  const inView = ref(false);
  const mounted = ref(false);
  const rootMargin = opts.rootMargin ?? "240px 0px";

  const eager = computed(() => Boolean(toValue(opts.eager)));
  const source = computed(() => {
    const v = toValue(rawSrc);
    return v && String(v).trim() ? String(v) : null;
  });

  const activeSrc = computed(() => {
    if (!source.value) return null;
    // Eager: always in HTML (SSR + client). Lazy: only after mount + intersect.
    if (eager.value) return source.value;
    if (!mounted.value || !inView.value) return null;
    return source.value;
  });

  onMounted(() => {
    mounted.value = true;
  });

  watch(
    [el, eager, source, mounted],
    (_vals, _prev, onCleanup) => {
      if (!import.meta.client || !mounted.value) return;
      const isEager = eager.value;
      const src = source.value;
      const node = el.value;
      if (isEager || !src) {
        inView.value = Boolean(isEager && src);
        return;
      }
      if (!node) return;
      if (typeof IntersectionObserver === "undefined") {
        inView.value = true;
        return;
      }

      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            inView.value = true;
            io.disconnect();
          }
        },
        { root: null, rootMargin, threshold: 0.01 },
      );
      io.observe(node);
      onCleanup(() => io.disconnect());
    },
    { flush: "post" },
  );

  return { el, activeSrc, inView };
}
