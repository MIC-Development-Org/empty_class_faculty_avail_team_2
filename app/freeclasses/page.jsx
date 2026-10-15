"use client";

import { useMemo, useState } from "react";

/* ───────────── PLACEHOLDER DATA (replace with real allocation report) ───────────── */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const L = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => `L${a + i}`);
const T = (s) => s.split(" ");

// Period times. Lunch 13:25–14:00 sits between index 5 and 6.
const PERIODS = {
  theory: [["08:00","08:50"],["08:55","09:45"],["09:50","10:40"],["10:45","11:35"],["11:40","12:30"],["12:35","13:25"],["14:00","14:50"],["14:55","15:45"],["15:50","16:40"],["16:45","17:35"],["17:40","18:30"],["18:35","19:25"]],
  lab:    [["08:00","08:50"],["08:50","09:40"],["09:50","10:40"],["10:40","11:30"],["11:40","12:30"],["12:30","13:20"],["14:00","14:50"],["14:50","15:40"],["15:50","16:40"],["16:40","17:30"],["17:40","18:30"],["18:30","19:20"]],
};

// Slot code per period, per day. "-" = no slot.
const GRID = {
  Mon: { theory: T("A1 F1 D1 TB1 TG1 S11 A2 F2 D2 TB2 TG2 S3"),       lab: [...L(1, 6), ...L(31, 36)] },
  Tue: { theory: T("B1 G1 E1 TC1 TAA1 - B2 G2 E2 TC2 TAA2 S1"),       lab: [...L(7, 12), ...L(37, 42)] },
  Wed: { theory: T("C1 A1 F1 TD1 TBB1 - C2 A2 F2 TD2 TBB2 S4"),       lab: [...L(13, 18), ...L(43, 48)] },
  Thu: { theory: T("D1 B1 G1 TE1 TCC1 - D2 B2 G2 TE2 TCC2 S2"),       lab: [...L(19, 24), ...L(49, 54)] },
  Fri: { theory: T("E1 C1 TA1 TF1 TDD1 S15 E2 C2 TA2 TF2 TDD2 -"),    lab: [...L(25, 30), ...L(55, 60)] },
};

// Room universe. t = theory rooms, l = lab rooms. Extend freely.
const BLOCKS = {
  AB1: { t: ["101","102","103","104","201","202","203","204"],            l: ["404 A","404 B"] },
  AB2: { t: ["101","102","103","104","105","201","202","203","204","205"], l: ["210","211"] },
  AB3: { t: ["104","105","106","107","108","109","203","204","205","206","306","307","308"], l: ["302","311","412"] },
  AB4: { t: ["101","102","103","104","201","202","203","204"],            l: ["305","306"] },
  AB5: { t: ["101","102","103","201","202","203"],                        l: ["401"] },
};

// One row per course-room booking: slots it occupies, course, type, room.
// Parsed from  slot-subcode-ELA/ETH-block-room-ALL
const ALLOC = [
  { slots: ["A2", "TAA2", "TA2"], course: "BACSE201", type: "theory", room: "AB3-203" },
  { slots: ["F2", "TF2"],         course: "BASTS101", type: "theory", room: "AB3-106" },
  { slots: ["D2", "TD2"],         course: "BACSE202", type: "theory", room: "AB3-204" },
  { slots: ["C2", "TC2", "TCC2"], course: "BACSE344", type: "theory", room: "AB3-204" },
  { slots: ["E2", "TE2"],         course: "BACSE106", type: "theory", room: "AB3-108" },
  { slots: ["TB2"],               course: "BAFRE101", type: "theory", room: "AB3-306" },
  { slots: ["L1", "L2"],          course: "BAFRE101", type: "lab",    room: "AB1-404 A" },
  { slots: ["L7", "L8"],          course: "BACSE202", type: "lab",    room: "AB3-311" },
  { slots: ["L9", "L10", "L19", "L20"], course: "BACSE102", type: "lab", room: "AB3-412" },
  { slots: ["L21", "L22"],        course: "BACSE106", type: "lab",    room: "AB3-302" },
];

/* ───────────── LOGIC ───────────── */

