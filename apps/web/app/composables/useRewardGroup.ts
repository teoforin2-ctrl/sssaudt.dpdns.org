import { pickRewardGroup, type RewardGroup } from "@x-reviewer/shared";

const COOKIE_AB = "rv_ab_reward1";
const COOKIE_PLAYER = "rv_player_id";
const COOKIE_DAYS = 90;

function readCookie(name: string): string | null {
  if (!import.meta.client) return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function writeCookie(name: string, value: string) {
  if (!import.meta.client) return;
  const maxAge = COOKIE_DAYS * 86400;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

/** Sticky A/B cohort assigned on first Review CTA click. */
export function useRewardGroup() {
  const group = useState<RewardGroup | null>("rv-ab-group", () => null);
  const playerId = useState<string | null>("rv-player-id", () => null);
  const cookieId = useState<string | null>("rv-cookie-id", () => null);

  function hydrate() {
    if (!import.meta.client) return;
    const ab = readCookie(COOKIE_AB);
    const pid = readCookie(COOKIE_PLAYER);
    if (ab === "A" || ab === "B") group.value = ab;
    if (pid) playerId.value = pid;
    if (!cookieId.value) {
      cookieId.value = pid || crypto.randomUUID();
    }
  }

  /** Call on first Review CTA — assigns 50/50 forever. */
  function ensureGroup(): RewardGroup {
    hydrate();
    if (group.value === "A" || group.value === "B") {
      writeCookie(COOKIE_AB, group.value);
      if (playerId.value) writeCookie(COOKIE_PLAYER, playerId.value);
      if (!cookieId.value) cookieId.value = playerId.value || crypto.randomUUID();
      return group.value;
    }
    const g = pickRewardGroup();
    group.value = g;
    if (!cookieId.value) cookieId.value = crypto.randomUUID();
    writeCookie(COOKIE_AB, g);
    return g;
  }

  function setPlayerId(id: string) {
    playerId.value = id;
    writeCookie(COOKIE_PLAYER, id);
  }

  return {
    group,
    playerId,
    cookieId,
    hydrate,
    ensureGroup,
    setPlayerId,
  };
}
