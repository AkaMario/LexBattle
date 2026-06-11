create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null check (char_length(username) between 2 and 32),
  avatar text,
  is_guest boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.games (
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

create table public.players (
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

create table public.rounds (
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

create table public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  category text not null check (category in ('Animales', 'Paises', 'Ciudades', 'Tecnologia', 'Programacion', 'Libre')),
  first_letter text not null check (char_length(first_letter) between 1 and 2),
  normalized_word text not null,
  created_at timestamptz not null default now(),
  unique (category, normalized_word)
);

create index games_room_code_idx on public.games(room_code);
create index players_game_id_idx on public.players(game_id);
create index rounds_game_id_idx on public.rounds(game_id);
create index words_lookup_idx on public.words(category, first_letter, normalized_word);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.words enable row level security;

create policy "Guests can create profiles"
on public.profiles for insert
to anon
with check (is_guest = true);

create policy "Guests can read profiles"
on public.profiles for select
to anon
using (true);

create policy "Guests can update their transient profile"
on public.profiles for update
to anon
using (is_guest = true)
with check (is_guest = true);

create policy "Guests can create games"
on public.games for insert
to anon
with check (true);

create policy "Guests can read games"
on public.games for select
to anon
using (true);

create policy "Guests can update games"
on public.games for update
to anon
using (true)
with check (true);

create policy "Guests can join games"
on public.players for insert
to anon
with check (true);

create policy "Guests can read players"
on public.players for select
to anon
using (true);

create policy "Guests can update players"
on public.players for update
to anon
using (true)
with check (true);

create policy "Guests can create rounds"
on public.rounds for insert
to anon
with check (true);

create policy "Guests can read rounds"
on public.rounds for select
to anon
using (true);

create policy "Everyone can read words"
on public.words for select
to anon
using (true);

insert into public.words (word, category, first_letter, normalized_word) values
  ('Ardilla', 'Animales', 'A', 'ardilla'),
  ('Ballena', 'Animales', 'B', 'ballena'),
  ('Caballo', 'Animales', 'C', 'caballo'),
  ('Delfin', 'Animales', 'D', 'delfin'),
  ('Elefante', 'Animales', 'E', 'elefante'),
  ('Flamenco', 'Animales', 'F', 'flamenco'),
  ('Gato', 'Animales', 'G', 'gato'),
  ('Hormiga', 'Animales', 'H', 'hormiga'),
  ('Iguana', 'Animales', 'I', 'iguana'),
  ('Jirafa', 'Animales', 'J', 'jirafa'),
  ('Koala', 'Animales', 'K', 'koala'),
  ('Leon', 'Animales', 'L', 'leon'),
  ('Mono', 'Animales', 'M', 'mono'),
  ('Nutria', 'Animales', 'N', 'nutria'),
  ('Ñandu', 'Animales', 'Ñ', 'nandu'),
  ('Oso', 'Animales', 'O', 'oso'),
  ('Perro', 'Animales', 'P', 'perro'),
  ('Quetzal', 'Animales', 'Q', 'quetzal'),
  ('Raton', 'Animales', 'R', 'raton'),
  ('Serpiente', 'Animales', 'S', 'serpiente'),
  ('Tigre', 'Animales', 'T', 'tigre'),
  ('Urraca', 'Animales', 'U', 'urraca'),
  ('Vaca', 'Animales', 'V', 'vaca'),
  ('Walabi', 'Animales', 'W', 'walabi'),
  ('Xoloitzcuintle', 'Animales', 'X', 'xoloitzcuintle'),
  ('Yegua', 'Animales', 'Y', 'yegua'),
  ('Zorro', 'Animales', 'Z', 'zorro'),
  ('Argentina', 'Paises', 'A', 'argentina'),
  ('Brasil', 'Paises', 'B', 'brasil'),
  ('Colombia', 'Paises', 'C', 'colombia'),
  ('Dinamarca', 'Paises', 'D', 'dinamarca'),
  ('España', 'Paises', 'E', 'espana'),
  ('Francia', 'Paises', 'F', 'francia'),
  ('Guatemala', 'Paises', 'G', 'guatemala'),
  ('Haiti', 'Paises', 'H', 'haiti'),
  ('Italia', 'Paises', 'I', 'italia'),
  ('Jamaica', 'Paises', 'J', 'jamaica'),
  ('Kenia', 'Paises', 'K', 'kenia'),
  ('Luxemburgo', 'Paises', 'L', 'luxemburgo'),
  ('Mexico', 'Paises', 'M', 'mexico'),
  ('Nicaragua', 'Paises', 'N', 'nicaragua'),
  ('Oman', 'Paises', 'O', 'oman'),
  ('Panama', 'Paises', 'P', 'panama'),
  ('Qatar', 'Paises', 'Q', 'qatar'),
  ('Rumania', 'Paises', 'R', 'rumania'),
  ('Suecia', 'Paises', 'S', 'suecia'),
  ('Turquia', 'Paises', 'T', 'turquia'),
  ('Uruguay', 'Paises', 'U', 'uruguay'),
  ('Venezuela', 'Paises', 'V', 'venezuela'),
  ('Yemen', 'Paises', 'Y', 'yemen'),
  ('Zambia', 'Paises', 'Z', 'zambia'),
  ('Bogota', 'Ciudades', 'B', 'bogota'),
  ('Cartagena', 'Ciudades', 'C', 'cartagena'),
  ('Madrid', 'Ciudades', 'M', 'madrid'),
  ('React', 'Tecnologia', 'R', 'react'),
  ('Docker', 'Tecnologia', 'D', 'docker'),
  ('Supabase', 'Tecnologia', 'S', 'supabase'),
  ('Algoritmo', 'Programacion', 'A', 'algoritmo'),
  ('Backend', 'Programacion', 'B', 'backend'),
  ('Compilador', 'Programacion', 'C', 'compilador')
on conflict (category, normalized_word) do nothing;
