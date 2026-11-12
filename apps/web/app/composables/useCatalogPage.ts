/** Shared catalog pagination helpers (SSR-friendly /page/N). */
export function useCatalogPage(opts: {
  total: MaybeRefOrGetter<number>;
  pageSize: number;
  basePath: string;
}) {
  const route = useRoute();
  const localePath = useLocalePath();

  const pageNum = computed(() => {
    const n = Number(route.params.page);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  });

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(toValue(opts.total) / opts.pageSize)),
  );

  function slice<T>(list: T[]): T[] {
    const start = (pageNum.value - 1) * opts.pageSize;
    return list.slice(start, start + opts.pageSize);
  }

  const prevPage = computed(() => {
    if (pageNum.value <= 2) return localePath(opts.basePath);
    return localePath(`${opts.basePath}/page/${pageNum.value - 1}`);
  });

  const nextPage = computed(() => {
    if (pageNum.value >= totalPages.value) return null;
    return localePath(`${opts.basePath}/page/${pageNum.value + 1}`);
  });

  function guardPage() {
    if (pageNum.value === 1) {
      return navigateTo(localePath(opts.basePath), { redirectCode: 301 });
    }
    return null;
  }

  function assertInRange(pending: boolean, listLen: number) {
    if (pending) return;
    if (pageNum.value === 1) return;
    if (listLen === 0) return;
    if (pageNum.value > totalPages.value) {
      throw createError({ statusCode: 404, statusMessage: "Page not found" });
    }
  }

  return {
    pageNum,
    totalPages,
    pageSize: opts.pageSize,
    slice,
    prevPage,
    nextPage,
    guardPage,
    assertInRange,
  };
}
