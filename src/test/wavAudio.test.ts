import { describe, expect, it } from 'vitest';

import { downsample, encodeWav, joinChunks, WAV_RATE } from '@/lib/wavAudio';

describe('wavAudio', () => {
   it('averages 48 kHz down to 16 kHz', () => {
      const out = downsample(new Float32Array([0, 0.3, 0.6, 1, 1, 1]), 48000);
      expect(out.length).toBe(2);
      expect(out[0]).toBeCloseTo(0.3);
      expect(out[1]).toBeCloseTo(1);
   });

   it('leaves audio already at or below 16 kHz alone', () => {
      const samples = new Float32Array([0.1, 0.2]);
      expect(downsample(samples, WAV_RATE)).toBe(samples);
      expect(downsample(samples, 8000)).toBe(samples);
   });

   it('handles rates that are not a whole multiple (44.1 kHz)', () => {
      const out = downsample(new Float32Array(44100).fill(0.5), 44100);
      expect(out.length).toBe(16000);
      expect(out.every((v) => Math.abs(v - 0.5) < 1e-6)).toBe(true);
   });

   it('writes a 16-bit mono PCM WAV header and clips loud samples', () => {
      const view = new DataView(encodeWav(new Float32Array([0, 1, -1, 2]), 16000));
      const tag = (at: number) =>
         String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
      expect(tag(0)).toBe('RIFF');
      expect(tag(8)).toBe('WAVE');
      expect(view.getUint16(20, true)).toBe(1);
      expect(view.getUint16(22, true)).toBe(1);
      expect(view.getUint32(24, true)).toBe(16000);
      expect(view.getUint16(34, true)).toBe(16);
      expect(view.getUint32(40, true)).toBe(8);
      expect(view.byteLength).toBe(52);
      expect(view.getInt16(44, true)).toBe(0);
      expect(view.getInt16(46, true)).toBe(32767);
      expect(view.getInt16(48, true)).toBe(-32768);
      expect(view.getInt16(50, true)).toBe(32767);
   });

   it('joins microphone chunks in order', () => {
      expect(Array.from(joinChunks([new Float32Array([1, 2]), new Float32Array([3])]))).toEqual([1, 2, 3]);
   });
});
