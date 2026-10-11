import { useAuth } from '@workspace/replit-auth-web';
import { Button } from '@/components/ui/button';
import { Mic, FileText, ShieldCheck } from 'lucide-react';

export function LoginScreen() {
  const { login } = useAuth();
  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.1fr_1fr]" data-testid="screen-login">
      <section className="bg-primary text-primary-foreground p-8 sm:p-14 flex flex-col justify-between gap-16">
        <div className="label-mono !text-primary-foreground/70">Личный исследовательский инструмент</div>
        <div>
          <h1 className="font-text text-6xl sm:text-8xl leading-[0.92] font-medium tracking-tight">
            English
            <br />
            <span className="italic text-[hsl(var(--accent))]">Lab</span>
          </h1>
          <p className="mt-8 max-w-md text-lg text-primary-foreground/80 font-text">
            Речь на B1, текст без прикрас и два варианта той же мысли: B2 и C1. Смысл проверяется глазами, а не верой.
          </p>
        </div>
        <ul className="grid gap-3 text-sm text-primary-foreground/75 max-w-md">
          <li className="flex gap-3 items-start"><Mic className="size-4 mt-0.5 shrink-0" /> Запись и распознавание с сохранением ошибок и повторов</li>
          <li className="flex gap-3 items-start"><FileText className="size-4 mt-0.5 shrink-0" /> Редактируемая инструкция и параметры модели</li>
          <li className="flex gap-3 items-start"><ShieldCheck className="size-4 mt-0.5 shrink-0" /> Платные запросы доступны только владельцу</li>
        </ul>
      </section>
      <section className="flex items-center justify-center p-8 sm:p-14">
        <div className="w-full max-w-sm">
          <div className="label-mono mb-3">Вход</div>
          <h2 className="font-text text-3xl font-medium mb-3">Рабочая область закрыта</h2>
          <p className="text-muted-foreground mb-8">
            Войдите, чтобы открыть лабораторию. Записи и тексты хранятся только в этом браузере и очищаются при выходе.
          </p>
          <Button size="lg" className="w-full" onClick={login} data-testid="button-login">
            Войти
          </Button>
          <p className="mt-6 text-xs text-muted-foreground">
            Если вход выполнен, но доступ закрыт, экран подскажет, как владельцу назначить этот аккаунт.
          </p>
        </div>
      </section>
    </div>
  );
}
