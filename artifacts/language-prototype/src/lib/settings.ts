import type { AiParameters, PrototypeConfig } from '@workspace/api-client-react';
import type { Draft, Settings } from './types';

export type DraftErrors = Partial<Record<keyof Draft, string>>;

export function settingsFromConfig(config: PrototypeConfig, revision: number): Settings {
  return {
    schemaVersion: 1,
    instruction: config.defaultInstruction,
    parameters: { ...config.defaultParameters },
    transcriptionTemperature: config.defaultTranscriptionTemperature,
    revision,
    defaultsVersion: config.defaultsVersion,
  };
}

export function settingsToDraft(s: Settings): Draft {
  return {
    instruction: s.instruction,
    temperature: String(s.parameters.temperature),
    topP: String(s.parameters.top_p),
    maxTokens: String(s.parameters.max_tokens),
    seed: s.parameters.seed === undefined ? '' : String(s.parameters.seed),
    tempA: String(s.transcriptionTemperature),
  };
}

export function draftEquals(a: Draft, b: Draft): boolean {
  return (
    a.instruction === b.instruction &&
    a.temperature.trim() === b.temperature.trim() &&
    a.topP.trim() === b.topP.trim() &&
    a.maxTokens.trim() === b.maxTokens.trim() &&
    a.seed.trim() === b.seed.trim() &&
    a.tempA.trim() === b.tempA.trim()
  );
}

export function paramsEqual(a: AiParameters, b: AiParameters): boolean {
  return (
    a.temperature === b.temperature &&
    a.top_p === b.top_p &&
    a.max_tokens === b.max_tokens &&
    a.seed === b.seed
  );
}

function num(s: string): number {
  const t = s.trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
}

export type ParsedDraft =
  | {
      ok: true;
      value: { instruction: string; parameters: AiParameters; transcriptionTemperature: number };
    }
  | { ok: false; errors: DraftErrors };

export function parseDraft(d: Draft): ParsedDraft {
  const errors: DraftErrors = {};
  if (d.instruction.trim().length === 0) errors.instruction = 'Инструкция не может быть пустой.';
  else if (d.instruction.length > 20000) errors.instruction = 'Не более 20 000 символов.';

  const temperature = num(d.temperature);
  if (!(temperature >= 0 && temperature <= 2)) errors.temperature = 'Число от 0 до 2.';
  const topP = num(d.topP);
  if (!(topP > 0 && topP <= 1)) errors.topP = 'Число больше 0 и не больше 1.';
  const maxTokens = num(d.maxTokens);
  if (!(Number.isInteger(maxTokens) && maxTokens >= 64 && maxTokens <= 4096))
    errors.maxTokens = 'Целое число от 64 до 4096.';
  let seed: number | undefined;
  if (d.seed.trim() !== '') {
    seed = num(d.seed);
    if (!(Number.isInteger(seed) && seed >= 0 && seed <= 2147483647))
      errors.seed = 'Целое число от 0 до 2147483647 либо пусто.';
  }
  const tempA = num(d.tempA);
  if (!(tempA >= 0 && tempA <= 1)) errors.tempA = 'Число от 0 до 1.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const parameters: AiParameters = { temperature, top_p: topP, max_tokens: maxTokens };
  if (seed !== undefined) parameters.seed = seed;
  return {
    ok: true,
    value: { instruction: d.instruction, parameters, transcriptionTemperature: tempA },
  };
}

export function describeApiError(e: unknown, timedOut: boolean, timeoutMs: number): string {
  if (timedOut)
    return (
      'Превышено время ожидания (' +
      Math.round(timeoutMs / 1000) +
      ' с). Результат не получен. Провайдер мог принять запрос и списать оплату; повтор — отдельное платное действие.'
    );
  if (typeof e === 'object' && e !== null) {
    const o = e as { status?: unknown; data?: unknown; name?: unknown; message?: unknown };
    if (o.name === 'AbortError') return 'Запрос прерван.';
    if (typeof o.status === 'number') {
      let serverMsg = '';
      let reqId = '';
      const data = o.data as { error?: { message?: unknown; requestId?: unknown } } | null;
      if (data && typeof data === 'object' && data.error) {
        if (typeof data.error.message === 'string') serverMsg = data.error.message;
        if (typeof data.error.requestId === 'string') reqId = data.error.requestId;
      }
      const map: Record<number, string> = {
        400: 'Сервер отклонил данные запроса.',
        401: 'Сессия истекла. Войдите снова.',
        403: 'Этот аккаунт не является владельцем прототипа.',
        409: 'На сервере уже выполняется другой платной запрос.',
        413: 'Файл слишком большой для сервера.',
        415: 'Сервер не поддерживает формат аудио.',
        429: 'Превышен лимит запросов. Подождите минуту.',
        502: 'Внешний сервис вернул некорректный ответ.',
        503: 'Сервис или его конфигурация сейчас недоступны.',
        504: 'Внешний сервис не ответил вовремя.',
      };
      const base = map[o.status] ?? 'Ошибка запроса (HTTP ' + o.status + ').';
      return base + (serverMsg ? ' ' + serverMsg : '') + (reqId ? ' [запрос ' + reqId + ']' : '');
    }
    if (e instanceof TypeError) return 'Нет связи с сервером. Проверьте сеть и повторите вручную.';
    if (typeof o.message === 'string') return o.message;
  }
  return 'Неизвестная ошибка.';
}
