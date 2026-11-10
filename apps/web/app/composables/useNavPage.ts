import {
  findNavLink,
  locTitle,
  siteNav,
  type NavLink,
  type NavSection,
} from "~/data/site-nav";

export function useNavPage(path: string) {
  const { locale } = useI18n();
  const link = findNavLink(path);

  if (!link) {
    throw createError({ statusCode: 404, statusMessage: "Page not found" });
  }

  const section = siteNav.find(
    (s) => s.path === path || path.startsWith(`${s.path}/`),
  ) as NavSection | undefined;

  const childLinks: NavLink[] = [];
  if (section && section.path === path && section.columns) {
    for (const col of section.columns) {
      for (const item of col.items) {
        if (item.path !== path) childLinks.push(item);
      }
    }
  }

  return {
    link,
    title: computed(() => locTitle(link.title, locale.value)),
    childLinks,
  };
}
