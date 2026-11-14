import { useEffect, useMemo, useState } from "react";
import { fetchEvents, fetchTiles, normalizeTiles } from "./api.js";
import { placeTiles, toPixel, hexPoints, SIZE } from "./layout.js";
import bannerImage from "./CTPointsBanner.webp";
import { firebaseConfigured, setTileMarked, subscribeToMarks } from "./firebase.js";

const relicAssets = import.meta.glob("./relics/*", { eager: true, query: "?url", import: "default" });
const RELIC_SIZE = SIZE * 0.7;

// Full class names (not built dynamically) so Tailwind can see them.
const TILE_TYPE_FILL = {
  regular: "fill-regular",
  banner: "fill-banner-navy",
  relic: "fill-relic-dark",
  teamstart: "fill-start",
};
const START_FILL = {
  A: "fill-start-purple",
  B: "fill-start-pink",
  C: "fill-start-green",
  D: "fill-start-blue",
  E: "fill-start-yellow",
  F: "fill-start-red",
};
const TEAMS = [
  { letter: "A", rotation: 180, color: "bg-start-purple" },
  { letter: "B", rotation: 240, color: "bg-start-pink" },
  { letter: "C", rotation: 300, color: "bg-start-green" },
  { letter: "D", rotation: 0, color: "bg-start-blue" },
  { letter: "E", rotation: 60, color: "bg-start-yellow" },
  { letter: "F", rotation: 120, color: "bg-start-red" },
];
const fillFor = (t) => {
  const tileType = t.tileType.toLowerCase().replace(/[^a-z]/g, "");
  if (tileType === "teamstart") return START_FILL[t.id?.charAt(0)] ?? "fill-start";
  if (tileType.startsWith("relic")) return TILE_TYPE_FILL.relic;
  return TILE_TYPE_FILL[tileType] ?? "fill-regular";
};
const isBanner = (t) => t.tileType.toLowerCase().replace(/[^a-z]/g, "") === "banner";
const BANNER_SIZE = SIZE * 0.7;
const isRelic = (t) => t.tileType.toLowerCase().startsWith("relic");
const normalizeRelicName = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const relicImages = Object.fromEntries(
  Object.entries(relicAssets).map(([path, url]) => [
    normalizeRelicName(path.split(/[\\/]/).pop().replace(/\.[^.]+$/, "")),
    url,
  ]),
);
const relicImageFor = (t) => relicImages[normalizeRelicName(t.relic)];

const selectCls = "rounded-md border border-edge bg-panel px-2 py-1.5 text-ink";
const btnCls = "cursor-pointer rounded-md border border-edge bg-panel px-2.5 py-1.5 hover:border-ink";
const noticeCls = "mx-5 mt-3 border-l-[3px] bg-panel px-3 py-2.5 text-sm";
const firebaseErrorMessage = (error, action) =>
  error.code === "permission-denied" || error.message.includes("Missing or insufficient permissions")
    ? `${action} Firebase data was denied. Deploy firestore.rules and confirm Firestore is enabled for project btd6ctillicus.`
    : `${action}: ${error.message}`;

// calc time
const formatStart = (start) => {
  if (start == null) return null;
  const ms = typeof start === "number" && start < 1e12 ? start * 1000 : start;
  const d = new Date(ms);
  return isNaN(d) ? null : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};