const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const STARTS = PERIODS.theory.map(([s]) => toMin(s));
const LUNCH_AFTER = 5; // lunch sits between period 5 and 6
const key = (id) => id.replace(/\s+/g, "").toUpperCase();

const ROOMS = Object.entries(BLOCKS).flatMap(([block, { t, l }]) => [
  ...t.map((n) => ({ id: `${block}-${n}`, block, kind: "theory" })),
  ...l.map((n) => ({ id: `${block}-${n}`, block, kind: "lab" })),
]);
const ROOM_BY_KEY = new Map(ROOMS.map((r) => [key(r.id), r]));

const BY_SLOT = new Map();
ALLOC.forEach((a) => a.slots.forEach((s) => BY_SLOT.set(s, [...(BY_SLOT.get(s) || []), a])));

// "Now" snaps to the period whose start is at or before the current time (8:10 → 08:00)
const periodNow = () => {
  const n = new Date(), m = n.getHours() * 60 + n.getMinutes();
  let p = 0;
  STARTS.forEach((s, i) => { if (m >= s) p = i; });
  return p;
};
const todayDay = () => DAYS[(new Date().getDay() + 6) % 7] || "Mon";

/* ───────────── UI ───────────── */

const Chip = ({ on, onClick, children }) => (
  <button type="button" aria-pressed={on} className={`frf-chip ${on ? "is-on" : ""}`} onClick={onClick}>{children}</button>
);

function DayPicker({ day, setDay }) {
  return (
    <fieldset className="frf-field">
      <legend className="frf-label">Day</legend>
      <div className="frf-days">{DAYS.map((d) => <Chip key={d} on={day === d} onClick={() => setDay(d)}>{d}</Chip>)}</div>
    </fieldset>
  );
}

