# Game LexBattle

## Descripción

LexBattle es un juego de palabras en tiempo real desarrollado con React y TypeScript. Incluye:

- Modo solitario: completa el abecedario con palabras válidas antes de que el temporizador termine.
- Modo multiplayer online: crea una sala privada con código, invita a amigos y compite por turnos.
- Sincronización en vivo usando Supabase Realtime.

## Arquitectura

### Frontend

- `src/App.tsx`:
  - Componente único principal que controla el flujo de la aplicación.
  - Maneja creación de salas, unión de jugadores, inicio de rondas, validación de palabras y actualizaciones de estado.
- `src/types/game.ts`:
  - Tipos de `GameState`, `Player`, `RealtimeEvent`, `GameContext` y fases del juego.
- `src/utils/gameData.ts`:
  - Datos de letras y contextos.
  - Bancos de palabras por categoría.
  - Normalización y validación de palabras.
- `src/services/supabase/client.ts`:
  - Inicializa el cliente de Supabase con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `src/services/supabase/rooms.ts`:
  - Funciones para crear salas, unir jugadores y guardar el estado del juego.
- `src/services/realtime/channel.ts`:
  - Crea el canal de Supabase Realtime y difunde eventos entre clientes.

### Backend / persistencia

- Supabase Postgres guarda:
  - `profiles`: perfiles de usuario (invitados incluidos).
  - `games`: metadatos de partidas y estado actual.
  - `players`: estado de cada jugador en la partida.
  - `room_states`: estado completo de la sala en JSON.
  - `rounds` y `words`: esquema preparado para historial y palabras, aunque el cliente actual usa principalmente `room_states`.
- El archivo de migración está en `supabase/migrations/20260611120000_online_rooms_schema.sql`.

## Cómo funciona

### Inicio

1. El jugador ingresa un nombre.
2. Selecciona un contexto de juego:
   - `Animales`, `Paises`, `Ciudades`, `Tecnologia`, `Programacion`, `Libre`.
3. Elige modo:
   - `Solitario`: juego local con abecedario completo.
   - `Crear sala`: hostea una sala online y comparte el código.
   - `Entrar`: ingresar a una sala existente con código.

### Flujo de partida multiplayer

1. El host crea la sala y espera la entrada de otros jugadores.
2. Todos los jugadores se sincronizan mediante Supabase Realtime.
3. El host inicia la partida cuando hay al menos 2 jugadores.
4. Cada jugador tiene un turno con una letra activa y 30 segundos para responder.
5. La palabra se valida y se actualiza el estado global.

### Lógica de turnos y fin de partida

- Cada turno dura 30 segundos.
- Si el jugador no responde a tiempo, pierde y el turno se reasigna.
- Si un jugador acumula 3 errores, queda eliminado.
- El juego termina cuando solo queda un jugador activo.
- El puntaje se calcula así:
  - Palabra válida: +10 puntos.
  - Respuesta rápida (<8 s): +5 puntos extra.
  - Palabra inválida: -5 puntos.

### Validación de palabras

- La palabra debe comenzar con la letra actual.
- No puede repetirse una palabra ya usada.
- Para categorías distintas de `Libre`, se valida contra el banco local de palabras.
- Para `Libre`, primero se valida con el banco local; si no está, se consulta el diccionario español externo.
- Las palabras se normalizan eliminando mayúsculas y acentos.

### Modo solitario

- Genera inmediatamente el estado de juego en local.
- El objetivo es completar todas las letras del abecedario.
- Si se cometen 3 errores o el tiempo se acaba en un turno, la partida termina.

## Cómo se juega

- En cada turno aparece una letra activa.
- Escribe una palabra válida que inicie con esa letra.
- Envía tu palabra antes de que el temporizador llegue a cero.
- Si aciertas, el turno avanza y ganas puntos.
- Si fallas, acumulas errores y puedes ser eliminado.
- En modo `Libre`, puedes usar palabras del diccionario español si no están en el banco local.

## Stack técnico

- Framework: React 19.
- Lenguaje: TypeScript 6.
- Bundler / dev server: Vite 4.
- UI: Tailwind CSS 4 (`@tailwindcss/vite`).
- Realtime / backend: Supabase Realtime y Supabase Postgres.
- Cliente Supabase: `@supabase/supabase-js`.
- Diccionario: `an-array-of-spanish-words`.

## Setup y ejecución

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variables de entorno:

```bash
VITE_SUPABASE_URL=tu-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=tu-supabase-key
```

3. Ejecutar en desarrollo:

```bash
npm run dev
```

4. Construir producción:

```bash
npm run build
```

5. Previsualizar build:

```bash
npm run preview
```

## Archivos clave

- `src/App.tsx`
- `src/utils/gameData.ts`
- `src/services/supabase/client.ts`
- `src/services/supabase/rooms.ts`
- `src/services/realtime/channel.ts`
- `supabase/migrations/20260611120000_online_rooms_schema.sql`
