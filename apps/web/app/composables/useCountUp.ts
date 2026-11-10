export function useCountUp(target: Ref<number> | number, ms = 900) {
  const value = ref(0);
  const reduced =
    import.meta.client && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function run(el?: Element | null) {
    const end = unref(target);
    if (reduced || !el) {
      value.value = end;
      return;
    }
    const start = performance.now();
    const from = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      value.value = Math.round(from + (end - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  return { value, run };
}
