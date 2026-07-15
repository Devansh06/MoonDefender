-- Moon Defender leaderboard schema
-- Run this once in: https://supabase.com/dashboard/project/gnijgvmzwghbtihlgaae/sql/new

create table if not exists leaderboard (
  id          uuid default gen_random_uuid() primary key,
  player_name text not null,
  ip_address  text not null,
  score       integer not null default 0,
  level       integer not null default 1,
  created_at  timestamptz default now()
);

alter table leaderboard enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'leaderboard' and policyname = 'Public read'
  ) then
    execute 'create policy "Public read" on leaderboard for select using (true)';
  end if;
end$$;

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
      return json_build_object('inserted', false);
    end if;
    select id into v_min_id
      from leaderboard where ip_address = p_ip order by score asc limit 1;
    delete from leaderboard where id = v_min_id;
  end if;

  insert into leaderboard(player_name, ip_address, score, level)
    values (p_name, p_ip, p_score, p_level);

  return json_build_object('inserted', true);
end;
$$;
