// Move ♥ Me — "Buy me a coffee" + "Send Heatherlee feedback" (About page), same look and behavior as the GitHub site.
// Also exports sendToSheet(), used for every form that saves to Heatherlee's Google Sheet.
import { useEffect, useRef, useState, type ReactNode } from "react";

const MM_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzLx7BXcheaM9cw2nB7BH8zJ7YU24v8496YyeUmO9jRsvwsoDYGsh-USb8yimJZ_ZcI/exec";
const CASHTAG = "heatherleewin";

// text/plain + no-cors = a "simple" request Google Apps Script accepts from any site. The reply can't be read, so never wait on it.
export function sendToSheet(payload: Record<string, unknown>) {
  try {
    fetch(MM_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, source: "Lovable" }),
    }).catch(() => {});
  } catch {
    /* never block the visitor */
  }
}

const INK = "#1B1B2F";

function CoffeeIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 34C8 18 24 8 38 11c14 3 20 19 14 31C46 54 26 58 16 50c-5-4-5.5-10-6-16Z" fill="#FF8A65" transform="rotate(-10 32 32)" />
      <path d="M24 21c-2-3 2-5 0-8M31 21c-2-3 2-5 0-8M38 21c-2-3 2-5 0-8" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M42.5 31h3c3.2 0 5.5 2.4 5.5 5.5S48.7 42 45.5 42h-3" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M17.5 26h25v13c0 7.2-5.6 13-12.5 13s-12.5-5.8-12.5-13Z" fill="#F5F1E8" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M17.5 30.5h25" stroke={INK} strokeWidth="2.2" />
      <path d="M30 46.5c-3.6-2.4-5.6-4.6-5.6-6.8a2.8 2.8 0 0 1 5.6-1.1 2.8 2.8 0 0 1 5.6 1.1c0 2.2-2 4.4-5.6 6.8Z" fill="#2F4BFF" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 55.5h36" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 34C8 18 24 8 38 11c14 3 20 19 14 31C46 54 26 58 16 50c-5-4-5.5-10-6-16Z" fill="#D4F25A" transform="rotate(12 32 32)" />
      <path d="M4 33h7M2 39h8M6 45h5" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <rect x="14" y="24" width="38" height="26" rx="4" fill="#F5F1E8" stroke={INK} strokeWidth="2.8" />
      <path d="M15 26.5 33 39l18-12.5" fill="none" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M50 21.5c-4.4-3-6.8-5.6-6.8-8.3a3.4 3.4 0 0 1 6.8-1.3 3.4 3.4 0 0 1 6.8 1.3c0 2.7-2.4 5.3-6.8 8.3Z" fill="#FF8A65" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M42 18.5q-4 1-6 4.5" fill="none" stroke="#2F4BFF" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 3.4" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 4.5l4.6 9.6 10.5 1.4-7.7 7.3 1.9 10.4L20 28.2l-9.3 5 1.9-10.4-7.7-7.3 10.5-1.4z" />
    </svg>
  );
}

