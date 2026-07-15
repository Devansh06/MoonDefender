// Supabase leaderboard — fill in credentials to enable global high scores.
// Setup:
//   1. Create a free project at https://supabase.com
//   2. In SQL Editor, run the SQL block below
//   3. Copy your project URL and anon key from Project Settings → API

export const SUPABASE_URL = "https://gnijgvmzwghbtihlgaae.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_BeaUuXeg72X4GUDzQTc_CA_GHeInj1t";

/*  ── Run once in Supabase SQL Editor ──────────────────────────────────

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

create or replace function submit_score(
  p_name text, p_ip text, p_score integer, p_level integer
) returns json language plpgsql security definer as $$
declare
  v_count     integer;
  v_min_score integer;
  v_min_id    uuid;
begin
  select count(*) into v_count
    from leaderboard where ip_address = p_ip;

  if v_count >= 2 then
    select min(score) into v_min_score
      from leaderboard where ip_address = p_ip;
    if p_score <= v_min_score then
      return '{"inserted":false}'::json;
    end if;
    select id into v_min_id
      from leaderboard where ip_address = p_ip order by score asc limit 1;
    delete from leaderboard where id = v_min_id;
  end if;

  insert into leaderboard(player_name, ip_address, score, level)
    values (p_name, p_ip, p_score, p_level);

  return '{"inserted":true}'::json;
end;
$$;

─────────────────────────────────────────────────────────────────────── */
