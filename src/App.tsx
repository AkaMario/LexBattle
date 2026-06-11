import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  broadcastGameEvent,
  createRoomChannel,
} from "./services/realtime/channel";
import { isSupabaseConfigured } from "./services/supabase/client";
import {
  createOnlineRoom,
  joinOnlineRoom,
  saveRoomState,
} from "./services/supabase/rooms";
import type {
  GameContext,
  GameState,
  Player,
  RealtimeEvent,
} from "./types/game";
import {
  GAME_CONTEXTS,
  LETTERS,
  normalizeWord,
  validateWord,
} from "./utils/gameData";

const PLAYER_STORAGE_KEY = "lexbattle-player";
const MAX_ERRORS = 3;
const SINGLE_PLAYER_ROOM = "SOLO";
const TURN_SECONDS = 30;

function createPlayer(name: string, isHost = false): Player {
  const savedId = localStorage.getItem(PLAYER_STORAGE_KEY);
  const id = savedId ?? crypto.randomUUID();

  localStorage.setItem(PLAYER_STORAGE_KEY, id);

  return {
    id,
    name: name.trim() || "Guest Player",
    score: 0,
    errors: 0,
    isOnline: true,
    isHost,
  };
}

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createInitialState(roomCode: string, host: Player): GameState {
  return {
    roomCode,
    phase: "lobby",
    hostId: host.id,
    context: "Animales",
    players: [host],
    currentTurnIndex: 0,
    currentLetterIndex: 0,
    usedWords: [],
    history: [],
    roundStartedAt: Date.now(),
    message: "Sala creada. Comparte el codigo para iniciar la batalla.",
  };
}

function upsertPlayer(players: Player[], player: Player) {
  const exists = players.some(
    (currentPlayer) => currentPlayer.id === player.id,
  );
  if (!exists) return [...players, player];

  return players.map((currentPlayer) =>
    currentPlayer.id === player.id
      ? { ...currentPlayer, name: player.name, isOnline: true }
      : currentPlayer,
  );
}

function getNextTurnIndex(players: Player[], currentTurnIndex: number) {
  const activePlayers = players.filter((player) => player.errors < MAX_ERRORS);
  if (activePlayers.length <= 1) return currentTurnIndex;

  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidateIndex = (currentTurnIndex + offset) % players.length;
    if (players[candidateIndex].errors < MAX_ERRORS) return candidateIndex;
  }

  return currentTurnIndex;
}

function getWinnerId(players: Player[]) {
  const activePlayers = players.filter((player) => player.errors < MAX_ERRORS);
  if (activePlayers.length === 1) return activePlayers[0].id;

  return [...players].sort((a, b) => b.score - a.score)[0]?.id;
}

function getNextLetterIndex(currentLetterIndex: number, shouldLoop: boolean) {
  if (shouldLoop) return (currentLetterIndex + 1) % LETTERS.length;

  return Math.min(currentLetterIndex + 1, LETTERS.length - 1);
}

