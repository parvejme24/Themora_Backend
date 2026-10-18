import crypto from "node:crypto";

export const MAX_OTP_ATTEMPTS = 5;

// Session tokens are stored as SHA-256 hashes, so a database leak does not
// expose live sessions. Clients keep the raw token.
export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const generateSessionToken = () => crypto.randomBytes(32).toString("hex");

export const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

// OTPs are hashed with the user id, so equal codes differ per user
export const hashOtp = (userId: string, otp: string) => hashToken(`${userId}:${otp}`);

export const otpMatches = (userId: string, otp: string, storedHash: string | null) => {
  if (!storedHash) return false;
  const expected = Buffer.from(storedHash, "hex");
  const received = Buffer.from(hashOtp(userId, otp.trim()), "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

// Fields that must never leave the API
export const toSafeUser = <T extends Record<string, unknown>>(user: T) => {
  const { password, otpCode, otpPurpose, otpExpiresAt, otpAttempts, nextAuthSecret, ...safe } = user;
  return safe;
};
