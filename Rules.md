# LexBattle

## Descripción General

LexBattle es un juego web multijugador online basado en palabras y velocidad mental.

Los jugadores compiten en tiempo real dentro de una sala donde deben responder palabras válidas según una letra asignada y un contexto específico.

Cada ronda se desarrolla en sentido horario, simulando una dinámica tipo "Papa Caliente", donde el tiempo es limitado y los errores generan penalizaciones.

El objetivo es ser el último jugador en pie o acumular la mayor cantidad de puntos al finalizar la partida.

---

# Objetivos del Proyecto

## Objetivo Principal

Desarrollar una aplicación web moderna que sirva como proyecto de portafolio profesional demostrando conocimientos en:

- Frontend moderno
- Aplicaciones en tiempo real
- Arquitectura Full Stack
- Bases de datos relacionales
- Autenticación
- WebSockets / Realtime
- CI/CD
- Deploy Cloud

---

# Modalidades de Juego

## Single Player

Modo individual.

El jugador debe completar el mayor número de letras posibles antes de que termine el tiempo.

### Características

- Temporizador global
- Puntuación local
- Ranking personal
- Estadísticas

---

## Multiplayer

Partidas online de:

- 2 jugadores
- 3 jugadores
- 4 jugadores

### Características

- Salas privadas
- Código de invitación
- Turnos sincronizados
- Sistema de puntuación
- Reconexion automática

---

# Mecánica del Juego

## Flujo General

1. Crear sala
2. Compartir código
3. Ingreso de jugadores
4. Selección de contexto
5. Inicio de partida
6. Asignación de turnos
7. Inicio de ronda
8. Validación de palabras
9. Cambio de turno
10. Finalización

---

# Ejemplo

Contexto:

Animales

Turno Jugador 1

Letra:

A

Respuesta:

Ardilla

Turno Jugador 2

Letra:

B

Respuesta:

Ballena

Turno Jugador 3

Letra:

C

Respuesta:

Caballo

...

Continúa hasta finalizar el alfabeto.

---

# Reglas

## Palabra válida

Debe:

- Existir en el diccionario
- Iniciar con la letra indicada
- No haber sido utilizada
- Cumplir el contexto seleccionado

## Palabra inválida

- No existe
- Repetida
- No inicia con la letra correcta
- No corresponde al contexto

---

# Contextos Iniciales

## Animales

Perro
Gato
Caballo

## Países

Colombia
México
Argentina

## Ciudades

Cartagena
Bogotá
Madrid

## Tecnología

Angular
Docker
React

## Programación

Algoritmo
Backend
Compilador

## Libre

Cualquier palabra válida

---

# Sistema de Puntuación

## Respuesta correcta

+10 puntos

## Respuesta rápida

+5 puntos extra

## Error

-5 puntos

## Tiempo agotado

-10 puntos

---

# Condiciones de Victoria

## Modo Eliminación

Pierde quien:

- Acumule 3 errores
- Se desconecte por más de 60 segundos

Gana:

Último jugador activo

---

## Modo Puntaje

Gana:

Jugador con mayor puntuación al finalizar la ronda.

---

# Arquitectura

## Arquitectura General

Frontend SPA

↓

Supabase

↓

PostgreSQL

↓

Realtime

↓

Edge Functions

---

# Stack Tecnológico

## Frontend

- React 19
- TypeScript
- Vite
- TailwindCSS
- Zustand
- React Router

## Backend

- Supabase

### Servicios

- PostgreSQL
- Auth
- Realtime
- Edge Functions
- Storage

---

# Hosting

## Frontend

GitHub Pages

## Backend

Supabase Free Tier

---

# Autenticación

## Opciones

- Invitado
- Google Login
- GitHub Login

---

# Funcionalidades Realtime

## Presence

Permite visualizar:

- Jugadores conectados
- Jugadores desconectados
- Estado online

## Broadcast

Permite transmitir:

- Cambios de turno
- Inicio de ronda
- Fin de partida
- Eventos especiales

---

# Base de Datos

## Tabla Users

```sql
id
username
avatar
created_at
```

## Tabla Games

```sql
id
room_code
host_id
status
context
current_turn
current_letter
created_at
```

## Tabla Players

```sql
id
game_id
user_id
score
errors
position
is_online
```

## Tabla Rounds

```sql
id
game_id
player_id
letter
word
is_valid
response_time
created_at
```

## Tabla Words

```sql
id
word
category
first_letter
normalized_word
```

---

# Estructura del Proyecto

```txt
lexbattle/

├── public/
│
├── src/
│
├── assets/
│
├── components/
│   ├── ui/
│   ├── game/
│   ├── lobby/
│   └── shared/
│
├── pages/
│   ├── Home/
│   ├── Lobby/
│   ├── Game/
│   ├── Results/
│   └── Profile/
│
├── hooks/
│
├── services/
│   ├── supabase/
│   ├── api/
│   └── realtime/
│
├── store/
│
├── routes/
│
├── types/
│
├── utils/
│
└── tests/
```

---

# Roadmap

## Fase 1

MVP

- Crear salas
- Unirse a salas
- Turnos
- Letras
- Puntajes

## Fase 2

Realtime

- Presence
- Reconexión
- Chat

## Fase 3

Ranking

- Leaderboard global
- Estadísticas

## Fase 4

Gamificación

- Logros
- Niveles
- Insignias

## Fase 5

IA

- Validación inteligente
- Generación automática de categorías
- Moderación de respuestas

---

# Características Técnicas para Portafolio

Demostrar:

- TypeScript avanzado
- Arquitectura escalable
- Diseño responsive
- Optimización de rendimiento
- Manejo de estado global
- Aplicaciones en tiempo real
- PostgreSQL
- Seguridad
- CI/CD
- Testing
- Clean Architecture

---

# Futuras Mejoras

- Aplicación móvil
- PWA
- Torneos
- Ranking mundial
- Modo espectador
- Soporte multilenguaje
- IA para validación semántica
- Sistema de temporadas

---

# Licencia

MIT License

---

Desarrollado por Oscar Uparela
Proyecto de Portafolio Full Stack Senior
