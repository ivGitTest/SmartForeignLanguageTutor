import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { fmtBytes } from '@/lib/format';
import type { Draft } from '@/lib/types';
import { AlertTriangle } from 'lucide-react';

function Field({ id, label, hint, error, children }: { id: string; label: string; hint: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert" data-testid={'error-' + id}>{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Fixed({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border last:border-0 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono text-right break-all">{v}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const w = useWorkspace();
  const { config, settings, draft, draftErrors } = w;
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => {
    setSaved(false);
    w.setDraft({ ...draft, [k]: e.target.value });
  };
  const d = config.defaultParameters;
  const customInstruction = draft.instruction !== config.defaultInstruction;

  if (w.loadStatus !== 'ready') {
    return (
      <p className="text-sm text-muted-foreground" data-testid="state-settings-unavailable">
        Настройки недоступны, пока локальное хранилище не загружено.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]" data-testid="page-settings">
      <div className="grid gap-5">
        <div>
          <div className="label-mono mb-1">Настройки ИИ</div>
          <h1 className="font-text text-3xl font-medium">Инструкция и параметры</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Сохранённая инструкция применяется вместо значений по умолчанию, ни к чему не дописывается и не заменяется молча. Изменения не запускают запросов. Сохранение новой инструкции или параметров Б помечает прежние результаты устаревшими.
          </p>
        </div>

        {w.settingsError && (
          <div role="alert" className="text-sm border border-destructive/40 bg-destructive/10 text-destructive rounded-md px-3 py-2" data-testid="text-settings-error">
            {w.settingsError}
          </div>
        )}
        {settings.defaultsVersion !== config.defaultsVersion && (
          <div className="text-sm border border-border bg-secondary rounded-md px-3 py-2" data-testid="notice-defaults-changed">
            Значения по умолчанию на сервере обновились (версия {config.defaultsVersion}, ваши настройки созданы на {settings.defaultsVersion}). Ваши сохранённые значения не изменены.
          </div>
        )}

        <section className="bg-card border border-card-border rounded-md p-5 grid gap-3">
          <Field id="instruction" label="Инструкция операции Б" hint="Общая для B2 и C1; целевой уровень передаётся отдельно. До 20 000 символов." error={draftErrors.instruction}>
            <Textarea
              id="instruction"
              value={draft.instruction}
              onChange={set('instruction')}
              className="font-mono text-[0.82rem] leading-relaxed min-h-80 bg-background"
              data-testid="input-instruction"
            />
          </Field>
          <div className="text-xs font-mono text-muted-foreground">{draft.instruction.length} / 20000</div>
          {customInstruction && (
            <div className="flex gap-2 items-start text-sm border border-[hsl(var(--mark)/.4)] bg-accent/60 rounded-md px-3 py-2" data-testid="warn-custom-instruction">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>Инструкция отличается от эталонной. Она может ослабить требования сохранения смысла и формы ответа; эталон контрольной проверки — инструкция по умолчанию.</span>
            </div>
          )}
        </section>

        <section className="bg-card border border-card-border rounded-md p-5 grid sm:grid-cols-2 gap-5">
          <Field id="temperature" label="temperature (Б)" hint={'0–2, по умолчанию ' + d.temperature} error={draftErrors.temperature}>
            <Input id="temperature" inputMode="decimal" value={draft.temperature} onChange={set('temperature')} data-testid="input-temperature" />
          </Field>
          <Field id="topP" label="top_p (Б)" hint={'больше 0 и не больше 1, по умолчанию ' + d.top_p} error={draftErrors.topP}>
            <Input id="topP" inputMode="decimal" value={draft.topP} onChange={set('topP')} data-testid="input-top-p" />
          </Field>
          <Field id="maxTokens" label="max_tokens (Б)" hint={'целое 64–4096, по умолчанию ' + d.max_tokens + '; не предел входа'} error={draftErrors.maxTokens}>
            <Input id="maxTokens" inputMode="numeric" value={draft.maxTokens} onChange={set('maxTokens')} data-testid="input-max-tokens" />
          </Field>
          <Field id="seed" label="seed (Б)" hint="целое 0–2147483647; пусто — параметр не отправляется" error={draftErrors.seed}>
            <Input id="seed" inputMode="numeric" value={draft.seed} onChange={set('seed')} placeholder="не задан" data-testid="input-seed" />
          </Field>
          <Field id="tempA" label="temperature (А)" hint={'0–1, по умолчанию ' + config.defaultTranscriptionTemperature + '. Применяется только к следующему запуску А'} error={draftErrors.tempA}>
            <Input id="tempA" inputMode="decimal" value={draft.tempA} onChange={set('tempA')} data-testid="input-temp-a" />
          </Field>
        </section>

        <div className="flex flex-wrap items-center gap-3 sticky bottom-0 bg-background/90 backdrop-blur py-3 border-t border-border">
          <Button
            disabled={!w.dirty}
            onClick={async () => setSaved(await w.saveDraft())}
            data-testid="button-save-settings"
          >
            Сохранить
          </Button>
          <Button variant="outline" disabled={!w.dirty} onClick={() => { setSaved(false); w.discardDraft(); }} data-testid="button-discard-settings">
            Отменить правки
          </Button>
          <Button variant="ghost" onClick={() => setConfirmReset(true)} data-testid="button-reset-defaults">
            Восстановить значения по умолчанию
          </Button>
          {w.dirty && <span className="text-xs text-[hsl(var(--mark))]" data-testid="status-dirty">Есть несохранённые правки</span>}
          {saved && !w.dirty && <span className="text-xs text-muted-foreground" data-testid="status-saved">Сохранено локально</span>}
        </div>
      </div>

      <aside className="grid gap-5 content-start">
        <section className="bg-card border border-card-border rounded-md p-5">
          <div className="label-mono mb-2">Фиксировано</div>
          <dl>
            <Fixed k="Исходный CEFR" v="B1" />
            <Fixed k="Провайдер" v={config.provider} />
            <Fixed k="Модель А" v={config.transcriptionModel} />
            <Fixed k="Модель Б" v={config.rewriteModel} />
            <Fixed k="Макс. запись" v={config.maxRecordingSeconds + ' с'} />
            <Fixed k="Макс. аудио" v={fmtBytes(config.maxAudioBytes)} />
            <Fixed k="Таймаут" v={Math.round(config.timeoutMs / 1000) + ' с'} />
            <Fixed k="Язык интерфейса" v="русский" />
            <Fixed k="Тема" v="системная" />
          </dl>
        </section>
        <section className="bg-card border border-card-border rounded-md p-5">
          <div className="label-mono mb-2">Сохранённые</div>
          <dl>
            <Fixed k="Редакция Б" v={String(settings.revision)} />
            <Fixed k="Версия defaults" v={settings.defaultsVersion} />
          </dl>
          <p className="text-xs text-muted-foreground mt-3">Ключ доступа в интерфейсе отсутствует: он хранится только на сервере.</p>
        </section>
      </aside>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Восстановить значения по умолчанию?</AlertDialogTitle>
            <AlertDialogDescription>
              Инструкция и все параметры будут заменены значениями сервера и сразу сохранены. Платный запрос не запускается. Прежние результаты, если настройки Б изменятся, будут помечены устаревшими.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reset-cancel">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setSaved(false); void w.resetDefaults(); }} data-testid="button-reset-confirm">Восстановить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
