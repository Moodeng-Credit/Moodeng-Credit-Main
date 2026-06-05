'use strict';

var sha3 = require('@noble/hashes/sha3');
var utils = require('@noble/hashes/utils');

// src/lib/hashing.ts
function hashToField(input) {
  const hash = BigInt("0x" + utils.bytesToHex(sha3.keccak_256(input))) >> 8n;
  return utils.hexToBytes(hash.toString(16).padStart(64, "0"));
}
function hashSignal(signal) {
  let input;
  if (signal instanceof Uint8Array) {
    input = signal;
  } else if (signal.startsWith("0x") && isValidHex(signal.slice(2))) {
    input = utils.hexToBytes(signal.slice(2));
  } else {
    input = new TextEncoder().encode(signal);
  }
  return "0x" + utils.bytesToHex(hashToField(input));
}
function isValidHex(s) {
  if (s.length === 0) return false;
  if (s.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]+$/.test(s);
}

exports.hashSignal = hashSignal;
