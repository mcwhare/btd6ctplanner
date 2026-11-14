// In dev, "/nk" is proxied to https://data.ninjakiwi.com (see vite.config.js).
// For production, point BASE at your own proxy or the API directly if CORS allows it.
import { LAYOUT } from "./layout.js";

const BASE = (import.meta.env?.VITE_NK_BASE) ?? "/nk";

// The API returns absolute URLs for sub-resources (e.g. event.tiles); route them through BASE.
const viaBase = (url) => url.replace("https://data.ninjakiwi.com", BASE);

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}) for ${url}`);
  const json = await res.json();
  if (json.success === false) throw new Error(json.error || "API returned an error");
  return json.body;
}

export const fetchEvents = () => get(`${BASE}/btd6/ct`);
export const fetchTiles = (event) => get(viaBase(event.tiles));

// The tile payload's field naming isn't something I could verify against the official docs,
// so accept PascalCase, camelCase and snake_case, and keep the raw object for the info panel.
const pick = (o, ...keys) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

// Find the tile code: a known key first, otherwise any string value that is a code on our board.
const findCode = (t) => {
  const direct = pick(t, "id", "Id", "ID", "code", "Code", "tile", "Tile", "tileId", "TileId", "name", "Name");
  if (typeof direct === "string" && LAYOUT[direct.toUpperCase()]) return direct.toUpperCase();
  for (const v of Object.values(t)) if (typeof v === "string" && LAYOUT[v.toUpperCase()]) return v.toUpperCase();
  return typeof direct === "string" ? direct : undefined;
};

// The response may be an array of tiles, an object keyed by tile code, or either of those
// nested one level down (e.g. { tiles: [...] }).
export function tileList(body) {
  let data = body;
  if (data && !Array.isArray(data) && typeof data === "object") {
    const nested = Object.values(data).find((v) => Array.isArray(v) || (v && typeof v === "object" && Object.keys(v).some((k) => LAYOUT[k])));
    if (nested && !Object.keys(data).some((k) => LAYOUT[k])) data = nested;
  }
  if (Array.isArray(data)) return data.filter((t) => t && typeof t === "object");
  return Object.entries(data ?? {})
    .filter(([, t]) => t && typeof t === "object")
    .map(([id, t]) => ({ id, ...t }));
}

export function normalizeTiles(body) {
  return tileList(body).map((t) => {
    const tileType = String(pick(t, "TileType", "tileType", "tile_type", "Type", "type") ?? "Unknown");
    const relic = pick(t, "RelicType", "relicType", "relic", "Relic")
      ?? (tileType.match(/^relic\s*-\s*(.+)$/i)?.[1]);

    return {
      id: findCode(t),
      tileType,
      gameType: String(pick(t, "GameType", "gameType", "game_type") ?? "Unknown"),
      boss: pick(t, "BossType", "bossType", "boss", "Boss"),
      relic,
      raw: t,
    };
  });
}