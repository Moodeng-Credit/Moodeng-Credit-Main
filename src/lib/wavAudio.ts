// The sound of a recorded answer as a small WAV (16 kHz, mono, 16-bit), which is what the
// speech-to-text behind the pre-screening page takes (it can't read phone video). 45 seconds ≈ 1.4 MB.

export const WAV_RATE = 16000;

/** Averages samples down to `toRate`. Returns the input when it's already at or below that rate. */
export function downsample(samples: Float32Array, fromRate: number, toRate = WAV_RATE): Float32Array {
   if (!(fromRate > toRate)) return samples;
   const ratio = fromRate / toRate;
   const out = new Float32Array(Math.floor(samples.length / ratio));
   for (let i = 0; i < out.length; i += 1) {
      const start = Math.floor(i * ratio);
      const end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j += 1) sum += samples[j];
      out[i] = sum / (end - start);
   }
   return out;
}

/** 16-bit PCM mono WAV bytes. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
   const buffer = new ArrayBuffer(44 + samples.length * 2);
   const view = new DataView(buffer);
   const text = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
   };
   text(0, 'RIFF');
   view.setUint32(4, 36 + samples.length * 2, true);
   text(8, 'WAVE');
   text(12, 'fmt ');
   view.setUint32(16, 16, true);
   view.setUint16(20, 1, true); // PCM
   view.setUint16(22, 1, true); // mono
   view.setUint32(24, sampleRate, true);
   view.setUint32(28, sampleRate * 2, true);
   view.setUint16(32, 2, true);
   view.setUint16(34, 16, true);
   text(36, 'data');
   view.setUint32(40, samples.length * 2, true);
   for (let i = 0; i < samples.length; i += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
   }
   return buffer;
}

export function joinChunks(chunks: Float32Array[]): Float32Array {
   const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
   let at = 0;
   for (const c of chunks) {
      out.set(c, at);
      at += c.length;
   }
   return out;
}

/** WAV file from raw microphone samples, capped at `maxSeconds`. */
export function wavBlob(samples: Float32Array, fromRate: number, maxSeconds = 110): Blob {
   const rate = Math.min(fromRate, WAV_RATE);
   const down = downsample(samples, fromRate).subarray(0, rate * maxSeconds);
   return new Blob([encodeWav(down, rate)], { type: 'audio/wav' });
}

type AudioContextCtor = typeof AudioContext;
export const audioContextCtor = (): AudioContextCtor | null =>
   typeof window === 'undefined'
      ? null
      : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ?? null);

/** The sound of a video file the phone's camera made (the fallback when live recording isn't allowed). Null if it can't be read. */
export async function wavFromMediaFile(file: Blob): Promise<{ wav: Blob; seconds: number } | null> {
   const Ctor = audioContextCtor();
   if (!Ctor) return null;
   const ctx = new Ctor();
   try {
      const bytes = await file.arrayBuffer();
      const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
         // Callback form too: older Safari has no promise version.
         const maybe = ctx.decodeAudioData(bytes, resolve, reject);
         if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
      });
      return { wav: wavBlob(decoded.getChannelData(0), decoded.sampleRate), seconds: decoded.duration };
   } catch {
      return null;
   } finally {
      void ctx.close().catch(() => undefined);
   }
}
