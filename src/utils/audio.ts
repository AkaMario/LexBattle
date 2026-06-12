const BGM_URL = "https://cdn.freesound.org/previews/455/455017_9182239-hq.mp3";
const SFX_ERROR =
  "https://cdn.freesound.org/previews/331/331912_3248244-hq.mp3";
const SFX_SUCCESS =
  "https://cdn.freesound.org/previews/528/528957_10334845-hq.mp3";
const SFX_EXPLOSION =
  "https://cdn.freesound.org/previews/587/587886_5487341-hq.mp3";

let bgmAudio: HTMLAudioElement | null = null;
let _muted = false;

export function isMuted() {
  return _muted;
}

export function setMuted(value: boolean) {
  _muted = value;
}

export function toggleMute() {
  _muted = !_muted;
  if (_muted) stopBgm();
  else playBgm();
  return _muted;
}

export function playBgm() {
  if (_muted) return;
  stopBgm();
  bgmAudio = new Audio(BGM_URL);
  bgmAudio.loop = true;
  bgmAudio.volume = 0.85;
  bgmAudio.play().catch(() => {});
}

export function stopBgm() {
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio = null;
  }
}

export function ensureBgm() {
  if (_muted) return;
  if (!bgmAudio || bgmAudio.paused) {
    playBgm();
  }
}

function playSfx(url: string, volume = 0.5) {
  if (_muted) return;
  const audio = new Audio(url);
  audio.volume = volume;
  audio.play().catch(() => {});
}

export function playErrorSfx() {
  playSfx(SFX_ERROR, 0.6);
}

export function playSuccessSfx() {
  playSfx(SFX_SUCCESS, 0.5);
}

export function playExplosionSfx() {
  playSfx(SFX_EXPLOSION, 0.7);
}
