import type { RequestHandler } from "express";
import { PrototypeError } from "../lib/prototype-errors";

export const requireOwner: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!req.isAuthenticated()) return next(new PrototypeError(401, "LOGIN_REQUIRED", "Войдите в приложение."));
  const owner = process.env.PROTOTYPE_OWNER_USER_ID;
  if (!owner) return next(new PrototypeError(503, "OWNER_NOT_CONFIGURED", "Не настроен PROTOTYPE_OWNER_USER_ID. Укажите ID владельца в настройках среды сервера."));
  if (req.user.id !== owner) return next(new PrototypeError(403, "OWNER_ONLY", "Прототип доступен только владельцу."));
  if (req.method !== "GET") {
    const origin = req.headers.origin;
    // Paid operations must come from the same browser origin. Non-browser API
    // clients may omit Origin but still require a verified session.
    let allowedOrigin = true;
    if (origin) {
      const host = (req.get("x-forwarded-host") ?? req.get("host"))?.split(",")[0]?.trim();
      try { allowedOrigin = new URL(origin).host === host; }
      catch { allowedOrigin = false; }
    }
    if (!allowedOrigin) {
      return next(new PrototypeError(403, "ORIGIN_REJECTED", "Недопустимый источник запроса."));
    }
  }
  next();
};

export class RequestGate {
  private active = new Set<string>();
  private starts = new Map<string, number[]>();
  acquire(userId: string, now = Date.now()) {
    if (this.active.has(userId)) throw new PrototypeError(409, "REQUEST_ACTIVE", "Запрос уже выполняется.");
    const recent = (this.starts.get(userId) ?? []).filter(t => now - t < 60_000);
    if (recent.length >= 5) throw new PrototypeError(429, "RATE_LIMIT", "Не более пяти запросов в минуту. Подождите и повторите.", true);
    this.starts.set(userId, [...recent, now]);
    this.active.add(userId);
    return () => this.active.delete(userId);
  }
}

const gate = new RequestGate();
export const paidRequest: RequestHandler = (req, res, next) => {
  if (!process.env.OPENROUTER_API_KEY) return next(new PrototypeError(503, "API_NOT_CONFIGURED", "Не настроен серверный ключ OpenRouter."));
  const release = gate.acquire(req.user!.id);
  res.locals.operationStartedAt = Date.now();
  req.setTimeout(60_000, () => req.destroy());
  res.once("finish", release);
  res.once("close", release);
  next();
};
