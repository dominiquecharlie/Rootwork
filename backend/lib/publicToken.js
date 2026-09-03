const crypto = require("crypto");

// 128 bits, URL-safe. Length is always 22 characters for 16 random bytes.
const PUBLIC_TOKEN_BYTES = 16;
const PUBLIC_TOKEN_SHAPE = /^[A-Za-z0-9_-]{22,64}$/;

function generatePublicToken() {
  return crypto.randomBytes(PUBLIC_TOKEN_BYTES).toString("base64url");
}

function isValidPublicTokenShape(token) {
  return typeof token === "string" && PUBLIC_TOKEN_SHAPE.test(token);
}

module.exports = {
  generatePublicToken,
  isValidPublicTokenShape,
  PUBLIC_TOKEN_BYTES,
  PUBLIC_TOKEN_SHAPE,
};
