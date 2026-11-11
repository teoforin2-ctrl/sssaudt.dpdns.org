/**
 * Align SSR `data-theme` with the cookie set by theme-boot / useTheme,
 * so first paint matches hydration (avoids mismatch when user chose light).
 */
export default defineNuxtPlugin(() => {
  const theme = useCookie<"dark" | "light" | null>("xr_theme", {
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  const mode = theme.value === "light" || theme.value === "dark" ? theme.value : "dark";
  useHead({
    htmlAttrs: {
      "data-theme": mode,
    },
  });
});
