-- ─────────────────────────────────────────────────────────────────────────────
-- Moon Defender — Supabase Schema
-- Run the entire file in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: all statements use CREATE IF NOT EXISTS / CREATE OR REPLACE.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Leaderboard table ──────────────────────────────────────────────────────

create table if not exists leaderboard (
  id          uuid default gen_random_uuid() primary key,
  player_name text not null,
  ip_address  text not null,
  score       integer not null default 0,
  level       integer not null default 1,
  accuracy    integer not null default 0,
  created_at  timestamptz default now()
);
alter table leaderboard enable row level security;

-- Public can only read; all writes go through security-definer RPCs.
drop policy if exists "Public read" on leaderboard;
create policy "Public read" on leaderboard for select using (true);


-- ── 2. Game sessions table ────────────────────────────────────────────────────
-- A session is created server-side when a real game starts.
-- submit_score checks the session exists, IP matches, timing is plausible,
-- and it hasn't been used before.  No direct anon access allowed.

create table if not exists game_sessions (
  session_id  uuid default gen_random_uuid() primary key,
  ip_address  text not null,
  started_at  timestamptz default now() not null,
  submitted   boolean default false not null
);
alter table game_sessions enable row level security;
-- No anon policies: all access is through security-definer RPCs.


-- ── 3. start_session — called by JS when a real game begins ──────────────────
-- Returns { session_id } on success, or { error } if rate-limited.

create or replace function start_session(p_ip text)
returns json language plpgsql security definer as $$
declare
  v_id uuid;
begin
  -- Delete sessions older than 4 hours to keep table small.
  delete from game_sessions where started_at < now() - interval '4 hours';

  -- Rate limit: max 8 session registrations per IP per hour.
  if (
    select count(*) from game_sessions
    where ip_address = p_ip
      and started_at > now() - interval '1 hour'
  ) >= 8 then
    return '{"error":"rate_limited"}'::json;
  end if;

  insert into game_sessions(ip_address) values(p_ip) returning session_id into v_id;
  return json_build_object('session_id', v_id);
end;
$$;


-- ── 4. check_name ─────────────────────────────────────────────────────────────

create or replace function check_name(
  p_name text, p_ip text
) returns json language plpgsql security definer as $$
declare
  v_owner_ip text;
begin
  select ip_address into v_owner_ip
    from leaderboard where player_name = p_name limit 1;
  if v_owner_ip is null or v_owner_ip = p_ip then
    return '{"available":true}'::json;
  end if;
  return '{"available":false}'::json;
end;
$$;


-- ── 5. submit_score — validates session before accepting any score ─────────────
-- Security layers applied in order:
--   a) Input bounds: level 1-10, accuracy 0-100, score > 0
--   b) Score plausibility cap per level (generous 2× real-game maximum)
--   c) Session must exist and not already be used
--   d) Session IP must match the submitting IP
--   e) Session must be old enough to prove the game was actually played
--      (minimum real-world seconds = (level - 1) * 60 + 30)
--   f) Name ownership (IP-bound)
--   g) Personal-best only

create or replace function submit_score(
  p_name       text,
  p_ip         text,
  p_score      integer,
  p_level      integer,
  p_accuracy   integer default 0,
  p_session_id uuid    default null
) returns json language plpgsql security definer as $$
declare
  v_owner_ip    text;
  v_max_score   integer;
  v_sess_ip     text;
  v_sess_start  timestamptz;
  v_sess_used   boolean;
  v_min_secs    integer;
  v_score_cap   integer;
begin

  -- ── a) Basic bounds ──────────────────────────────────────────────────
  if p_level < 1 or p_level > 10 then
    return '{"inserted":false,"reason":"invalid_level"}'::json;
  end if;
  if p_accuracy < 0 or p_accuracy > 100 then
    return '{"inserted":false,"reason":"invalid_accuracy"}'::json;
  end if;
  if p_score <= 0 then
    return '{"inserted":false,"reason":"invalid_score"}'::json;
  end if;

  -- ── b) Score cap per level ───────────────────────────────────────────
  -- Derived from: ~4 rocks/s × max points × level_duration, with 2× buffer.
  -- A real max at level N is roughly cumulative over all preceding levels too.
  v_score_cap := case p_level
    when 1  then   8000
    when 2  then  18000
    when 3  then  32000
    when 4  then  50000
    when 5  then  72000
    when 6  then  98000
    when 7  then 130000
    when 8  then 168000
    when 9  then 214000
    when 10 then 270000
    else          270000
  end;
  if p_score > v_score_cap then
    return '{"inserted":false,"reason":"score_implausible"}'::json;
  end if;

  -- ── c) Session existence + single-use ───────────────────────────────
  if p_session_id is null then
    return '{"inserted":false,"reason":"no_session"}'::json;
  end if;
  select ip_address, started_at, submitted
    into v_sess_ip, v_sess_start, v_sess_used
    from game_sessions
   where session_id = p_session_id;
  if not found then
    return '{"inserted":false,"reason":"invalid_session"}'::json;
  end if;
  if v_sess_used then
    return '{"inserted":false,"reason":"session_used"}'::json;
  end if;

  -- ── d) IP must match session registration ────────────────────────────
  if v_sess_ip <> p_ip then
    return '{"inserted":false,"reason":"session_ip_mismatch"}'::json;
  end if;

  -- ── e) Minimum real-world play time ─────────────────────────────────
  -- To reach level N a player must have survived at least (N-1) full 60s levels
  -- plus at least 30s into the final level.  Enforce this server-side so an
  -- attacker who calls start_session then immediately posts a fake level-10
  -- score is rejected even though the session is otherwise valid.
  v_min_secs := (p_level - 1) * 60 + 30;
  if extract(epoch from (now() - v_sess_start)) < v_min_secs then
    return '{"inserted":false,"reason":"too_fast"}'::json;
  end if;

  -- Mark session consumed before any further DB writes.
  update game_sessions set submitted = true where session_id = p_session_id;

  -- ── f) Name ownership ────────────────────────────────────────────────
  select ip_address into v_owner_ip
    from leaderboard where player_name = p_name limit 1;
  if v_owner_ip is not null and v_owner_ip <> p_ip then
    return '{"inserted":false,"reason":"name_taken"}'::json;
  end if;

  -- ── g) Personal best ─────────────────────────────────────────────────
  select max(score) into v_max_score
    from leaderboard where player_name = p_name;
  if v_max_score is not null and p_score <= v_max_score then
    return '{"inserted":false,"reason":"not_beaten"}'::json;
  end if;

  -- ── Insert ────────────────────────────────────────────────────────────
  delete from leaderboard where player_name = p_name;
  insert into leaderboard(player_name, ip_address, score, level, accuracy)
    values (p_name, p_ip, p_score, p_level, p_accuracy);
  return '{"inserted":true}'::json;
end;
$$;
