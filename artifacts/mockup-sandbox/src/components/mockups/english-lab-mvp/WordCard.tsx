import { useState } from "react";
import { ArrowLeft, Check, RotateCcw, Trash2 } from "lucide-react";
import "./_group.css";

type DictionaryCard = { word: string; ru: string; example?: string; source?: string };
type ReviewProgress = { intervalDays: number; repetitions: number; ease: number; nextReview: string | null };
type ReviewStore = {
  cards?: DictionaryCard[];
  nativeLanguage?: string;
  reviewProgress?: Record<string, ReviewProgress>;
};

const base = "/__mockup/preview/english-lab-mvp/";
const defaultCards: DictionaryCard[] = [
  { word: "to make a point", ru: "подчеркнуть мысль", example: "She made a point of thanking everyone.", source: "A quieter morning" },
  { word: "as far as I know", ru: "насколько я знаю", example: "As far as I know, the meeting is still on.", source: "A quieter morning" },
  { word: "to figure out", ru: "разобраться, понять", example: "I’m trying to figure out what works for me.", source: "Manual card" },
  { word: "a little overwhelmed", ru: "немного перегружен", example: "I felt a little overwhelmed this week.", source: "A quieter morning" },
];
const languageLabels: Record<string, string> = {
  ru: "Russian", en: "English", de: "German", fr: "French", es: "Spanish",
  it: "Italian", zh: "Chinese", ja: "Japanese", pt: "Portuguese", uk: "Ukrainian",
};

function readStore(): ReviewStore {
  try {
    return JSON.parse(window.localStorage.getItem("elab-review-demo") || "{}") as ReviewStore;
  } catch {
    return {};
  }
}

function readProgress(word: string): ReviewProgress {
  return readStore().reviewProgress?.[word] ?? {
    intervalDays: 2,
    repetitions: 3,
    ease: 2.5,
    nextReview: "in 2 days",
  };
}

function CardButton({ children, onClick, variant = "secondary" }: { children: React.ReactNode; onClick: () => void; variant?: string }) {
  return <button className={variant} onClick={onClick}>{children}</button>;
}

