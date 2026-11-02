import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { fileMarkers, gcashRefIssues, imageInfo, isAiSize, rowKeys, rowOverlap } from './fileForensics.ts';

const png = (w: number, h: number, extra = '') => {
   const b = new Uint8Array(33 + extra.length);
   b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
   new DataView(b.buffer).setUint32(16, w);
   new DataView(b.buffer).setUint32(20, h);
   b.set(new TextEncoder().encode(extra), 33);
   return b;
};

const jpeg = (w: number, h: number) => {
   // SOI, an APP0 segment, then SOF0 with the size.
   const b = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03, 0, 0, 0, 0]);
   new DataView(b.buffer).setUint16(13, h);
   new DataView(b.buffer).setUint16(15, w);
   return b;
};

const webpX = (w: number, h: number) => {
   const b = new Uint8Array(40);
   b.set(new TextEncoder().encode('RIFF'), 0);
   b.set(new TextEncoder().encode('WEBPVP8X'), 8);
   const dv = new DataView(b.buffer);
   dv.setUint16(24, (w - 1) & 0xffff, true);
   b[26] = ((w - 1) >> 16) & 0xff;
   dv.setUint16(27, (h - 1) & 0xffff, true);
   b[29] = ((h - 1) >> 16) & 0xff;
   return b;
};

Deno.test('image sizes from headers', () => {
   assertEquals(imageInfo(png(1080, 2400)), { format: 'png', width: 1080, height: 2400 });
   assertEquals(imageInfo(jpeg(1170, 2532)), { format: 'jpeg', width: 1170, height: 2532 });
   assertEquals(imageInfo(webpX(1024, 1536)), { format: 'webp', width: 1024, height: 1536 });
   assertEquals(imageInfo(new TextEncoder().encode('%PDF-1.4')), null);
});

Deno.test('AI sizes vs phone screenshots', () => {
   assert(isAiSize(imageInfo(png(1024, 1536))));
   assert(isAiSize(imageInfo(png(1024, 1024))));
   assert(!isAiSize(imageInfo(png(1080, 2400))));
   assert(!isAiSize(imageInfo(jpeg(1170, 2532))));
});

Deno.test('hidden AI and editor tags', () => {
   assertEquals(fileMarkers(png(1, 1, 'Iptc4xmpExt:DigitalSourceType http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia')).aiLabel !== null, true);
   assertEquals(fileMarkers(png(1, 1, 'tEXtSoftware\u0000Made with OpenAI')).generator, 'OpenAI / ChatGPT');
   assertEquals(fileMarkers(png(1, 1, 'tEXtparameters\u0000a receipt, Negative prompt: blurry')).generator, 'Stable Diffusion');
   assertEquals(fileMarkers(png(1, 1, 'Software Adobe Photoshop 25.0')).editor, 'Photoshop');
   assertEquals(fileMarkers(png(1080, 2400)), { aiLabel: null, generator: null, editor: null });
});

Deno.test('GCash reference numbers', () => {
   const ok = gcashRefIssues([{ source_text: 'Oct 2 Received Ref No. 9012 345 678901 +500.00' }, { source_text: 'Oct 3 Paid Ref No. 9012 345 678902 -100' }]);
   assertEquals(ok, { found: 2, wrongLength: [], repeated: [] });
   const bad = gcashRefIssues([{ source_text: 'Ref No. 1234 5678' }, { source_text: 'Ref No. 9012 345 678901' }, { source_text: 'Ref No. 9012 345 678901' }]);
   assertEquals(bad.wrongLength, ['12345678']);
   assertEquals(bad.repeated, ['9012345678901']);
});

Deno.test('same rows across accounts', () => {
   const a = rowKeys([{ date: '2026-10-01', amount: 500 }, { date: '2026-10-02', amount: -100 }, { date: '2026-10-03', amount: 2000 }]);
   const b = rowKeys([{ date: '2026-10-01', amount: 500 }, { date: '2026-10-02', amount: -100 }, { date: '2026-10-09', amount: 50 }]);
   assertEquals(Math.round(rowOverlap(a, b) * 100), 67);
});
