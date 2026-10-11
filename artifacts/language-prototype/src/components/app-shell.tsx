import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { LogOut } from 'lucide-react';

export function AppShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { userId, secureLogout, dirty, op, info } = useWorkspace();
  const nav = [
    { href: '/', label: 'Рабочая область', id: 'link-workspace' },
    { href: '/settings', label: 'Настройки ИИ', id: 'link-settings' },
  ];
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 h-14 flex items-center gap-6">
          <Link href="/" className="font-text text-xl font-semibold tracking-tight" data-testid="link-home">
            English <span className="italic text-[hsl(var(--mark))]">Lab</span>
          </Link>
          <nav className="flex gap-1 flex-1" aria-label="Разделы">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                data-testid={n.id}
                className={
                  'px-3 py-1.5 rounded-md text-sm transition-colors ' +
                  (loc === n.href ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground')
                }
              >
                {n.label}
                {n.href === '/settings' && dirty && <span className="ml-1.5 text-[hsl(var(--mark))]" title="Есть несохранённые правки">*</span>}
              </Link>
            ))}
          </nav>
          {op && <span className="label-mono hidden sm:inline" data-testid="status-op-header">идёт запрос</span>}
          <span className="hidden md:inline label-mono max-w-[14rem] truncate" title={userId} data-testid="text-header-user">
            {userId}
          </span>
          <Button variant="outline" size="sm" onClick={() => void secureLogout()} data-testid="button-logout">
            <LogOut className="size-4" /> Выйти
          </Button>
        </div>
        {info && (
          <div className="bg-accent text-accent-foreground text-sm px-4 sm:px-8 py-2" role="status" data-testid="text-info">
            {info}
          </div>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-8">{children}</main>
    </div>
  );
}
