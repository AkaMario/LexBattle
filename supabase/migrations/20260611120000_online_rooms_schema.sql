create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null check (char_length(username) between 2 and 32),
  avatar text,
  is_guest boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'cancelled')),
  context text not null default 'Animales' check (context in ('Animales', 'Paises', 'Ciudades', 'Tecnologia', 'Programacion', 'Libre')),
  current_turn uuid references public.profiles(id) on delete set null,
  current_letter text not null default 'A',
  current_letter_index integer not null default 0 check (current_letter_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0,
  errors integer not null default 0 check (errors >= 0),
  position integer not null check (position >= 0),
  is_online boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (game_id, user_id),
  unique (game_id, position)
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  letter text not null check (char_length(letter) between 1 and 2),
  word text not null,
  normalized_word text not null,
  is_valid boolean not null,
  response_time integer not null default 0 check (response_time >= 0),
  created_at timestamptz not null default now(),
  unique (game_id, normalized_word)
);

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  category text not null check (category in ('Animales', 'Paises', 'Ciudades', 'Tecnologia', 'Programacion', 'Libre')),
  first_letter text not null check (char_length(first_letter) between 1 and 2),
  normalized_word text not null,
  created_at timestamptz not null default now(),
  unique (category, normalized_word)
);

create table if not exists public.room_states (
  room_code text primary key check (room_code ~ '^[A-Z0-9]{6}$'),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_room_code_idx on public.games(room_code);
create index if not exists players_game_id_idx on public.players(game_id);
create index if not exists rounds_game_id_idx on public.rounds(game_id);
create index if not exists words_lookup_idx on public.words(category, first_letter, normalized_word);
create index if not exists room_states_updated_at_idx on public.room_states(updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

drop trigger if exists room_states_set_updated_at on public.room_states;
create trigger room_states_set_updated_at
before update on public.room_states
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.words enable row level security;
alter table public.room_states enable row level security;

drop policy if exists "Guests can create profiles" on public.profiles;
drop policy if exists "Guests can read profiles" on public.profiles;
drop policy if exists "Guests can update their transient profile" on public.profiles;
drop policy if exists "Guests can create games" on public.games;
drop policy if exists "Guests can read games" on public.games;
drop policy if exists "Guests can update games" on public.games;
drop policy if exists "Guests can join games" on public.players;
drop policy if exists "Guests can read players" on public.players;
drop policy if exists "Guests can update players" on public.players;
drop policy if exists "Guests can create rounds" on public.rounds;
drop policy if exists "Guests can read rounds" on public.rounds;
drop policy if exists "Everyone can read words" on public.words;
drop policy if exists "Guests can create room states" on public.room_states;
drop policy if exists "Guests can read room states" on public.room_states;
drop policy if exists "Guests can update room states" on public.room_states;

create policy "Guests can create profiles" on public.profiles for insert to anon with check (is_guest = true);
create policy "Guests can read profiles" on public.profiles for select to anon using (true);
create policy "Guests can update their transient profile" on public.profiles for update to anon using (is_guest = true) with check (is_guest = true);

create policy "Guests can create games" on public.games for insert to anon with check (true);
create policy "Guests can read games" on public.games for select to anon using (true);
create policy "Guests can update games" on public.games for update to anon using (true) with check (true);

create policy "Guests can join games" on public.players for insert to anon with check (true);
create policy "Guests can read players" on public.players for select to anon using (true);
create policy "Guests can update players" on public.players for update to anon using (true) with check (true);

create policy "Guests can create rounds" on public.rounds for insert to anon with check (true);
create policy "Guests can read rounds" on public.rounds for select to anon using (true);

create policy "Everyone can read words" on public.words for select to anon using (true);

create policy "Guests can create room states" on public.room_states for insert to anon with check (true);
create policy "Guests can read room states" on public.room_states for select to anon using (true);
create policy "Guests can update room states" on public.room_states for update to anon using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.room_states;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