export default function App() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [markedTiles, setMarkedTiles] = useState(() => new Set());
  const [markError, setMarkError] = useState("");
  const [tileSearch, setTileSearch] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEvents()
      .then((body) => {
        setEvents(body);
        setEventId(body[0]?.id ?? null);
        setStatus(body.length ? "ready" : "empty");
      })
      .catch((e) => { setError(e.message); setStatus("error"); });
  }, []);

  const event = events.find((e) => e.id === eventId);

  useEffect(() => {
    if (!event) return;
    setStatus("loading"); setSelected(null);
    fetchTiles(event)
      .then((body) => { setTiles(normalizeTiles(body)); setStatus("ready"); })
      .catch((e) => { setError(e.message); setStatus("error"); });
  }, [eventId]); // eslint-disable-line

  useEffect(() => {
    if (!eventId || !firebaseConfigured) {
      setMarkedTiles(new Set());
      return undefined;
    }

    setMarkError("");
    return subscribeToMarks(
      eventId,
      setMarkedTiles,
      (error) => setMarkError(firebaseErrorMessage(error, "Loading shared markings")),
    );
  }, [eventId]);

  const { placed, missing, empty } = useMemo(() => placeTiles(tiles), [tiles]);
  const games = useMemo(() => [...new Set(tiles.map((t) => t.gameType))].sort(), [tiles]);

  const shown = (t) => {
    const query = tileSearch.trim().toLowerCase();
    const searchableText = [t.id, t.tileType, t.gameType, t.boss, t.relic]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!query || searchableText.includes(query)) &&
      (gameFilter === "all" || t.gameType === gameFilter)
    );
  };

  const drawn = placed.map((t) => ({ ...t, ...toPixel(t.pos) }));
  const markedTileList = tiles
    .filter((tile) => markedTiles.has(tile.id))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  // Square view centred on the middle tile, big enough for any rotation.
  const half = Math.max(1, ...drawn.map((t) => Math.hypot(t.x, t.y))) + SIZE + 8;
  const vb = `${-half} ${-half} ${half * 2} ${half * 2}`;

  const toggleMark = async (tileId) => {
    try {
      setMarkError("");
      await setTileMarked(eventId, tileId, !markedTiles.has(tileId));
    } catch (error) {
      setMarkError(firebaseErrorMessage(error, "Saving shared marking"));
    }
  };
  const spinCls = "transition-transform duration-300 ease-out motion-reduce:transition-none";
  const clearTileFocus = () => {
    setSelected(null);
    setTileSearch("");
  };
  const clearSelectionOutsideMap = (e) => {
    if (!e.target.closest("svg") && !e.target.closest("aside")) clearTileFocus();
  };

  return (
    <div className="flex min-h-screen flex-col" onClick={clearSelectionOutsideMap}>
      <header className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line px-5 py-4">
        <h1 className="mr-auto font-display text-[32px] font-bold">Tilliticus Contested Territories</h1>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Event
          <select className={selectCls} value={eventId ?? ""} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {formatStart(e.start) ?? e.name ?? e.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Search tiles
          <input
            className={selectCls}
            type="search"
            value={tileSearch}
            onChange={(e) => setTileSearch(e.target.value)}
            placeholder="ID, type, or mode"
            aria-label="Search tiles by ID, type, mode, boss, or relic"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Game mode
          <select className={selectCls} value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}>
            <option value="all">All</option>
            {games.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </header>

      {status === "error" && (
        <p className={`${noticeCls} border-start`}>
          Couldn't load data: {error}. Check your connection and that the dev server proxy is running.
        </p>
      )}
      {markError && <p className={`${noticeCls} border-start`}>{markError}</p>}
      {status === "empty" && <p className={`${noticeCls} border-banner`}>No Contested Territory events were returned.</p>}
      {tiles.length > 0 && (missing.length > 0 || empty.length > 0) && (
        <div className={`${noticeCls} border-banner space-y-1`}>
          {missing.length > 0 && (
            <p>
              <b>In the API but not on our board layout (not drawn):</b>{" "}
              {missing.map((id) => String(id)).join(", ")}
            </p>
          )}
          {empty.length > 0 && (
            <p>
              <b>On our board layout but not in the API response (empty slots):</b> {empty.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* <details className="mx-5 mt-3 text-[13px] text-muted">
        <summary className="cursor-pointer">Debug info</summary>
        <pre className="mt-2 overflow-auto rounded-md bg-deep p-2.5 text-xs">{JSON.stringify({
          events: events.length,
          eventKeys: event ? Object.keys(event) : null,
          eventTilesUrl: event?.tiles ?? null,
          tilesReceived: tiles.length,
          tilesOnBoard: placed.length,
          sampleTile: tiles[0]?.raw ?? null,
        }, null, 2)}</pre>
      </details> */}

      <main className="grid flex-1 gap-4 px-5 py-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {TEAMS.map((team) => {
              const active = rotation === team.rotation;
              return (
                <button
                  key={team.letter}
                  className={`${btnCls} h-9 w-9 border-0 ${team.color} font-bold text-deep ${active ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""}`}
                  onClick={() => setRotation(team.rotation)}
                  aria-label={`View from team ${team.letter}`}
                  aria-pressed={active}
                >
                  {team.letter}
                </button>
              );
            })}
          </div>

          <svg
            viewBox={vb} role="img" aria-label="Contested Territory board"
            className="aspect-square w-full select-none rounded-xl bg-deep lg:aspect-auto lg:h-[calc(100vh-200px)]"
          >
            <defs>
              {drawn.map((t) => (
                <clipPath key={t.id} id={`tile-clip-${t.id}`}>
                  <polygon points={hexPoints(t.x, t.y)} />
                </clipPath>
              ))}
            </defs>
            <rect
              x={-half} y={-half} width={half * 2} height={half * 2}
              className="fill-transparent"
              onClick={clearTileFocus}
            />
            <g className={spinCls} style={{ transform: `rotate(${rotation}deg)` }}>
              {drawn.map((t) => (
                <polygon
                  key={t.id}
                  points={hexPoints(t.x, t.y)}
                  className={`${fillFor(t)} cursor-pointer transition-opacity duration-150 outline-none hover:stroke-ink focus:stroke-ink ${selected?.id === t.id ? "stroke-white stroke-[3]" : "stroke-deep stroke-[1.5]"
                    } ${markedTiles.has(t.id) ? "stroke-start-red stroke-[3]" : ""} ${shown(t) ? "opacity-100" : "opacity-15"}`}
                  onClick={() => setSelected(t)}
                    onDoubleClick={() => toggleMark(t.id)}
                    tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(t)}
                >
                  <title>{`${t.id}: ${t.tileType} / ${t.gameType}`}</title>
                </polygon>
              ))}
              {drawn.filter(isBanner).map((t) => (
                <image
                  key={t.id + "-banner"}
                  href={bannerImage}
                  x={t.x - BANNER_SIZE}
                  y={t.y - BANNER_SIZE}
                  width={BANNER_SIZE * 2}
                  height={BANNER_SIZE * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#tile-clip-${t.id})`}
                  className={`pointer-events-none ${spinCls} ${shown(t) ? "opacity-100" : "opacity-15"}`}
                  style={{
                    transform: `rotate(${-rotation}deg)`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                  aria-hidden="true"
                />
              ))}
              {drawn.filter((t) => isRelic(t) && relicImageFor(t)).map((t) => (
                <image
                  key={t.id + "-relic"}
                  href={relicImageFor(t)}
                  x={t.x - RELIC_SIZE}
                  y={t.y - RELIC_SIZE}
                  width={RELIC_SIZE * 2}
                  height={RELIC_SIZE * 2}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath={`url(#tile-clip-${t.id})`}
                  className={`pointer-events-none ${spinCls} ${shown(t) ? "opacity-100" : "opacity-15"}`}
                  style={{
                    transform: `rotate(${-rotation}deg)`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                  aria-hidden="true"
                />
              ))}
              {drawn.map((t) => (
                !isBanner(t) && !isRelic(t) && (
                  <text
                    key={t.id + "l"} x={t.x} y={t.y} dy="0.35em" textAnchor="middle"
                    className={`pointer-events-none fill-deep text-[8px] font-semibold ${spinCls} ${shown(t) ? "opacity-100" : "opacity-20"}`}
                    style={{ transform: `rotate(${-rotation}deg)`, transformBox: "fill-box", transformOrigin: "center" }}
                  >{t.id}</text>
                )
              ))}
            </g>
          </svg>
        </div>

        <div className="flex flex-col gap-3 lg:max-h-[calc(100vh-200px)]">
          <aside className="h-64 shrink-0 overflow-auto rounded-xl bg-panel p-5">
            {selected ? (
              <>
                <h2 className="mb-2 font-display text-xl font-bold">{selected.tileType}</h2>
                <button
                  className={`${btnCls} mb-2 w-full ${markedTiles.has(selected.id) ? "border-yellow text-yellow" : ""}`}
                  disabled={!firebaseConfigured}
                  onClick={() => toggleMark(selected.id)}
                >
                  {markedTiles.has(selected.id) ? "Remove shared mark" : "Mark tile"}
                </button>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Tile ID</dt><dd>{selected.id}</dd>
                  <dt className="text-muted">Tile type</dt><dd>{selected.tileType}</dd>
                  <dt className="text-muted">Game mode</dt><dd>{selected.gameType}</dd>
                  {selected.boss && (<><dt className="text-muted">Boss</dt><dd>{String(selected.boss)}</dd></>)}
                  {selected.relic && (<><dt className="text-muted">Relic</dt><dd>{String(selected.relic)}</dd></>)}
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted">Select a tile to see its details.</p>
            )}
          </aside>

          <aside className="min-h-0 overflow-auto rounded-xl bg-panel p-3" onClick={clearTileFocus}>
            <h2 className="mb-2 font-display text-lg font-bold">Marked tiles</h2>
            {markedTileList.length > 0 ? (
              <ul className="space-y-1">
                {markedTileList.map((tile) => (
                  <li key={tile.id}>
                    <button
                      className={`w-full rounded-md border px-2.5 py-1.5 text-left text-muted text-sm hover:border-ink ${
                        selected?.id === tile.id ? "border-start-red text-start-red" : "border-edge"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTileSearch(tile.id);
                        setSelected(tile);
                      }}
                    >
                      <span>{tile.id}</span>
                      <span className="ml-2 font-bold text-white">{tile.tileType}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No tiles have been marked.</p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}