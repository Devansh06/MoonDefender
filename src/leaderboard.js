import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const TABLE   = "leaderboard";
const TOP_N   = 20;

export const isEnabled = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function apiHeaders() {
  return {
    "apikey":        SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":  "application/json",
  };
}

// ── IP detection ─────────────────────────────────────────────────────
export async function getPlayerIP() {
  try {
    const res  = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    const json = await res.json();
    return json.ip || "unknown";
  } catch {
    return "unknown";
  }
}

// ── Name storage ─────────────────────────────────────────────────────
export function getStoredName() {
  return localStorage.getItem("md_player_name") || "";
}

export function storeName(name) {
  localStorage.setItem("md_player_name", name.trim().slice(0, 20));
}

// ── Local submission log (for "is this my score" highlighting) ────────
function getLocalSubs() {
  try { return JSON.parse(localStorage.getItem("md_subs") || "[]"); }
  catch { return []; }
}

function recordLocalSub(name, score, level) {
  const subs = getLocalSubs();
  subs.push({ name, score, level });
  localStorage.setItem("md_subs", JSON.stringify(subs.slice(-4)));
}

export function isMySub(playerName, score, level) {
  return getLocalSubs().some(s => s.name === playerName && s.score === score && s.level === level);
}

// ── Leaderboard fetch ────────────────────────────────────────────────
export async function fetchLeaderboard() {
  if (!isEnabled()) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/${TABLE}?select=player_name,score,level&order=score.desc&limit=${TOP_N}`;
    const res = await fetch(url, { headers: apiHeaders() });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

// ── Score submission (via stored procedure for safe max-2 enforcement) ─
export async function submitScore(name, score, level, ip) {
  if (!isEnabled() || !name || score <= 0) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_score`, {
      method:  "POST",
      headers: { ...apiHeaders(), "Prefer": "return=minimal" },
      body:    JSON.stringify({ p_name: name, p_ip: ip, p_score: score, p_level: level }),
    });
    recordLocalSub(name, score, level);
  } catch (e) {
    console.warn("Score submit failed:", e);
  }
}
