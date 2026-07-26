import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * Better Auth uçları — /api/auth/*
 * Bu uçlar bizim API listemize (docs/03) dahil DEĞİLDİR; giriş, çıkış, şifre
 * sıfırlama, TOTP ve oturum yönetimi Better Auth tarafından sunulur.
 * Bizim eklediğimiz kontroller: middleware'deki zorunlu 2FA ve audit köprüsü.
 */
export const { GET, POST } = toNextJsHandler(auth);