function getCircularStyle(index: number, total: number, radius: number) {
  const angle = (360 / total) * index - 90;

  return {
    transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)`,
  };
}

function playTone(kind: "join" | "valid" | "error" | "start") {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const audio = new AudioContextClass();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const frequency = {
    join: 520,
    valid: 860,
    error: 160,
    start: 420,
  }[kind];

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  gain.gain.setValueAtTime(0.05, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.18);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function App() {
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [word, setWord] = useState("");
  const [isValidatingWord, setIsValidatingWord] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [isRoomBusy, setIsRoomBusy] = useState(false);
  const [selectedContext, setSelectedContext] =
    useState<GameContext>("Animales");
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const playerRef = useRef<Player | null>(null);
  const pendingSyncRef = useRef<Player | null>(null);
  const timeoutKeyRef = useRef("");

  function publishState(nextState: GameState) {
    stateRef.current = nextState;
    setGameState(nextState);
    void saveRoomState(nextState).catch((error: unknown) => {
      setRoomError(
        error instanceof Error ? error.message : "No se pudo guardar la sala.",
      );
    });
    broadcastGameEvent(channelRef.current, { type: "state", state: nextState });
  }

  const handleRealtimeEvent = useEffectEvent((event: RealtimeEvent) => {
    if (event.type === "state") {
      stateRef.current = event.state;
      setGameState(event.state);
      return;
    }

    const currentState = stateRef.current;
    const currentPlayer = playerRef.current;
    if (
      !currentState ||
      !currentPlayer ||
      currentState.hostId !== currentPlayer.id
    )
      return;

    const nextPlayers = upsertPlayer(currentState.players, event.player);
    const nextState = {
      ...currentState,
      players: nextPlayers,
      message: `${event.player.name} entro a la sala.`,
    };
    playTone("join");
    publishState(nextState);
  });

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    playerRef.current = localPlayer;
  }, [localPlayer]);

  useEffect(() => {
    if (
      !gameState?.roomCode ||
      gameState.roomCode === SINGLE_PLAYER_ROOM ||
      !isSupabaseConfigured
    )
      return undefined;

    channelRef.current?.unsubscribe();
    const channel = createRoomChannel(gameState.roomCode, (event) =>
      handleRealtimeEvent(event),
    );
    channelRef.current = channel;

    const pendingPlayer = pendingSyncRef.current;
    if (pendingPlayer) {
      pendingSyncRef.current = null;
      window.setTimeout(() => {
        broadcastGameEvent(channelRef.current, {
          type: "sync-request",
          player: pendingPlayer,
        });
      }, 500);
    }

    return () => {
      channel?.unsubscribe();
      channelRef.current = null;
    };
  }, [gameState?.roomCode]);

  async function handleCreateRoom() {
    if (isRoomBusy) return;

    setRoomError("");
    setIsRoomBusy(true);
    const host = createPlayer(playerName, true);
    const roomCode = createRoomCode();
    const nextState = {
      ...createInitialState(roomCode, host),
      context: selectedContext,
    };

    try {
      await createOnlineRoom(nextState);
      setLocalPlayer(host);
      setGameState(nextState);
      playTone("start");
    } catch (error) {
      setRoomError(
        error instanceof Error ? error.message : "No se pudo crear la sala.",
      );
    } finally {
      setIsRoomBusy(false);
    }
  }

  function handleSinglePlayer() {
    const player = createPlayer(playerName, true);
    const nextState: GameState = {
      ...createInitialState(SINGLE_PLAYER_ROOM, player),
      phase: "playing",
      context: selectedContext,
      message:
        "Modo solo iniciado. Completa el alfabeto usando el diccionario español.",
    };

    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setLocalPlayer(player);
    setGameState(nextState);
    playTone("start");
  }

  async function handleJoinRoom() {
    if (isRoomBusy) return;

    setRoomError("");
    setIsRoomBusy(true);
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setIsRoomBusy(false);
      return;
    }

    const player = createPlayer(playerName);

    try {
      const nextState = await joinOnlineRoom(code, player);
      pendingSyncRef.current = player;
      setLocalPlayer(player);
      setGameState(nextState);
      playTone("join");
    } catch (error) {
      setRoomError(
        error instanceof Error ? error.message : "No se pudo entrar a la sala.",
      );
    } finally {
      setIsRoomBusy(false);
    }
  }

  function handleContextChange(context: GameContext) {
    if (!gameState || localPlayer?.id !== gameState.hostId) return;
    setSelectedContext(context);
    publishState({
      ...gameState,
      context,
      message: `Categoria seleccionada: ${context}.`,
    });
  }

  function handleStartGame() {
    if (
      !gameState ||
      localPlayer?.id !== gameState.hostId ||
      gameState.players.length < 2
    )
      return;

    publishState({
      ...gameState,
      phase: "playing",
      players: gameState.players.map((player) => ({
        ...player,
        score: 0,
        errors: 0,
      })),
      currentTurnIndex: 0,
      currentLetterIndex: 0,
      usedWords: [],
      history: [],
      roundStartedAt: Date.now(),
      winnerId: undefined,
      message: "La batalla comenzo. Responde antes que explote el turno.",
    });
    playTone("start");
  }

  async function handleSubmitWord() {
    if (!gameState || !localPlayer) return;

    const activePlayer = gameState.players[gameState.currentTurnIndex];
    if (activePlayer.id !== localPlayer.id || isValidatingWord) return;

    setIsValidatingWord(true);

    const currentLetter = LETTERS[gameState.currentLetterIndex];
    const responseTime = Date.now() - gameState.roundStartedAt;
    const result = await validateWord(
      word,
      currentLetter,
      gameState.context,
      gameState.usedWords,
    );
    const normalizedWord = normalizeWord(word);
    const scoreDelta = result.isValid ? 10 + (responseTime < 8000 ? 5 : 0) : -5;
    const nextPlayers = gameState.players.map((player) =>
      player.id === localPlayer.id
        ? {
            ...player,
            score: player.score + scoreDelta,
            errors: result.isValid ? player.errors : player.errors + 1,
          }
        : player,
    );
    const isSinglePlayer = gameState.roomCode === SINGLE_PLAYER_ROOM;
    const finishedByLetters =
      isSinglePlayer &&
      result.isValid &&
      gameState.currentLetterIndex >= LETTERS.length - 1;
    const activePlayersCount = nextPlayers.filter(
      (player) => player.errors < MAX_ERRORS,
    ).length;
    const finishedByErrors = isSinglePlayer
      ? nextPlayers[0].errors >= MAX_ERRORS
      : activePlayersCount <= 1;
    const nextState: GameState = {
      ...gameState,
      players: nextPlayers,
      phase: finishedByLetters || finishedByErrors ? "finished" : "playing",
      currentTurnIndex: getNextTurnIndex(
        nextPlayers,
        gameState.currentTurnIndex,
      ),
      currentLetterIndex: result.isValid
        ? getNextLetterIndex(gameState.currentLetterIndex, !isSinglePlayer)
        : gameState.currentLetterIndex,
      usedWords: result.isValid
        ? [...gameState.usedWords, normalizedWord]
        : gameState.usedWords,
      history: [
        {
          playerId: localPlayer.id,
          letter: currentLetter,
          word,
          isValid: result.isValid,
        },
        ...gameState.history,
      ].slice(0, 8),
      roundStartedAt: Date.now(),
      winnerId: finishedByLetters
        ? localPlayer.id
        : !isSinglePlayer && finishedByErrors
          ? getWinnerId(nextPlayers)
          : undefined,
      message: finishedByLetters
        ? `${localPlayer.name} completo todo el abecedario.`
        : isSinglePlayer && finishedByErrors
          ? "La bomba exploto por demasiados errores. Debias completar todo el abecedario."
          : `${localPlayer.name}: ${result.reason}`,
    };

    setWord("");
    setIsValidatingWord(false);
    playTone(result.isValid ? "valid" : "error");
    publishState(nextState);
  }

  const handleTurnTimeout = useEffectEvent(() => {
    const currentState = stateRef.current;
    const currentPlayer = playerRef.current;
    if (!currentState || currentState.phase !== "playing") return;
    if (
      currentState.roomCode !== SINGLE_PLAYER_ROOM &&
      currentPlayer?.id !== currentState.hostId
    )
      return;

    const activePlayer = currentState.players[currentState.currentTurnIndex];
    if (!activePlayer) return;

    const timeoutKey = `${currentState.roundStartedAt}:${activePlayer.id}`;
    if (timeoutKeyRef.current === timeoutKey) return;
    timeoutKeyRef.current = timeoutKey;

    const isSinglePlayer = currentState.roomCode === SINGLE_PLAYER_ROOM;
    const nextPlayers = currentState.players.map((player) =>
      player.id === activePlayer.id
        ? { ...player, errors: MAX_ERRORS, score: player.score - 10 }
        : player,
    );
    const activePlayersCount = nextPlayers.filter(
      (player) => player.errors < MAX_ERRORS,
    ).length;
    const nextState: GameState = {
      ...currentState,
      players: nextPlayers,
      phase: isSinglePlayer || activePlayersCount <= 1 ? "finished" : "playing",
      currentTurnIndex: isSinglePlayer
        ? currentState.currentTurnIndex
        : getNextTurnIndex(nextPlayers, currentState.currentTurnIndex),
      winnerId: isSinglePlayer
        ? undefined
        : activePlayersCount <= 1
          ? getWinnerId(nextPlayers)
          : undefined,
      roundStartedAt: Date.now(),
      message: isSinglePlayer
        ? "La bomba exploto. Debias completar todo el abecedario."
        : `La bomba exploto en manos de ${activePlayer.name}. Ahora especta la partida.`,
    };

    setIsValidatingWord(false);
    playTone("error");
    publishState(nextState);
  });

  const gamePhase = gameState?.phase;
  const roundStartedAt = gameState?.roundStartedAt;

  useEffect(() => {
    if (gamePhase !== "playing" || !roundStartedAt) return undefined;

    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        TURN_SECONDS - Math.floor((Date.now() - roundStartedAt) / 1000),
      );
      setTimeLeft(remaining);

      if (remaining <= 0) handleTurnTimeout();
    }, 250);

    return () => window.clearInterval(interval);
  }, [gamePhase, roundStartedAt]);

  function handleRestart() {
    if (!gameState || localPlayer?.id !== gameState.hostId) return;

    if (gameState.roomCode === SINGLE_PLAYER_ROOM) {
      publishState({
        ...gameState,
        phase: "playing",
        players: gameState.players.map((player) => ({
          ...player,
          score: 0,
          errors: 0,
        })),
        currentTurnIndex: 0,
        currentLetterIndex: 0,
        usedWords: [],
        history: [],
        roundStartedAt: Date.now(),
        winnerId: undefined,
        message:
          "Nueva partida en solitario. Completa el abecedario antes de que explote la bomba.",
      });
      return;
    }

    publishState({
      ...gameState,
      phase: "lobby",
      players: gameState.players.map((player) => ({
        ...player,
        score: 0,
        errors: 0,
      })),
      currentTurnIndex: 0,
      currentLetterIndex: 0,
      usedWords: [],
      history: [],
      winnerId: undefined,
      message: "Nueva ronda lista en el lobby.",
    });
  }

  function handleLeaveRoom() {
    if (gameState && localPlayer && gameState.roomCode !== SINGLE_PLAYER_ROOM) {
      const remainingPlayers = gameState.players.filter(
        (player) => player.id !== localPlayer.id,
      );

      if (remainingPlayers.length > 0) {
        const nextState: GameState = {
          ...gameState,
          hostId:
            gameState.hostId === localPlayer.id
              ? remainingPlayers[0].id
              : gameState.hostId,
          players: remainingPlayers.map((player, index) => ({
            ...player,
            isHost:
              gameState.hostId === localPlayer.id ? index === 0 : player.isHost,
          })),
          currentTurnIndex: Math.min(
            gameState.currentTurnIndex,
            remainingPlayers.length - 1,
          ),
          message: `${localPlayer.name} salio de la sala.`,
        };

        broadcastGameEvent(channelRef.current, {
          type: "state",
          state: nextState,
        });
      }
    }

    channelRef.current?.unsubscribe();
    channelRef.current = null;
    stateRef.current = null;
    playerRef.current = null;
    pendingSyncRef.current = null;
    setGameState(null);
    setLocalPlayer(null);
    setWord("");
    setJoinCode("");
    setIsValidatingWord(false);
  }

  const activePlayer = gameState?.players[gameState.currentTurnIndex];
  const isHost = Boolean(gameState && localPlayer?.id === gameState.hostId);
  const isMyTurn = Boolean(activePlayer && localPlayer?.id === activePlayer.id);
  const winner = gameState?.players.find(
    (player) => player.id === gameState.winnerId,
  );
  const isSinglePlayer = gameState?.roomCode === SINGLE_PLAYER_ROOM;
  const localPlayerRecord = gameState?.players.find(
    (player) => player.id === localPlayer?.id,
  );
  const isSpectator = Boolean(
    localPlayerRecord &&
    localPlayerRecord.errors >= MAX_ERRORS &&
    !isSinglePlayer,
  );
  const currentLetter = gameState ? LETTERS[gameState.currentLetterIndex] : "A";
  const timerPercent = (timeLeft / TURN_SECONDS) * 100;
  const isFocusScreen =
    gameState?.phase === "playing" || gameState?.phase === "finished";

  return (
    <main
      className={`min-h-screen bg-[#0b1026] text-slate-100 ${isFocusScreen ? "px-3 py-3 sm:px-5" : "px-4 py-6 sm:px-6 lg:px-10"}`}
    >
      <div className="mx-auto max-w-6xl">
        {!gameState ? (
          <section className="home-screen">
            <div className="game-marquee">
              <strong>LEXBATTLE</strong>
              <small>30 segundos para explotar</small>
            </div>

            <div className="start-panel">
              <label htmlFor="player-name">Jugador</label>
              <input
                className="retro-input"
                id="player-name"
                maxLength={18}
                placeholder="Ingresa tu apodo"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
              />

              <label htmlFor="home-context">Tematica</label>
              <select
                className="retro-input"
                id="home-context"
                value={selectedContext}
                onChange={(event) =>
                  setSelectedContext(event.target.value as GameContext)
                }
              >
                {GAME_CONTEXTS.map((context) => (
                  <option key={context}>{context}</option>
                ))}
              </select>

              {roomError && <p className="home-error">{roomError}</p>}

              <div className="mode-grid">
                <button
                  className="mode-card"
                  type="button"
                  onClick={handleSinglePlayer}
                >
                  <span>1P</span>
                  <strong>Solitario</strong>
                  <small>Completa el abecedario</small>
                </button>

                <button
                  className="mode-card"
                  type="button"
                  onClick={() => void handleCreateRoom()}
                  disabled={!isSupabaseConfigured || isRoomBusy}
                >
                  <span>HOST</span>
                  <strong>{isRoomBusy ? "Creando..." : "Crear sala"}</strong>
                  <small>Invita con codigo</small>
                </button>
              </div>

              <div className="join-box">
                <input
                  className="retro-input uppercase"
                  maxLength={6}
                  placeholder="CODIGO"
                  value={joinCode}
                  onChange={(event) =>
                    setJoinCode(event.target.value.toUpperCase())
                  }
                />
                <button
                  className="retro-button"
                  type="button"
                  onClick={() => void handleJoinRoom()}
                  disabled={!isSupabaseConfigured || isRoomBusy}
                >
                  {isRoomBusy ? "..." : "Entrar"}
                </button>
              </div>
            </div>

            <div className="how-to-play">
              <span>Como jugar</span>
              <p>
                Responde una palabra con la letra activa antes de que la bomba
                llegue a cero.
              </p>
            </div>
          </section>
        ) : (
          <section
            className={
              isFocusScreen
                ? "play-shell"
                : "grid gap-5 lg:grid-cols-[0.9fr_1.3fr]"
            }
          >
            <aside className={isFocusScreen ? "hidden" : "pixel-card p-5"}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300">
                    Room
                  </p>
                  <strong className="mt-1 block font-mono text-4xl text-white">
                    {gameState.roomCode}
                  </strong>
                </div>
                <span className="rounded-full bg-lime-300 px-3 py-1 font-mono text-xs font-bold text-slate-950">
                  {gameState.phase.toUpperCase()}
                </span>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">
                  Players
                </p>
                <div className="mt-4 space-y-3">
                  {gameState.players.map((player, index) => (
                    <div
                      className={`rounded-xl border p-3 ${
                        activePlayer?.id === player.id
                          ? "border-cyan-300 bg-cyan-300/10"
                          : "border-white/10 bg-slate-950/50"
                      }`}
                      key={player.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm text-white">
                          {index + 1}. {player.name}{" "}
                          {player.isHost ? "[HOST]" : ""}
                        </span>
                        <span
                          className={
                            player.errors >= MAX_ERRORS
                              ? "text-xs text-rose-300"
                              : "text-xs text-lime-300"
                          }
                        >
                          {player.errors >= MAX_ERRORS
                            ? "OUT"
                            : `${player.score} pts`}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-1">
                        {Array.from({ length: MAX_ERRORS }).map(
                          (_, errorIndex) => (
                            <span
                              className={`h-2 flex-1 rounded-full ${errorIndex < player.errors ? "bg-rose-500" : "bg-white/10"}`}
                              key={errorIndex}
                            />
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                className="mt-4 w-full rounded-2xl border border-rose-400/50 bg-rose-500/10 px-4 py-3 font-mono text-sm font-black uppercase text-rose-200 transition hover:bg-rose-500/20"
                type="button"
                onClick={handleLeaveRoom}
              >
                Salir
              </button>
            </aside>

            <div
              className={
                isFocusScreen
                  ? "play-panel"
                  : "pixel-card min-h-[520px] p-5 sm:p-7"
              }
            >
              {gameState.phase === "lobby" && (
                <div className="grid h-full content-center gap-6">
                  <div className="loading-grid mx-auto h-32 w-32 rounded-3xl border border-cyan-300/40" />
                  <div className="text-center">
                    <p className="font-mono text-sm uppercase tracking-[0.35em] text-cyan-300">
                      Pixel Lobby
                    </p>
                    <h2 className="mt-3 text-4xl font-black text-white">
                      Esperando combatientes
                    </h2>
                    <p className="mt-3 text-slate-300">{gameState.message}</p>
                  </div>

                  {isHost && (
                    <div className="mx-auto grid w-full max-w-xl gap-4">
                      <select
                        className="retro-input"
                        value={gameState.context}
                        onChange={(event) =>
                          handleContextChange(event.target.value as GameContext)
                        }
                      >
                        {GAME_CONTEXTS.map((context) => (
                          <option key={context}>{context}</option>
                        ))}
                      </select>
                      <button
                        className="retro-button"
                        type="button"
                        onClick={handleStartGame}
                        disabled={gameState.players.length < 2}
                      >
                        Start Battle
                      </button>
                    </div>
                  )}
                </div>
              )}

              {gameState.phase === "playing" && (
                <div className="play-view">
                  <div className="play-hud">
                    <span>{gameState.context}</span>
                    <strong>{currentLetter}</strong>
                    <span className={timeLeft <= 5 ? "text-rose-300" : ""}>
                      {timeLeft}s
                    </span>
                  </div>

                  <button
                    className="leave-game-button"
                    type="button"
                    onClick={handleLeaveRoom}
                  >
                    Salir de la partida
                  </button>

                  <div className="score-strip" aria-label="Marcador">
                    {gameState.players.map((player) => (
                      <div
                        className={`score-chip ${activePlayer?.id === player.id ? "score-chip-active" : ""}`}
                        key={player.id}
                      >
                        <span>{player.name}</span>
                        <strong>
                          {player.errors >= MAX_ERRORS ? "OUT" : player.score}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="table-arena">
                    <div className="round-table">
                      <div className="table-core">
                        <span>Turno</span>
                        <strong>{activePlayer?.name}</strong>
                        <div
                          className={`bomb ${timeLeft <= 5 ? "bomb-danger" : ""}`}
                        >
                          BOMB
                        </div>
                      </div>

                      {LETTERS.map((letter, index) => (
                        <span
                          className={`letter-token ${letter === currentLetter ? "letter-token-active" : ""}`}
                          key={letter}
                          style={getCircularStyle(index, LETTERS.length, 128)}
                        >
                          {letter}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="time-bar">
                    <span style={{ width: `${timerPercent}%` }} />
                  </div>

                  <form
                    className="grid gap-4 rounded-2xl border border-white/10 p-3 text-center"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSubmitWord();
                    }}
                  >
                    <p className="h-fit min-h-8 overflow-visible break-words font-mono text-xs leading-relaxed text-lime-300">
                      {isSpectator ? "Estas espectando." : gameState.message}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                      <input
                        className="retro-input"
                        disabled={!isMyTurn || isValidatingWord || isSpectator}
                        placeholder={
                          isMyTurn
                            ? `Palabra con ${currentLetter}`
                            : "Esperando turno"
                        }
                        value={word}
                        onChange={(event) => setWord(event.target.value)}
                      />
                      <button
                        className="retro-button min-h-12 w-full sm:w-auto"
                        type="submit"
                        disabled={!isMyTurn || isValidatingWord || isSpectator}
                      >
                        {isValidatingWord ? "..." : "OK"}
                      </button>
                    </div>
                  </form>

                  {gameState.history[0] && (
                    <div className="last-play">
                      <span>Ultima</span>
                      <strong>
                        {gameState.history[0].letter} /{" "}
                        {gameState.history[0].word}
                      </strong>
                      <em>{gameState.history[0].isValid ? "OK" : "MISS"}</em>
                    </div>
                  )}
                </div>
              )}

              {gameState.phase === "finished" && (
                <div className="grid h-full content-center gap-6 text-center justify-center">
                  <p className="font-mono text-sm uppercase tracking-[0.35em] text-lime-300">
                    Game Over
                  </p>
                  <h2 className="text-5xl font-black text-white">
                    {winner ? `${winner.name} gana` : "Partida perdida"}
                  </h2>
                  <p className="text-slate-300">{gameState.message}</p>
                  {isHost && (
                    <button
                      className="retro-button mx-auto"
                      type="button"
                      onClick={handleRestart}
                    >
                      {isSinglePlayer ? "Jugar de nuevo" : "Volver al lobby"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