function Popup({ open, onClose, label, titleId, children }: { open: boolean; onClose: () => void; label: string; titleId: string; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="mm-pop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mm-card" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={card}>
        <div className="mm-top">
          <span className="mm-meta"><i aria-hidden="true" />{label}</span>
          <button type="button" className="mm-x" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5 Q12 12.4 19 18.6 M18.6 5 Q12.2 11.6 5.2 19" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const AMOUNTS = [
  { v: 5, note: "a coffee" },
  { v: 10, note: "coffee + treat" },
  { v: 15, note: "a round" },
  { v: 20, note: "you’re a gem" },
];

export default function SupportActions({ map = "love" }: { map?: "love" | "career" }) {
  const [coffeeOpen, setCoffeeOpen] = useState(false);
  const [amt, setAmt] = useState(10);
  const [fbOpen, setFbOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const canSend = rating > 0 || text.trim().length >= 3;

  const openFeedback = () => { setRating(0); setHover(0); setText(""); setSent(false); setFbOpen(true); };
  const submit = () => {
    if (!canSend) return;
    sendToSheet({ type: "feedback", rating, text: text.trim().slice(0, 2000), page: "#about", map });
    setSent(true);
  };

  return (
    <div className="mm-acts">
      <style>{CSS}</style>
      <span className="mm-act-wrap">
        <button type="button" className="mm-act mm-coffee" aria-label="Buy me a coffee" onClick={() => setCoffeeOpen(true)}><CoffeeIcon /></button>
        <span className="mm-tip" role="tooltip">Buy me a coffee</span>
      </span>
      <span className="mm-act-wrap">
        <button type="button" className="mm-act mm-mail" aria-label="Send Heatherlee feedback" onClick={openFeedback}><MailIcon /></button>
        <span className="mm-tip" role="tooltip">Send Heatherlee feedback</span>
      </span>

      <Popup open={coffeeOpen} onClose={() => setCoffeeOpen(false)} label="buy me a coffee" titleId="mm-coffee-title">
        <h2 id="mm-coffee-title">keep the map growing</h2>
        <p>Move ♥ Me is a one-person passion project. If it helped you dream a little bigger, a coffee keeps the research and new features coming.</p>
        <div className="mm-amts" role="radiogroup" aria-label="Amount">
          {AMOUNTS.map((a) => (
            <button key={a.v} type="button" role="radio" aria-checked={amt === a.v} className="mm-amt" onClick={() => setAmt(a.v)}>
              ${a.v}<small>{a.note}</small>
            </button>
          ))}
        </div>
        <div className="mm-actions">
          <a className="mm-btn mm-primary" href={`https://cash.app/$${CASHTAG}/${amt}`} target="_blank" rel="noopener noreferrer">
            Send ${amt} with Cash App <span aria-hidden="true">→</span>
          </a>
        </div>
        <p className="mm-hint">Opens Cash App with the amount filled in. Thank you!</p>
      </Popup>

      <Popup open={fbOpen} onClose={() => setFbOpen(false)} label="feedback" titleId="mm-fb-title">
        {!sent ? (
          <>
            <h2 id="mm-fb-title">send heatherlee feedback</h2>
            <p>How’s Move ♥ Me treating you? Rate it, tell me what to fix, or what you’d love to see next.</p>
            <div className="mm-stars" role="radiogroup" aria-label="Rating, 1 to 5 stars" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} type="button" role="radio" aria-checked={rating === v} aria-label={`${v} star${v > 1 ? "s" : ""}`}
                  className={`mm-star${v <= (hover || rating) ? " on" : ""}`} onMouseEnter={() => setHover(v)} onClick={() => setRating(v)}>
                  <StarIcon />
                </button>
              ))}
            </div>
            <label className="mm-sr" htmlFor="mm-fb-text">Your feedback</label>
            <textarea id="mm-fb-text" className="mm-textarea" maxLength={2000} placeholder="Your thoughts…" value={text} onChange={(e) => setText(e.target.value)} />
            <p className="mm-hint">Goes straight to Heatherlee’s inbox. Anonymous unless you add your name.</p>
            <div className="mm-actions">
              <button type="button" className="mm-btn mm-ghost" onClick={() => setFbOpen(false)}>Cancel</button>
              <button type="button" className="mm-btn mm-primary" aria-disabled={!canSend} onClick={submit}>Submit <span aria-hidden="true">→</span></button>
            </div>
          </>
        ) : (
          <>
            <h2 id="mm-fb-title">thank you!</h2>
            <p>Your feedback is on its way to Heatherlee. It genuinely shapes what gets built next.</p>
            <div className="mm-actions"><button type="button" className="mm-btn mm-primary" onClick={() => setFbOpen(false)}>Close</button></div>
          </>
        )}
      </Popup>
    </div>
  );
}

