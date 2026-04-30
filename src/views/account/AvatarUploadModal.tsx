import { useCallback, useMemo, useRef, useState } from 'react';

import Cropper, { type Area } from 'react-easy-crop';
import { Camera, Upload, X } from 'lucide-react';

import { PLACEHOLDER_AVATAR } from '@/components/UserAvatar';

interface AvatarUploadModalProps {
   isOpen: boolean;
   currentAvatar?: string;
   isSaving?: boolean;
   onClose: () => void;
   onSave: (imageDataUrl: string) => Promise<void> | void;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export default function AvatarUploadModal({
   isOpen,
   currentAvatar,
   isSaving = false,
   onClose,
   onSave
}: AvatarUploadModalProps) {
   const inputRef = useRef<HTMLInputElement | null>(null);
   const [step, setStep] = useState<'upload' | 'crop'>('upload');
   const [imageSrc, setImageSrc] = useState<string | null>(null);
   const [crop, setCrop] = useState({ x: 0, y: 0 });
   const [zoom, setZoom] = useState(1);
   const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
   const [error, setError] = useState('');

   const previewImage = useMemo(() => imageSrc ?? currentAvatar ?? PLACEHOLDER_AVATAR, [currentAvatar, imageSrc]);

   const resetState = () => {
      setStep('upload');
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setError('');
      if (inputRef.current) {
         inputRef.current.value = '';
      }
   };

   const handleClose = () => {
      if (isSaving) return;
      resetState();
      onClose();
   };

   const onCropComplete = useCallback((_croppedArea: Area, nextCroppedAreaPixels: Area) => {
      setCroppedAreaPixels(nextCroppedAreaPixels);
   }, []);

   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
         setError('Please choose an image file.');
         return;
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
         setError('Please choose an image smaller than 5MB.');
         return;
      }

      const reader = new FileReader();
      reader.onload = () => {
         setImageSrc(reader.result as string);
         setStep('crop');
         setError('');
      };
      reader.onerror = () => {
         setError('We could not read that image. Please try another one.');
      };
      reader.readAsDataURL(file);
   };

   const createCroppedImage = async () => {
      if (!imageSrc || !croppedAreaPixels) return null;

      const image = new Image();
      image.src = imageSrc;
      await new Promise((resolve, reject) => {
         image.onload = resolve;
         image.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
         image,
         croppedAreaPixels.x,
         croppedAreaPixels.y,
         croppedAreaPixels.width,
         croppedAreaPixels.height,
         0,
         0,
         croppedAreaPixels.width,
         croppedAreaPixels.height
      );

      return canvas.toDataURL('image/jpeg', 0.9);
   };

   const handleSave = async () => {
      if (step !== 'crop') {
         setError('Please choose a photo first.');
         return;
      }

      const croppedImage = await createCroppedImage();
      if (!croppedImage) {
         setError('We could not prepare that image. Please try again.');
         return;
      }

      await onSave(croppedImage);
      resetState();
   };

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5" onClick={handleClose}>
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-4 items-center"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex w-full items-center justify-between">
               <h2 className="text-md-h4 font-semibold text-md-heading">
                  {step === 'upload' ? 'Upload Profile Photo' : 'Adjust Profile Photo'}
               </h2>
               <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSaving}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-md-neutral-1200 disabled:opacity-50"
                  aria-label="Close avatar upload"
               >
                  <X size={18} />
               </button>
            </div>

            {step === 'upload' ? (
               <>
                  <p className="w-full text-md-b2 text-md-neutral-1200">
                     Choose a clear photo. This helps other people recognize your profile more easily.
                  </p>

                  <div className="relative">
                     <img
                        src={previewImage}
                        alt="Avatar preview"
                        className="h-28 w-28 rounded-full border-2 border-md-primary-100 object-cover"
                     />
                     <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-md-primary-900 shadow-md-card">
                        <Camera size={16} className="text-white" />
                     </div>
                  </div>

                  <label
                     htmlFor="avatar-upload"
                     className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-md-lg border border-dashed border-md-primary-900 bg-md-neutral-100 px-md-4 py-md-4 text-md-primary-900"
                  >
                     <Upload size={18} />
                     <span className="text-md-b1 font-semibold">Choose photo</span>
                     <input
                        ref={inputRef}
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                     />
                  </label>
               </>
            ) : (
               <>
                  <p className="w-full text-md-b2 text-md-neutral-1200">Move and zoom to fit your face in the circle.</p>

                  <div className="relative h-[280px] w-full overflow-hidden rounded-md-lg bg-md-heading">
                     {imageSrc ? (
                        <Cropper
                           image={imageSrc}
                           crop={crop}
                           zoom={zoom}
                           aspect={1}
                           cropShape="round"
                           showGrid={false}
                           onCropChange={setCrop}
                           onCropComplete={onCropComplete}
                           onZoomChange={setZoom}
                        />
                     ) : null}
                  </div>

                  <div className="w-full">
                     <label className="mb-2 block text-md-b2 font-semibold text-md-heading">Zoom</label>
                     <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full accent-md-primary-900"
                     />
                  </div>
               </>
            )}

            {error ? <p className="w-full text-center text-md-b3 text-md-red-400">{error}</p> : null}

            <div className="flex w-full flex-col gap-md-3">
               {step === 'crop' ? (
                  <button
                     type="button"
                     disabled={isSaving}
                     onClick={handleSave}
                     className="w-full rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-50"
                  >
                     {isSaving ? 'Saving...' : 'Save photo'}
                  </button>
               ) : null}

               <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                     if (step === 'crop') {
                        setStep('upload');
                        setImageSrc(null);
                        setZoom(1);
                        setError('');
                        return;
                     }
                     handleClose();
                  }}
                  className="w-full rounded-md-lg border border-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-primary-1200 disabled:opacity-50"
               >
                  {step === 'crop' ? 'Back' : 'Cancel'}
               </button>
            </div>
         </div>
      </div>
   );
}
