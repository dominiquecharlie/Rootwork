const crypto = require("crypto");

// Server-side pepper. A database leak without this env value yields nothing
// usable. Rotating the pepper invalidates every outstanding removal code, so
// it is not a routine operation.
const PEPPER = process.env.REMOVAL_CODE_PEPPER;
if (typeof PEPPER !== "string" || !PEPPER.trim()) {
  throw new Error("Missing REMOVAL_CODE_PEPPER in environment.");
}

// Unambiguous alphabet for hand copying. No 0/O, no 1/I.
// Capital L is kept so the alphabet length stays 32 (power of two, no modulo bias).
const REMOVAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const REMOVAL_CODE_LENGTH = 9; // 32^9 ≈ 35 trillion.

// 256 % 32 === 0, so indexing with byte % length has no modulo bias.
function generateRemovalCode() {
  const bytes = crypto.randomBytes(REMOVAL_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < REMOVAL_CODE_LENGTH; i++) {
    out += REMOVAL_CODE_ALPHABET[bytes[i] % REMOVAL_CODE_ALPHABET.length];
  }
  return out;
}

function normalizeRemovalCode(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase().replace(/[\s-]/g, "");
}

function isValidRemovalCodeShape(raw) {
  const code = normalizeRemovalCode(raw);
  if (code.length !== REMOVAL_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!REMOVAL_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

// One-way with pepper. Lookup uses this same hash in SQL.
// Without the pepper, a database leak yields nothing usable.
function hashRemovalCode(raw) {
  const code = normalizeRemovalCode(raw);
  return crypto
    .createHash("sha256")
    .update(PEPPER + code, "utf8")
    .digest("hex");
}

// Public remove always returns this body, match or miss. Do not branch on it.
const PUBLIC_REMOVE_OK = Object.freeze({ success: true });

// Display only: groups of 3 for reading aloud / photographing.
function formatRemovalCodeForDisplay(code) {
  const n = normalizeRemovalCode(code);
  return n.replace(/(.{3})(?=.)/g, "$1-");
}

module.exports = {
  PUBLIC_REMOVE_OK,
  REMOVAL_CODE_ALPHABET,
  REMOVAL_CODE_LENGTH,
  formatRemovalCodeForDisplay,
  generateRemovalCode,
  hashRemovalCode,
  isValidRemovalCodeShape,
  normalizeRemovalCode,
};
