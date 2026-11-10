const STORAGE_KEY = "xr_age_gate_ok";
const LANG_KEY = "xr_lang_pref";

export type AgeGateLocale = "ru" | "en";

export function useAgeGate() {
  const accepted = useState<boolean | null>("age-gate", () => null);

  function read() {
    if (!import.meta.client)
      return;
    try {
      accepted.value = localStorage.getItem(STORAGE_KEY) === "1";
    }
    catch {
      accepted.value = false;
    }
  }

  function removeBootDom() {
    if (!import.meta.client)
      return;
    document.getElementById("age-gate-boot")?.remove();
  }

  function clearPendingClass() {
    if (!import.meta.client)
      return;
    document.documentElement.classList.remove("age-gate-pending");
  }

  function clearBootOverlay() {
    removeBootDom();
    clearPendingClass();
  }

  function accept() {
    accepted.value = true;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    catch {
      /* ignore */
    }
    clearBootOverlay();
    document.documentElement.classList.remove("age-gate-open");
  }

  function readLang(): AgeGateLocale | null {
    if (!import.meta.client)
      return null;
    try {
      const v = localStorage.getItem(LANG_KEY);
      if (v === "ru" || v === "en")
        return v;
    }
    catch {
      /* ignore */
    }
    return null;
  }

  function saveLang(code: AgeGateLocale) {
    if (!import.meta.client)
      return;
    try {
      localStorage.setItem(LANG_KEY, code);
    }
    catch {
      /* ignore */
    }
  }

  return {
    accepted,
    read,
    accept,
    readLang,
    saveLang,
    clearBootOverlay,
    removeBootDom,
    clearPendingClass,
    LANG_KEY,
  };
}
