import { supermemo, type SuperMemoGrade } from "supermemo";
import { id, timezone, type AppData, type Card } from "./model";

export const GRADES = [
  { label: "Again", quality: 0 }, { label: "Hard", quality: 3 },
  { label: "Good", quality: 4 }, { label: "Easy", quality: 5 },
] as const;
export function eligible(cards: Card[], now = Date.now()) {
  const due = cards.filter(c => c.dueAt !== null && c.dueAt <= now).sort((a, b) => a.dueAt! - b.dueAt!);
  const fresh = cards.filter(c => c.dueAt === null).sort((a, b) => a.createdAt - b.createdAt);
  return [...due, ...fresh].slice(0, 10);
}
export function startSession(d: AppData, now = Date.now()) {
  if (d.session && d.session.index < d.session.ids.length) return;
  const ids = eligible(d.cards, now).map(c => c.id);
  d.session = ids.length ? { id: id(), startedAt: now, ids, index: 0, revealed: false, ratings: [], sourceLanguage: "en", targetLanguage: "ru" } : null;
}
export function skipDeleted(d: AppData) {
  if (!d.session) return;
  while (d.session.index < d.session.ids.length && !d.cards.some(c => c.id === d.session!.ids[d.session!.index])) {
    d.session.index++;
    d.session.revealed = false;
  }
}
export function rate(d: AppData, sessionId: string, cardId: string, grade: SuperMemoGrade, now = Date.now()) {
  const s = d.session;
  if (!s || s.id !== sessionId || s.ids[s.index] !== cardId || !s.revealed) return false;
  const eventId = `${sessionId}:${cardId}`;
  if (d.reviewEvents.some(e => e.id === eventId)) return false;
  const c = d.cards.find(c => c.id === cardId);
  if (!c) { skipDeleted(d); return false; }
  const next = supermemo({ interval: c.interval, repetition: c.repetition, efactor: c.efactor }, grade);
  Object.assign(c, next);
  // SM-2's integer interval is an elapsed number of 24-hour days in UTC, not local midnight.
  c.dueAt = now + next.interval * 86400000;
  c.timezone = timezone();
  s.ratings.push({ cardId, quality: grade });
  d.reviewEvents.push({ id: eventId, cardId, sessionId, at: now, quality: grade, interval: next.interval, timezone: c.timezone });
  s.index++;
  s.revealed = false;
  skipDeleted(d);
  return true;
}
