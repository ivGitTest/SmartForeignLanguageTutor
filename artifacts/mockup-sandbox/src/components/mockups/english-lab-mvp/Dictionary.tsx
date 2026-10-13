import { useMemo, useState } from "react";
import { APP_NAME } from "./_shared/screens";

const previewWords = [
  "to make a point",
  "as far as I know",
  "to figure out",
  "a little overwhelmed",
  "on the other hand",
  "to get used to",
];

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Dictionary() {
  const [query, setQuery] = useState("");
  const words = useMemo(
    () => previewWords.filter((word) => word.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  return (
    <main className="sl-dictionary">
      <style>{`
        .sl-dictionary {
          --sl-ink: #243b39;
          --sl-muted: #647774;
          --sl-line: #dce6df;
          --sl-paper: #f5f8f3;
          --sl-surface: #fffefa;
          --sl-sage: #dcebe1;
          --sl-green: #315f53;
          min-height: 100dvh;
          background: var(--sl-paper);
          color: var(--sl-ink);
          font: 15px/1.48 "DM Sans", "Avenir Next", sans-serif;
        }
        .sl-dictionary, .sl-dictionary * { box-sizing: border-box; }
        .sl-shell {
          display: flex; flex-direction: column; min-height: 100dvh;
          max-width: 480px; margin: auto; padding-bottom: 76px;
        }
        .sl-top {
          display: flex; align-items: center; justify-content: space-between;
          padding: max(18px, env(safe-area-inset-top)) 20px 12px;
        }
        .sl-brand { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:700; letter-spacing:-.02em; }
        .sl-mark {
          display:grid; place-items:center; width:34px; height:34px; border-radius:12px;
          color:var(--sl-paper); background:var(--sl-green); font:600 20px/1 Georgia,serif;
        }
        .sl-settings {
          display:grid; place-items:center; width:48px; height:48px; border-radius:16px;
          color:var(--sl-green); text-decoration:none;
        }
        .sl-content { width:100%; padding:10px 20px 22px; }
        .sl-eyebrow {
          color:var(--sl-muted); font-size:11px; font-weight:700;
          letter-spacing:.12em; text-transform:uppercase;
        }
        .sl-content h1 {
          margin:3px 0 4px; font:500 34px/1.14 Fraunces, Georgia,serif;
          letter-spacing:-.025em;
        }
        .sl-intro { margin:0; color:var(--sl-muted); }
        .sl-start {
          display:flex; align-items:center; justify-content:center; gap:9px;
          min-height:54px; margin:18px 0 20px; padding:13px 18px; border-radius:18px;
          background:var(--sl-green); color:#fffefa; text-decoration:none;
          font-weight:700; transition:transform .18s,opacity .18s;
        }
        .sl-start:hover { opacity:.95; transform:translateY(-1px); }
        .sl-section-head { display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .sl-count { display:flex; flex-direction:column; gap:2px; }
        .sl-count strong { font-size:15px; }
        .sl-add {
          display:flex; align-items:center; justify-content:center; gap:7px;
          min-height:46px; padding:10px 15px; border-radius:15px;
          color:#fffefa; background:var(--sl-green); font-weight:700;
          text-decoration:none;
        }
        .sl-search {
          display:flex; align-items:center; gap:10px; min-height:48px;
          margin-top:14px; padding:0 13px; border:1px solid var(--sl-line);
          border-radius:15px; background:var(--sl-surface); color:var(--sl-muted);
        }
        .sl-search input {
          width:100%; padding:10px 0; border:0; outline:none;
          background:transparent; color:var(--sl-ink); font:inherit;
        }
        .sl-search input::placeholder { color:#83918d; }
        .sl-list { margin:12px 0 0; padding:0; list-style:none; }
        .sl-word {
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          min-height:47px; border-bottom:1px solid var(--sl-line);
          color:var(--sl-ink); text-decoration:none;
          font:500 17px/1.3 Fraunces, Georgia,serif;
        }
        .sl-word:last-child { border-bottom:0; }
        .sl-word svg { flex:none; color:#82918b; }
        .sl-empty { padding:17px 0; color:var(--sl-muted); }
        .sl-bottom {
          position:fixed; z-index:2; bottom:0; left:0; right:0;
          display:grid; grid-template-columns:repeat(3,minmax(0,1fr));
          gap:6px; padding:8px 12px max(8px,env(safe-area-inset-bottom));
          border-top:1px solid var(--sl-line); background:var(--sl-paper);
        }
        .sl-bottom a {
          display:flex; align-items:center; justify-content:center; min-height:48px;
          border-radius:15px; color:var(--sl-muted); text-decoration:none;
          font-size:12px; font-weight:600;
        }
        .sl-bottom a[aria-current="page"] { background:#e8f0e9; color:var(--sl-green); }
        @media (max-width:380px) {
          .sl-top { padding-left:16px; padding-right:16px; }
          .sl-content { padding-right:16px; padding-left:16px; }
        }
        @media (prefers-reduced-motion:reduce) {
          .sl-dictionary *, .sl-dictionary *::before, .sl-dictionary *::after {
            transition:none!important; scroll-behavior:auto!important;
          }
        }
      `}</style>
      <div className="sl-shell">
        <header className="sl-top">
          <div className="sl-brand"><span className="sl-mark" aria-hidden="true">S</span><span>{APP_NAME}</span></div>
          <a className="sl-settings" href="/__mockup/preview/english-lab-mvp/Settings" aria-label="Settings">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none">
              <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="1.6"/>
              <path d="m19 13.5 1.2 1-.9 1.6-1.5-.4a7.4 7.4 0 0 1-1.5.9l-.3 1.6h-1.9l-.5-1.5a7.5 7.5 0 0 1-1.8 0l-.9 1.3-1.7-.7.1-1.6a7.4 7.4 0 0 1-1.2-1.3l-1.6.1-.6-1.8 1.2-1a7.5 7.5 0 0 1 .1-1.8L4.6 9 5.5 7.4l1.5.4a7.4 7.4 0 0 1 1.5-.9l.3-1.6h1.9l.5 1.5a7.5 7.5 0 0 1 1.8 0l.9-1.3 1.7.7-.1 1.6a7.4 7.4 0 0 1 1.2 1.3l1.6-.1.6 1.8-1.2 1a7.5 7.5 0 0 1-.1 1.7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" transform="translate(0 1)"/>
            </svg>
          </a>
        </header>

        <section className="sl-content" aria-labelledby="sl-dictionary-title">
          <div className="sl-eyebrow">Your word collection</div>
          <h1 id="sl-dictionary-title">Dictionary</h1>
          <p className="sl-intro">Small phrases, ready when you are.</p>

          <a className="sl-start" href="/__mockup/preview/english-lab-mvp/Learning">
            Start learning
            <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none">
              <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>

          <div className="sl-section-head">
            <div className="sl-count">
              <span className="sl-eyebrow">EN → RU</span>
              <strong>{words.length} phrases</strong>
            </div>
            <a className="sl-add" href="/__mockup/preview/english-lab-mvp/WordCard?new=1">
              <span aria-hidden="true">＋</span> Add
            </a>
          </div>

          <label className="sl-search">
            <svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17" fill="none">
              <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5"/>
              <path d="m13.2 13.2 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input aria-label="Search English words and phrases" placeholder="Search words or translations" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>

          <ul className="sl-list" aria-label="English word previews">
            {words.length ? words.map((word) => (
              <li key={word}>
                <a className="sl-word" href={`/__mockup/preview/english-lab-mvp/WordCard?word=${encodeURIComponent(word)}`}>
                  <span>{word}</span><Chevron />
                </a>
              </li>
            )) : <li className="sl-empty">No matching phrase. Try another search.</li>}
          </ul>
        </section>

        <nav className="sl-bottom" aria-label="Main navigation">
          <a href="/__mockup/preview/english-lab-mvp/Dictionary" aria-current="page">Dictionary</a>
          <a href="/__mockup/preview/english-lab-mvp/Materials">Materials</a>
          <a href="/__mockup/preview/english-lab-mvp/Learning">Learning</a>
        </nav>
      </div>
    </main>
  );
}
