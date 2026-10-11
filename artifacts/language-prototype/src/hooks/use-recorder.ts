import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecorderResult {
  blob: Blob;
  mime: string;
  durationMs: number;
  interrupted: boolean;
}

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'finishing';

export function getRecorderSupport(): { ok: boolean; reason?: string } {
  if (typeof window === 'undefined') return { ok: false, reason: 'Нет окружения браузера.' };
  if (!window.isSecureContext)
    return { ok: false, reason: 'Для доступа к микрофону нужен защищённый контекст HTTPS.' };
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia)
    return {
      ok: false,
      reason: 'Этот браузер не поддерживает MediaRecorder или getUserMedia. Используйте актуальный Firefox на ПК.',
    };
  return { ok: true };
}

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return '';
}

function micError(e: unknown): string {
  const name = typeof e === 'object' && e !== null ? String((e as { name?: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Доступ к микрофону запрещён. Разрешите его в настройках сайта и повторите. Прежняя запись сохранена.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'Микрофон не найден. Прежняя запись сохранена.';
  if (name === 'NotReadableError' || name === 'AbortError')
    return 'Микрофон занят другим приложением или недоступен. Прежняя запись сохранена.';
  return 'Не удалось начать запись. Прежняя запись сохранена.';
}

export function useRecorder(opts: {
  maxSeconds: number;
  onComplete: (r: RecorderResult) => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const cancelledRef = useRef(false);
  const interruptedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (status !== 'idle') return;
    const support = getRecorderSupport();
    if (!support.ok) {
      optsRef.current.onError(support.reason ?? 'Запись не поддерживается.');
      return;
    }
    const token = ++tokenRef.current;
    cancelledRef.current = false;
    interruptedRef.current = false;
    setStatus('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      if (token === tokenRef.current) {
        setStatus('idle');
        optsRef.current.onError(micError(e));
      }
      return;
    }
    if (token !== tokenRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    let rec: MediaRecorder;
    try {
      const mime = pickMime();
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      cleanup();
      setStatus('idle');
      optsRef.current.onError('Не удалось создать запись в этом формате. Прежняя запись сохранена.');
      return;
    }
    recRef.current = rec;
    chunksRef.current = [];
    const startedAt = performance.now();
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onerror = () => {
      interruptedRef.current = true;
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        /* ignore */
      }
    };
    rec.onstop = () => {
      const durationMs = performance.now() - startedAt;
      cleanup();
      recRef.current = null;
      setStatus('idle');
      setElapsedMs(0);
      if (cancelledRef.current) return;
      if (interruptedRef.current) {
        optsRef.current.onError(
          'Запись прервана браузером или устройством. Неполный фрагмент отброшен, прежняя запись сохранена.',
        );
        return;
      }
      const mime = rec.mimeType || 'audio/webm';
      optsRef.current.onComplete({
        blob: new Blob(chunksRef.current, { type: mime }),
        mime,
        durationMs,
        interrupted: interruptedRef.current,
      });
    };
    stream.getAudioTracks().forEach((t) =>
      t.addEventListener('ended', () => {
        if (rec.state === 'recording') {
          interruptedRef.current = true;
          rec.stop();
        }
      }),
    );
    rec.start(1000);
    setStatus('recording');
    timerRef.current = window.setInterval(() => {
      const el = performance.now() - startedAt;
      setElapsedMs(el);
      if (el >= optsRef.current.maxSeconds * 1000 && rec.state === 'recording') {
        setStatus('finishing');
        rec.stop();
      }
    }, 200);
  }, [status, cleanup]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state === 'recording') {
      setStatus('finishing');
      rec.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    tokenRef.current++;
    cancelledRef.current = true;
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        cleanup();
      }
    } else {
      cleanup();
    }
    setStatus('idle');
    setElapsedMs(0);
  }, [cleanup]);

  useEffect(
    () => () => {
      tokenRef.current++;
      cancelledRef.current = true;
      const rec = recRef.current;
      if (rec && rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      cleanup();
    },
    [cleanup],
  );

  return { status, elapsedMs, start, stop, cancel };
}
