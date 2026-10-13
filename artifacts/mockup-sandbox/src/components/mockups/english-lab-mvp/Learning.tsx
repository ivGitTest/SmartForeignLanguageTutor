import { useState } from "react";
import { ArrowLeft, BookOpen, Layers3 } from "lucide-react";
import "./Learning.css";

const base = "/__mockup/preview/english-lab-mvp/";
const queue = [
  { en: "to make a point", ru: "подчеркнуть мысль", example: "She made a point of thanking everyone." },
  { en: "as far as I know", ru: "насколько я знаю", example: "As far as I know, the meeting is still on." },
  { en: "to figure out", ru: "разобраться, понять", example: "I’m trying to figure out what works for me." },
  { en: "a little overwhelmed", ru: "немного перегружен", example: "I felt a little overwhelmed this week." },
  { en: "on the other hand", ru: "с другой стороны", example: "On the other hand, we could wait a day." },
  { en: "to take a break", ru: "сделать перерыв", example: "I decided to take a break before replying." },
  { en: "to look forward to", ru: "с нетерпением ждать", example: "I look forward to seeing the new place." },
  { en: "to keep in mind", ru: "иметь в виду", example: "Keep in mind that plans can change." },
  { en: "at the moment", ru: "в данный момент", example: "At the moment, I’m working from home." },
  { en: "to get used to", ru: "привыкнуть к", example: "It took me a week to get used to the schedule." },
];

type Rating = "Again" | "Hard" | "Good" | "Easy";
type Session = {
  active: boolean;
  index: number;
  side: "front" | "back";
  total: number;
  rated: number;
  ratings: Record<string, number>;
  complete?: boolean;
};

function loadSession(): Session {
  try {
    const store = JSON.parse(localStorage.getItem("elab-review-demo") || "{}");
    return store.session ?? { active: true, index: 3, side: "front", total: 10, rated: 3, ratings: { Again: 0, Hard: 1, Good: 2, Easy: 0 } };
  } catch {
    return { active: true, index: 3, side: "front", total: 10, rated: 3, ratings: {} };
  }
}

export function Learning() {
  const [session, setSession] = useState<Session>(loadSession);
  const [notice, setNotice] = useState("");
  const index = Math.min(Math.max(0, session.index), queue.length - 1);
  const current = queue[index];

  function save(next: Session) {
    setSession(next);
    setNotice("");
    try {
      const store = JSON.parse(localStorage.getItem("elab-review-demo") || "{}");
      localStorage.setItem("elab-review-demo", JSON.stringify({ ...store, session: next }));
    } catch {
      setNotice("This browser could not save the demo session.");
    }
  }

  function rate(value: Rating) {
    if (session.side !== "back") return;
    const rated = session.rated + 1;
    const ratings = { ...session.ratings, [value]: (session.ratings[value] ?? 0) + 1 };
    const isLast = index >= queue.length - 1;
    save({
      ...session,
      index: isLast ? queue.length : index + 1,
      side: "front",
      rated,
      ratings,
      active: !isLast,
      complete: isLast,
    });
    if (isLast) window.location.href = base + "SessionComplete";
  }

  return (
    <main className="learning-screen">
      <header className="learning-topbar">
        <a href={base + "Dictionary"} aria-label="Return to Dictionary"><ArrowLeft size={21} /></a>
        <div><strong>Learning</strong><span>UI-10 · FIXED QUEUE</span></div>
        <span className="learning-lang">EN → RU</span>
      </header>

      <section className="learning-content">
        <div className="learning-intro">
          <div className="learning-eyebrow">A LITTLE PRACTICE</div>
          <h1>One phrase at a time.</h1>
          <p>Take a moment. Your place is saved as you go.</p>
        </div>

        <div className="learning-progress-meta">
          <span>Card {index + 1} of 10</span>
          <span>{session.rated} reviewed</span>
        </div>
        <div
          className="learning-progress"
          role="progressbar"
          aria-label="Learning session progress"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={10}
        >
          <span style={{ width: `${((index + 1) / 10) * 100}%` }} />
        </div>

        <article className="learning-card" aria-live="polite">
          <div className="learning-card-label">{session.side === "back" ? "TRANSLATION · RUSSIAN" : "ENGLISH EXPRESSION"}</div>
          <div className="learning-expression">{session.side === "back" ? current.ru : current.en}</div>
          {session.side === "back" && <p className="learning-example">{current.example}</p>}
        </article>

        {session.side === "back" && (
          <div className="rating-area">
            <p>How did that feel?</p>
            <div className="rating-grid">
              <button className="rating-button rating-again" onClick={() => rate("Again")}>Again</button>
              <button className="rating-button rating-hard" onClick={() => rate("Hard")}>Hard</button>
              <button className="rating-button rating-good" onClick={() => rate("Good")}>Good</button>
              <button className="rating-button rating-easy" onClick={() => rate("Easy")}>Easy</button>
            </div>
          </div>
        )}
        {notice && <div className="learning-notice" role="status">{notice}</div>}
      </section>

      <div className="learning-dock">
        <div className="learning-dock-action">
          {session.side === "front" ? (
            <button className="flip-button" onClick={() => save({ ...session, side: "back" })}>Flip</button>
          ) : (
            <span aria-live="polite">Rate your answer to continue</span>
          )}
        </div>
        <nav className="learning-nav" aria-label="Main navigation">
          <a href={base + "Dictionary"}><BookOpen size={18} /><span>Dictionary</span></a>
          <a href={base + "Materials"}><Layers3 size={18} /><span>Materials</span></a>
        </nav>
      </div>
    </main>
  );
}
