export type CookieChoice = "all" | "necessary" | null;

const STORAGE_KEY = "xr_cookie_consent";

export function useCookieConsent() {
  const choice = useState<CookieChoice>("cookie-consent", () => null);

  function read() {
    if (!import.meta.client) return;
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "all" || v === "necessary") choice.value = v;
    } catch {
      /* ignore */
    }
  }

  function accept(value: Exclude<CookieChoice, null>) {
    choice.value = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }

  return { choice, read, accept };
}
