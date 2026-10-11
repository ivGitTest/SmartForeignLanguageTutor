import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import type { RewriteResult } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useWorkspace } from '@/hooks/use-workspace';
import { fmtBytes, fmtClock, fmtCost, fmtDate, fmtSeconds } from '@/lib/format';
import type { Level } from '@/lib/types';
import { AlertTriangle, Mic, Square, X, Trash2, RotateCcw, Loader2 } from 'lucide-react';

function Step({ n, title, hint, children, testid }: { n: string; title: string; hint?: string; children: ReactNode; testid: string }) {
  return (
    <section className="bg-card border border-card-border rounded-md" data-testid={testid}>
      <div className="flex items-baseline gap-3 px-5 pt-4 pb-3 border-b border-border">
        <span className="font-mono text-xs text-[hsl(var(--mark))]">{n}</span>
        <h2 className="font-text text-xl font-medium">{title}</h2>
        {hint && <span className="label-mono ml-auto hidden sm:inline">{hint}</span>}
      </div>
      <div className="p-5 grid gap-4">{children}</div>
    </section>
  );
}

function Notice({ tone, children, testid }: { tone: 'warn' | 'error'; children: ReactNode; testid?: string }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid={testid}
      className={
        'flex gap-2 items-start text-sm rounded-md border px-3 py-2 ' +
        (tone === 'error'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-[hsl(var(--mark)/.4)] bg-accent/60 text-accent-foreground')
      }
    >
      <AlertTriangle className="size-4 mt-0.5 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

function Meta({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="label-mono">{k}</dt>
          <dd className="font-mono break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Snapshot({ r }: { r: RewriteResult }) {
  const p = r.parameters;
  return (
    <details className="text-xs border border-border rounded-md" data-testid={'details-snapshot-' + r.targetLevel}>
      <summary className="cursor-pointer px-3 py-2 label-mono">Снимок применённых настроек</summary>
      <div className="p-3 grid gap-2">
        <Meta
          items={[
            ['редакция настроек', String(r.settingsRevision)],
            ['версия defaults', r.defaultsVersion],
            ['temperature', String(p.temperature)],
            ['top_p', String(p.top_p)],
            ['max_tokens', String(p.max_tokens)],
            ['seed', p.seed === undefined ? 'не задан' : String(p.seed)],
          ]}
        />
        <div className="label-mono">Инструкция (точный текст)</div>
        <pre className="whitespace-pre-wrap break-words font-mono bg-background border border-border rounded p-2 max-h-72 overflow-auto">
          {r.instruction}
        </pre>
      </div>
    </details>
  );
}

export default function Workspace() {
  const w = useWorkspace();
  const { config, settings, work, recording, recorder, op, level } = w;
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmRerunA, setConfirmRerunA] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (w.loadStatus === 'loading') {
    return (
      <div className="grid gap-5" data-testid="state-loading">
        <Skeleton className="h-44" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (w.loadStatus === 'error') {
    return (
      <div className="max-w-xl mx-auto bg-card border border-card-border rounded-md p-8" data-testid="state-storage-error">
        <div className="label-mono !text-[hsl(var(--mark))] mb-2">Локальное хранилище недоступно</div>
        <h1 className="font-text text-2xl mb-3">Работа невозможна без IndexedDB</h1>
        <p className="text-sm mb-2">{w.loadError}</p>
        <p className="text-sm text-muted-foreground mb-5">
          Приватный режим, запрет хранения данных сайта или переполнение диска делают постоянное сохранение невозможным. Режим только в памяти не выдаётся за сохранение, поэтому рабочая область заблокирована.
        </p>
        <Button onClick={w.reload} data-testid="button-retry-storage">Повторить</Button>
      </div>
    );
  }

  const recording_ = recorder.status === 'recording';
  const busyRec = recorder.status !== 'idle';
  const hasDownstream =
    work.transcript !== null &&
    (work.editable.text !== work.transcript.text || work.results.B2 !== undefined || work.results.C1 !== undefined);
  const text = work.editable.text;
  const tooLong = text.length > 10000;
  const empty = text.trim().length === 0;
  const result = work.results[level];
  const stale = result ? w.staleReasons(result) : [];
  const levels: Level[] = ['B2', 'C1'];

  const blockReason = !config.apiConfigured
    ? 'Серверный ключ провайдера не настроен: платные запросы отключены.'
    : w.dirty
      ? 'Есть несохранённые изменения настроек ИИ.'
      : !work.transcript
        ? 'Сначала выполните А — распознавание.'
        : empty
          ? 'Текст для улучшения пуст.'
          : tooLong
            ? 'Текст длиннее 10 000 символов.'
            : '';
  const canB = blockReason === '' && !op && !busyRec && !w.saving;
  const canA = !!recording && w.canPaid && !op && !busyRec && !w.saving;

  const onRecord = () => {
    if (recording) setConfirmReplace(true);
    else w.startRecording();
  };
  const onA = () => {
    if (hasDownstream) setConfirmRerunA(true);
    else w.run('A');
  };

  const progress = Math.min(100, (recorder.elapsedMs / (config.maxRecordingSeconds * 1000)) * 100);

  return (
    <div className="grid gap-5" data-testid="page-workspace">
      {!config.apiConfigured && (
        <Notice tone="error" testid="notice-api-missing">
          На сервере не настроен ключ внешнего провайдера. Запись и просмотр доступны, платные операции А и Б отключены.
        </Notice>
      )}
      {w.persistError && <Notice tone="error" testid="notice-persist">{w.persistError}</Notice>}
      {w.dirty && (
        <Notice tone="warn" testid="notice-dirty">
          <div className="flex flex-wrap items-center gap-3">
            <span>Настройки ИИ изменены, но не сохранены. Б заблокирована.</span>
            <Button size="sm" onClick={() => void w.saveDraft()} data-testid="button-save-from-workspace">Сохранить</Button>
            <Button size="sm" variant="outline" onClick={w.discardDraft} data-testid="button-discard-from-workspace">Отменить правки</Button>
            <Link href="/settings" className="underline" data-testid="link-open-settings">Открыть настройки</Link>
          </div>
        </Notice>
      )}

      <Step n="01" title="Запись" hint={'до ' + config.maxRecordingSeconds + ' с · до ' + fmtBytes(config.maxAudioBytes)} testid="section-record">
        {!w.support.ok && <Notice tone="error" testid="notice-unsupported">{w.support.reason}</Notice>}
        {w.recError && <Notice tone="error" testid="text-rec-error">{w.recError}</Notice>}
        <div className="flex flex-wrap items-center gap-3">
          {!busyRec && (
            <Button onClick={onRecord} disabled={!w.support.ok || !!op || w.saving} data-testid="button-record">
              <Mic className="size-4" /> Записать
            </Button>
          )}
          {recorder.status === 'requesting' && (
            <span className="text-sm text-muted-foreground flex items-center gap-2" data-testid="status-requesting">
              <Loader2 className="size-4 animate-spin" /> Ожидание разрешения микрофона
            </span>
          )}
          {recording_ && (
            <Button variant="destructive" onClick={recorder.stop} data-testid="button-stop">
              <Square className="size-4" /> Остановить
            </Button>
          )}
          {busyRec && (
            <Button variant="outline" onClick={recorder.cancel} data-testid="button-cancel-recording">
              <X className="size-4" /> Отменить запись
            </Button>
          )}
          {(recording_ || recorder.status === 'finishing') && (
            <div className="flex items-center gap-2 font-mono text-lg" data-testid="text-timer">
              <span className="size-2.5 rounded-full bg-[hsl(var(--mark))] rec-dot" />
              {fmtClock(recorder.elapsedMs)} / {fmtClock(config.maxRecordingSeconds * 1000)}
            </div>
          )}
          {op && <span className="text-xs text-muted-foreground">Во время запроса новая запись недоступна: завершите или отмените запрос.</span>}
        </div>
        {(recording_ || recorder.status === 'finishing') && (
          <div className="h-1 bg-muted rounded overflow-hidden" aria-hidden>
            <div className="h-full bg-[hsl(var(--mark))] origin-left" style={{ width: progress + '%' }} />
          </div>
        )}
        {recording ? (
          <div className="grid gap-3 border-t border-border pt-4">
            <audio controls src={w.audioUrl ?? undefined} className="w-full" data-testid="audio-player" />
            <Meta
              items={[
                ['записано', fmtDate(recording.createdAt)],
                ['длительность', fmtSeconds(recording.durationMs)],
                ['размер', fmtBytes(recording.blob.size)],
                ['формат', recording.mime],
                ['идентификатор', recording.id.slice(0, 8)],
              ]}
            />
            <div>
              <Button variant="ghost" size="sm" disabled={!!op || busyRec} onClick={() => setConfirmDelete(true)} data-testid="button-delete-all">
                <Trash2 className="size-4" /> Удалить запись и результаты
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground border-t border-border pt-4" data-testid="empty-recording">
            Записи нет. Микрофон включается только по кнопке «Записать». Новая запись заменит предыдущую вместе с результатами.
          </p>
        )}
      </Step>

      <Step n="02" title="А — распознавание" hint={config.transcriptionModel} testid="section-a">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onA} disabled={!canA} data-testid="button-run-a">
            {op === 'A' ? <Loader2 className="size-4 animate-spin" /> : null} А — распознать
          </Button>
          {op === 'A' && (
            <Button variant="outline" onClick={w.cancelOp} data-testid="button-cancel-op">Отменить запрос</Button>
          )}
          <span className="text-xs text-muted-foreground">
            температура А: <span className="font-mono">{settings.transcriptionTemperature}</span> · таймаут {Math.round(config.timeoutMs / 1000)} с
          </span>
        </div>
        {!recording && <p className="text-sm text-muted-foreground">А станет доступна после завершённой записи.</p>}
        {w.opError?.kind === 'A' && (
          <Notice tone="error" testid="text-error-a">
            {w.opError.message}{' '}
            <button className="underline" onClick={onA} disabled={!canA} data-testid="button-retry-a">Повторить вручную (платный запрос)</button>
          </Notice>
        )}
        {work.transcript ? (
          <div className="grid gap-2">
            <div className="label-mono">Оригинал А — только чтение</div>
            <Textarea
              readOnly
              value={work.transcript.text}
              className="font-text text-base min-h-32 bg-background"
              data-testid="text-original-a"
            />
            <Meta
              items={[
                ['модель', work.transcript.model],
                ['температура', String(work.transcript.temperature)],
                ['время', fmtSeconds(work.transcript.processingMs)],
                ['стоимость', fmtCost(work.transcript.usageCostUsd)],
                ['получено', fmtDate(work.transcript.createdAt)],
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="empty-transcript">Расшифровки пока нет.</p>
        )}
      </Step>

      <Step n="03" title="Б — улучшение" hint={config.rewriteModel} testid="section-b">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="grid gap-3 content-start">
            <div className="flex items-center justify-between">
              <label htmlFor="editable" className="label-mono">Текст для улучшения</label>
              <Button variant="ghost" size="sm" onClick={w.resetEditable} disabled={!work.transcript || op === 'A' || text === work.transcript.text} data-testid="button-reset-editable">
                <RotateCcw className="size-4" /> Сбросить к оригиналу А
              </Button>
            </div>
            <Textarea
              id="editable"
              value={text}
              onChange={(e) => w.editText(e.target.value)}
              disabled={!work.transcript || op === 'A'}
              placeholder="После А здесь появится редактируемая копия"
              className="font-text text-base min-h-56 bg-background"
              data-testid="input-editable-text"
            />
            <div className={'text-xs font-mono ' + (tooLong ? 'text-destructive' : 'text-muted-foreground')}>
              {text.length} / 10000 · редакция {work.editable.revision}
            </div>
          </div>

          <div className="grid gap-3 content-start">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div role="radiogroup" aria-label="Режим улучшения" className="inline-flex border border-input rounded-md overflow-hidden">
                {levels.map((lv) => (
                  <button
                    key={lv}
                    role="radio"
                    aria-checked={level === lv}
                    onClick={() => w.setLevel(lv)}
                    data-testid={'toggle-level-' + lv}
                    className={
                      'px-4 py-1.5 text-sm font-medium transition-colors ' +
                      (level === lv ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary')
                    }
                  >
                    B1 → {lv}
                    {work.results[lv] && <span className="ml-1.5 text-xs opacity-70">{w.staleReasons(work.results[lv]!).length ? '(устар.)' : work.results[lv]!.finishReason === 'length' ? '(неполный)' : '(готов)'}</span>}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => w.run(level)} disabled={!canB} data-testid="button-run-b">
                  {op === level ? <Loader2 className="size-4 animate-spin" /> : null} Б — улучшить
                </Button>
                {(op === 'B2' || op === 'C1') && (
                  <Button variant="outline" onClick={w.cancelOp} data-testid="button-cancel-op-b">Отменить</Button>
                )}
              </div>
            </div>
            {blockReason && <p className="text-xs text-muted-foreground" data-testid="text-b-blocked">{blockReason}</p>}
            {w.opError && w.opError.kind !== 'A' && (
              <Notice tone="error" testid="text-error-b">
                {w.opError.message}{' '}
                <button className="underline" onClick={() => w.run(w.opError!.kind === 'C1' ? 'C1' : 'B2')} disabled={!canB} data-testid="button-retry-b">
                  Повторить вручную (платный запрос)
                </button>
              </Notice>
            )}

            {result ? (
              <div className="grid gap-3" data-testid={'result-' + level}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="label-mono">Вариант с ориентацией на {level}</span>
                  {stale.length > 0 && (
                    <span className="text-[0.7rem] font-mono px-2 py-0.5 rounded bg-accent text-accent-foreground" data-testid={'badge-stale-' + level}>
                      УСТАРЕЛ
                    </span>
                  )}
                  {result.finishReason === 'length' && (
                    <span className="text-[0.7rem] font-mono px-2 py-0.5 rounded bg-destructive/15 text-destructive" data-testid={'badge-incomplete-' + level}>
                      НЕПОЛНЫЙ
                    </span>
                  )}
                </div>
                {stale.length > 0 && (
                  <Notice tone="warn" testid={'text-stale-' + level}>
                    Результат не соответствует текущим данным ({stale.join('; ')}). Он показан для справки со своими настройками и не считается новым экспериментом.
                  </Notice>
                )}
                {result.finishReason === 'length' && (
                  <Notice tone="error">Ответ обрезан по лимиту токенов и не считается завершённым улучшением. Повтор — только вручную.</Notice>
                )}
                <div className="font-text text-base whitespace-pre-wrap break-words bg-background border border-border rounded-md p-3 min-h-40 select-text" data-testid={'text-result-' + level}>
                  {result.text}
                </div>
                <Meta
                  items={[
                    ['модель', result.model],
                    ['время', fmtSeconds(result.processingMs)],
                    ['стоимость', fmtCost(result.usageCostUsd)],
                    ['finish_reason', result.finishReason],
                    ['редакция текста', String(result.textRevision)],
                    ['получено', fmtDate(result.createdAt)],
                  ]}
                />
                {result.instruction !== config.defaultInstruction && (
                  <p className="text-xs text-[hsl(var(--mark))]">Эксперимент с пользовательской инструкцией: результат может не соответствовать цели {level}.</p>
                )}
                <Snapshot r={result} />
              </div>
            ) : (
              <div className="border border-dashed border-input rounded-md p-6 text-sm text-muted-foreground min-h-40" data-testid={'empty-result-' + level}>
                Результата B1 → {level} пока нет. Переключение режима ничего не запускает: нажмите «Б — улучшить».
              </div>
            )}
          </div>
        </div>
      </Step>

      <p className="text-xs text-muted-foreground max-w-3xl" data-testid="text-privacy">
        Приватность: аудио и тексты передаются через сервер приложения в OpenRouter и обслуживающему провайдеру моделей. Записи, тексты и настройки хранятся только в этом браузере (IndexedDB); очистка данных сайта, приватный режим или вытеснение браузером могут удалить их без резервной копии. Результат оценивается как вариант с ориентацией на уровень, а не как сертифицированный CEFR.
      </p>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Новая запись заменит текущую</AlertDialogTitle>
            <AlertDialogDescription>
              После успешного завершения новой записи прежнее аудио, расшифровка, правки и результаты B2/C1 будут заменены. Пока вы просто записываете, прежняя запись остаётся; отмена её не затронет.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-replace-cancel">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={w.startRecording} data-testid="button-replace-confirm">Записать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRerunA} onOpenChange={setConfirmRerunA}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Повторить А — платный запрос</AlertDialogTitle>
            <AlertDialogDescription>
              После успешного нового распознавания ваши правки текста и результаты B2/C1 будут сброшены. При ошибке прежние данные сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-rerun-cancel">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => w.run('A')} data-testid="button-rerun-confirm">Распознать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись и результаты?</AlertDialogTitle>
            <AlertDialogDescription>
              Аудио, расшифровка, правки и оба результата будут удалены из браузера. Настройки ИИ сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => void w.deleteAll()} data-testid="button-delete-confirm">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={w.consentPending !== null} onOpenChange={(o) => { if (!o) w.declineConsent(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Передача данных внешнему сервису</AlertDialogTitle>
            <AlertDialogDescription>
              Аудио (для А) или текст (для Б) будет отправлен через сервер приложения в OpenRouter и обслуживающему провайдеру модели. Запрос платный. Отмена или таймаут не гарантируют, что оплата не списана. Автоповторов нет.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-consent-decline">Не отправлять</AlertDialogCancel>
            <AlertDialogAction onClick={() => void w.acceptConsent()} data-testid="button-consent-accept">Понимаю, отправить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
