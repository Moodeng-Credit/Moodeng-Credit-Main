// Shared by the picture guides (MenuGuide, MessengerSwitchGuide): the yellow ring around the spot to
// tap, and the tapping finger's animation.

export const RING = 'ring-[3px] ring-[#FFD43B] ring-offset-2 ring-offset-white';

export const TAP_KEYFRAMES = `
@keyframes mg-tap { 0%, 100% { transform: translate(10px, 14px); } 40%, 62% { transform: translate(0, 0); } 50% { transform: translate(0, 0) scale(0.86); } }
@keyframes mg-ripple { 0%, 46% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; } 52% { opacity: 0.95; } 100% { transform: translate(-50%, -50%) scale(1.7); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .mg-finger, .mg-ripple { animation: none !important; } }
`;
