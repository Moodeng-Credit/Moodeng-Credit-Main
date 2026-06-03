import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { X } from 'lucide-react';
import { useDispatch } from 'react-redux';

import { PLACEHOLDER_AVATAR } from '@/components/UserAvatar';
import { AVATAR_BACKGROUNDS, DEFAULT_AVATAR_BACKGROUND } from '@/config/avatarBackgrounds';
import { detectVisibleAvatarBackgroundArea, imageHasVisibleAvatarBackgroundArea } from '@/lib/avatarBackgroundVisibility';
import { updateUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

// ─── Constants ────────────────────────────────────────────────────────────────

const PREVIEW_SIZE = 240; // px — circular preview shown in the modal
const OUTPUT_SIZE = 512;  // px — square canvas used for the PNG export
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvatarUploadModalProps {
   isOpen: boolean;
   isSaving: boolean;
   currentAvatar?: string | null;
   currentAvatarBackground?: string | null;
   onClose: () => void;
   /** Receives a 512×512 PNG Blob wrapped in a File plus the selected frame color. */
   onSave: (file: File, avatarBackground: string) => Promise<void>;
}

type Step = 'select' | 'crop';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Two-step modal: file picker → canvas crop.
 *
 * No external crop library required. Uses a single <canvas> for live preview
 * and a separate offscreen canvas to export the final PNG.
 *
 * Offset state is in *natural image pixels* so the math stays consistent
 * regardless of the preview size or the output size.
 */
export default function AvatarUploadModal({
   isOpen,
   isSaving,
   currentAvatar,
   currentAvatarBackground,
   onClose,
   onSave,
}: AvatarUploadModalProps) {
   const dispatch = useDispatch<AppDispatch>();
   const [step, setStep] = useState<Step>('select');
   const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
   const [scale, setScale] = useState(1);
   const [offset, setOffset] = useState({ x: 0, y: 0 }); // natural-image-pixel offset from centre
   const [avatarBackground, setAvatarBackground] = useState(currentAvatarBackground ?? DEFAULT_AVATAR_BACKGROUND);
   const [currentAvatarSupportsBackground, setCurrentAvatarSupportsBackground] = useState(!currentAvatar);
   const [uploadedAvatarSupportsBackground, setUploadedAvatarSupportsBackground] = useState(false);
   const [isSavingBackground, setIsSavingBackground] = useState(false);
   const [error, setError] = useState('');

   const canvasRef = useRef<HTMLCanvasElement>(null);
   // Drag tracking stored in a ref so moves don't trigger re-renders mid-drag
   const dragRef = useRef<{ clientX: number; clientY: number; ox: number; oy: number } | null>(null);

   // ─── Canvas preview ───────────────────────────────────────────────────────

   useEffect(() => {
      if (!imgEl || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const baseScale = Math.max(
         PREVIEW_SIZE / imgEl.naturalWidth,
         PREVIEW_SIZE / imgEl.naturalHeight,
      );
      const totalScale = baseScale * scale;

      ctx.save();
      ctx.beginPath();
      ctx.arc(PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = avatarBackground;
      ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

      // offset is in natural pixels; multiply by totalScale to get canvas pixels
      const drawX = PREVIEW_SIZE / 2 - (imgEl.naturalWidth / 2 - offset.x) * totalScale;
      const drawY = PREVIEW_SIZE / 2 - (imgEl.naturalHeight / 2 - offset.y) * totalScale;
      ctx.drawImage(imgEl, drawX, drawY, imgEl.naturalWidth * totalScale, imgEl.naturalHeight * totalScale);
      ctx.restore();
   }, [avatarBackground, imgEl, scale, offset]);

   useEffect(() => {
      if (!isOpen) return;

      let isCancelled = false;
      const avatarSource = currentAvatar || PLACEHOLDER_AVATAR;

      setCurrentAvatarSupportsBackground(!currentAvatar);
      detectVisibleAvatarBackgroundArea(avatarSource).then((supportsBackground) => {
         if (!isCancelled) {
            setCurrentAvatarSupportsBackground(supportsBackground);
         }
      });

      return () => {
         isCancelled = true;
      };
   }, [currentAvatar, isOpen]);

   // ─── Helpers ──────────────────────────────────────────────────────────────

   const reset = () => {
      setStep('select');
      setImgEl(null);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setAvatarBackground(currentAvatarBackground ?? DEFAULT_AVATAR_BACKGROUND);
      setUploadedAvatarSupportsBackground(false);
      setError('');
      dragRef.current = null;
   };

   const handleClose = () => {
      reset();
      onClose();
   };

   const loadFile = (file: File) => {
      setError('');
      if (!file.type.startsWith('image/')) {
         setError('Please select an image file (PNG, JPG, or WEBP).');
         return;
      }
      if (file.size > MAX_BYTES) {
         setError('Image must be under 5 MB.');
         return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
         setImgEl(img);
         setScale(1);
         setOffset({ x: 0, y: 0 });
         setUploadedAvatarSupportsBackground(imageHasVisibleAvatarBackgroundArea(img));
         setStep('crop');
      };
      img.onerror = () => setError('Could not load the image. Please try a different file.');
      img.src = url;
   };

   // ─── Pointer drag ─────────────────────────────────────────────────────────

   const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      dragRef.current = { clientX: e.clientX, clientY: e.clientY, ox: offset.x, oy: offset.y };
   };

   const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragRef.current || !imgEl) return;
      const baseScale = Math.max(PREVIEW_SIZE / imgEl.naturalWidth, PREVIEW_SIZE / imgEl.naturalHeight);
      const totalScale = baseScale * scale;
      // Convert screen-pixel delta → natural-image-pixel delta
      const dx = (e.clientX - dragRef.current.clientX) / totalScale;
      const dy = (e.clientY - dragRef.current.clientY) / totalScale;
      setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
   };

   const handlePointerUp = () => {
      dragRef.current = null;
   };

   // ─── Save / export ────────────────────────────────────────────────────────

   const handleSave = () => {
      if (!imgEl) return;
      setError('');

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
         setError('Canvas not supported in this browser.');
         return;
      }

      // Clip to circle
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = avatarBackground;
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      // Same formula as the preview, scaled up by OUTPUT_SIZE / PREVIEW_SIZE
      const ratio = OUTPUT_SIZE / PREVIEW_SIZE;
      const baseScale = Math.max(PREVIEW_SIZE / imgEl.naturalWidth, PREVIEW_SIZE / imgEl.naturalHeight);
      const totalScale = baseScale * scale * ratio;

      const drawX = OUTPUT_SIZE / 2 - (imgEl.naturalWidth / 2 - offset.x) * totalScale;
      const drawY = OUTPUT_SIZE / 2 - (imgEl.naturalHeight / 2 - offset.y) * totalScale;
      ctx.drawImage(imgEl, drawX, drawY, imgEl.naturalWidth * totalScale, imgEl.naturalHeight * totalScale);

      canvas.toBlob(
         async (blob) => {
            if (!blob) {
               setError('Failed to process the image. Please try again.');
               return;
            }
            try {
               await onSave(new File([blob], 'avatar.png', { type: 'image/png' }), avatarBackground);
               reset();
            } catch (err) {
               setError(err instanceof Error ? err.message : 'Failed to save avatar.');
            }
         },
         'image/png',
      );
   };

   const handleSaveBackground = async () => {
      setError('');
      setIsSavingBackground(true);
      try {
         const result = await dispatch(updateUser({ avatarBackground }));

         if (!updateUser.fulfilled.match(result)) {
            throw new Error(result.error?.message || 'Failed to save avatar background.');
         }

         reset();
         onClose();
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Failed to save avatar background.');
      } finally {
         setIsSavingBackground(false);
      }
   };

   // ─── Render ───────────────────────────────────────────────────────────────

   if (!isOpen) return null;

   return createPortal(
      <div
         className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-5"
         onClick={handleClose}
      >
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-3 items-center"
            onClick={(e) => e.stopPropagation()}
         >
            {/* ── Header ── */}
            <div className="flex items-center justify-between w-full">
               <h2 className="text-md-h4 font-semibold text-md-heading">
                  {step === 'select' ? 'Change Profile Photo' : 'Crop Photo'}
               </h2>
               <button
                  type="button"
                  onClick={handleClose}
                  className="text-md-neutral-800 hover:text-md-heading transition-colors"
                  aria-label="Close"
               >
                  <X size={20} />
               </button>
            </div>

            {/* ── Step 1 — file select ── */}
            {step === 'select' && (
               <>
                  <img
                     src={currentAvatar || PLACEHOLDER_AVATAR}
                     alt="Current profile photo"
                     className="w-16 h-16 rounded-full object-cover border-2 border-md-primary-100 shrink-0"
                     style={{ backgroundColor: avatarBackground }}
                  />

                  {currentAvatarSupportsBackground ? (
                     <div className="w-full rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 p-3">
                        <p className="text-md-b3 font-semibold text-md-heading">Change background only</p>
                        <div className="mt-3 grid grid-cols-8 gap-2">
                           {AVATAR_BACKGROUNDS.map((option) => {
                              const isSelected = avatarBackground === option.value;
                              return (
                                 <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setAvatarBackground(option.value)}
                                    className={`flex aspect-square items-center justify-center rounded-full border bg-white transition ${
                                       isSelected ? 'border-md-primary-900 shadow-[0_0_0_3px_rgba(131,54,240,0.16)]' : 'border-md-neutral-400'
                                    }`}
                                    aria-label={`${option.name} avatar background`}
                                    aria-pressed={isSelected}
                                 >
                                    <span
                                       className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10"
                                       style={{ backgroundColor: option.value }}
                                    >
                                       {isSelected ? (
                                          <span
                                             className={`h-3 w-3 rounded-full ${
                                                option.value === DEFAULT_AVATAR_BACKGROUND || option.name === 'Night' ? 'bg-white' : 'bg-md-primary-1200'
                                             }`}
                                             aria-hidden="true"
                                          />
                                       ) : null}
                                    </span>
                                 </button>
                              );
                           })}
                        </div>
                        <button
                           type="button"
                           disabled={isSaving || isSavingBackground || avatarBackground === (currentAvatarBackground ?? DEFAULT_AVATAR_BACKGROUND)}
                           onClick={handleSaveBackground}
                           className="mt-3 w-full rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-50"
                        >
                           {isSavingBackground ? 'Saving…' : 'Save Background'}
                        </button>
                     </div>
                  ) : null}

                  <label
                     className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-md-neutral-600 rounded-md-lg p-6 cursor-pointer hover:border-md-primary-900 transition-colors"
                     onDragOver={(e) => e.preventDefault()}
                     onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) loadFile(file);
                     }}
                  >
                     <p className="text-md-b1 text-md-neutral-1200 text-center">
                        <span className="text-md-primary-900 font-semibold">Click to upload</span>
                        {' '}or drag and drop
                     </p>
                     <p className="text-md-b3 text-md-neutral-800">PNG, JPG, WEBP · up to 5 MB</p>
                     <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) loadFile(file);
                           e.target.value = '';
                        }}
                     />
                  </label>

                  {error ? (
                     <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p>
                  ) : null}

                  <button
                     type="button"
                     onClick={handleClose}
                     className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200"
                  >
                     Cancel
                  </button>
               </>
            )}

            {/* ── Step 2 — crop ── */}
            {step === 'crop' && (
               <>
                  {/* Live circular crop preview */}
                  <canvas
                     ref={canvasRef}
                     width={PREVIEW_SIZE}
                     height={PREVIEW_SIZE}
                     className="rounded-full cursor-grab active:cursor-grabbing touch-none shrink-0"
                     style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, backgroundColor: avatarBackground }}
                     onPointerDown={handlePointerDown}
                     onPointerMove={handlePointerMove}
                     onPointerUp={handlePointerUp}
                     onPointerCancel={handlePointerUp}
                  />

                  {/* Zoom slider */}
                  <div className="flex items-center gap-3 w-full">
                     <span className="text-md-b3 text-md-neutral-800 select-none w-4 text-center">−</span>
                     <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={scale}
                        onChange={(e) => setScale(parseFloat(e.target.value))}
                        className="flex-1"
                     />
                     <span className="text-md-b3 text-md-neutral-800 select-none w-4 text-center">+</span>
                  </div>

                  <p className="text-md-b3 text-md-neutral-800 text-center">
                     Drag to reposition · use the slider to zoom
                  </p>

                  {uploadedAvatarSupportsBackground ? (
                     <div className="w-full rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 p-3">
                        <p className="text-md-b3 font-semibold text-md-heading">Avatar background</p>
                        <div className="mt-3 grid grid-cols-8 gap-2">
                           {AVATAR_BACKGROUNDS.map((option) => {
                              const isSelected = avatarBackground === option.value;
                              return (
                                 <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setAvatarBackground(option.value)}
                                    className={`flex aspect-square items-center justify-center rounded-full border bg-white transition ${
                                       isSelected ? 'border-md-primary-900 shadow-[0_0_0_3px_rgba(131,54,240,0.16)]' : 'border-md-neutral-400'
                                    }`}
                                    aria-label={`${option.name} avatar background`}
                                    aria-pressed={isSelected}
                                 >
                                    <span
                                       className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10"
                                       style={{ backgroundColor: option.value }}
                                    >
                                       {isSelected ? (
                                          <span
                                             className={`h-3 w-3 rounded-full ${
                                                option.value === DEFAULT_AVATAR_BACKGROUND || option.name === 'Night' ? 'bg-white' : 'bg-md-primary-1200'
                                             }`}
                                             aria-hidden="true"
                                          />
                                       ) : null}
                                    </span>
                                 </button>
                              );
                           })}
                        </div>
                     </div>
                  ) : null}

                  {error ? (
                     <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p>
                  ) : null}

                  <button
                     type="button"
                     disabled={isSaving}
                     onClick={handleSave}
                     className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center disabled:opacity-50"
                  >
                     {isSaving ? 'Saving…' : 'Save Photo'}
                  </button>

                  <button
                     type="button"
                     onClick={() => setStep('select')}
                     className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200"
                  >
                     Back
                  </button>
               </>
            )}
         </div>
      </div>,
      document.body
   );
}
