import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { decrypt, encrypt } from "../../utils/encryption";
import { MAX_OTP_ATTEMPTS, generateSessionToken, hashToken, toSafeUser } from "../../utils/secureToken";

// Accept the previous/next 30-second code to tolerate clock drift
authenticator.options = { window: 1 };

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RECOVERY_CODE_COUNT = 8;

const newRecoveryCodes = () =>
  Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

const normalizeRecovery = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export class TwoFactorService {
  async setup(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, twoFactorEnabled: true } });
    if (user.twoFactorEnabled) throw AppError.conflict("Two-factor authentication is already on");
    const secret = authenticator.generateSecret();
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: encrypt(secret) } });
    // The frontend renders otpauthUrl as a QR code
    return { secret, otpauthUrl: authenticator.keyuri(user.email, "Themora", secret) };
  }

  async enable(userId: string, code: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { twoFactorEnabled: true, twoFactorSecret: true } });
    if (user.twoFactorEnabled) throw AppError.conflict("Two-factor authentication is already on");
    if (!user.twoFactorSecret) throw AppError.badRequest("Start the setup first");
    if (!authenticator.verify({ token: code.trim(), secret: decrypt(user.twoFactorSecret) })) {
      throw AppError.badRequest("That code is not correct. Check the time on your phone and try again");
    }
    const recoveryCodes = newRecoveryCodes();
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorRecoveryCodes: recoveryCodes.map((c) => hashToken(normalizeRecovery(c))) },
    });
    // Shown once; only hashes are stored
    return { recoveryCodes };
  }

  async disable(userId: string, input: { code?: string; password?: string }) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled) throw AppError.badRequest("Two-factor authentication is not on");
    const passwordOk = input.password && user.password ? await bcrypt.compare(input.password, user.password) : false;
    if (!passwordOk && !(input.code && (await this.verifyCode(user, input.code)))) {
      throw AppError.badRequest("Enter a valid code or your password to turn off two-factor authentication");
    }
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [], twoFactorChallenge: null, twoFactorChallengeExpiresAt: null },
    });
  }

  async regenerateRecoveryCodes(userId: string, code: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !(await this.verifyCode(user, code))) throw AppError.badRequest("That code is not correct");
    const recoveryCodes = newRecoveryCodes();
    await prisma.user.update({ where: { id: userId }, data: { twoFactorRecoveryCodes: recoveryCodes.map((c) => hashToken(normalizeRecovery(c))) } });
    return { recoveryCodes };
  }

  // A TOTP code, or a recovery code (each recovery code works once)
  private async verifyCode(user: { id: string; twoFactorSecret: string | null; twoFactorRecoveryCodes: string[] }, code: string) {
    const trimmed = code.trim();
    if (/^\d{6}$/.test(trimmed) && user.twoFactorSecret) {
      return authenticator.verify({ token: trimmed, secret: decrypt(user.twoFactorSecret) });
    }
    const hashed = hashToken(normalizeRecovery(trimmed));
    if (!user.twoFactorRecoveryCodes.includes(hashed)) return false;
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorRecoveryCodes: user.twoFactorRecoveryCodes.filter((stored) => stored !== hashed) },
    });
    return true;
  }

  // ── Sign-in ────────────────────────────────────────────────────────────

  // After the password (or Google) check succeeds, before any session exists
  async createChallenge(userId: string) {
    const token = generateSessionToken();
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorChallenge: hashToken(token), twoFactorChallengeExpiresAt: new Date(Date.now() + CHALLENGE_TTL_MS), otpAttempts: 0 },
    });
    return token;
  }

  async completeChallenge(challengeToken: string, code: string, clientToken?: string) {
    const user = await prisma.user.findFirst({
      where: { twoFactorChallenge: hashToken(challengeToken), twoFactorChallengeExpiresAt: { gt: new Date() } },
    });
    if (!user) throw AppError.unauthorized("This sign-in attempt has expired. Please sign in again");

    if (!(await this.verifyCode(user, code))) {
      const locked = user.otpAttempts + 1 >= MAX_OTP_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: locked ? { twoFactorChallenge: null, twoFactorChallengeExpiresAt: null, otpAttempts: 0 } : { otpAttempts: { increment: 1 } },
      });
      throw AppError.badRequest(locked ? "Too many incorrect codes. Please sign in again" : "That code is not correct");
    }

    const token = clientToken || generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        nextAuthSecret: hashToken(token),
        nextAuthExpiresAt: expiresAt,
        isLoggedIn: true,
        lastLoginAt: new Date(),
        twoFactorChallenge: null,
        twoFactorChallengeExpiresAt: null,
        otpAttempts: 0,
      },
      include: { profile: true },
    });
    return { user: toSafeUser(updated), nextAuthSecret: token, expiresAt };
  }
}

export const twoFactorService = new TwoFactorService();