export function WordCard() {
  const initialStore = readStore();
  const isNew = new URLSearchParams(window.location.search).has("new");
  const initialWord = new URLSearchParams(window.location.search).get("word") || "";
  const initialCard = initialStore.cards?.find((card) => card.word === initialWord)
    ?? (isNew ? undefined : (initialStore.cards ?? defaultCards)[0]);
  const [cards, setCards] = useState<DictionaryCard[]>(initialStore.cards ?? defaultCards);
  const [word, setWord] = useState(isNew ? "" : initialCard?.word ?? "");
  const [translation, setTranslation] = useState(isNew ? "" : initialCard?.ru ?? "");
  const [example, setExample] = useState(isNew ? "" : initialCard?.example ?? "");
  const [progress, setProgress] = useState(() => initialCard ? readProgress(initialCard.word) : {
    intervalDays: 0, repetitions: 0, ease: 2.5, nextReview: null,
  });
  const [confirm, setConfirm] = useState<"reset" | "delete" | "">("");
  const [feedback, setFeedback] = useState("");
  const [invalid, setInvalid] = useState(false);
  const nativeLanguageCode = (initialStore.nativeLanguage || "ru").trim().toLowerCase().split(/[-_]/)[0];
  const nativeLanguage = languageLabels[nativeLanguageCode] || nativeLanguageCode.toUpperCase();
  const displayTitle = isNew ? "Add a phrase" : (word || "Word card");

  function persist(patch: Partial<ReviewStore>) {
    try {
      window.localStorage.setItem("elab-review-demo", JSON.stringify({ ...readStore(), ...patch }));
    } catch {
      setFeedback("This browser could not save the local review demo.");
    }
  }

  function saveCard() {
    if (!word.trim() || !translation.trim()) {
      setInvalid(true);
      return;
    }
    const saved = isNew
      ? [...cards, { word: word.trim(), ru: translation.trim(), example: example.trim(), source: "Manual card" }]
      : cards.map((card) => card.word === initialCard?.word
        ? { ...card, word: word.trim(), ru: translation.trim(), example: example.trim() }
        : card);
    setCards(saved);
    persist({ cards: saved });
    setInvalid(false);
    setFeedback("Card saved in this review demo.");
  }

  function confirmAction() {
    if (confirm === "delete") {
      const updated = cards.filter((card) => card.word !== initialCard?.word);
      setCards(updated);
      persist({ cards: updated });
      window.location.href = base + "Dictionary";
      return;
    }
    if (confirm === "reset") {
      const reset: ReviewProgress = {
        intervalDays: 0,
        repetitions: 0,
        ease: 2.5,
        nextReview: null,
      };
      const reviewProgress = { ...(readStore().reviewProgress ?? {}), [word]: reset };
      persist({ reviewProgress });
      setProgress(reset);
      setFeedback("Progress reset: no scheduled reviews or completed repetitions.");
    }
    setConfirm("");
  }

  return (
    <div className="elab">
      <div className="screen-tag">UI-09 · WORD CARD</div>
      <div className="app-shell">
        <header className="topbar">
          <button className="icon-button" aria-label="Back to Dictionary" onClick={() => { window.location.href = base + "Dictionary"; }}>
            <ArrowLeft size={21} />
          </button>
          <span style={{ fontWeight: 700, marginRight: "auto", marginLeft: 8 }}>{displayTitle}</span>
        </header>

        <main className="content">
          <div className="intro">
            <div className="eyebrow">{nativeLanguage.toUpperCase()} → ENGLISH</div>
            <h1>{isNew ? "Add a phrase" : "A phrase to keep"}</h1>
            <p>{isNew ? "Create a card manually. Both language fields are required." : "Edit the card and its translation; review progress stays unchanged."}</p>
          </div>

          <label htmlFor="word-expression">{nativeLanguage} expression</label>
          <input id="word-expression" value={word} onChange={(event) => setWord(event.target.value)} />
          <label htmlFor="word-translation">Translation</label>
          <input id="word-translation" value={translation} onChange={(event) => setTranslation(event.target.value)} />
          <label htmlFor="word-example">Example</label>
          <textarea id="word-example" value={example} onChange={(event) => setExample(event.target.value)} />

          {invalid && <div className="state-banner error" role="alert">Enter both the {nativeLanguage.toLowerCase()} expression and its translation.</div>}

          <label>Source</label>
          <div className="card row">
            <div>
              <strong>{initialCard?.source ?? (isNew ? "Manual card" : "No linked source")}</strong>
              <div className="micro">{initialCard?.source ? "Linked source material" : "No linked material"}</div>
            </div>
            <span className="pill">{initialCard?.source ? "LINKED" : "MANUAL"}</span>
          </div>

          {!isNew && (
            <section className="soft-card" style={{ marginTop: 14 }} aria-label="Learning progress">
              <div className="eyebrow">REVIEW PROGRESS</div>
              {progress.repetitions === 0
                ? <p style={{ marginTop: 6 }}>No scheduled reviews · 0 repetitions <span className="micro">· Ease {progress.ease.toFixed(1)}</span></p>
                : <p style={{ marginTop: 6 }}>Next review · {progress.nextReview ?? `in ${progress.intervalDays} days`} <span className="micro">· Interval {progress.intervalDays} days · {progress.repetitions} reviews · Ease {progress.ease.toFixed(1)}</span></p>
              }
              <button className="quiet" style={{ paddingLeft: 0 }} onClick={() => setConfirm("reset")}>
                <RotateCcw size={15} /> Reset progress
              </button>
            </section>
          )}

          {feedback && <div className="state-banner" role="status" style={{ marginTop: 12 }}>{feedback}</div>}

          {confirm && (
            <div className="card" role="alertdialog" aria-labelledby="confirmation-title" aria-describedby="confirmation-description" style={{ marginTop: 12 }}>
              <strong id="confirmation-title">{confirm === "reset" ? "Reset this card’s progress?" : "Delete this Dictionary card?"}</strong>
              <p id="confirmation-description" className="micro" style={{ marginTop: 4 }}>
                {confirm === "reset"
                  ? "The schedule and repetition count return to zero. The card and its meaning stay in the Dictionary."
                  : "This card is removed after confirmation. Other cards and the learning queue stay unchanged."}
              </p>
              <div className="actions">
                <CardButton onClick={() => setConfirm("")}>Cancel</CardButton>
                <CardButton variant="danger" onClick={confirmAction}>
                  {confirm === "reset" ? "Reset progress" : "Delete card"}
                </CardButton>
              </div>
            </div>
          )}

          <div className="actions">
            {!isNew && <CardButton variant="danger" onClick={() => setConfirm("delete")}><Trash2 size={16} /> Delete card</CardButton>}
            <CardButton variant={isNew ? "primary full" : "primary"} onClick={saveCard}><Check size={17} /> Save card</CardButton>
          </div>
          <p className="micro" style={{ marginTop: 12 }}>Deletion requires confirmation. Resetting progress never deletes this card.</p>
          <div className="bottom-space" />
        </main>
      </div>
    </div>
  );
}
