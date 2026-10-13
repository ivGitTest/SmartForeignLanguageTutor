import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { BookmarkPlus, Check, X } from "lucide-react";
import { Material as SharedMaterial } from "./_shared/screens";
import "./Material.css";

type SelectionPreview = {
  phrase: string;
  translation: string;
  example: string;
  top: number;
  left: number;
};

function translateDemoPhrase(phrase: string) {
  const normalized = phrase.toLocaleLowerCase();
  const examples: Array<[RegExp, string]> = [
    [/i['’]ve been thinking about changing my routine/i, "Я думал о том, чтобы изменить свой распорядок"],
    [/perhaps i should start with a smaller plan/i, "Возможно, мне стоит начать с плана поменьше"],
    [/i['’]m not sure where to begin/i, "Я не уверен, с чего начать"],
    [/not sure where to begin/i, "Не уверен, с чего начать"],
    [/changing my routine|change my routine/i, "Изменить свой распорядок"],
    [/where to begin|begin/i, "С чего начать"],
    [/smaller plan|small(er)? plan/i, "План поменьше"],
    [/routine/i, "Распорядок"],
  ];

  return examples.find(([pattern]) => pattern.test(normalized))?.[1]
    ?? "Контекстный перевод выбранного выражения";
}

function readReviewStore() {
  try {
    const value = JSON.parse(localStorage.getItem("elab-review-demo") || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function nodeElement(node: Node | null) {
  if (node instanceof Element) return node;
  return node?.parentElement ?? null;
}

function sentenceAtRange(paragraph: HTMLParagraphElement, range: Range) {
  const text = paragraph.textContent?.trim() ?? "";
  if (!text) return "";

  const prefix = document.createRange();
  prefix.selectNodeContents(paragraph);
  prefix.setEnd(range.startContainer, range.startOffset);
  const selectionOffset = prefix.toString().length;
  const sentences = Array.from(text.matchAll(/[^.!?]+(?:[.!?]+["'’”)\]]*|$)/g));
  const sentence = sentences.find((match) => {
    const start = match.index ?? 0;
    return selectionOffset >= start && selectionOffset <= start + match[0].length;
  });

  return sentence?.[0].trim() ?? text;
}

export function Material() {
  const [selection, setSelection] = useState<SelectionPreview | null>(null);
  const [added, setAdded] = useState(false);

  function captureSelection() {
    const current = window.getSelection();
    const phrase = current?.toString().trim();
    if (!current || !phrase || current.isCollapsed || !current.rangeCount) {
      setSelection(null);
      setAdded(false);
      return;
    }

    const anchorCard = nodeElement(current.anchorNode)?.closest(".card");
    const focusCard = nodeElement(current.focusNode)?.closest(".card");
    const heading = anchorCard?.querySelector("h2")?.textContent?.toLowerCase() ?? "";
    const transcript = anchorCard?.querySelector("p") ?? null;
    const anchorParagraph = nodeElement(current.anchorNode)?.closest("p");
    const focusParagraph = nodeElement(current.focusNode)?.closest("p");
    if (
      !anchorCard ||
      anchorCard !== focusCard ||
      !heading.includes("improved transcript") ||
      !transcript ||
      anchorParagraph !== transcript ||
      focusParagraph !== transcript
    ) {
      setSelection(null);
      setAdded(false);
      return;
    }

    const range = current.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const menuWidth = Math.min(290, window.innerWidth - 24);
    const menuHeight = 190;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12));
    let top = rect.bottom + 8;
    if (top + menuHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - menuHeight - 8);
    }

    setSelection({
      phrase,
      translation: translateDemoPhrase(phrase),
      example: sentenceAtRange(transcript, range) || phrase,
      top,
      left,
    });
    setAdded(false);
  }

  function handleMouseUp(event: ReactMouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest(".material-selection-menu")) return;
    window.setTimeout(captureSelection, 0);
  }

  function addSelectionToDictionary() {
    if (!selection) return;
    const store = readReviewStore();
    const cards = Array.isArray(store.cards) ? store.cards : [];
    const exists = cards.some((card: { word?: string }) =>
      card.word?.toLocaleLowerCase() === selection.phrase.toLocaleLowerCase()
    );

    if (!exists) {
      const card = {
        word: selection.phrase,
        ru: selection.translation,
        example: selection.example,
        source: store.selectedMaterial || "A quieter morning",
      };
      try {
        localStorage.setItem("elab-review-demo", JSON.stringify({
          ...store,
          cards: [card, ...cards],
        }));
      } catch {
        return;
      }
    }

    setAdded(true);
  }

  return <>
    <div
      className="material-selection-root"
      onMouseUp={handleMouseUp}
      onTouchEnd={() => window.setTimeout(captureSelection, 60)}
      onKeyUp={() => window.setTimeout(captureSelection, 0)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setSelection(null);
          setAdded(false);
        }
      }}
    >
      <SharedMaterial />
    </div>
    {selection && createPortal(
      <div
        className="material-selection-menu"
        role="dialog"
        aria-label="Selected phrase actions"
        style={{ top: selection.top, left: selection.left }}
        onMouseUp={(event) => event.stopPropagation()}
      >
        <div className="material-selection-heading">
          <span className="material-selection-label">B · CONTEXTUAL TRANSLATION · DEMO</span>
          <button
            className="material-selection-close"
            type="button"
            aria-label="Close phrase menu"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setSelection(null);
              setAdded(false);
            }}
          >
            <X size={17} />
          </button>
        </div>
        <p className="material-selection-phrase">“{selection.phrase}”</p>
        <div className="material-selection-translation">
          <span>AI translation · Russian · demo</span>
          <strong lang="ru">{selection.translation}</strong>
        </div>
        <div className="material-selection-actions">
          <span>{added ? "Added to Dictionary" : "Add to Dictionary"}</span>
          <button
            className="material-selection-add"
            type="button"
            aria-label={added ? "Phrase added to Dictionary" : `Add “${selection.phrase}” to Dictionary`}
            title={added ? "Added to Dictionary" : "Add to Dictionary"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={addSelectionToDictionary}
            disabled={added}
          >
            {added ? <Check size={18} aria-hidden="true" /> : <BookmarkPlus size={18} aria-hidden="true" />}
          </button>
        </div>
        <span className="material-selection-note" aria-live="polite">
          {added ? "Saved in this preview." : "Select a word or expression from B, then tap the bookmark."}
        </span>
      </div>,
      document.body,
    )}
  </>;
}
