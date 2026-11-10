export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "xr_theme";

function readStored(): ThemeMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function preferSystem(): ThemeMode {
  if (import.meta.client && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

export function useTheme() {
  const theme = useState<ThemeMode>("theme", () => "dark");

  function apply(mode: ThemeMode) {
    theme.value = mode;
    if (import.meta.client) {
      document.documentElement.setAttribute("data-theme", mode);
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        /* ignore */
      }
    }
  }

  function toggle() {
    apply(theme.value === "dark" ? "light" : "dark");
  }

  function init() {
    if (!import.meta.client) return;
    apply(readStored() ?? preferSystem());
  }

  return { theme, apply, toggle, init };
}
