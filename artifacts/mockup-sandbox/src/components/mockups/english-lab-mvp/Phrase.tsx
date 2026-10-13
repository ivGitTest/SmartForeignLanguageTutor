import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { BookmarkPlus, Check } from "lucide-react";
import "./Phrase.css";

const initialPhrase = "changing my routine";
const transcript =
  "I’ve been thinking about changing my routine, but I’m not sure where to begin. Perhaps I should start with a smaller plan.";

function translateSelection(phrase: string) {
  const value = phrase.toLocaleLowerCase();
  if (value.includes("changing my routine") || value.includes("change my routine")) {
    return "изменить свой распорядок";
  }
  if (value.includes("where to begin")) return "с чего начать";
  if (value.includes("smaller plan")) return "план поменьше";
  return "контекстный перевод выбранной фразы";
}

function readCards() {
  try {
    const stored = JSON.parse(localStorage.getItem("elab-review-demo") || "{}");
    return Array.isArray(stored.cards) ? stored.cards : [];
  } catch {
    return [];
  }
}

export function Phrase() {
  const [phrase, setPhrase] = useState(initialPhrase);
  const [translation, setTranslation] = useState(translateSelection(initialPhrase));
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function captureSelection() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selection || !selectedText || selection.isCollapsed || !selection.rangeCount) return;

    const anchor = selection.anchorNode instanceof Element
      ? selection.anchorNode
      : selection.anchorNode?.parentElement;
    const focus = selection.focusNode instanceof Element
      ? selection.focusNode
      : selection.focusNode?.parentElement;
    if (
      !anchor?.closest(".phrase-context__transcript") ||
      !focus?.closest(".phrase-context__transcript")
    ) {
      return;
    }

    setPhrase(selectedText);
    setTranslation(translateSelection(selectedText));
    setSaved(readCards().some(
      (card: { word?: string }) => card.word?.toLocaleLowerCase() === selectedText.toLocaleLowerCase(),
    ));
    setSaveError(false);
  }

  function handleMouseUp(event: ReactMouseEvent<HTMLParagraphElement>) {
    if ((event.target as Element).closest(".phrase-context__actions")) return;
    window.setTimeout(captureSelection, 0);
  }

  function addToDictionary() {
    const cards = readCards();
    const alreadyExists = cards.some(
      (card: { word?: string }) => card.word?.toLocaleLowerCase() === phrase.toLocaleLowerCase(),
    );
    if (alreadyExists) {
      setSaved(true);
      return;
    }

    try {
      const current = JSON.parse(localStorage.getItem("elab-review-demo") || "{}");
      localStorage.setItem("elab-review-demo", JSON.stringify({
        ...current,
        cards: [{
          word: phrase,
          ru: translation,
          example: transcript,
          source: "A quieter morning",
        }, ...cards],
      }));
      setSaved(true);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  return (
    <main className="phrase-context">
      <section className="phrase-context__example" aria-label="Contextual action within transcript B">
        <p className="phrase-context__eyebrow">B · IMPROVED TRANSCRIPT</p>
        <p
          className="phrase-context__transcript"
          onMouseUp={handleMouseUp}
          onTouchEnd={() => window.setTimeout(captureSelection, 60)}
          onKeyUp={() => window.setTimeout(captureSelection, 0)}
        >
          I’ve been thinking about <mark>{initialPhrase}</mark>, but I’m not sure where to begin.
          Perhaps I should start with a smaller plan.
        </p>
      </section>

      <section className="phrase-context__menu" aria-label="Selected phrase translation and dictionary action">
        <div className="phrase-context__translation">
          <p className="phrase-context__eyebrow">TRANSLATE · RUSSIAN</p>
          <p className="phrase-context__selected">{phrase}</p>
          <p className="phrase-context__meaning" lang="ru">{translation}</p>
        </div>
        <div className="phrase-context__actions">
          <button
            className="phrase-context__bookmark"
            type="button"
            aria-label={saved ? "Phrase already in Dictionary" : "Add selected phrase to Dictionary"}
            title={saved ? "Already in Dictionary" : "Add to Dictionary"}
            disabled={saved}
            onMouseDown={(event) => event.preventDefault()}
            onClick={addToDictionary}
          >
            {saved
              ? <Check size={19} aria-hidden="true" />
              : <BookmarkPlus size={19} aria-hidden="true" />}
          </button>
        </div>
        <p className="phrase-context__status" aria-live="polite">
          {saveError
            ? "Could not save in this preview."
            : saved
              ? "Added to Dictionary."
              : "Select a word or expression in B, then tap the bookmark."}
        </p>
      </section>

      <p className="phrase-context__note">In-context action · no separate phrase screen</p>
    </main>
  );
}
