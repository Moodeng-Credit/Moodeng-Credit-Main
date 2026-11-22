// "Ride the Hippo, Fight the Sharks" share image (Figma "Share card – Ride the Hippo"), drawn on the phone.
// The selfie never leaves the device: it is read from the file input, drawn on a canvas and handed to the
// share sheet as a PNG. Without a selfie the fighter Moodeng fills the card on her own.

const SIZE = 1080;
const FIGHTER_SRC = '/shark-fighter/fighter-moodeng.webp';
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export type FightImageCopy = { line1: string; line2: string; streak: string; tagline: string; site: string };

const loadImage = (src: string) =>
   new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Couldn't load ${src}`));
      image.src = src;
   });

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
   ctx.beginPath();
   ctx.moveTo(x + r, y);
   ctx.arcTo(x + w, y, x + w, y + h, r);
   ctx.arcTo(x + w, y + h, x, y + h, r);
   ctx.arcTo(x, y + h, x, y, r);
   ctx.arcTo(x, y, x + w, y, r);
   ctx.closePath();
};

/** Draws `image` into the box, cropped to cover it (like object-fit: cover). */
const drawCover = (
   ctx: CanvasRenderingContext2D,
   image: CanvasImageSource & { width: number; height: number },
   x: number,
   y: number,
   w: number,
   h: number
) => {
   const scale = Math.max(w / image.width, h / image.height);
   const sw = w / scale;
   const sh = h / scale;
   ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 3, sw, sh, x, y, w, h);
};

const drawContain = (ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) => {
   const scale = Math.min(w / image.width, h / image.height);
   const dw = image.width * scale;
   const dh = image.height * scale;
   ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh), dw, dh);
};

/** A tilted white-framed photo with a soft shadow. */
const drawPolaroid = (
   ctx: CanvasRenderingContext2D,
   cx: number,
   cy: number,
   w: number,
   h: number,
   angle: number,
   draw: (x: number, y: number) => void,
   fill: string
) => {
   ctx.save();
   ctx.translate(cx, cy);
   ctx.rotate((angle * Math.PI) / 180);
   ctx.shadowColor = 'rgba(0,0,0,0.35)';
   ctx.shadowBlur = 40;
   ctx.shadowOffsetY = 18;
   roundedRect(ctx, -w / 2 - 14, -h / 2 - 14, w + 28, h + 28, 46);
   ctx.fillStyle = '#ffffff';
   ctx.fill();
   ctx.shadowColor = 'transparent';
   roundedRect(ctx, -w / 2, -h / 2, w, h, 34);
   ctx.save();
   ctx.clip();
   ctx.fillStyle = fill;
   ctx.fillRect(-w / 2, -h / 2, w, h);
   draw(-w / 2, -h / 2);
   ctx.restore();
   ctx.restore();
};

export async function drawFightImage(selfie: File | null, copy: FightImageCopy): Promise<Blob> {
   const canvas = document.createElement('canvas');
   canvas.width = SIZE;
   canvas.height = SIZE;
   const ctx = canvas.getContext('2d');
   if (!ctx) throw new Error('Canvas not supported');

   const [fighter, photo] = await Promise.all([
      loadImage(FIGHTER_SRC),
      selfie ? createImageBitmap(selfie).catch(() => null) : Promise.resolve(null)
   ]);

   // Background: Moodeng purple with faint rays.
   const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
   bg.addColorStop(0, '#2a1466');
   bg.addColorStop(0.55, '#5b3fd9');
   bg.addColorStop(1, '#8b6cff');
   ctx.fillStyle = bg;
   ctx.fillRect(0, 0, SIZE, SIZE);
   ctx.save();
   ctx.translate(SIZE / 2, 600);
   ctx.fillStyle = 'rgba(255,255,255,0.045)';
   for (let i = 0; i < 14; i += 1) {
      ctx.rotate(Math.PI / 14);
      ctx.fillRect(-800, -30, 1600, 60);
   }
   ctx.restore();

   // Title.
   ctx.textAlign = 'center';
   ctx.textBaseline = 'top';
   ctx.font = `italic 900 88px ${FONT}`;
   ctx.fillStyle = '#ffffff';
   ctx.fillText(copy.line1, SIZE / 2, 56, SIZE - 80);
   ctx.fillStyle = '#ffd54a';
   ctx.fillText(copy.line2, SIZE / 2, 158, SIZE - 80);

   if (photo) {
      drawPolaroid(ctx, 285, 560, 430, 520, 4, (x, y) => drawCover(ctx, photo, x, y, 430, 520), '#ddd6f3');
      drawPolaroid(ctx, 795, 560, 430, 520, -4, (x, y) => drawContain(ctx, fighter, x + 20, y + 20, 390, 480), '#ffffff');
      // The gold "+" between them.
      ctx.beginPath();
      ctx.arc(SIZE / 2, 565, 66, 0, Math.PI * 2);
      const gold = ctx.createLinearGradient(0, 500, 0, 630);
      gold.addColorStop(0, '#ffe27a');
      gold.addColorStop(1, '#ffbe1a');
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#4a2a00';
      ctx.font = `900 84px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText('+', SIZE / 2, 568);
   } else {
      drawContain(ctx, fighter, 240, 270, 600, 560);
   }

   // Streak pill.
   ctx.font = `900 50px ${FONT}`;
   ctx.textBaseline = 'middle';
   const pillW = Math.min(SIZE - 80, ctx.measureText(copy.streak).width + 80);
   roundedRect(ctx, (SIZE - pillW) / 2, 868, pillW, 92, 46);
   const pill = ctx.createLinearGradient((SIZE - pillW) / 2, 0, (SIZE + pillW) / 2, 0);
   pill.addColorStop(0, '#ffe27a');
   pill.addColorStop(1, '#ffbe1a');
   ctx.fillStyle = pill;
   ctx.fill();
   ctx.fillStyle = '#4a2a00';
   ctx.fillText(copy.streak, SIZE / 2, 916, pillW - 40);

   ctx.font = `700 38px ${FONT}`;
   ctx.fillStyle = '#ffffff';
   ctx.fillText(copy.tagline, SIZE / 2, 1000, SIZE - 80);
   ctx.font = `600 28px ${FONT}`;
   ctx.textAlign = 'right';
   ctx.fillStyle = 'rgba(255,255,255,0.75)';
   ctx.fillText(copy.site, SIZE - 40, 1048);

   return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not make the image'))), 'image/png')
   );
}
