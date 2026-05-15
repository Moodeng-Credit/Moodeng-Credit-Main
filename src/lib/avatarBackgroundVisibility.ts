const SAMPLE_SIZE = 64;
const TRANSPARENCY_THRESHOLD = 248;
const MIN_TRANSPARENT_RATIO = 0.02;

export type AvatarBackgroundImageData = Pick<ImageData, 'data' | 'height' | 'width'>;

export function hasVisibleAvatarBackgroundArea(imageData: AvatarBackgroundImageData) {
   const totalPixels = imageData.width * imageData.height;
   if (totalPixels <= 0) return false;

   let transparentPixels = 0;

   for (let alphaIndex = 3; alphaIndex < imageData.data.length; alphaIndex += 4) {
      if (imageData.data[alphaIndex] < TRANSPARENCY_THRESHOLD) {
         transparentPixels += 1;
      }
   }

   return transparentPixels / totalPixels >= MIN_TRANSPARENT_RATIO;
}

export function imageHasVisibleAvatarBackgroundArea(image: HTMLImageElement) {
   const canvas = document.createElement('canvas');
   canvas.width = SAMPLE_SIZE;
   canvas.height = SAMPLE_SIZE;

   const ctx = canvas.getContext('2d', { willReadFrequently: true });
   if (!ctx) return false;

   ctx.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
   ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

   try {
      return hasVisibleAvatarBackgroundArea(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE));
   } catch {
      return false;
   }
}

export function detectVisibleAvatarBackgroundArea(src: string) {
   return new Promise<boolean>((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(imageHasVisibleAvatarBackgroundArea(image));
      image.onerror = () => resolve(false);
      image.src = src;
   });
}
