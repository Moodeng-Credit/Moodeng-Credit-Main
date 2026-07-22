// Shared Mecha assets/constants. Kept out of the component files so those can
// export only components (satisfies react-refresh/only-export-components).

// Mecha is Moodeng's robot friend (the chibi-mecha guide from the Academy) —
// NOT the Moodeng hippo. Localized from the animaapp CDN used in AcademyGuide.tsx.
export const MECHA_AVATAR = '/mecha/mecha.png';

// Mecha's expressions. He changes pose to match what's happening in the chat —
// waving hello, thinking while he answers, cheering a 👍, shrugging when he's not
// sure, saluting after handing you to the team, pointing when he nudges.
export type MechaMood = 'wave' | 'think' | 'present' | 'shrug' | 'point' | 'thumbsup' | 'salute';

export const MECHA_POSES: Record<MechaMood, string> = {
   wave: '/mecha/poses/wave.png',
   think: '/mecha/poses/think.png',
   present: '/mecha/poses/present.png',
   shrug: '/mecha/poses/shrug.png',
   point: '/mecha/poses/point.png',
   thumbsup: '/mecha/poses/thumbsup.png',
   salute: '/mecha/poses/salute.png'
};

// Neutral resting pose — used wherever no particular mood applies.
export const MECHA_MOOD_DEFAULT: MechaMood = 'present';

export const poseSrc = (mood: MechaMood): string => MECHA_POSES[mood];

// Preload the poses once so the avatar swaps are instant (no flash on first use).
// No-op on the server; guarded so it never throws in non-browser contexts.
let preloaded = false;
export function preloadMechaPoses(): void {
   if (preloaded || typeof window === 'undefined' || typeof Image === 'undefined') return;
   preloaded = true;
   for (const src of Object.values(MECHA_POSES)) {
      const img = new Image();
      img.src = src;
   }
}
