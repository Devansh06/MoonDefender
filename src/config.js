// Supabase leaderboard — fill in credentials to enable global high scores.
// Setup:
//   1. Create a free project at https://supabase.com
//   2. In SQL Editor, run the SQL block below
//   3. Copy your project URL and anon key from Project Settings → API

export const SUPABASE_URL = "https://gnijgvmzwghbtihlgaae.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_BeaUuXeg72X4GUDzQTc_CA_GHeInj1t";

/*  ── Run in Supabase SQL Editor to create/update the schema ──────────

-- Table (run once on first setup)
create table if not exists leaderboard (
  id          uuid default gen_random_uuid() primary key,
  player_name text not null,
  ip_address  text not null,
  score       integer not null default 0,
  level       integer not null default 1,
  created_at  timestamptz default now()
);
alter table leaderboard enable row level security;
create policy "Public read" on leaderboard for select using (true);

-- Add accuracy column (run once on existing tables)
alter table leaderboard add column if not exists accuracy integer not null default 0;

-- submit_score: 1 score per name (personal best only); name is tied to the first IP that used it
create or replace function submit_score(
  p_name text, p_ip text, p_score integer, p_level integer, p_accuracy integer default 0
) returns json language plpgsql security definer as $$
declare
  v_owner_ip  text;
  v_max_score integer;
begin
  select ip_address into v_owner_ip
    from leaderboard where player_name = p_name limit 1;
  if v_owner_ip is not null and v_owner_ip <> p_ip then
    return '{"inserted":false,"reason":"name_taken"}'::json;
  end if;
  select max(score) into v_max_score
    from leaderboard where player_name = p_name;
  if v_max_score is not null and p_score <= v_max_score then
    return '{"inserted":false,"reason":"not_beaten"}'::json;
  end if;
  delete from leaderboard where player_name = p_name;
  insert into leaderboard(player_name, ip_address, score, level, accuracy)
    values (p_name, p_ip, p_score, p_level, p_accuracy);
  return '{"inserted":true}'::json;
end;
$$;

-- check_name: returns {"available":true/false} for a given name+IP pair
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

─────────────────────────────────────────────────────────────────────── */
