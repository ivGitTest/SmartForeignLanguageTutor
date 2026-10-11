import { useState, type ReactNode } from 'react';
import { useAuth } from '@workspace/replit-auth-web';
import { Button } from '@/components/ui/button';
import { clearSensitive } from '@/lib/storage';
import { Copy, Check } from 'lucide-react';

function Frame({ kicker, title, children, testid }: { kicker: string; title: string; children: ReactNode; testid: string }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6" data-testid={testid}>
      <div className="w-full max-w-xl bg-card border border-card-border rounded-md p-8 sm:p-10">
        <div className="label-mono !text-[hsl(var(--mark))] mb-3">{kicker}</div>
        <h1 className="font-text text-3xl font-medium mb-4">{title}</h1>
        <div className="grid gap-4 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function IdBox({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 border border-input rounded-md bg-background p-2 pl-3">
      <code className="font-mono text-sm break-all flex-1" data-testid="text-user-id">{id}</code>
      <Button
        variant="outline"
        size="sm"
        data-testid="button-copy-user-id"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? 'Скопировано' : 'Копировать'}
      </Button>
    </div>
  );
}

function LogoutButton({ userId }: { userId: string }) {
  const { logout } = useAuth();
  const [err, setErr] = useState('');
  return (
    <div className="grid gap-2">
      <Button
        variant="outline"
        data-testid="button-logout-gate"
        onClick={async () => {
          try {
            await clearSensitive(userId);
          } catch (e) {
            setErr(
              'Выход отменён: не удалось очистить сохранённые локально записи и тексты (' +
                (e instanceof Error ? e.message : 'ошибка хранилища') +
                '). Они остались в этом браузере.',
            );
            return;
          }
          logout();
        }}
      >
        Выйти
      </Button>
      {err && (
        <p className="text-xs text-destructive" role="alert" data-testid="text-logout-error">
          {err}
        </p>
      )}
    </div>
  );
}

export function ForbiddenScreen({ userId, onRetry }: { userId: string; onRetry: () => void }) {
  return (
    <Frame kicker="403 · доступ закрыт" title="Этот аккаунт не назначен владельцем" testid="screen-forbidden">
      <p>
        Вход выполнен, но платные операции разрешены только одному владельцу. Владельцу нужно задать секрет
        {' '}<code className="font-mono">PROTOTYPE_OWNER_USER_ID</code> равным идентификатору ниже и перезапустить сервер.
      </p>
      <div>
        <div className="label-mono mb-1.5">Ваш идентификатор</div>
        <IdBox id={userId} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={onRetry} data-testid="button-retry-config">Проверить снова</Button>
        <LogoutButton userId={userId} />
      </div>
    </Frame>
  );
}

export function ConfigErrorScreen({
  userId,
  status,
  onRetry,
}: {
  userId: string;
  status: number | null;
  onRetry: () => void;
}) {
  const unauth = status === 401;
  return (
    <Frame
      kicker={status ? 'Ошибка конфигурации · HTTP ' + status : 'Сервер недоступен'}
      title={unauth ? 'Сессия не принята сервером' : 'Не удалось получить конфигурацию'}
      testid="screen-config-error"
    >
      {unauth ? (
        <p>Сервер не признал вашу сессию. Выйдите и войдите снова.</p>
      ) : status === 503 ? (
        <p>
          Серверная конфигурация не завершена: проверьте, что владелец задал
          {' '}<code className="font-mono">PROTOTYPE_OWNER_USER_ID</code> и ключ внешнего провайдера. Платные запросы не отправляются.
        </p>
      ) : (
        <p>Сервер не ответил или вернул ошибку. Платные запросы не отправляются, пока конфигурация не получена.</p>
      )}
      <div>
        <div className="label-mono mb-1.5">Ваш идентификатор (для PROTOTYPE_OWNER_USER_ID)</div>
        <IdBox id={userId} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={onRetry} data-testid="button-retry-config">Повторить</Button>
        <LogoutButton userId={userId} />
      </div>
    </Frame>
  );
}