function FreeRooms() {
  const [day, setDay] = useState(todayDay);
  const [p, setP] = useState(() => periodNow());
  const [kind, setKind] = useState("all");
  const [block, setBlock] = useState("all");

  const thSlot = GRID[day].theory[p], labSlot = GRID[day].lab[p];

  const { grouped, counts, shown, total } = useMemo(() => {
    const busy = new Set([thSlot, labSlot].flatMap((s) => (BY_SLOT.get(s) || []).map((a) => a.room)));
    const pool = ROOMS.filter((r) => kind === "all" || r.kind === kind);
    const free = pool.filter((r) => !busy.has(r.id));
    const c = {};
    free.forEach((r) => (c[r.block] = (c[r.block] || 0) + 1));
    const list = free.filter((r) => block === "all" || r.block === block)
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const g = {};
    list.forEach((r) => (g[r.block] = [...(g[r.block] || []), r]));
    return { grouped: g, counts: c, shown: list.length, total: free.length };
  }, [thSlot, labSlot, kind, block]);

  return (
    <div className="frf-body">
      <aside className="frf-rail" aria-label="Free room filters">
        <DayPicker day={day} setDay={setDay} />

        <fieldset className="frf-field">
          <legend className="frf-label">Time slot</legend>
          <div className="frf-periods">
            {PERIODS.theory.map(([s], i) => (
              <button key={s} type="button" aria-pressed={p === i} onClick={() => setP(i)}
                className={`frf-period ${p === i ? "is-on" : ""}`} aria-label={`${s} slot ${GRID[day].theory[i]}`}>
                <span className="frf-mono">{s}</span>
              </button>
            ))}
          </div>
          <button type="button" className="frf-ghost" onClick={() => setP(periodNow())}>Jump to current slot</button>
        </fieldset>

        <fieldset className="frf-field">
          <legend className="frf-label">Room type</legend>
          <div className="frf-seg">
            {[["all", "Any"], ["theory", "Theory"], ["lab", "Lab"]].map(([v, t]) => (
              <button key={v} type="button" aria-pressed={kind === v} className={`frf-segbtn ${kind === v ? "is-on" : ""}`} onClick={() => setKind(v)}>{t}</button>
            ))}
          </div>
        </fieldset>

        <fieldset className="frf-field">
          <legend className="frf-label">Block</legend>
          <div className="frf-chips">
            <Chip on={block === "all"} onClick={() => setBlock("all")}>All <i>{total}</i></Chip>
            {Object.keys(BLOCKS).map((b) => <Chip key={b} on={block === b} onClick={() => setBlock(b)}>{b} <i>{counts[b] || 0}</i></Chip>)}
          </div>
        </fieldset>
      </aside>

      <main className="frf-main" aria-live="polite">
        <div className="frf-summary">
          <p className="frf-big">{shown}</p>
          <p className="frf-bigtext">rooms free · {day} {PERIODS.theory[p][0]}–{PERIODS.theory[p][1]}<br />
            <span>Theory slot {thSlot} · Lab slot {labSlot}</span></p>
        </div>
        {shown === 0 && <p className="frf-empty">No free rooms for this filter. Try another block, type or slot.</p>}
        {Object.entries(grouped).map(([b, rows]) => (
          <section key={b} className="frf-block">
            <h2 className="frf-bhead">{b}<span>{rows.length} free</span></h2>
            <ul className="frf-tiles">
              {rows.map((r) => (
                <li key={r.id} className="frf-tile">
                  <span className="frf-mono">{r.id}</span>
                  {r.kind === "lab" && <em className="frf-tag">Lab</em>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}

function RoomTimeline() {
  const [day, setDay] = useState(todayDay);
  const [block, setBlock] = useState("AB3");
  const [num, setNum] = useState("");

  // typing "ab1-303" in the room box also sets the block
  const onNum = (v) => {
    const m = v.trim().match(/^(AB\d)\s*[-\s]\s*(.*)$/i);
    if (m && BLOCKS[m[1].toUpperCase()]) { setBlock(m[1].toUpperCase()); setNum(m[2]); } else setNum(v);
  };

  const id = num.trim() ? `${block}-${num.trim().toUpperCase()}` : "";
  const room = id ? ROOM_BY_KEY.get(key(id)) : null;
  const blockRooms = ROOMS.filter((r) => r.block === block);

  const data = useMemo(() => {
    if (!room) return null;
    const rows = PERIODS[room.kind].map(([s, e], i) => {
      const slot = GRID[day][room.kind][i];
      return { i, s, e, slot, bk: (BY_SLOT.get(slot) || []).find((a) => a.room === room.id) };
    });
    const wins = [];
    let cur = null;
    rows.forEach((r) => {
      if (r.bk) { cur = null; return; }
      if (cur && r.i !== LUNCH_AFTER + 1) cur.e = r.e; else { cur = { s: r.s, e: r.e }; wins.push(cur); }
    });
    return { rows, wins, free: rows.filter((r) => !r.bk).length };
  }, [room, day]);

  return (
    <div className="frf-body">
      <aside className="frf-rail" aria-label="Room lookup">
        <fieldset className="frf-field">
          <legend className="frf-label">Block</legend>
          <div className="frf-days">{Object.keys(BLOCKS).map((b) => <Chip key={b} on={block === b} onClick={() => { setBlock(b); setNum(""); }}>{b}</Chip>)}</div>
        </fieldset>
        <div className="frf-field">
          <label className="frf-label" htmlFor="frf-room">Room number</label>
          <input id="frf-room" className="frf-input" value={num} placeholder="e.g. 203" autoComplete="off"
            onChange={(e) => onNum(e.target.value)} />
          <div className="frf-suggest" aria-label={`Rooms in ${block}`}>
            {blockRooms.map((r) => {
              const n = r.id.slice(block.length + 1);
              return <button key={r.id} type="button" className={`frf-mini ${room?.id === r.id ? "is-on" : ""}`} onClick={() => setNum(n)}>{n}</button>;
            })}
          </div>
        </div>
        <DayPicker day={day} setDay={setDay} />
      </aside>

      <main className="frf-main" aria-live="polite">
        {!id && <div className="frf-empty frf-hero"><p className="frf-herot">Check any room</p><p>Pick a block, then enter or tap a room number to see when it is free.</p></div>}
        {id && !room && <div className="frf-empty frf-hero"><p className="frf-herot">Room not found</p><p>No room <b className="frf-mono">{id}</b> in the data. Check the block and number.</p></div>}
        {data && (
          <>
            <div className="frf-summary">
              <p className="frf-big frf-mono">{room.id}</p>
              <p className="frf-bigtext">{day} · {room.kind === "lab" ? "Lab room" : "Theory room"}<br />
                <span>{data.free} of {data.rows.length} slots free</span></p>
            </div>
            <p className="frf-wins">
              <b>Free:</b> {data.wins.length ? data.wins.map((w) => `${w.s}–${w.e}`).join("  ·  ") : "Not free at any slot"}
            </p>
            <ol className="frf-rows">
              {data.rows.map((r) => (
                <li key={r.i} className="frf-slotwrap">
                  <div className={`frf-slot ${r.bk ? "is-busy" : "is-free"}`}>
                    <span className="frf-mono">{r.s}–{r.e}</span>
                    <span className="frf-mono frf-code">{r.slot}</span>
                    <span className="frf-state">{r.bk ? `Busy · ${r.bk.course}` : "Free"}</span>
                  </div>
                  {r.i === LUNCH_AFTER && <div className="frf-lunch">Lunch · {PERIODS[room.kind][LUNCH_AFTER][1]}–{PERIODS[room.kind][LUNCH_AFTER + 1][0]}</div>}
                </li>
              ))}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}

export default function FreeRoomFinder() {
  const [tab, setTab] = useState("free");
  return (
    <div className="frf">
      <style>{CSS}</style>
      <header className="frf-head">
        <div>
          <h1 className="frf-title">Free Room Finder</h1>
          <p className="frf-sub">Fall 2026–27 · AB1–AB5</p>
        </div>
        <div className="frf-tabs" role="tablist" aria-label="Mode">
          {[["free", "Free rooms"], ["room", "Room timeline"]].map(([v, t]) => (
            <button key={v} type="button" role="tab" aria-selected={tab === v} className={`frf-tab ${tab === v ? "is-on" : ""}`} onClick={() => setTab(v)}>{t}</button>
          ))}
        </div>
      </header>
      {tab === "free" ? <FreeRooms /> : <RoomTimeline />}
    </div>
  );
}

/* ───────────── STYLES ───────────── */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');
.frf{--slate:#E8EDF3;--card:#fff;--navy:#16304F;--muted:#5B6E85;--line:#D3DBE5;--free:#0F8F66;--freebg:#DDF1E8;--busy:#B4463D;--busybg:#F7DEDA;--lab:#2D7FD3;--sand:#F1E2BC;
  font-family:'Instrument Sans',system-ui,sans-serif;color:var(--navy);background:var(--slate);min-height:100vh;padding:clamp(16px,3vw,40px);box-sizing:border-box}
.frf *{box-sizing:border-box}
.frf-head{max-width:1120px;margin:0 auto 24px;display:flex;flex-wrap:wrap;gap:16px;align-items:end;justify-content:space-between}
.frf-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(28px,4vw,44px);letter-spacing:-.02em;margin:0}
.frf-sub{margin:4px 0 0;color:var(--muted);font-size:14px}
.frf-tabs{display:flex;background:#d6dee8;border-radius:12px;padding:3px;gap:3px}
.frf-tab{font:600 14px 'Instrument Sans',sans-serif;color:var(--navy);background:transparent;border:0;border-radius:9px;padding:9px 16px;cursor:pointer}
.frf-body{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:start}
.frf-rail{position:sticky;top:16px;background:var(--card);border-radius:16px;padding:20px;display:grid;gap:20px;box-shadow:0 1px 0 var(--line)}
.frf-field{border:0;padding:0;margin:0;min-width:0}
.frf-label{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:0;margin-bottom:8px;display:block}
.frf-chips{display:flex;flex-wrap:wrap;gap:6px}
.frf-days{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.frf-days .frf-chip{padding:7px 0;text-align:center}
.frf-chip,.frf-mini,.frf-segbtn,.frf-ghost,.frf-period{font:inherit;color:var(--navy);background:var(--slate);border:1px solid transparent;border-radius:10px;cursor:pointer;transition:background .15s,color .15s}
.frf-chip{padding:7px 11px;font-size:14px;font-weight:500}
.frf-chip i{font-style:normal;font-family:'JetBrains Mono',monospace;font-size:12px;opacity:.65;margin-left:4px}
.frf-chip:hover,.frf-mini:hover,.frf-segbtn:hover,.frf-ghost:hover,.frf-period:hover{background:#dbe3ec}
.frf .is-on,.frf .is-on:hover{background:var(--navy);color:#fff}
.frf :is(button,input):focus-visible{outline:3px solid var(--lab);outline-offset:2px}
.frf-periods{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}
.frf-period{padding:10px 0;text-align:center}
.frf-period .frf-mono{font-size:13px}
.frf-ghost{width:100%;padding:9px 0;font-weight:600;font-size:14px;border-color:var(--line)}
.frf-input{width:100%;font:600 18px 'JetBrains Mono',monospace;color:var(--navy);background:var(--slate);border:1px solid var(--line);border-radius:10px;padding:10px 12px;text-transform:uppercase}
.frf-input::placeholder{text-transform:none;font-weight:500;opacity:.5}
.frf-suggest{margin-top:10px;display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.frf-suggest .frf-mini{padding:8px 0;text-align:center}
.frf-mini{font:500 12px 'JetBrains Mono',monospace;padding:6px 8px;border-radius:8px}
.frf-seg{display:grid;grid-template-columns:repeat(3,1fr);background:var(--slate);border-radius:12px;padding:3px;gap:3px}
.frf-segbtn{padding:8px 0;font-weight:600;font-size:14px;background:transparent}
.frf-summary{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.frf-big{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(48px,7vw,80px);line-height:.95;margin:0;color:var(--free);letter-spacing:-.03em}
.frf-big.frf-mono{font-family:'JetBrains Mono',monospace;font-size:clamp(32px,5vw,52px);color:var(--navy);letter-spacing:-.02em}
.frf-bigtext{margin:0;font-weight:600;font-size:16px;line-height:1.4}
.frf-bigtext span{font-weight:400;color:var(--muted);font-size:14px}
.frf-block{margin-bottom:22px}
.frf-bhead{display:flex;align-items:baseline;gap:10px;font-family:'Bricolage Grotesque',sans-serif;font-size:22px;margin:0 0 10px}
.frf-bhead span{font:500 13px 'Instrument Sans',sans-serif;color:var(--muted)}
.frf-tiles{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.frf-tile{height:52px;white-space:nowrap;font-size:14px;background:var(--card);border-radius:12px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-left:4px solid var(--free);box-shadow:0 1px 0 var(--line)}
.frf-mono{font-family:'JetBrains Mono',monospace;font-weight:700}
.frf-tag{font-style:normal;font-size:11px;font-weight:600;color:#fff;background:var(--lab);border-radius:6px;padding:2px 6px}
.frf-wins{background:var(--card);border-radius:12px;padding:14px 16px;margin:0 0 16px;font-size:14px;line-height:1.6}
.frf-wins b{color:var(--free)}
.frf-rows{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.frf-slot{display:grid;grid-template-columns:140px 60px 1fr;gap:12px;align-items:center;padding:12px 16px;border-radius:12px;font-size:14px;border-left:4px solid}
.frf-slot.is-free{background:var(--freebg);border-color:var(--free)}
.frf-slot.is-busy{background:var(--busybg);border-color:var(--busy)}
.frf-code{opacity:.7;font-size:13px}
.frf-state{font-weight:600}
.is-free .frf-state{color:var(--free)}
.is-busy .frf-state{color:var(--busy)}
.frf-lunch{margin:6px 0 0;padding:6px 16px;border-radius:10px;background:var(--sand);font-size:12px;font-weight:600;color:#6b5a2b;text-align:center}
.frf-empty{background:var(--card);border-radius:12px;padding:24px;color:var(--muted)}
.frf-hero{min-height:320px;display:grid;place-content:center;justify-items:center;text-align:center;gap:6px;border:2px dashed var(--line);background:transparent;line-height:1.5}
.frf-hero p{margin:0;max-width:34ch}
.frf-herot{font:800 24px 'Bricolage Grotesque',sans-serif;color:var(--navy)}
@media (max-width:860px){
  .frf-body{grid-template-columns:1fr}
  .frf-rail{position:static}
  .frf-slot{grid-template-columns:1fr auto;gap:4px 12px}
  .frf-state{grid-column:1/-1}
}
@media (prefers-reduced-motion:reduce){.frf *{transition:none!important}}
`;