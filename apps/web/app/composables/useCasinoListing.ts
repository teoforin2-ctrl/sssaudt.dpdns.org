export type CasinoListItem = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  rating: number;
  editorialScore?: number;
  playerScore?: number | null;
  reviewCount?: number;
  hot: boolean;
  top: boolean;
  rank: number;
  isNew?: boolean;
  hasRepresentative?: boolean;
  bonusLabel?: string | null;
  bonusWager?: string | null;
  bonusPromo?: string | null;
  bonusCheckedAt?: string | null;
  license?: string | null;
};

export type CasinoFilterKey = "all" | "top" | "hot" | "new";

export const CASINO_PAGE_SIZE = 20;

export function useCasinoListing(opts?: {
  filter?: Ref<CasinoFilterKey> | CasinoFilterKey;
}) {
  const config = useRuntimeConfig();
  const { locale } = useI18n();

  const { data, error, pending, refresh } = useAsyncData(
    () => `casino-listing-${locale.value}`,
    () =>
      $fetch<{ items: CasinoListItem[] }>(`${config.public.apiBase}/v1/casinos`, {
        query: { locale: locale.value },
      }),
    { watch: [locale] },
  );

  const filterRef = computed<CasinoFilterKey>(() => {
    const f = opts?.filter;
    if (!f) return "all";
    return unref(f);
  });

  const all = computed(() => data.value?.items ?? []);
  const items = computed(() => {
    let list = [...all.value];
    const filter = filterRef.value;
    if (filter === "top") list = list.filter((c) => c.top);
    else if (filter === "hot") list = list.filter((c) => c.hot);
    else if (filter === "new") list = list.filter((c) => c.isNew);
    return list;
  });

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(items.value.length / CASINO_PAGE_SIZE)),
  );

  function pageSlice(page: number) {
    const p = Math.max(1, Math.floor(page) || 1);
    const start = (p - 1) * CASINO_PAGE_SIZE;
    return items.value.slice(start, start + CASINO_PAGE_SIZE).map((c, i) => ({
      ...c,
      displayRank: start + i + 1,
    }));
  }

  return {
    all,
    items,
    totalPages,
    pageSlice,
    error,
    pending,
    refresh,
    pageSize: CASINO_PAGE_SIZE,
  };
}