const CSS = `
.mm-acts{display:flex;align-items:center;gap:6px;flex:none}
.mm-act-wrap{position:relative;display:inline-flex}
.mm-act{all:unset;cursor:pointer;width:64px;height:64px;display:grid;place-items:center;border-radius:18px;transition:transform .25s cubic-bezier(.34,1.56,.64,1),filter .25s}
.mm-act svg{width:100%;height:100%;overflow:visible}
.mm-coffee{transform:rotate(-7deg)} .mm-mail{transform:rotate(7deg)}
.mm-act:hover,.mm-act:focus-visible{filter:drop-shadow(3px 3px 0 #1B1B2F)}
.dark .mm-act:hover,.dark .mm-act:focus-visible,[data-theme="dark"] .mm-act:hover{filter:drop-shadow(3px 3px 0 #000)}
.mm-coffee:hover,.mm-coffee:focus-visible{transform:translate(-3px,-3px) rotate(-14deg) scale(1.06)}
.mm-mail:hover,.mm-mail:focus-visible{transform:translate(-3px,-3px) rotate(14deg) scale(1.06)}
.mm-act:focus-visible{outline:2px solid #2F4BFF;outline-offset:4px}
.mm-tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translate(-50%,4px);opacity:0;pointer-events:none;white-space:nowrap;
  background:#1B1B2F;color:#F5F1E8;font:600 12px/1 Manrope,system-ui,sans-serif;padding:8px 11px;border-radius:999px;transition:opacity .18s,transform .18s;z-index:5}
.dark .mm-tip,[data-theme="dark"] .mm-tip{background:#F5F1E8;color:#1B1B2F}
.mm-act-wrap:hover .mm-tip,.mm-act:focus-visible + .mm-tip{opacity:1;transform:translate(-50%,0)}
@media (hover:none){.mm-tip{display:none}}
.mm-pop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(27,27,47,.55);animation:mmFade .2s ease}
@keyframes mmFade{from{opacity:0}}
.mm-card{width:min(540px,100%);max-height:92vh;overflow:auto;background:#F5F1E8;color:#1B1B2F;border:2px solid #1B1B2F;border-radius:24px;box-shadow:6px 6px 0 #1B1B2F;
  padding:22px 24px 24px;font-family:Manrope,system-ui,sans-serif;animation:mmPop .32s cubic-bezier(.34,1.56,.64,1)}
@keyframes mmPop{from{transform:translateY(10px) scale(.96);opacity:0}}
.dark .mm-card,[data-theme="dark"] .mm-card{background:#23233A;color:#F5F1E8;border-color:#F5F1E8;box-shadow:6px 6px 0 #000}
.mm-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.mm-meta{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.mm-meta i{width:10px;height:10px;border-radius:50%;border:2px solid currentColor;background:#FF8A65}
.mm-x{all:unset;cursor:pointer;width:38px;height:38px;display:grid;place-items:center;border-radius:50%;border:2px solid currentColor}
.mm-x svg{width:18px;height:18px}
.mm-card h2{font-family:Unbounded,system-ui,sans-serif;font-weight:600;font-size:clamp(22px,4vw,28px);line-height:1.15;text-transform:lowercase;margin:4px 0 10px}
.mm-card p{font-size:16px;line-height:1.55;margin:0 0 14px}
.mm-amts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:6px 0 16px}
@media (max-width:420px){.mm-amts{grid-template-columns:repeat(2,1fr)}}
.mm-amt{all:unset;cursor:pointer;text-align:center;font:600 clamp(20px,4vw,26px)/1 Unbounded,system-ui,sans-serif;padding:18px 6px;border:2px solid currentColor;border-radius:16px;
  box-shadow:3px 3px 0 #1B1B2F;transition:transform .2s cubic-bezier(.34,1.56,.64,1),background .2s}
.dark .mm-amt,[data-theme="dark"] .mm-amt{box-shadow:3px 3px 0 #000}
.mm-amt:hover{transform:translate(-2px,-2px) rotate(-2deg)}
.mm-amt[aria-checked="true"]{background:#D4F25A;color:#1B1B2F;border-color:#1B1B2F}
.mm-amt small{display:block;font:500 11px/1.2 Manrope,system-ui,sans-serif;margin-top:6px;opacity:.75}
.mm-actions{display:flex;gap:10px;flex-wrap:wrap}
.mm-btn{all:unset;box-sizing:border-box;cursor:pointer;flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 22px;border-radius:999px;
  border:2px solid #1B1B2F;font:700 16px/1 Manrope,system-ui,sans-serif;box-shadow:3px 3px 0 #1B1B2F;transition:transform .15s}
.mm-btn:hover{transform:translate(-1px,-1px)}
.mm-primary{background:#2F4BFF;color:#F5F1E8}
.mm-ghost{background:transparent;color:inherit;border-color:currentColor}
.mm-btn[aria-disabled="true"]{opacity:.45;cursor:not-allowed;transform:none}
.mm-hint{font-size:13px !important;opacity:.7;margin:10px 0 0 !important}
.mm-stars{display:flex;gap:6px;margin:4px 0 14px}
.mm-star{all:unset;cursor:pointer;width:40px;height:40px;display:grid;place-items:center;border-radius:10px;transition:transform .2s cubic-bezier(.34,1.56,.64,1)}
.mm-star svg{width:36px;height:36px}
.mm-star path{fill:transparent;stroke:currentColor;stroke-width:2.4;stroke-linejoin:round;transition:fill .15s}
.mm-star.on path{fill:#FF8A65}
.mm-star:hover{transform:rotate(-8deg) scale(1.08)}
.mm-textarea{box-sizing:border-box;width:100%;min-height:130px;padding:14px;border:2px solid currentColor;border-radius:16px;background:transparent;color:inherit;font:500 16px/1.5 Manrope,system-ui,sans-serif;resize:vertical}
.mm-textarea:focus{outline:2px solid #2F4BFF;outline-offset:2px}
.mm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
`;
