export function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function fmtBytes(n: number): string {
  if (n < 1024) return n + ' Б';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' КиБ';
  return (n / 1024 / 1024).toFixed(2) + ' МиБ';
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'medium' });
}

export function fmtSeconds(ms: number): string {
  return (ms / 1000).toFixed(1).replace('.', ',') + ' с';
}

export function fmtCost(v: number | null): string {
  return v === null ? 'не сообщена провайдером' : '$' + v.toFixed(6);
}
