import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@workspace/replit-auth-web';
import {
  rewriteTranscript,
  transcribeRecording,
  useRewriteTranscript,
  useTranscribeRecording,
  type PrototypeConfig,
  type RewriteResult,
} from '@workspace/api-client-react';
import { clearSensitive, readAll, writeEntries } from '@/lib/storage';
import {
  describeApiError,
  draftEquals,
  paramsEqual,
  parseDraft,
  settingsFromConfig,
  settingsToDraft,
  type DraftErrors,
} from '@/lib/settings';
import type { Draft, Level, RecordingRec, Settings, WorkState } from '@/lib/types';
import { getRecorderSupport, useRecorder, type RecorderResult } from '@/hooks/use-recorder';

type LoadStatus = 'loading' | 'ready' | 'error';
type RunKind = 'A' | Level;

interface Op {
  seq: number;
  ctrl: AbortController;
  timedOut: boolean;
  cancelled: boolean;
}

const EMPTY_WORK: WorkState = {
  transcript: null,
  editable: { text: '', revision: 0 },
  results: {},
};

function errText(e: unknown): string {
  return e instanceof Error ? e.message : 'Неизвестная ошибка хранилища.';
}

function extFor(mime: string): string {
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'm4a';
  return 'webm';
}

function useWorkspaceState(config: PrototypeConfig, userId: string) {
  const { logout } = useAuth();
  const qc = useQueryClient();
  const transcribe = useTranscribeRecording({
    mutation: {
      mutationFn: ({ data }) => transcribeRecording(data, { signal: signalRef.current ?? undefined }),
    },
  });
  const rewrite = useRewriteTranscript({
    mutation: {
      mutationFn: ({ data }) => rewriteTranscript(data, { signal: signalRef.current ?? undefined }),
    },
  });
  const signalRef = useRef<AbortSignal | null>(null);

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [settings, setSettings] = useState<Settings>(() => settingsFromConfig(config, 1));
  const [draft, setDraft] = useState<Draft>(() => settingsToDraft(settingsFromConfig(config, 1)));
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [settingsError, setSettingsError] = useState('');
  const [recording, setRecording] = useState<RecordingRec | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [work, setWork] = useState<WorkState>(EMPTY_WORK);
  const [consent, setConsent] = useState(false);
  const [consentPending, setConsentPending] = useState<RunKind | null>(null);
  const [level, setLevel] = useState<Level>('B2');
  const [op, setOp] = useState<RunKind | null>(null);
  const [opError, setOpError] = useState<{ kind: RunKind; message: string } | null>(null);
  const [recError, setRecError] = useState('');
  const [info, setInfo] = useState('');
  const [persistError, setPersistError] = useState('');

  const workRef = useRef(work);
  const settingsRef = useRef(settings);
  const recordingRef = useRef(recording);
  const opRef = useRef<Op | null>(null);
  const seqRef = useRef(0);
  const persistTimer = useRef<number | null>(null);
  const pendingWrites = useRef(0);
  const loggingOut = useRef(false);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const recStatusRef = useRef<string>('idle');
  const pendingConsentRun = useRef<RunKind | null>(null);
  settingsRef.current = settings;
  recordingRef.current = recording;

  const commitWork = useCallback((next: WorkState) => {
    workRef.current = next;
    setWork(next);
  }, []);

  const persistWork = useCallback(
    async (next: WorkState) => {
      if (loggingOut.current) return;
      pendingWrites.current++;
      try {
        await writeEntries(userId, { state: next });
        setPersistError('');
      } catch (e) {
        setPersistError(
          'Не удалось сохранить данные локально: ' + errText(e) + ' Данные существуют только в памяти страницы и пропадут при обновлении.',
        );
      } finally {
        pendingWrites.current--;
      }
    },
    [userId],
  );

  // Load per-user workspace.
  useEffect(() => {
    let dead = false;
    setLoadStatus('loading');
    (async () => {
      try {
        const all = await readAll(userId);
        if (dead) return;
        let s = all.settings as Settings | undefined;
        if (!s || s.schemaVersion !== 1) {
          s = settingsFromConfig(config, 1);
          await writeEntries(userId, { settings: s });
          if (dead) return;
        }
        const st = (all.state as WorkState | undefined) ?? EMPTY_WORK;
        const rec = (all.recording as RecordingRec | undefined) ?? null;
        setSettings(s);
        setDraft(settingsToDraft(s));
        setRecording(rec);
        commitWork(rec ? st : EMPTY_WORK);
        setConsent(all.consent === true);
        setLevel(all.targetLevel === 'C1' ? 'C1' : 'B2');
        setLoadStatus('ready');
      } catch (e) {
        if (dead) return;
        setLoadError(errText(e));
        setLoadStatus('error');
      }
    })();
    return () => {
      dead = true;
    };
  }, [userId, config, reloadTick, commitWork]);

  const selectLevel = useCallback((next: Level) => {
    setLevel(next);
    void writeEntries(userId, { sourceLevel: 'B1', targetLevel: next }).catch((e) => {
      setPersistError('Не удалось сохранить выбранный уровень: ' + errText(e));
    });
  }, [userId]);

  useEffect(() => {
    if (!recording) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(recording.blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recording]);

  const dirty = useMemo(() => !draftEquals(draft, settingsToDraft(settings)), [draft, settings]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (!dirty && pendingWrites.current === 0 && !savingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // ---------- recording ----------
  const handleRecorded = useCallback(
    async (r: RecorderResult) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      if (persistTimer.current !== null) {
        window.clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      try {
        await commitRecording(r);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.maxAudioBytes, userId, commitWork],
  );

  const commitRecording = useCallback(
    async (r: RecorderResult) => {
      setRecError('');
      if (r.blob.size === 0) {
        setRecError('Запись пустая и не сохранена. Прежняя запись осталась без изменений.');
        return;
      }
      if (r.blob.size > config.maxAudioBytes) {
        setRecError('Запись превышает допустимый размер. Прежняя запись осталась без изменений.');
        return;
      }
      const rec: RecordingRec = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        blob: r.blob,
        mime: r.mime,
        durationMs: r.durationMs,
      };
      const fresh: WorkState = {
        transcript: null,
        editable: { text: '', revision: workRef.current.editable.revision + 1 },
        results: {},
      };
      try {
        await writeEntries(userId, { recording: rec, state: fresh });
      } catch (e) {
        setRecError('Не удалось сохранить новую запись: ' + errText(e) + ' Прежняя запись сохранена.');
        return;
      }
      setRecording(rec);
      commitWork(fresh);
      setOpError(null);
      setInfo(
        r.interrupted
          ? 'Браузер прервал запись. Сохранён доступный фрагмент — проверьте его прослушиванием.'
          : '',
      );
    },
    [config.maxAudioBytes, userId, commitWork],
  );

  const recorder = useRecorder({
    maxSeconds: config.maxRecordingSeconds,
    onComplete: (r) => void handleRecorded(r),
    onError: (m) => setRecError(m),
  });
  recStatusRef.current = recorder.status;
  const support = useMemo(() => getRecorderSupport(), []);

  const startRecording = useCallback(() => {
    if (opRef.current || savingRef.current) return;
    setRecError('');
    void recorder.start();
  }, [recorder]);

  // ---------- operations ----------
  const canPaid = config.apiConfigured && loadStatus === 'ready';

  const beginOp = useCallback(
    (kind: RunKind): Op => {
      const o: Op = { seq: ++seqRef.current, ctrl: new AbortController(), timedOut: false, cancelled: false };
      opRef.current = o;
      signalRef.current = o.ctrl.signal;
      setOp(kind);
      setOpError(null);
      setInfo('');
      return o;
    },
    [],
  );

  const endOp = useCallback((o: Op) => {
    if (opRef.current === o) {
      opRef.current = null;
      signalRef.current = null;
      setOp(null);
    }
  }, []);

  const cancelOp = useCallback(() => {
    const o = opRef.current;
    if (!o) return;
    o.cancelled = true;
    o.ctrl.abort();
    opRef.current = null;
    signalRef.current = null;
    setOp((k) => {
      if (k) {
        setOpError({
          kind: k,
          message:
            'Запрос отменён. Провайдер мог уже обработать его и списать оплату. Прежние данные сохранены.',
        });
      }
      return null;
    });
  }, []);

  const doRunA = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec || opRef.current || !canPaid || savingRef.current || recStatusRef.current !== 'idle') return;
    const startRev = workRef.current.editable.revision;
    const o = beginOp('A');
    const timer = window.setTimeout(() => {
      o.timedOut = true;
      o.ctrl.abort();
    }, config.timeoutMs);
    const temp = settingsRef.current.transcriptionTemperature;
    try {
      const res = await transcribe.mutateAsync({
        data: {
          audio: new File([rec.blob], 'recording.' + extFor(rec.mime), { type: rec.mime }),
          recordingId: rec.id,
          requestId: crypto.randomUUID(),
          temperature: temp,
        },
      });
      if (opRef.current !== o || recordingRef.current?.id !== rec.id) return;
      if (workRef.current.editable.revision !== startRev) {
        setInfo('Результат А получен после изменения текста и не сохранён, чтобы не перезаписать правки.');
        return;
      }
      if (!res.text || res.text.trim().length === 0) {
        setOpError({
          kind: 'A',
          message: 'Распознавание вернуло пустой текст (возможно, тишина). Результат не принят; прежние данные сохранены.',
        });
        return;
      }
      const next: WorkState = {
        transcript: res,
        editable: { text: res.text, revision: workRef.current.editable.revision + 1 },
        results: {},
      };
      commitWork(next);
      await persistWork(next);
    } catch (e) {
      if (opRef.current !== o) return;
      setOpError({ kind: 'A', message: describeApiError(e, (o as Op).timedOut, config.timeoutMs) });
    } finally {
      window.clearTimeout(timer);
      endOp(o);
    }
  }, [beginOp, endOp, canPaid, config.timeoutMs, transcribe, commitWork, persistWork]);

  const doRunB = useCallback(
    async (lv: Level) => {
      const rec = recordingRef.current;
      const w = workRef.current;
      const s = settingsRef.current;
      if (!rec || !w.transcript || opRef.current || !canPaid || savingRef.current || recStatusRef.current !== 'idle') return;
      const text = w.editable.text;
      if (text.trim().length === 0 || text.length > 10000) return;
      const textRevision = w.editable.revision;
      const o = beginOp(lv);
      const timer = window.setTimeout(() => {
        o.timedOut = true;
        o.ctrl.abort();
      }, config.timeoutMs);
      try {
        const res: RewriteResult = await rewrite.mutateAsync({
          data: {
            recordingId: rec.id,
            requestId: crypto.randomUUID(),
            textRevision,
            text,
            sourceLevel: 'B1',
            targetLevel: lv,
            instruction: s.instruction,
            parameters: s.parameters,
            settingsRevision: s.revision,
          },
        });
        if (opRef.current !== o) return;
        if (
          recordingRef.current?.id !== rec.id ||
          workRef.current.editable.revision !== textRevision ||
          settingsRef.current.revision !== s.revision
        ) {
          setInfo('Ответ получен для устаревшего текста или настроек и не сохранён, чтобы не перезаписать текущие данные.');
          return;
        }
        if (!res.text || res.text.trim().length === 0) {
          setOpError({ kind: lv, message: 'Модель вернула пустой ответ. Результат не сохранён.' });
          return;
        }
        const next: WorkState = { ...workRef.current, results: { ...workRef.current.results, [lv]: res } };
        commitWork(next);
        await persistWork(next);
      } catch (e) {
        if (opRef.current !== o) return;
        setOpError({ kind: lv, message: describeApiError(e, (o as Op).timedOut, config.timeoutMs) });
      } finally {
        window.clearTimeout(timer);
        endOp(o);
      }
    },
    [beginOp, endOp, canPaid, config.timeoutMs, rewrite, commitWork, persistWork],
  );

  const run = useCallback(
    (kind: RunKind) => {
      if (kind === 'B2' || kind === 'C1') {
        if (dirty) return;
      }
      if (!consent) {
        pendingConsentRun.current = kind;
        setConsentPending(kind);
        return;
      }
      if (kind === 'A') void doRunA();
      else void doRunB(kind);
    },
    [consent, dirty, doRunA, doRunB],
  );

  const acceptConsent = useCallback(async () => {
    const kind = pendingConsentRun.current;
    try {
      await writeEntries(userId, { consent: true });
    } catch (e) {
      setConsentPending(null);
      pendingConsentRun.current = null;
      setInfo('Не удалось сохранить подтверждение: ' + errText(e) + ' Запрос не отправлен.');
      return;
    }
    setConsent(true);
    setConsentPending(null);
    pendingConsentRun.current = null;
    if (kind === 'A') void doRunA();
    else if (kind) void doRunB(kind);
  }, [userId, doRunA, doRunB]);

  const declineConsent = useCallback(() => {
    pendingConsentRun.current = null;
    setConsentPending(null);
  }, []);

  // ---------- text editing ----------
  const editText = useCallback(
    (text: string) => {
      const w = workRef.current;
      if (!w.transcript) return;
      const next = { ...w, editable: { text, revision: w.editable.revision + 1 } };
      commitWork(next);
      void persistWork(next);
    },
    [commitWork, persistWork],
  );

  const resetEditable = useCallback(() => {
    const w = workRef.current;
    if (!w.transcript) return;
    const next = { ...w, editable: { text: w.transcript.text, revision: w.editable.revision + 1 } };
    commitWork(next);
    void persistWork(next);
  }, [commitWork, persistWork]);

  const deleteAll = useCallback(async () => {
    if (opRef.current || savingRef.current) return;
    if (persistTimer.current !== null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    try {
      await writeEntries(userId, {}, ['recording', 'state']);
    } catch (e) {
      setRecError('Не удалось удалить локальные данные: ' + errText(e));
      return;
    }
    setRecording(null);
    commitWork({ ...EMPTY_WORK, editable: { text: '', revision: workRef.current.editable.revision + 1 } });
    setOpError(null);
    setInfo('');
    setRecError('');
  }, [userId, commitWork]);

  // ---------- settings ----------
  const saveDraft = useCallback(async (): Promise<boolean> => {
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      setDraftErrors(parsed.errors);
      return false;
    }
    setDraftErrors({});
    const s = settingsRef.current;
    const changedB =
      parsed.value.instruction !== s.instruction || !paramsEqual(parsed.value.parameters, s.parameters);
    const next: Settings = {
      ...s,
      ...parsed.value,
      revision: changedB ? s.revision + 1 : s.revision,
      defaultsVersion: config.defaultsVersion,
    };
    try {
      await writeEntries(userId, { settings: next });
    } catch (e) {
      setSettingsError('Не удалось сохранить настройки: ' + errText(e));
      return false;
    }
    setSettingsError('');
    setSettings(next);
    setDraft(settingsToDraft(next));
    return true;
  }, [draft, config.defaultsVersion, userId]);

  const discardDraft = useCallback(() => {
    setDraft(settingsToDraft(settingsRef.current));
    setDraftErrors({});
  }, []);

  const resetDefaults = useCallback(async () => {
    const s = settingsRef.current;
    const d = settingsFromConfig(config, s.revision);
    const changedB = d.instruction !== s.instruction || !paramsEqual(d.parameters, s.parameters);
    const next = { ...d, revision: changedB ? s.revision + 1 : s.revision };
    try {
      await writeEntries(userId, { settings: next });
    } catch (e) {
      setSettingsError('Не удалось восстановить значения по умолчанию: ' + errText(e));
      return;
    }
    setSettingsError('');
    setSettings(next);
    setDraft(settingsToDraft(next));
    setDraftErrors({});
  }, [config, userId]);

  // ---------- staleness ----------
  const staleReasons = useCallback(
    (r: RewriteResult): string[] => {
      const out: string[] = [];
      if (r.recordingId !== recording?.id) out.push('другая запись');
      if (r.textRevision !== work.editable.revision) out.push('текст для улучшения изменён');
      if (r.settingsRevision !== settings.revision) out.push('настройки Б изменены');
      return out;
    },
    [recording, work.editable.revision, settings.revision],
  );

  const secureLogout = useCallback(async () => {
    loggingOut.current = true;
    cancelOp();
    recorder.cancel();
    if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
    try {
      await clearSensitive(userId);
      qc.clear();
    } catch (e) {
      loggingOut.current = false;
      setInfo('Выход отменён: не удалось очистить локальные записи и тексты (' + errText(e) + '). Данные остались в браузере; повторите выход.');
      return;
    }
    logout();
  }, [cancelOp, recorder, userId, qc, logout]);

  return {
    config,
    userId,
    loadStatus,
    loadError,
    reload: () => setReloadTick((t) => t + 1),
    settings,
    draft,
    setDraft,
    draftErrors,
    settingsError,
    dirty,
    saveDraft,
    discardDraft,
    resetDefaults,
    recording,
    audioUrl,
    work,
    level,
    setLevel: selectLevel,
    op,
    opError,
    recError,
    info,
    persistError,
    recorder,
    support,
    startRecording,
    run,
    cancelOp,
    canPaid,
    saving,
    consent,
    consentPending,
    acceptConsent,
    declineConsent,
    editText,
    resetEditable,
    deleteAll,
    staleReasons,
    secureLogout,
  };
}

type Ctx = ReturnType<typeof useWorkspaceState>;
const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({
  config,
  userId,
  children,
}: {
  config: PrototypeConfig;
  userId: string;
  children: ReactNode;
}) {
  const value = useWorkspaceState(config, userId);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const c = useContext(WorkspaceContext);
  if (!c) throw new Error('useWorkspace вне WorkspaceProvider');
  return c;
}
