import { useState, useEffect, useCallback, useRef } from "react";
import { get, post, patch, del } from "./api.js";

const GOOGLE_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Lora:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');`;

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #F5F1EB; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #F0EBE3; }
  ::-webkit-scrollbar-thumb { background: #C4B9A8; border-radius: 3px; }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
  @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
  @keyframes shimmer  { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
  @keyframes slideIn  { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
  @keyframes spin     { to { transform: rotate(360deg) } }
`;

// ─────────────────────────────────────────────────────────────────────────────
//  Toast system
// ─────────────────────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);
  return { toasts, toast };
}

const TOAST_BG = { info: "#011F5B", success: "#2D6A4F", error: "#9B1C1C" };

function Toasts({ toasts }) {
  return (
    <div style={{ position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:9999, display:"flex", flexDirection:"column", gap:"0.5rem", pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.85rem", color:"#FEFCF8", background: TOAST_BG[t.type]||TOAST_BG.info, padding:"0.75rem 1.2rem", borderRadius:"4px", boxShadow:"0 4px 20px rgba(0,0,0,0.25)", maxWidth:"340px", lineHeight:1.4, animation:"slideIn 0.2s ease" }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Skeleton loaders
// ─────────────────────────────────────────────────────────────────────────────

function Sk({ h="1rem", w="100%", mb="0.5rem" }) {
  return <div style={{ height:h, width:w, background:"linear-gradient(90deg,#EDE8E0 25%,#E2DCD4 50%,#EDE8E0 75%)", backgroundSize:"200% 100%", borderRadius:"3px", marginBottom:mb, animation:"shimmer 1.4s infinite" }} />;
}

function CardSkeleton() {
  return (
    <div style={{ background:"#FEFCF8", border:"1px solid #E8E2D9", borderRadius:"4px", padding:"1.4rem 1.6rem", marginBottom:"0.85rem" }}>
      <Sk h="1.2rem" w="75%" mb="0.7rem"/><Sk h="0.8rem" w="38%" mb="1rem"/>
      <Sk h="0.85rem" mb="0.35rem"/><Sk h="0.85rem" w="88%" mb="1rem"/>
      <div style={{display:"flex",gap:"0.4rem"}}><Sk h="1.4rem" w="80px" mb="0"/><Sk h="1.4rem" w="100px" mb="0"/></div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Cold-start loading gate (Render free-tier wake-up handling)
// ─────────────────────────────────────────────────────────────────────────────

function ColdStartScreen({ slow }) {
  return (
    <div style={{ minHeight:"100vh", background:"#F5F1EB", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"1.2rem", padding:"2rem", textAlign:"center" }}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.5rem", fontWeight:700, color:"#011F5B" }}>
        CFP Commons
      </div>
      <div style={{ width:"28px", height:"28px", border:"3px solid #E8E2D9", borderTopColor:"#990000", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", color:"#7A6F60", maxWidth:"320px", lineHeight:1.6 }}>
        {slow
          ? "Waking up the demo server — this runs on free hosting, so the first load after a quiet spell can take up to a minute. Thanks for your patience!"
          : "Loading…"}
      </p>
    </div>
  );
}

function LoadErrorScreen({ onRetry }) {
  return (
    <div style={{ minHeight:"100vh", background:"#F5F1EB", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"1rem", padding:"2rem", textAlign:"center" }}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.3rem", fontWeight:700, color:"#011F5B" }}>
        CFP Commons
      </div>
      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", color:"#9B1C1C", maxWidth:"320px", lineHeight:1.6 }}>
        Couldn't reach the server. It may still be waking up — try again in a moment.
      </p>
      <button onClick={onRetry} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.85rem", fontWeight:500, color:"#FEFCF8", background:"#011F5B", border:"none", borderRadius:"3px", padding:"0.6rem 1.4rem", cursor:"pointer" }}>
        Try again
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Token Reveal Modal
// ─────────────────────────────────────────────────────────────────────────────

function TokenModal({ token, cfpId, title, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(token).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(1,31,91,0.78)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", animation:"fadeIn 0.2s ease" }}>
      <div style={{ background:"#FEFCF8", borderRadius:"6px", maxWidth:"520px", width:"100%", overflow:"hidden", boxShadow:"0 24px 80px rgba(0,0,0,0.45)", animation:"fadeUp 0.25s ease" }}>
        <div style={{ background:"#990000", padding:"0.85rem 1.6rem", display:"flex", alignItems:"center", gap:"0.6rem" }}>
          <span style={{fontSize:"1rem"}}>⚠</span>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:600, color:"#FEFCF8", letterSpacing:"0.05em" }}>
            SAVE YOUR EDIT TOKEN — SHOWN ONLY ONCE
          </span>
        </div>
        <div style={{ padding:"1.8rem" }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.35rem", color:"#011F5B", marginBottom:"0.5rem" }}>CFP Submitted!</h2>
          <p style={{ fontFamily:"'Lora',serif", fontSize:"0.9rem", color:"#5A4F40", lineHeight:1.65, marginBottom:"1.4rem" }}>
            <em>"{title}"</em> is pending review. A confirmation email with this token has been sent to your contact address.
          </p>

          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem", letterSpacing:"0.08em", textTransform:"uppercase", color:"#9A8F80", marginBottom:"0.45rem" }}>Edit Token</div>
          <div style={{ background:"#011F5B", borderRadius:"4px", padding:"0.85rem 1rem", display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"1rem" }}>
            <code style={{ fontFamily:"monospace", fontSize:"0.8rem", color:"#990000", wordBreak:"break-all", flex:1 }}>{token}</code>
            <button onClick={copy} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.75rem", fontWeight:500, color:copied?"#2D6A4F":"#FEFCF8", background:copied?"#D8F3DC":"#1F3E72", border:"none", borderRadius:"3px", padding:"0.4rem 0.8rem", cursor:"pointer", transition:"all 0.2s", flexShrink:0 }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem", letterSpacing:"0.08em", textTransform:"uppercase", color:"#9A8F80", marginBottom:"0.45rem" }}>CFP ID</div>
          <div style={{ background:"#F7F3EE", borderRadius:"4px", padding:"0.6rem 1rem", fontFamily:"monospace", fontSize:"0.85rem", color:"#011F5B", marginBottom:"1.4rem" }}>#{cfpId}</div>

          <div style={{ fontSize:"0.8rem", fontFamily:"'DM Sans',sans-serif", color:"#92400E", lineHeight:1.55, marginBottom:"1.4rem", padding:"0.75rem", background:"#FEF3C7", borderRadius:"3px", borderLeft:"3px solid #D97706" }}>
            You need both your <strong>CFP ID</strong> and <strong>edit token</strong> to edit this listing, request a deadline extension, or delete it. We cannot recover a lost token.
          </div>

          <button onClick={onClose} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", fontWeight:500, color:"#FEFCF8", background:"#011F5B", border:"none", borderRadius:"3px", padding:"0.7rem 1.6rem", cursor:"pointer", width:"100%", letterSpacing:"0.04em" }}>
            I've saved my token — close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

const TC = { Conference:{bg:"#E4E9F2",text:"#011F5B"}, Journal:{bg:"#FEF3C7",text:"#92400E"}, Announcement:{bg:"#D1FAE5",text:"#065F46"} };
const fmtDate  = d => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
const daysLeft = d => Math.ceil((new Date(d + "T23:59:59") - new Date()) / 86400000);

function DeadlineBadge({ deadline }) {
  const d = daysLeft(deadline);
  const [color, bg] = d<0 ? ["#6B7280","#F3F4F6"] : d<=14 ? ["#9B1C1C","#FEE2E2"] : d<=30 ? ["#92400E","#FEF3C7"] : ["#2D6A4F","#D8F3DC"];
  return <span style={{ fontSize:"0.72rem", fontFamily:"'DM Sans',sans-serif", fontWeight:500, letterSpacing:"0.03em", padding:"3px 9px", borderRadius:"20px", background:bg, color }}>{d<0?"Closed":d===0?"Due today":`${d}d left`}</span>;
}

function BackBtn({ onClick, label = "Back to listings" }) {
  return <button onClick={onClick} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", color:"#990000", background:"none", border:"none", cursor:"pointer", padding:"0 0 1.5rem", display:"flex", alignItems:"center", gap:"0.4rem", letterSpacing:"0.04em" }}>← {label}</button>;
}

const inpBase = (err) => ({ width:"100%", fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem", color:"#011F5B", background:"#FEFCF8", border:`1px solid ${err?"#E53E3E":"#D8D0C4"}`, borderRadius:"3px", padding:"0.65rem 0.8rem", outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" });
const LBL = { fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:500, letterSpacing:"0.05em", textTransform:"uppercase", color:"#5A4F40", marginBottom:"0.4rem", display:"block" };
const ERR = { fontFamily:"'DM Sans',sans-serif", fontSize:"0.75rem", color:"#E53E3E", marginTop:"0.3rem" };

function Inp({ hasErr, style={}, ...props }) {
  return <input {...props} style={{ ...inpBase(hasErr), ...style }} onFocus={e=>e.target.style.borderColor="#990000"} onBlur={e=>e.target.style.borderColor=hasErr?"#E53E3E":"#D8D0C4"} />;
}
function Textarea({ hasErr, style={}, ...props }) {
  return <textarea {...props} style={{ ...inpBase(hasErr), resize:"vertical", minHeight:"160px", lineHeight:1.65, ...style }} onFocus={e=>e.target.style.borderColor="#990000"} onBlur={e=>e.target.style.borderColor=hasErr?"#E53E3E":"#D8D0C4"} />;
}
function Select({ style={}, ...props }) {
  return <select {...props} style={{ ...inpBase(false), appearance:"none", cursor:"pointer", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239A8F80' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 0.8rem center", paddingRight:"2.2rem", ...style }} />;
}
function CategoryGrid({ categories, selected, onToggle, hasErr }) {
  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:"0.3rem", background:"#F7F3EE", border:`1px solid ${hasErr?"#E53E3E":"#D8D0C4"}`, borderRadius:"3px", padding:"1rem" }}>
        {categories.map(cat => {
          const checked = selected.includes(cat.id);
          const disabled = !checked && selected.length >= 5;
          return (
            <label key={cat.id} style={{ display:"flex", alignItems:"center", gap:"0.45rem", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, fontFamily:"'DM Sans',sans-serif", fontSize:"0.81rem", color:checked?"#011F5B":"#5A4F40", fontWeight:checked?500:400 }}>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={()=>onToggle(cat.id)} style={{ accentColor:"#990000", width:"13px", height:"13px" }} />
              {cat.name}
            </label>
          );
        })}
      </div>
      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.73rem", color:"#9A8F80", marginTop:"0.35rem" }}>{selected.length}/5 selected</div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CFP Card
// ─────────────────────────────────────────────────────────────────────────────

function CFPCard({ cfp, onClick }) {
  const [hov, setHov] = useState(false);
  const tc = TC[cfp.listing_type] || TC.Announcement;
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:"#FEFCF8", border:`1px solid ${hov?"#990000":"#E8E2D9"}`, borderRadius:"4px", padding:"1.4rem 1.6rem", cursor:"pointer", transition:"all 0.18s ease", marginBottom:"0.85rem", boxShadow:hov?"0 4px 16px rgba(0,0,0,0.09)":"0 1px 3px rgba(0,0,0,0.04)", transform:hov?"translateY(-1px)":"" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", marginBottom:"0.5rem" }}>
        <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.08rem", fontWeight:600, color:"#011F5B", lineHeight:1.35, flex:1 }}>{cfp.title}</h3>
        <span style={{ fontSize:"0.7rem", fontFamily:"'DM Sans',sans-serif", fontWeight:500, letterSpacing:"0.07em", textTransform:"uppercase", padding:"3px 9px", borderRadius:"3px", background:tc.bg, color:tc.text, whiteSpace:"nowrap", flexShrink:0 }}>{cfp.listing_type}</span>
      </div>
      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", color:"#7A6F60", marginBottom:"0.8rem" }}>
        {cfp.organization}
        {cfp.extension_count > 0 && <span style={{ marginLeft:"0.5rem", fontSize:"0.7rem", color:"#9A8F80", fontStyle:"italic" }}>· extended {cfp.extension_count}×</span>}
      </p>
      <p style={{ fontFamily:"'Lora',serif", fontSize:"0.88rem", color:"#4A4035", marginBottom:"1rem", lineHeight:1.6, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
        {(cfp.content || "").split("\n")[0].replace(/\*/g, "")}
      </p>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.5rem" }}>
        <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
          {(cfp.categories || []).slice(0, 3).map(c => <span key={c} style={{ fontSize:"0.68rem", fontFamily:"'DM Sans',sans-serif", color:"#7A6F60", background:"#F0EBE3", padding:"2px 8px", borderRadius:"2px" }}>{c}</span>)}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <span style={{ fontSize:"0.75rem", fontFamily:"'DM Sans',sans-serif", color:"#9A8F80" }}>Due {fmtDate(cfp.deadline)}</span>
          <DeadlineBadge deadline={cfp.deadline} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CFP Detail
// ─────────────────────────────────────────────────────────────────────────────

function CFPDetail({ cfpId, onBack, onManage }) {
  const [cfp, setCfp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setLoading(true); setErr(null);
    get(`/api/cfps/${cfpId}`).then(setCfp).catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [cfpId]);

  if (loading) return <div style={{ maxWidth:"720px" }}><BackBtn onClick={onBack}/><Sk h="2rem" w="80%" mb="0.6rem"/><Sk h="0.9rem" w="40%" mb="2rem"/><Sk h="5rem" mb="1rem"/><Sk h="4rem"/></div>;
  if (err) return <div style={{ maxWidth:"720px" }}><BackBtn onClick={onBack}/><p style={{ fontFamily:"'DM Sans',sans-serif", color:"#9B1C1C", background:"#FEE2E2", padding:"1rem", borderRadius:"4px" }}>{err === "CFP not found" ? "This listing doesn't exist or hasn't been approved yet." : `Error: ${err}`}</p></div>;

  const tc = TC[cfp.listing_type] || TC.Announcement;
  const paras = (cfp.content || "").split("\n").filter(p => p.trim());

  return (
    <div style={{ maxWidth:"720px", animation:"fadeUp 0.25s ease" }}>
      <BackBtn onClick={onBack} />
      <div style={{ display:"flex", gap:"0.6rem", marginBottom:"1rem", flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:"0.72rem", fontFamily:"'DM Sans',sans-serif", fontWeight:500, letterSpacing:"0.07em", textTransform:"uppercase", padding:"4px 10px", borderRadius:"3px", background:tc.bg, color:tc.text }}>{cfp.listing_type}</span>
        <DeadlineBadge deadline={cfp.deadline} />
        {cfp.extension_count > 0 && <span style={{ fontSize:"0.72rem", fontFamily:"'DM Sans',sans-serif", color:"#9A8F80", fontStyle:"italic" }}>deadline extended {cfp.extension_count}×</span>}
      </div>

      <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.9rem", fontWeight:700, color:"#011F5B", lineHeight:1.25, marginBottom:"0.6rem" }}>{cfp.title}</h1>
      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem", color:"#7A6F60", marginBottom:"0.25rem" }}>{cfp.organization}</p>
      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", color:"#9A8F80", marginBottom:"2rem" }}>
        Posted {fmtDate(cfp.posted_at.slice(0,10))}
        {cfp.posted_at !== cfp.updated_at && ` · Updated ${fmtDate(cfp.updated_at.slice(0,10))}`}
      </p>

      <div style={{ background:"#F7F3EE", border:"1px solid #E8E2D9", borderRadius:"4px", padding:"1.2rem 1.4rem", marginBottom:"2rem", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
        {[["Submission Deadline", fmtDate(cfp.deadline)], ["Contact", cfp.contact_email]].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem", letterSpacing:"0.08em", textTransform:"uppercase", color:"#9A8F80", marginBottom:"0.25rem" }}>{label}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem", color:"#011F5B", fontWeight:500 }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:"2rem" }}>
        {paras.map((p, i) => <p key={i} style={{ fontFamily:"'Lora',serif", fontSize:"1rem", lineHeight:1.8, color:"#2E2820", marginBottom:"1.1rem" }}>{p.replace(/\*/g,"")}</p>)}
      </div>

      <div style={{ borderTop:"1px solid #E8E2D9", paddingTop:"1.2rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem", letterSpacing:"0.08em", textTransform:"uppercase", color:"#9A8F80", marginBottom:"0.6rem" }}>Categories</div>
        <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
          {(cfp.categories || []).map(c => <span key={c.id||c} style={{ fontSize:"0.8rem", fontFamily:"'DM Sans',sans-serif", color:"#5A4F40", background:"#F0EBE3", padding:"4px 12px", borderRadius:"3px", border:"1px solid #E0D8CE" }}>{c.name||c}</span>)}
        </div>
      </div>

      <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
        <a href={`mailto:${cfp.contact_email}`} style={{ display:"inline-block", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", fontWeight:500, color:"#FEFCF8", background:"#011F5B", padding:"0.65rem 1.4rem", borderRadius:"3px", textDecoration:"none", letterSpacing:"0.04em" }}>Contact Organizers →</a>
        <button onClick={onManage} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", color:"#7A6F60", background:"none", border:"1px solid #D8D0C4", padding:"0.65rem 1.2rem", borderRadius:"3px", cursor:"pointer" }}>Manage this listing</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Submit form
// ─────────────────────────────────────────────────────────────────────────────

function SubmitForm({ categories, onBack, onSuccess }) {
  const [f, setF] = useState({ title:"", org:"", email:"", deadline:"", type:"Conference", content:"", catIds:[] });
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setF(p => ({ ...p, [k]:v }));
  const toggleCat = id => set("catIds", f.catIds.includes(id) ? f.catIds.filter(x=>x!==id) : f.catIds.length<5 ? [...f.catIds,id] : f.catIds);

  const validate = () => {
    const e = {};
    if (!f.title.trim())   e.title    = "Required";
    if (!f.org.trim())     e.org      = "Required";
    if (!f.email.includes("@")) e.email = "Valid email required";
    if (!f.deadline)       e.deadline = "Required";
    if (!f.content.trim()) e.content  = "Required";
    if (!f.catIds.length)  e.cats     = "Select at least one category";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrs(e); return; }
    setSaving(true);
    try {
      const result = await post("/api/cfps", { title:f.title.trim(), organization:f.org.trim(), contact_email:f.email.trim(), deadline:f.deadline, listing_type:f.type, content:f.content.trim(), category_ids:f.catIds });
      onSuccess(result);
    } catch(err) { setErrs({ submit: err.message }); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth:"680px", animation:"fadeUp 0.25s ease" }}>
      <BackBtn onClick={onBack} />
      <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"2rem", fontWeight:700, color:"#011F5B", marginBottom:"0.5rem" }}>Submit a Call for Papers</h1>
      <p style={{ fontFamily:"'Lora',serif", color:"#7A6F60", marginBottom:"2rem", lineHeight:1.6 }}>
        Listings are reviewed before publication. Fields marked <span style={{color:"#990000"}}>*</span> are required.
        You'll receive an <strong>edit token</strong> on submission — keep it safe.
      </p>
      {errs.submit && <div style={{ background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:"3px", padding:"0.75rem 1rem", marginBottom:"1.2rem", fontFamily:"'DM Sans',sans-serif", fontSize:"0.85rem", color:"#9B1C1C" }}>{errs.submit}</div>}

      <div style={{ display:"grid", gap:"1.4rem" }}>
        <div>
          <label style={LBL}>Title <span style={{color:"#990000"}}>*</span></label>
          <Inp value={f.title} onChange={e=>set("title",e.target.value)} hasErr={!!errs.title} placeholder="Title of your CFP, conference, or announcement" />
          {errs.title && <div style={ERR}>{errs.title}</div>}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
          <div>
            <label style={LBL}>Organization <span style={{color:"#990000"}}>*</span></label>
            <Inp value={f.org} onChange={e=>set("org",e.target.value)} hasErr={!!errs.org} placeholder="Journal, society, or institution" />
            {errs.org && <div style={ERR}>{errs.org}</div>}
          </div>
          <div>
            <label style={LBL}>Listing Type</label>
            <Select value={f.type} onChange={e=>set("type",e.target.value)}><option>Conference</option><option>Journal</option><option>Announcement</option></Select>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
          <div>
            <label style={LBL}>Contact Email <span style={{color:"#990000"}}>*</span></label>
            <Inp type="email" value={f.email} onChange={e=>set("email",e.target.value)} hasErr={!!errs.email} placeholder="contact@institution.edu" />
            {errs.email && <div style={ERR}>{errs.email}</div>}
          </div>
          <div>
            <label style={LBL}>Submission Deadline <span style={{color:"#990000"}}>*</span></label>
            <Inp type="date" value={f.deadline} onChange={e=>set("deadline",e.target.value)} hasErr={!!errs.deadline} />
            {errs.deadline && <div style={ERR}>{errs.deadline}</div>}
          </div>
        </div>

        <div>
          <label style={LBL}>CFP Content <span style={{color:"#990000"}}>*</span></label>
          <Textarea value={f.content} onChange={e=>set("content",e.target.value)} hasErr={!!errs.content} placeholder="Full description: topics, guidelines, word limits, conference details, etc." style={{ minHeight:"180px" }} />
          {errs.content && <div style={ERR}>{errs.content}</div>}
        </div>

        <div>
          <label style={LBL}>Categories <span style={{color:"#990000"}}>*</span> <span style={{ fontWeight:400, textTransform:"none", fontSize:"0.73rem", color:"#9A8F80" }}>— select up to 5</span></label>
          <CategoryGrid categories={categories} selected={f.catIds} onToggle={toggleCat} hasErr={!!errs.cats} />
          {errs.cats && <div style={ERR}>{errs.cats}</div>}
        </div>

        <div style={{ display:"flex", gap:"0.75rem" }}>
          <button onClick={submit} disabled={saving} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem", fontWeight:500, color:"#FEFCF8", background:saving?"#6B6050":"#011F5B", border:"none", borderRadius:"3px", padding:"0.7rem 1.6rem", cursor:saving?"not-allowed":"pointer", letterSpacing:"0.04em", transition:"background 0.15s" }}>
            {saving ? "Submitting…" : "Submit CFP"}
          </button>
          <button onClick={onBack} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem", color:"#7A6F60", background:"none", border:"1px solid #D8D0C4", padding:"0.7rem 1.4rem", borderRadius:"3px", cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Manage view
// ─────────────────────────────────────────────────────────────────────────────

function ManageView({ prefillId, categories, onBack, toast }) {
  const [cfpId, setCfpId] = useState(prefillId ? String(prefillId) : "");
  const [token, setToken] = useState("");
  const [cfp, setCfp] = useState(null);
  const [exts, setExts] = useState([]);
  const [tab, setTab] = useState("edit");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookErr, setLookErr] = useState(null);
  const [editF, setEditF] = useState({});
  const [extF, setExtF] = useState({ new_deadline:"", reason:"" });

  const lookup = async () => {
    if (!cfpId || !token) { setLookErr("Enter both CFP ID and token"); return; }
    setLoading(true); setLookErr(null);
    try {
      const data = await get(`/api/cfps/${cfpId}`);
      setCfp(data);
      setEditF({ title:data.title, org:data.organization, email:data.contact_email, type:data.listing_type, content:data.content, catIds:(data.categories||[]).map(c=>c.id) });
      try { const e = await get(`/api/cfps/${cfpId}/extensions?edit_token=${encodeURIComponent(token)}`); setExts(e); } catch{}
    } catch(e) { setLookErr(e.message); }
    finally { setLoading(false); }
  };

  const setE = (k,v) => setEditF(p=>({...p,[k]:v}));
  const toggleEditCat = id => setE("catIds", editF.catIds.includes(id) ? editF.catIds.filter(x=>x!==id) : editF.catIds.length<5 ? [...editF.catIds,id] : editF.catIds);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await patch(`/api/cfps/${cfpId}`, { edit_token:token, title:editF.title, organization:editF.org, contact_email:editF.email, listing_type:editF.type, content:editF.content, category_ids:editF.catIds });
      toast("CFP updated successfully", "success");
    } catch(e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const requestExt = async () => {
    if (!extF.new_deadline) { toast("Enter a new deadline", "error"); return; }
    setSaving(true);
    try {
      const res = await post(`/api/cfps/${cfpId}/extend-deadline`, { edit_token:token, new_deadline:extF.new_deadline, reason:extF.reason||null });
      toast(res.message, res.status==="approved"?"success":"info");
      if (res.status==="approved") setCfp(c=>({...c, deadline:res.new_deadline}));
      const e = await get(`/api/cfps/${cfpId}/extensions?edit_token=${encodeURIComponent(token)}`);
      setExts(e);
      setExtF({ new_deadline:"", reason:"" });
    } catch(e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const deleteCFP = async () => {
    if (!window.confirm("Permanently delete this CFP? This cannot be undone.")) return;
    setSaving(true);
    try {
      await del(`/api/cfps/${cfpId}?edit_token=${encodeURIComponent(token)}`);
      toast("CFP deleted", "info"); onBack();
    } catch(e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const TABS = [["edit","Edit"],["extend","Extend Deadline"],["history",`Extensions (${exts.length})`],["delete","Delete"]];

  return (
    <div style={{ maxWidth:"680px", animation:"fadeUp 0.25s ease" }}>
      <BackBtn onClick={onBack} />
      <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"2rem", fontWeight:700, color:"#011F5B", marginBottom:"0.5rem" }}>Manage your CFP</h1>
      <p style={{ fontFamily:"'Lora',serif", color:"#7A6F60", marginBottom:"1.8rem", lineHeight:1.6 }}>Enter your CFP ID and edit token to edit your listing, extend its deadline, or remove it.</p>

      {!cfp && (
        <div style={{ background:"#F7F3EE", border:"1px solid #E8E2D9", borderRadius:"4px", padding:"1.4rem" }}>
          <div style={{ display:"grid", gridTemplateColumns:"120px 1fr", gap:"0.75rem", marginBottom:"0.75rem" }}>
            <div><label style={LBL}>CFP ID</label><Inp value={cfpId} onChange={e=>setCfpId(e.target.value)} placeholder="e.g. 2" /></div>
            <div><label style={LBL}>Edit Token</label><Inp value={token} onChange={e=>setToken(e.target.value)} placeholder="Your secret token" style={{ fontFamily:"monospace", fontSize:"0.8rem" }} /></div>
          </div>
          {lookErr && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", color:"#9B1C1C", marginBottom:"0.75rem" }}>{lookErr}</div>}
          <button onClick={lookup} disabled={loading} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", fontWeight:500, color:"#FEFCF8", background:"#011F5B", border:"none", borderRadius:"3px", padding:"0.65rem 1.4rem", cursor:loading?"not-allowed":"pointer", letterSpacing:"0.04em" }}>
            {loading ? "Looking up…" : "Access my CFP"}
          </button>
        </div>
      )}

      {cfp && (<>
        <div style={{ background:"#FEFCF8", border:"1px solid #E8E2D9", borderRadius:"4px", padding:"1rem 1.2rem", marginBottom:"1.4rem", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"0.5rem" }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1rem", fontWeight:600, color:"#011F5B" }}>{cfp.title}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", color:"#9A8F80" }}>ID #{cfpId} · Deadline: {fmtDate(cfp.deadline)} · Status: {cfp.status}</div>
          </div>
          <button onClick={()=>{setCfp(null);setExts([]);}} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.75rem", color:"#9A8F80", background:"none", border:"none", cursor:"pointer" }}>Switch listing</button>
        </div>

        <div style={{ display:"flex", borderBottom:"2px solid #E8E2D9", marginBottom:"1.6rem" }}>
          {TABS.map(([key,label]) => (
            <button key={key} onClick={()=>setTab(key)} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.83rem", fontWeight:tab===key?600:400, color:tab===key?(key==="delete"?"#9B1C1C":"#011F5B"):"#7A6F60", background:"none", border:"none", borderBottom:`2px solid ${tab===key?(key==="delete"?"#9B1C1C":"#990000"):"transparent"}`, padding:"0.6rem 1rem", cursor:"pointer", marginBottom:"-2px", transition:"all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>

        {tab==="edit" && (
          <div style={{ display:"grid", gap:"1.2rem" }}>
            <div><label style={LBL}>Title</label><Inp value={editF.title||""} onChange={e=>setE("title",e.target.value)}/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
              <div><label style={LBL}>Organization</label><Inp value={editF.org||""} onChange={e=>setE("org",e.target.value)}/></div>
              <div><label style={LBL}>Listing Type</label><Select value={editF.type||"Conference"} onChange={e=>setE("type",e.target.value)}><option>Conference</option><option>Journal</option><option>Announcement</option></Select></div>
            </div>
            <div><label style={LBL}>Contact Email</label><Inp type="email" value={editF.email||""} onChange={e=>setE("email",e.target.value)}/></div>
            <div><label style={LBL}>Content</label><Textarea value={editF.content||""} onChange={e=>setE("content",e.target.value)}/></div>
            <div>
              <label style={LBL}>Categories <span style={{ fontWeight:400, textTransform:"none", fontSize:"0.73rem", color:"#9A8F80" }}>— up to 5</span></label>
              <CategoryGrid categories={categories} selected={editF.catIds||[]} onToggle={toggleEditCat}/>
            </div>
            <button onClick={saveEdit} disabled={saving} style={{ alignSelf:"start", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", fontWeight:500, color:"#FEFCF8", background:saving?"#6B6050":"#011F5B", border:"none", borderRadius:"3px", padding:"0.65rem 1.4rem", cursor:saving?"not-allowed":"pointer", letterSpacing:"0.04em" }}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}

        {tab==="extend" && (
          <div style={{ display:"grid", gap:"1.2rem" }}>
            <div style={{ background:"#F7F3EE", border:"1px solid #E8E2D9", borderRadius:"4px", padding:"1rem 1.2rem" }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.72rem", letterSpacing:"0.07em", textTransform:"uppercase", color:"#9A8F80", marginBottom:"0.25rem" }}>Current deadline</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"1rem", color:"#011F5B", fontWeight:500 }}>{fmtDate(cfp.deadline)}</div>
            </div>
            <div>
              <label style={LBL}>New Deadline <span style={{color:"#990000"}}>*</span></label>
              <Inp type="date" value={extF.new_deadline} onChange={e=>setExtF(p=>({...p,new_deadline:e.target.value}))}/>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.73rem", color:"#9A8F80", marginTop:"0.3rem" }}>Must be after current deadline. Max 6 months from original post date.</div>
            </div>
            <div>
              <label style={LBL}>Reason <span style={{ fontWeight:400, textTransform:"none", fontSize:"0.73rem", color:"#9A8F80" }}>— optional but recommended</span></label>
              <Textarea value={extF.reason} onChange={e=>setExtF(p=>({...p,reason:e.target.value}))} placeholder="e.g. Extended due to conference rescheduling" style={{ minHeight:"90px" }}/>
            </div>
            <div style={{ background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:"3px", padding:"0.75rem 1rem", fontFamily:"'DM Sans',sans-serif", fontSize:"0.8rem", color:"#92400E" }}>
              Extension requests are reviewed before the deadline is updated publicly.
            </div>
            <button onClick={requestExt} disabled={saving} style={{ alignSelf:"start", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", fontWeight:500, color:"#FEFCF8", background:saving?"#6B6050":"#990000", border:"none", borderRadius:"3px", padding:"0.65rem 1.4rem", cursor:saving?"not-allowed":"pointer", letterSpacing:"0.04em" }}>
              {saving ? "Submitting…" : "Request extension"}
            </button>
          </div>
        )}

        {tab==="history" && (
          exts.length === 0
            ? <p style={{ fontFamily:"'Lora',serif", color:"#7A6F60", fontStyle:"italic" }}>No extension requests on record for this listing.</p>
            : <div style={{ display:"grid", gap:"0.75rem" }}>
                {exts.map(ext => {
                  const sc = {pending:{bg:"#FEF3C7",text:"#92400E"},approved:{bg:"#D1FAE5",text:"#065F46"},rejected:{bg:"#FEE2E2",text:"#9B1C1C"}}[ext.status]||{bg:"#F3F4F6",text:"#6B7280"};
                  return (
                    <div key={ext.id} style={{ background:"#FEFCF8", border:"1px solid #E8E2D9", borderRadius:"4px", padding:"1rem 1.2rem" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.5rem" }}>
                        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", color:"#7A6F60" }}>{new Date(ext.requested_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                        <span style={{ fontSize:"0.72rem", fontFamily:"'DM Sans',sans-serif", fontWeight:500, padding:"2px 8px", borderRadius:"10px", background:sc.bg, color:sc.text }}>{ext.status}</span>
                      </div>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.85rem", color:"#011F5B" }}>{ext.original_deadline} → <strong>{ext.requested_deadline}</strong></div>
                      {ext.reason && <div style={{ fontFamily:"'Lora',serif", fontSize:"0.82rem", color:"#5A4F40", marginTop:"0.35rem", fontStyle:"italic" }}>{ext.reason}</div>}
                    </div>
                  );
                })}
              </div>
        )}

        {tab==="delete" && (
          <div>
            <div style={{ background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:"4px", padding:"1.2rem", marginBottom:"1.4rem" }}>
              <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", color:"#7F1D1D", lineHeight:1.6 }}>
                <strong>This action is permanent and cannot be undone.</strong> Deleting this CFP removes it from the site immediately. Consider contacting a site admin about archiving instead if scholars are expecting this listing.
              </p>
            </div>
            <button onClick={deleteCFP} disabled={saving} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", fontWeight:500, color:"#9B1C1C", background:"none", border:"1px solid #FCA5A5", borderRadius:"3px", padding:"0.65rem 1.4rem", cursor:saving?"not-allowed":"pointer" }}>
              {saving ? "Deleting…" : "Permanently delete this CFP"}
            </button>
          </div>
        )}
      </>)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Browse view — NOW with a prominent "All Recent Posts" heading + deadline sort
// ─────────────────────────────────────────────────────────────────────────────

function BrowseView({ categories, onSelect, onSubmit }) {
  const [search, setSearch] = useState("");
  const [debSearch, setDeb] = useState("");
  const [activeSlugs, setSlug] = useState([]);
  const [type, setType] = useState("All");
  const [sort, setSort] = useState("recent");
  const [closed, setClosed] = useState(false);
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");
  const [page, setPage] = useState(1);
  const [cfps, setCfps] = useState([]);
  const [meta, setMeta] = useState({ total:0, pages:1 });
  const [loading, setLoading] = useState(true);
  const debRef = useRef(null);

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => { setDeb(search); setPage(1); }, 350);
    return () => clearTimeout(debRef.current);
  }, [search]);

  useEffect(() => { setPage(1); }, [activeSlugs, type, sort, closed, debSearch, deadlineFrom, deadlineTo]);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ sort, page, page_size:15, include_closed:closed });
    if (debSearch) p.set("q", debSearch);
    if (type !== "All") p.set("listing_type", type);
    if (deadlineFrom) p.set("deadline_from", deadlineFrom);
    if (deadlineTo) p.set("deadline_to", deadlineTo);

    const fetcher = activeSlugs.length
      ? Promise.all(activeSlugs.map(slug => get(`/api/cfps?${p}&category=${slug}`)))
          .then(results => {
            const seen = new Set(); const merged = [];
            for (const r of results) for (const c of (r.results||[])) if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
            return { results:merged, total:merged.length, pages:1 };
          })
      : get(`/api/cfps?${p}`);

    fetcher.then(d => { setCfps(d.results||[]); setMeta({ total:d.total||0, pages:d.pages||1 }); }).catch(() => setCfps([])).finally(() => setLoading(false));
  }, [debSearch, activeSlugs, type, sort, closed, page, deadlineFrom, deadlineTo]);

  const toggleSlug = s => setSlug(p => p.includes(s) ? p.filter(x=>x!==s) : [...p,s]);
  const sbCats = categories.slice(0, 22);
  const selStyle = { background:"#011F5B", border:"1px solid #1F3E72", borderRadius:"3px", padding:"0.65rem 2rem 0.65rem 0.8rem", fontFamily:"'DM Sans',sans-serif", fontSize:"0.85rem", color:"#C4B9A8", outline:"none", cursor:"pointer", appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B6050' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 0.7rem center" };

  // NEW — dynamic section heading: names the single active category when
  // there is exactly one, otherwise reads as the real site's "all recent
  // posts" page — everything, unfiltered, across every category.
  const headingText = activeSlugs.length === 1
    ? (categories.find(c => c.slug === activeSlugs[0])?.name || "All Recent Posts")
    : "All Recent Posts";

  return (
    <>
      <div style={{ background:"#14315F", borderBottom:"1px solid #1F3E72", padding:"1.6rem 2rem" }}>
        <div style={{ maxWidth:"1200px", margin:"0 auto", display:"flex", gap:"0.75rem", flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ flex:1, minWidth:"240px", position:"relative" }}>
            <span style={{ position:"absolute", left:"0.8rem", top:"50%", transform:"translateY(-50%)", color:"#6B6050", fontSize:"1rem", pointerEvents:"none" }}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search titles, organizations, or keywords…"
              style={{ width:"100%", background:"#011F5B", border:"1px solid #1F3E72", borderRadius:"3px", padding:"0.65rem 0.8rem 0.65rem 2.2rem", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", color:"#FEFCF8", outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="#990000"} onBlur={e=>e.target.style.borderColor="#1F3E72"}/>
          </div>
          <select style={selStyle} value={type} onChange={e=>setType(e.target.value)}>{["All","Conference","Journal","Announcement"].map(o=><option key={o}>{o}</option>)}</select>
          <label style={{ display:"flex", alignItems:"center", gap:"0.4rem", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", color:"#9A8F80", cursor:"pointer", userSelect:"none" }}>
            <input type="checkbox" checked={closed} onChange={e=>setClosed(e.target.checked)} style={{ accentColor:"#990000" }}/>Include past
          </label>
        </div>
      </div>

      <main style={{ maxWidth:"1200px", margin:"0 auto", padding:"2rem", display:"grid", gridTemplateColumns:"220px 1fr", gap:"2rem" }}>
        <aside>
          <div style={{ background:"#FEFCF8", border:"1px solid #E8E2D9", borderRadius:"4px", padding:"1.2rem", position:"sticky", top:"80px" }}>

            <div style={{ marginBottom:"1.1rem", paddingBottom:"1.1rem", borderBottom:"1px solid #E8E2D9" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.6rem" }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem", letterSpacing:"0.08em", textTransform:"uppercase", color:"#9A8F80", fontWeight:500 }}>Deadline Range</span>
                {(deadlineFrom || deadlineTo) && (
                  <button onClick={()=>{setDeadlineFrom("");setDeadlineTo("");}} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem", color:"#990000", background:"none", border:"none", cursor:"pointer", padding:0 }}>Clear</button>
                )}
              </div>
              <div style={{ display:"grid", gap:"0.5rem" }}>
                <div>
                  <label style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.68rem", color:"#9A8F80", marginBottom:"0.2rem", display:"block" }}>From</label>
                  <input type="date" value={deadlineFrom} onChange={e=>setDeadlineFrom(e.target.value)}
                    style={{ width:"100%", fontFamily:"'DM Sans',sans-serif", fontSize:"0.8rem", color:"#011F5B", background:"#FEFCF8", border:"1px solid #D8D0C4", borderRadius:"3px", padding:"0.4rem 0.5rem", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.68rem", color:"#9A8F80", marginBottom:"0.2rem", display:"block" }}>To</label>
                  <input type="date" value={deadlineTo} onChange={e=>setDeadlineTo(e.target.value)}
                    style={{ width:"100%", fontFamily:"'DM Sans',sans-serif", fontSize:"0.8rem", color:"#011F5B", background:"#FEFCF8", border:"1px solid #D8D0C4", borderRadius:"3px", padding:"0.4rem 0.5rem", outline:"none", boxSizing:"border-box" }} />
                </div>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.9rem" }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem", letterSpacing:"0.08em", textTransform:"uppercase", color:"#9A8F80", fontWeight:500 }}>Filter by Category</span>
              {activeSlugs.length>0 && <button onClick={()=>setSlug([])} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.7rem", color:"#990000", background:"none", border:"none", cursor:"pointer" }}>Clear</button>}
            </div>
            {sbCats.map(c => (
              <label key={c.slug} style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.3rem 0", cursor:"pointer" }}>
                <input type="checkbox" checked={activeSlugs.includes(c.slug)} onChange={()=>toggleSlug(c.slug)} style={{ accentColor:"#990000", width:"13px", height:"13px" }}/>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.79rem", color:activeSlugs.includes(c.slug)?"#011F5B":"#5A4F40", fontWeight:activeSlugs.includes(c.slug)?500:400, lineHeight:1.3 }}>{c.name}</span>
              </label>
            ))}
            {categories.length > sbCats.length && (
              <div style={{ borderTop:"1px solid #E8E2D9", marginTop:"0.7rem", paddingTop:"0.7rem" }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.73rem", color:"#9A8F80", fontStyle:"italic" }}>+ {categories.length-sbCats.length} more on submit form</span>
              </div>
            )}
          </div>
        </aside>

        <div>
          {/* NEW — page masthead: dynamic heading + prominent sort toggle */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:"1rem", marginBottom:"0.5rem" }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.55rem", fontWeight:700, color:"#011F5B", lineHeight:1.2 }}>
              {headingText}
            </h2>
            <div style={{ display:"flex", background:"#F0EBE3", borderRadius:"20px", padding:"3px", flexShrink:0 }}>
              {[["recent","Most Recent"],["deadline","Soonest Deadline"]].map(([key,label]) => (
                <button key={key} onClick={()=>setSort(key)}
                  style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:500, letterSpacing:"0.01em", padding:"0.45rem 0.9rem", borderRadius:"17px", border:"none", cursor:"pointer", transition:"all 0.15s", background:sort===key?"#011F5B":"transparent", color:sort===key?"#FEFCF8":"#7A6F60" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.2rem" }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", color:"#9A8F80" }}>
              {loading ? "Loading…" : `${meta.total} listing${meta.total!==1?"s":""}${debSearch?` for "${debSearch}"`:""}${activeSlugs.length?` · ${activeSlugs.length} category filter${activeSlugs.length>1?"s":""}`:""}${(deadlineFrom||deadlineTo)?` · deadline ${deadlineFrom||"any"}–${deadlineTo||"any"}`:""}`}
            </span>
            <button onClick={onSubmit} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", fontWeight:500, color:"#FEFCF8", background:"#990000", border:"none", borderRadius:"3px", padding:"0.5rem 1rem", cursor:"pointer", letterSpacing:"0.03em", transition:"background 0.15s" }}
              onMouseEnter={e=>e.currentTarget.style.background="#7A0000"} onMouseLeave={e=>e.currentTarget.style.background="#990000"}>
              + Submit CFP
            </button>
          </div>

          {loading ? [1,2,3].map(i=><CardSkeleton key={i}/>)
          : cfps.length===0 ? (
            <div style={{ background:"#FEFCF8", border:"1px solid #E8E2D9", borderRadius:"4px", padding:"3rem", textAlign:"center" }}>
              <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#7A6F60", marginBottom:"0.5rem" }}>No listings match your filters.</p>
              <button onClick={()=>{setSearch("");setSlug([]);setType("All");setDeadlineFrom("");setDeadlineTo("");}} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.83rem", color:"#990000", background:"none", border:"none", cursor:"pointer" }}>Clear all filters</button>
            </div>
          ) : (
            <>
              {cfps.map((cfp,i) => <div key={cfp.id} style={{ animation:`fadeUp 0.25s ease ${i*0.04}s both` }}><CFPCard cfp={cfp} onClick={()=>onSelect(cfp.id)}/></div>)}
              {meta.pages>1 && (
                <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:"0.75rem", marginTop:"1.5rem", fontFamily:"'DM Sans',sans-serif", fontSize:"0.85rem", color:"#7A6F60" }}>
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ background:"none", border:"1px solid #D8D0C4", borderRadius:"3px", padding:"0.4rem 0.85rem", cursor:page===1?"not-allowed":"pointer", opacity:page===1?0.4:1, color:"#5A4F40" }}>← Prev</button>
                  <span>Page {page} of {meta.pages}</span>
                  <button onClick={()=>setPage(p=>Math.min(meta.pages,p+1))} disabled={page===meta.pages} style={{ background:"none", border:"1px solid #D8D0C4", borderRadius:"3px", padding:"0.4rem 0.85rem", cursor:page===meta.pages?"not-allowed":"pointer", opacity:page===meta.pages?0.4:1, color:"#5A4F40" }}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Root App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("browse");
  const [selectedId, setSelId] = useState(null);
  const [manageId, setManageId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tokenModal, setModal] = useState(null);
  const { toasts, toast } = useToasts();

  const [catsLoading, setCatsLoading] = useState(true);
  const [slowStart, setSlowStart] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadCategories = useCallback(() => {
    setCatsLoading(true);
    setLoadError(false);
    setSlowStart(false);
    const slowTimer = setTimeout(() => setSlowStart(true), 3500);
    get("/api/cfps/categories")
      .then(data => { setCategories(data); setCatsLoading(false); })
      .catch(() => { setLoadError(true); setCatsLoading(false); })
      .finally(() => clearTimeout(slowTimer));
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  if (loadError) return <LoadErrorScreen onRetry={loadCategories} />;
  if (catsLoading) return <ColdStartScreen slow={slowStart} />;

  const nav = (v) => { setView(v); window.scrollTo(0, 0); };

  return (
    <div style={{ minHeight:"100vh", background:"#F5F1EB" }}>
      <style>{GOOGLE_FONTS + GLOBAL_CSS}</style>

      <header style={{ background:"#011F5B", borderBottom:"3px solid #990000", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"0 2rem", display:"flex", alignItems:"center", justifyContent:"space-between", height:"64px" }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:"0.6rem", cursor:"pointer" }} onClick={() => nav("browse")}>
            <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.4rem", fontWeight:700, color:"#FEFCF8", letterSpacing:"-0.01em" }}>CFP Commons</span>
            <span style={{ fontFamily:"'Lora',serif", fontSize:"0.78rem", fontStyle:"italic", color:"#990000" }}>Calls for Papers & Announcements</span>
          </div>
          <nav style={{ display:"flex", gap:"0.1rem", alignItems:"center" }}>
            {[["Browse","browse"],["Submit CFP","submit"],["Manage","manage"]].map(([label,v]) => (
              <button key={v} onClick={() => nav(v)} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.83rem", fontWeight:view===v?600:400, color:view===v?"#990000":"#C4B9A8", background:"none", border:"none", cursor:"pointer", padding:"0.4rem 0.85rem", borderRadius:"3px", letterSpacing:"0.03em" }}>
                {label}
              </button>
            ))}
            <a href="/rss/all" target="_blank" style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.75rem", color:"#6B6050", textDecoration:"none", padding:"0.4rem 0.6rem", letterSpacing:"0.05em" }}
              onMouseEnter={e=>e.currentTarget.style.color="#990000"} onMouseLeave={e=>e.currentTarget.style.color="#6B6050"}>RSS</a>
          </nav>
        </div>
      </header>

      {view==="browse" && <BrowseView categories={categories} onSelect={id=>{setSelId(id);nav("detail");}} onSubmit={()=>nav("submit")}/>}
      {view==="detail" && (
        <main style={{ maxWidth:"1200px", margin:"0 auto", padding:"2rem" }}>
          <CFPDetail cfpId={selectedId} onBack={()=>nav("browse")} onManage={()=>{setManageId(selectedId);nav("manage");}}/>
        </main>
      )}
      {view==="submit" && (
        <main style={{ maxWidth:"1200px", margin:"0 auto", padding:"2rem" }}>
          <SubmitForm categories={categories} onBack={()=>nav("browse")} onSuccess={result=>{setModal({token:result.edit_token,cfpId:result.id,title:result.title});nav("browse");}}/>
        </main>
      )}
      {view==="manage" && (
        <main style={{ maxWidth:"1200px", margin:"0 auto", padding:"2rem" }}>
          <ManageView prefillId={manageId} categories={categories} onBack={()=>{setManageId(null);nav("browse");}} toast={toast}/>
        </main>
      )}

      {tokenModal && <TokenModal {...tokenModal} onClose={()=>setModal(null)}/>}
      <Toasts toasts={toasts}/>

      <footer style={{ background:"#011F5B", borderTop:"1px solid #1F3E72", marginTop:"4rem", padding:"1.5rem 2rem", textAlign:"center" }}>
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", color:"#6B6050" }}>
          CFP Commons · A community resource for humanities scholars ·{" "}
          <a href="/rss/all" style={{ color:"#990000", textDecoration:"none" }}>RSS</a>
          {" · "}<span style={{ color:"#1F3E72" }}>Redesign prototype</span>
        </p>
      </footer>
    </div>
  );
}
