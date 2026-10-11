import { PrototypeError } from "./prototype-errors";

export async function callOpenRouter(
  endpoint: "audio/transcriptions" | "chat/completions",
  body: object,
  signal: AbortSignal,
): Promise<Record<string, any>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new PrototypeError(503, "API_NOT_CONFIGURED", "Не настроен ключ OpenRouter.");
  const response = await fetch(`https://openrouter.ai/api/v1/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const status = response.status;
    // Do not forward upstream bodies: they can contain source text or credentials.
    if (status === 401 || status === 403) throw new PrototypeError(503, "PROVIDER_AUTH", "OpenRouter отклонил серверный ключ или доступ к модели.");
    if (status === 402) throw new PrototypeError(503, "PROVIDER_BALANCE", "Недостаточный баланс OpenRouter.");
    if (status === 429) throw new PrototypeError(429, "PROVIDER_LIMIT", "Ограничение запросов OpenRouter. Повторите позже.", true);
    if (status === 400 || status === 404) throw new PrototypeError(502, "PROVIDER_PARAMETERS", "Провайдер отклонил модель, формат или параметры. Настройки не были заменены.");
    throw new PrototypeError(503, "PROVIDER_UNAVAILABLE", "OpenRouter временно недоступен.", true);
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data) || "error" in data) {
    throw new PrototypeError(502, "PROVIDER_RESPONSE", "Некорректный ответ OpenRouter.");
  }
  return data as Record<string, any>;
}

export function costFrom(data: Record<string, any>): number | null {
  return typeof data.usage?.cost === "number" && Number.isFinite(data.usage.cost) ? data.usage.cost : null;
}
