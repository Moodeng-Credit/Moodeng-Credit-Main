// Soft Duolingo-style chimes for onboarding answers, synthesized with Web Audio (no sound files).
// Off by default — a money app making noise in public would surprise people — and the borrower
// turns them on with a speaker button (onboarding header or bio footer). Kept on the device.

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'md_ui_sounds';
// Every speaker button (onboarding header, bio footer) listens, so they always agree.
const listeners = new Set<() => void>();

export const soundsEnabled = (): boolean => {
   try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
   } catch {
      return false;
   }
};

export const setSoundsEnabled = (on: boolean) => {
   try {
      if (on) window.localStorage.setItem(STORAGE_KEY, '1');
      else window.localStorage.removeItem(STORAGE_KEY);
   } catch {
      // Storage blocked — sounds just stay off next time.
   }
   listeners.forEach((listener) => listener());
};

export const useSoundsEnabled = (): boolean =>
   useSyncExternalStore(
      (listener) => {
         listeners.add(listener);
         return () => listeners.delete(listener);
      },
      soundsEnabled,
      () => false
   );

let audioContext: AudioContext | null = null;

const getContext = (): AudioContext | null => {
   if (typeof window === 'undefined') return null;
   const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
   if (!Ctor) return null;
   audioContext ??= new Ctor();
   if (audioContext.state === 'suspended') void audioContext.resume();
   return audioContext;
};

// One soft bell-like note: quick attack, gentle exponential fade.
const note = (ctx: AudioContext, frequency: number, start: number, duration: number, volume: number) => {
   const osc = ctx.createOscillator();
   const gain = ctx.createGain();
   osc.type = 'sine';
   osc.frequency.setValueAtTime(frequency, start);
   gain.gain.setValueAtTime(0.0001, start);
   gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
   gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
   osc.connect(gain).connect(ctx.destination);
   osc.start(start);
   osc.stop(start + duration + 0.02);
};

const play = (notes: [frequency: number, offset: number, duration: number, volume: number][], force = false) => {
   if (!force && !soundsEnabled()) return;
   try {
      const ctx = getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      notes.forEach(([frequency, offset, duration, volume]) => note(ctx, frequency, now + offset, duration, volume));
   } catch {
      // No audio on this device — silently skip.
   }
};

// An answer: a quick rising two-note "ding" (A5 → E6).
export const playDing = (force = false) =>
   play(
      [
         [880, 0, 0.16, 0.1],
         [1318.5, 0.07, 0.26, 0.08]
      ],
      force
   );

// A finished page or step: a short bright arpeggio (C5 E5 G5 C6).
export const playSuccess = () =>
   play([
      [523.25, 0, 0.22, 0.09],
      [659.25, 0.08, 0.22, 0.09],
      [783.99, 0.16, 0.24, 0.09],
      [1046.5, 0.24, 0.42, 0.08]
   ]);
