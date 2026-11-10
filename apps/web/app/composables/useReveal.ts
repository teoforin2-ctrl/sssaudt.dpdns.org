type RevealOpts = {
  /** Stagger delay between children (ms). */
  stagger?: number;
  /** Max children to stagger. */
  max?: number;
  /** Root margin for IntersectionObserver. */
  rootMargin?: string;
  /** Once only (default true). */
  once?: boolean;
};

/**
 * Adds `.is-in` when element enters viewport.
 * Children with `[data-reveal-child]` get staggered `--reveal-i`.
 */
export function useReveal(opts: RevealOpts = {}) {
  const el = ref<HTMLElement | null>(null);
  const visible = ref(false);
  const stagger = opts.stagger ?? 40;
  const max = opts.max ?? 8;
  const once = opts.once !== false;
  let io: IntersectionObserver | null = null;

  onMounted(() => {
    const node = el.value;
    if (!node || !import.meta.client) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      visible.value = true;
      node.classList.add("is-in");
      return;
    }

    const kids = [...node.querySelectorAll<HTMLElement>("[data-reveal-child]")].slice(0, max);
    kids.forEach((child, i) => {
      child.style.setProperty("--reveal-i", String(i));
      child.style.setProperty("--reveal-stagger", `${stagger}ms`);
    });

    io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        visible.value = true;
        node.classList.add("is-in");
        if (once) io?.disconnect();
      },
      { rootMargin: opts.rootMargin ?? "0px 0px -8% 0px", threshold: 0.12 },
    );
    io.observe(node as unknown as Element);
  });

  onBeforeUnmount(() => {
    io?.disconnect();
    io = null;
  });

  return { el, visible, stagger };
}
