#!/usr/bin/env node
// Generates the VAPID (RFC 8292) key pair that identifies Moodeng to every push
// service. Run once per environment and keep the output; rotating the key
// invalidates every existing subscription, so every user has to re-grant
// permission on every device.
//
//   node scripts/generate-vapid-keys.mjs
//
// Then set:
//   VITE_VAPID_PUBLIC_KEY   (client build — public, safe to ship)
//   VAPID_PUBLIC_KEY        (edge functions)
//   VAPID_PRIVATE_KEY       (edge functions — secret, never in a VITE_ var)
//   VAPID_SUBJECT           (edge functions — mailto: or https: contact URI)

import { generateKeyPairSync, createPublicKey } from 'node:crypto';

const toBase64Url = (buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// The JWK form gives us exactly what the Web Push spec wants: the 32-byte
// private scalar `d`, and the public point as x/y coordinates.
const privateJwk = privateKey.export({ format: 'jwk' });
const publicJwk = createPublicKey(privateKey).export({ format: 'jwk' });

const publicKeyBytes = Buffer.concat([
   Buffer.from([0x04]), // uncompressed point prefix
   Buffer.from(publicJwk.x, 'base64url'),
   Buffer.from(publicJwk.y, 'base64url')
]);

console.log('VAPID_PUBLIC_KEY / VITE_VAPID_PUBLIC_KEY:');
console.log(toBase64Url(publicKeyBytes));
console.log();
console.log('VAPID_PRIVATE_KEY (secret — edge functions only):');
console.log(toBase64Url(Buffer.from(privateJwk.d, 'base64url')));
console.log();
console.log('VAPID_SUBJECT: mailto:support@moodeng.credit');
