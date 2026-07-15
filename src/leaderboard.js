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
    const url = `${SUPABASE_URL}/rest/v1/${TABLE}?select=player_name,score,level,accuracy&order=score.desc&limit=${TOP_N}`;
    const res = await fetch(url, { headers: apiHeaders() });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

// ── Name availability check ───────────────────────────────────────────
export async function checkNameAvailable(name, ip) {
  if (!isEnabled() || !ip || ip === "unknown") return true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_name`, {
      method:  "POST",
      headers: apiHeaders(),
      body:    JSON.stringify({ p_name: name.trim(), p_ip: ip }),
    });
    if (!res.ok) return true;
    const json = await res.json();
    return json.available !== false;
  } catch {
    return true;
  }
}

// ── Score submission (via stored procedure, max-3 per name, name tied to IP) ─
export async function submitScore(name, score, level, ip, accuracy = 100) {
  if (!isEnabled() || !name || score <= 0) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_score`, {
      method:  "POST",
      headers: apiHeaders(),
      body:    JSON.stringify({ p_name: name, p_ip: ip, p_score: score, p_level: level, p_accuracy: accuracy }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.inserted) recordLocalSub(name, score, level);
    return json;
  } catch (e) {
    console.warn("Score submit failed:", e);
    return null;
  }
}
