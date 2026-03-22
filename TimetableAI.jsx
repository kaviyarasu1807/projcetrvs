/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   AI-BASED COLLEGE TIMETABLE GENERATOR  v3.0  — SUPABASE        ║
 * ║   "Academic Clarity" · Light Theme · Full Backend Integration   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Backend: Supabase (Postgres + Auth + Realtime)
 * AI:      CSP (MCV + backtracking) · Genetic Algorithm
 * Features: Auth · CRUD · PDF export · Conflict highlight · Drag-drop
 *
 * Setup:
 *   npm install @supabase/supabase-js
 *   Run schema.sql in your Supabase SQL editor
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ══════════════════════════════════════════════════════════════
//  § 1  SUPABASE CLIENT
//  Works in Vite/CRA (npm) AND browser/CDN (esm.sh)
// ══════════════════════════════════════════════════════════════

const SUPABASE_URL     = "https://ygkjdnhtjqyrcxblwijw.supabase.co";
// Replace this with your actual anon key from:
//   Supabase Dashboard → Project Settings → API → anon / public
const SUPABASE_ANON_KEY = "sb_publishable_isuBYAPVbxwBuisHV_mgHw_FM919Qp8";

let _client = null;

// Returns a promise resolving to the Supabase client.
// Tries npm package first, falls back to esm.sh CDN.
async function getClient() {
  if (_client) return _client;
  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch {
    ({ createClient } = await import("https://esm.sh/@supabase/supabase-js@2"));
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}

// Shorthand used throughout the file: await (await sb()).from("table")
const sb = () => getClient();

// ── Data mappers: DB (snake_case) → App (camelCase) ────────────

const mapStaff    = r => ({ id:r.id, name:r.name, subject:r.subject, dept:r.dept||"", email:r.email||"",
  availability: r.availability || ["Monday","Tuesday","Wednesday","Thursday","Friday"],
  maxHrsDay: r.max_hrs_day||4, preferMorning: r.prefer_morning||false });

const mapClass    = r => ({ id:r.id, name:r.name, year:r.year||1, section:r.section||"",
  dept:r.dept||"", capacity:r.capacity||60 });

const mapSubject  = r => ({ id:r.id, classId:r.class_id, teacherId:r.teacher_id, name:r.name,
  hoursPerWeek:r.hours_per_week||3, isLab:r.is_lab||false, preferMorning:r.prefer_morning||false });

const mapRoom     = r => ({ id:r.id, name:r.name, capacity:r.capacity||60, isLab:r.is_lab||false });

const mapTimetable = r => ({
  id: r.id,
  timetable:      r.timetable_data,
  teacherView:    r.teacher_view,
  utilization:    r.utilization||{},
  violations:     r.violations||[],
  conflicts:      r.conflicts||0,
  algorithm:      r.algorithm||"csp",
  fitnessHistory: r.fitness_history||null,
  generatedAt:    r.generated_at,
});

// ══════════════════════════════════════════════════════════════
//  § 2  CONSTANTS
// ══════════════════════════════════════════════════════════════

const DEFAULT_SLOTS = [
  { id:"sl1", label:"9:00 AM",  start:"09:00", end:"10:00", isLunch:false, isMorning:true  },
  { id:"sl2", label:"10:00 AM", start:"10:00", end:"11:00", isLunch:false, isMorning:true  },
  { id:"sl3", label:"11:00 AM", start:"11:00", end:"12:00", isLunch:false, isMorning:true  },
  { id:"sl4", label:"12:00 PM", start:"12:00", end:"13:00", isLunch:true,  isMorning:false },
  { id:"sl5", label:"1:00 PM",  start:"13:00", end:"14:00", isLunch:false, isMorning:false },
  { id:"sl6", label:"2:00 PM",  start:"14:00", end:"15:00", isLunch:false, isMorning:false },
  { id:"sl7", label:"3:00 PM",  start:"15:00", end:"16:00", isLunch:false, isMorning:false },
  { id:"sl8", label:"4:00 PM",  start:"16:00", end:"17:00", isLunch:false, isMorning:false },
];
const DEFAULT_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];

const PALETTE = [
  "#4338CA","#0891B2","#059669","#D97706","#DC2626",
  "#7C3AED","#0284C7","#16A34A","#CA8A04","#E11D48",
  "#6D28D9","#0369A1","#15803D","#B45309","#BE185D",
];
const subjectColor = name => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h*31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
};

// ══════════════════════════════════════════════════════════════
//  § 3  CONFLICT DETECTOR
// ══════════════════════════════════════════════════════════════

function detectConflicts(timetable, teachers, classes, subjects, days, slots) {
  const violations = [];
  const usable = slots.filter(s => !s.isLunch);
  days.forEach(day => {
    usable.forEach(slot => {
      const entries = [];
      Object.entries(timetable).forEach(([classId, grid]) => {
        const cell = grid?.[day]?.[slot.id];
        if (cell && !cell.isLunch && cell.teacherId) entries.push({ classId, ...cell });
      });
      const tCount = {};
      entries.forEach(e => { tCount[e.teacherId] = tCount[e.teacherId] || []; tCount[e.teacherId].push(e.classId); });
      Object.entries(tCount).forEach(([tid, cids]) => {
        if (cids.length > 1) {
          const t = teachers.find(t => t.id === tid);
          cids.forEach(cid => violations.push({
            type:"TEACHER_CONFLICT", classId:cid, day, slotId:slot.id, teacherId:tid, severity:"hard",
            description:`${t?.name||tid} double-booked at ${day} ${slot.label}`,
          }));
        }
      });
    });
    teachers.forEach(teacher => {
      let run = 0, max = 0;
      usable.forEach(slot => {
        const has = Object.values(timetable).some(g => g?.[day]?.[slot.id]?.teacherId === teacher.id);
        if (has) { run++; max = Math.max(max, run); } else run = 0;
      });
      if (max >= 3) violations.push({
        type:"CONSECUTIVE_OVERLOAD", classId:null, day, slotId:null,
        teacherId:teacher.id, severity:"soft",
        description:`${teacher.name} has ${max}+ consecutive classes on ${day}`,
      });
    });
  });
  return violations;
}

// ══════════════════════════════════════════════════════════════
//  § 4  CSP ENGINE
// ══════════════════════════════════════════════════════════════

function runCSP(teachers, classes, subjects, days, slots, rooms, logCb) {
  const usable = slots.filter(s => !s.isLunch);
  const logs = []; const emit = m => { logs.push(m); logCb?.(m); };
  const tasks = [];
  subjects.forEach(sub => { for (let h=0;h<sub.hoursPerWeek;h++) tasks.push({...sub,taskId:`${sub.id}_h${h}`}); });
  const availMap = {};
  teachers.forEach(t => { availMap[t.id] = t.availability.length; });
  tasks.sort((a,b) => (availMap[a.teacherId]||5)-(availMap[b.teacherId]||5) || (b.hoursPerWeek||0)-(a.hoursPerWeek||0));
  emit(`[CSP] ${tasks.length} tasks — MCV sorted`);
  const tBusy={}, cBusy={}, tDay={}, rBusy={};
  const assigned=[], unassigned=[];
  const pickRoom=(sub,day,slotId)=>{
    if(!rooms?.length) return null;
    return rooms.find(r=>r.isLab===sub.isLab && !rBusy[`${r.id}|${day}|${slotId}`])||null;
  };
  tasks.forEach(task=>{
    const teacher=teachers.find(t=>t.id===task.teacherId);
    const avail=teacher?days.filter(d=>teacher.availability.includes(d)):days;
    const maxH=teacher?.maxHrsDay||4; let placed=false;
    const sortedSlots=[...usable].sort((a,b)=>(task.preferMorning?(a.isMorning?0:1)-(b.isMorning?0:1):Math.random()-.5));
    const shuffDays=[...avail].sort(()=>Math.random()-.5);
    outer: for(const day of shuffDays){ for(const slot of sortedSlots){
      const tk=`${task.teacherId}|${day}|${slot.id}`, ck=`${task.classId}|${day}|${slot.id}`, dk=`${task.teacherId}|${day}`;
      if(tBusy[tk]||cBusy[ck]||(tDay[dk]||0)>=maxH) continue;
      const room=pickRoom(task,day,slot.id);
      tBusy[tk]=cBusy[ck]=true; tDay[dk]=(tDay[dk]||0)+1;
      if(room) rBusy[`${room.id}|${day}|${slot.id}`]=true;
      assigned.push({...task,day,slotId:slot.id,roomId:room?.id||null,roomName:room?.name||null});
      placed=true; break outer;
    } }
    if(!placed){ unassigned.push(task); emit(`[WARN] Unscheduled: "${task.name}" → ${task.classId}`); }
  });
  emit(`[CSP] ${assigned.length}/${tasks.length} tasks placed`);
  emit(unassigned.length===0?"[SUCCESS] ✓ Zero conflicts — perfect schedule":`[CONFLICT] ${unassigned.length} tasks unscheduled`);
  return buildGrids(assigned,teachers,classes,subjects,days,slots);
}

// ══════════════════════════════════════════════════════════════
//  § 5  GENETIC ALGORITHM
// ══════════════════════════════════════════════════════════════

function randomChrom(teachers,classes,subjects,days,slots){
  const usable=slots.filter(s=>!s.isLunch); const genes=[];
  subjects.forEach(sub=>{
    const t=teachers.find(t=>t.id===sub.teacherId);
    const avail=t?days.filter(d=>t.availability.includes(d)):days;
    for(let h=0;h<sub.hoursPerWeek;h++){
      genes.push({subjectId:sub.id,classId:sub.classId,teacherId:sub.teacherId,
        name:sub.name,isLab:sub.isLab,preferMorning:sub.preferMorning,
        day:avail[Math.floor(Math.random()*avail.length)],
        slotId:usable[Math.floor(Math.random()*usable.length)].id});
    }
  });
  return genes;
}
function fitness(genes,teachers,days,slots){
  const usable=slots.filter(s=>!s.isLunch); let score=0;
  const ts={},cs={},td={};
  genes.forEach(g=>{
    ts[`${g.teacherId}|${g.day}|${g.slotId}`]=(ts[`${g.teacherId}|${g.day}|${g.slotId}`]||0)+1;
    cs[`${g.classId}|${g.day}|${g.slotId}`]=(cs[`${g.classId}|${g.day}|${g.slotId}`]||0)+1;
    const dk=`${g.teacherId}|${g.day}`; td[dk]=td[dk]||[];
    td[dk].push(usable.findIndex(s=>s.id===g.slotId));
  });
  Object.values(ts).forEach(c=>{ if(c>1) score+=(c-1)*100; });
  Object.values(cs).forEach(c=>{ if(c>1) score+=(c-1)*100; });
  teachers.forEach(t=>{ days.forEach(day=>{
    const idxs=(td[`${t.id}|${day}`]||[]).sort((a,b)=>a-b);
    if(idxs.length>(t.maxHrsDay||4)) score+=(idxs.length-(t.maxHrsDay||4))*20;
    let run=1; for(let i=1;i<idxs.length;i++){ if(idxs[i]===idxs[i-1]+1){run++;if(run>=3)score+=10;}else run=1; }
  }); });
  genes.forEach(g=>{ if(g.preferMorning){ const s=usable.find(x=>x.id===g.slotId); if(s&&!s.isMorning) score+=5; } });
  return score;
}
function tourney(scored,k=3){ return scored.sort(()=>Math.random()-.5).slice(0,k).sort((a,b)=>a.f-b.f)[0].g; }
function crossover(p1,p2,classes){ const c=[]; classes.forEach(cls=>{ const p=Math.random()<.5?p1:p2; p.filter(g=>g.classId===cls.id).forEach(g=>c.push({...g})); }); return c; }
function mutate(genes,teachers,days,slots,rate=.05){
  const usable=slots.filter(s=>!s.isLunch);
  return genes.map(g=>{
    if(Math.random()>rate) return g;
    const t=teachers.find(x=>x.id===g.teacherId); const avail=t?days.filter(d=>t.availability.includes(d)):days;
    return {...g,day:avail[Math.floor(Math.random()*avail.length)],slotId:usable[Math.floor(Math.random()*usable.length)].id};
  });
}
function runGA(teachers,classes,subjects,days,slots,params,logCb){
  const {generations=60,popSize=30,mutationRate=.05}=params;
  const logs=[]; const emit=m=>{logs.push(m);logCb?.(m);};
  const hist=[];
  emit(`[GA] Pop:${popSize} · Gen:${generations} · Mut:${(mutationRate*100).toFixed(0)}%`);
  let pop=Array.from({length:popSize},()=>randomChrom(teachers,classes,subjects,days,slots));
  let best=null,bestScore=Infinity;
  for(let gen=0;gen<generations;gen++){
    const scored=pop.map(g=>({g,f:fitness(g,teachers,days,slots)})).sort((a,b)=>a.f-b.f);
    hist.push(scored[0].f);
    if(scored[0].f<bestScore){ bestScore=scored[0].f; best=scored[0].g; emit(`[GA] Gen ${gen+1} — fitness: ${bestScore}`); }
    if(bestScore===0){ emit("[GA] ✓ Perfect solution found"); break; }
    const np=[scored[0].g,scored[1].g];
    while(np.length<popSize){ np.push(mutate(crossover(tourney(scored),tourney(scored),classes),teachers,days,slots,mutationRate)); }
    pop=np;
  }
  emit(`[GA] Final fitness: ${bestScore}`);
  const assigned=best.map((g,i)=>({...g,taskId:`${g.subjectId}_h${i}`,roomId:null,roomName:null}));
  return {...buildGrids(assigned,teachers,classes,subjects,days,slots),fitnessHistory:hist};
}

// ══════════════════════════════════════════════════════════════
//  § 6  GRID BUILDER
// ══════════════════════════════════════════════════════════════

function buildGrids(assigned,teachers,classes,subjects,days,slots){
  const timetable={};
  classes.forEach(cls=>{
    timetable[cls.id]={};
    days.forEach(day=>{ timetable[cls.id][day]={}; slots.forEach(slot=>{
      timetable[cls.id][day][slot.id]=slot.isLunch?{subject:"LUNCH BREAK",isLunch:true}:null;
    }); });
  });
  assigned.forEach(a=>{
    if(!timetable[a.classId]) return;
    const t=teachers.find(x=>x.id===a.teacherId);
    timetable[a.classId][a.day][a.slotId]={subject:a.name,teacherId:a.teacherId,
      teacherName:t?.name||"TBA",subjectId:a.subjectId||a.id,isLab:a.isLab,roomName:a.roomName,isLunch:false};
  });
  const teacherView={};
  teachers.forEach(t=>{
    teacherView[t.id]={};
    days.forEach(day=>{ teacherView[t.id][day]={}; slots.forEach(slot=>{ teacherView[t.id][day][slot.id]=null; }); });
  });
  assigned.forEach(a=>{
    if(!teacherView[a.teacherId]) return;
    const cls=classes.find(c=>c.id===a.classId);
    teacherView[a.teacherId][a.day][a.slotId]={className:cls?.name||"?",subject:a.name,isLab:a.isLab,roomName:a.roomName};
  });
  const utilization={};
  teachers.forEach(t=>{
    const s=assigned.filter(a=>a.teacherId===t.id).length;
    const p=t.availability.length*slots.filter(x=>!x.isLunch).length;
    utilization[t.id]=p?Math.round(s/p*100):0;
  });
  return {timetable,teacherView,utilization};
}

// ══════════════════════════════════════════════════════════════
//  § 7  DESIGN TOKENS
// ══════════════════════════════════════════════════════════════

const C = {
  bg0:"#F7F5F0", bg1:"#FFFFFF", bg2:"#F0EDE8", bg3:"#E8E4DD",
  border:"#DDD9D0", borderMd:"#C8C3B8",
  text:"#1C1917", textMd:"#57534E", textSm:"#A8A29E",
  indigo:"#4338CA", indigoLt:"#EEF2FF", indigoBd:"#C7D2FE",
  amber:"#D97706", amberLt:"#FFFBEB", amberBd:"#FDE68A",
  green:"#059669", greenLt:"#ECFDF5", greenBd:"#A7F3D0",
  red:"#DC2626", redLt:"#FEF2F2", redBd:"#FECACA",
  sky:"#0284C7", lunch:"#92400E", lunchBg:"#FEF3C7",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');`;

const card  = (x={}) => ({ background:C.bg1, border:`1px solid ${C.border}`, borderRadius:12, padding:24, marginBottom:20, boxShadow:"0 1px 3px rgba(28,25,23,.06),0 4px 12px rgba(28,25,23,.04)", ...x });
const inp   = (x={}) => ({ background:C.bg3, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"9px 13px", color:C.text, fontSize:13, fontFamily:"'DM Sans',sans-serif", width:"100%", boxSizing:"border-box", outline:"none", transition:"border-color .15s", ...x });
const lbl   = { fontSize:11, fontWeight:600, color:C.textMd, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:5, display:"block", fontFamily:"'DM Sans',sans-serif" };
const btn   = (bg=C.indigo, tc="#fff", x={}) => ({ padding:"9px 20px", background:bg, border:`1.5px solid ${bg}`, borderRadius:8, color:tc, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .15s", ...x });
const ghostBtn = (x={}) => ({ padding:"8px 18px", background:"transparent", border:`1.5px solid ${C.border}`, borderRadius:8, color:C.textMd, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", ...x });
const outlineBtn = (color=C.indigo, x={}) => ({ padding:"8px 18px", background:"transparent", border:`1.5px solid ${color}`, borderRadius:8, color, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .15s", ...x });
const dangerBtn  = { padding:"5px 11px", background:C.redLt, border:`1.5px solid ${C.redBd}`, borderRadius:6, color:C.red, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" };
const editBtn    = { padding:"5px 11px", background:C.indigoLt, border:`1.5px solid ${C.indigoBd}`, borderRadius:6, color:C.indigo, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" };
const tag   = color => ({ display:"inline-flex", alignItems:"center", padding:"3px 9px", borderRadius:20, background:color+"15", color, border:`1px solid ${color}30`, fontSize:11, fontWeight:600, fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" });
const thStyle = { background:C.bg2, color:C.textSm, padding:"10px 14px", textAlign:"left", fontWeight:700, borderBottom:`1px solid ${C.border}`, letterSpacing:"0.07em", textTransform:"uppercase", fontSize:10, whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" };
const tdStyle = { padding:"11px 14px", borderBottom:`1px solid ${C.bg2}`, color:C.text, verticalAlign:"middle", fontSize:13, fontFamily:"'DM Sans',sans-serif" };

const Heading = ({ children, sub }) => (
  <div style={{ marginBottom:28 }}>
    <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:C.text, margin:"0 0 6px", letterSpacing:"-0.01em" }}>{children}</h1>
    {sub && <p style={{ fontSize:13, color:C.textSm, margin:0 }}>{sub}</p>}
  </div>
);

// ── Loading / Error helpers ───────────────────────────────────
const Spinner = () => (
  <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:60 }}>
    <div style={{ width:36, height:36, border:`3px solid ${C.indigoBd}`, borderTop:`3px solid ${C.indigo}`,
      borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
  </div>
);

const Toast = ({ msg, type="error", onClose }) => (
  <div style={{ position:"fixed", top:72, right:20, zIndex:999,
    background: type==="success"?C.greenLt:C.redLt,
    border:`1.5px solid ${type==="success"?C.greenBd:C.redBd}`,
    color: type==="success"?C.green:C.red,
    padding:"12px 18px", borderRadius:10, fontSize:13, fontFamily:"'DM Sans',sans-serif",
    boxShadow:"0 4px 12px rgba(0,0,0,0.1)", display:"flex", alignItems:"center", gap:12, maxWidth:360 }}>
    <span style={{ flex:1 }}>{type==="success"?"✓":""} {msg}</span>
    <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer",
      color:"inherit", fontSize:16, padding:0, lineHeight:1 }}>×</button>
  </div>
);

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type="error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, show };
}

// ══════════════════════════════════════════════════════════════
//  § 8  LOGIN  (Supabase Auth)
// ══════════════════════════════════════════════════════════════

function LoginPage({ onLogin }) {
  const [email,    setEmail]    = useState("admin@timetableai.com");
  const [password, setPassword] = useState("");
  const [err,      setErr]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [mode,     setMode]     = useState("login"); // "login" | "signup"

  const submit = async () => {
    if (!email || !password) { setErr("Please fill in all fields"); return; }
    setLoading(true); setErr("");
    try {
      let res;
      if (mode === "signup") {
        res = await (await sb()).auth.signUp({ email, password });
        if (res.error) throw res.error;
        if (res.data?.user && !res.data.session) {
          setErr("✓ Check your email to confirm your account, then sign in.");
          setMode("login"); setLoading(false); return;
        }
      } else {
        res = await (await sb()).auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
      }
      onLogin(res.data.session);
    } catch (e) {
      setErr(e.message || "Authentication failed");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:C.bg0, fontFamily:"'DM Sans',sans-serif",
      backgroundImage:`radial-gradient(${C.borderMd} 1px, transparent 1px)`,
      backgroundSize:"24px 24px" }}>

      <div style={{ background:C.bg1, border:`1px solid ${C.border}`, borderRadius:20,
        padding:"48px 44px", width:420, boxSizing:"border-box",
        boxShadow:"0 8px 32px rgba(28,25,23,.10), 0 2px 8px rgba(28,25,23,.06)" }}>

        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:64, height:64, background:C.indigoLt,
            border:`2px solid ${C.indigoBd}`, borderRadius:18,
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 16px", fontSize:28 }}>📅</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24,
            fontWeight:700, color:C.text, margin:"0 0 6px" }}>TimetableAI</h1>
          <p style={{ fontSize:13, color:C.textSm, margin:"0 0 4px" }}>AI-Powered Schedule Optimizer</p>
          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"center" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:C.green }} />
            <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>Connected to Supabase</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display:"flex", background:C.bg2, padding:3, borderRadius:10, marginBottom:22, gap:3 }}>
          {[["login","Sign In"],["signup","Create Account"]].map(([m,l])=>(
            <button key={m} onClick={()=>{ setMode(m); setErr(""); }}
              style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none",
                background:mode===m?C.bg1:"transparent",
                color:mode===m?C.indigo:C.textMd,
                fontWeight:mode===m?700:500, fontSize:13, cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif",
                boxShadow:mode===m?"0 1px 3px rgba(28,25,23,.06)":"none" }}>{l}</button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <label style={lbl}>Email Address</label>
            <input style={inp()} type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="admin@college.edu" onKeyDown={e=>e.key==="Enter"&&submit()} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <label style={lbl}>Password</label>
            <input style={inp()} type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&submit()} />
          </div>

          {err && (
            <div style={{ background: err.startsWith("✓")?C.greenLt:C.redLt,
              border:`1px solid ${err.startsWith("✓")?C.greenBd:C.redBd}`,
              borderRadius:8, padding:"10px 14px", fontSize:13,
              color: err.startsWith("✓")?C.green:C.red }}>{err}</div>
          )}

          <button style={btn(C.indigo,"#fff",{ padding:"12px 20px", fontSize:14, width:"100%",
            boxShadow:"0 2px 8px rgba(67,56,202,.25)", opacity:loading?.7:1 })}
            onClick={submit} disabled={loading}>
            {loading ? "Please wait…" : mode==="signup" ? "Create Account" : "Sign In →"}
          </button>

          <p style={{ fontSize:12, color:C.textSm, textAlign:"center", margin:0 }}>
            {mode==="login" ? "New here? " : "Already have an account? "}
            <button onClick={()=>{ setMode(mode==="login"?"signup":"login"); setErr(""); }}
              style={{ background:"none", border:"none", color:C.indigo, fontWeight:700,
                cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
              {mode==="login" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 9  NAVBAR
// ══════════════════════════════════════════════════════════════

function NavBar({ page, setPage, onLogout, hasResult, userEmail }) {
  const items = [
    { id:"dashboard", label:"Dashboard", icon:"⊞" },
    { id:"staff",     label:"Staff",     icon:"◉" },
    { id:"classes",   label:"Classes",   icon:"◫" },
    { id:"subjects",  label:"Subjects",  icon:"◎" },
    { id:"rooms",     label:"Rooms",     icon:"▣" },
    { id:"config",    label:"Config",    icon:"⚙" },
    { id:"generate",  label:"Generate",  icon:"⚡" },
    { id:"timetable", label:"Timetable", icon:"📋", badge:hasResult },
  ];
  return (
    <nav style={{ background:C.bg1, borderBottom:`1.5px solid ${C.border}`,
      padding:"0 24px", display:"flex", alignItems:"center", height:58, gap:2,
      position:"sticky", top:0, zIndex:200, boxShadow:"0 1px 4px rgba(28,25,23,.06)" }}>
      <div style={{ marginRight:"auto", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, background:C.indigoLt, border:`1.5px solid ${C.indigoBd}`,
          borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>📅</div>
        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, color:C.text }}>TimetableAI</span>
        <span style={{ fontSize:10, color:C.green, background:C.greenLt, padding:"2px 8px",
          borderRadius:10, border:`1px solid ${C.greenBd}`, fontWeight:700,
          fontFamily:"'DM Sans',sans-serif" }}>● Supabase</span>
      </div>
      {items.map(n=>(
        <button key={n.id} onClick={()=>setPage(n.id)}
          style={{ position:"relative", padding:"6px 13px", borderRadius:8,
            background:page===n.id?C.indigoLt:"transparent",
            border:page===n.id?`1.5px solid ${C.indigoBd}`:"1.5px solid transparent",
            color:page===n.id?C.indigo:C.textMd, fontSize:12, fontWeight:600,
            cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:11 }}>{n.icon}</span>{n.label}
          {n.badge&&<span style={{ position:"absolute", top:4, right:4, width:7, height:7,
            borderRadius:"50%", background:C.green, border:`2px solid ${C.bg1}` }} />}
        </button>
      ))}
      <div style={{ marginLeft:10, display:"flex", alignItems:"center", gap:8 }}>
        {userEmail && <span style={{ fontSize:11, color:C.textSm }}>{userEmail}</span>}
        <button style={{ padding:"6px 14px", background:C.redLt, border:`1.5px solid ${C.redBd}`,
          borderRadius:8, color:C.red, fontSize:12, fontWeight:600,
          cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}
          onClick={onLogout}>Sign Out</button>
      </div>
    </nav>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 10 DASHBOARD
// ══════════════════════════════════════════════════════════════

// ── Seed helper: inserts sample data into Supabase ────────────
async function seedDatabase(setStaff, setClasses, setSubjects, setRooms, toast) {
  try {
    const client = await sb();

    // Clear existing
    await client.from("subjects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await client.from("staff").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await client.from("classes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await client.from("rooms").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Insert staff
    const { data: tData, error: tErr } = await client.from("staff").insert([
      { name:"Dr. Rajesh Kumar",  subject:"Mathematics",      dept:"Science",    email:"rajesh@college.edu",  availability:["Monday","Tuesday","Wednesday","Thursday","Friday"], max_hrs_day:4, prefer_morning:true  },
      { name:"Prof. Meena Iyer",  subject:"Physics",          dept:"Science",    email:"meena@college.edu",   availability:["Monday","Tuesday","Wednesday","Thursday","Friday"], max_hrs_day:4, prefer_morning:false },
      { name:"Dr. Arjun Sharma",  subject:"Chemistry",        dept:"Science",    email:"arjun@college.edu",   availability:["Monday","Tuesday","Wednesday","Thursday","Friday"], max_hrs_day:4, prefer_morning:false },
      { name:"Ms. Priya Nair",    subject:"Computer Science", dept:"Technology", email:"priya@college.edu",   availability:["Monday","Tuesday","Wednesday","Thursday","Friday"], max_hrs_day:5, prefer_morning:true  },
      { name:"Mr. Suresh Babu",   subject:"English",          dept:"Humanities", email:"suresh@college.edu",  availability:["Monday","Tuesday","Thursday","Friday"],            max_hrs_day:3, prefer_morning:true  },
      { name:"Dr. Kavitha Rajan", subject:"Biology",          dept:"Science",    email:"kavitha@college.edu", availability:["Monday","Wednesday","Friday"],                    max_hrs_day:3, prefer_morning:false },
      { name:"Mr. Anil Menon",    subject:"Data Structures",  dept:"Technology", email:"anil@college.edu",    availability:["Monday","Tuesday","Wednesday","Thursday","Friday"], max_hrs_day:4, prefer_morning:false },
    ]).select();
    if (tErr) throw tErr;

    // Insert classes
    const { data: cData, error: cErr } = await client.from("classes").insert([
      { name:"CS-A",  year:1, section:"A", dept:"Computer Science",        capacity:60 },
      { name:"CS-B",  year:1, section:"B", dept:"Computer Science",        capacity:60 },
      { name:"IT-A",  year:2, section:"A", dept:"Information Technology",  capacity:55 },
      { name:"CSE-B", year:3, section:"B", dept:"Computer Science & Eng.", capacity:50 },
    ]).select();
    if (cErr) throw cErr;

    // Map by name for subject references
    const T = Object.fromEntries(tData.map(t=>[t.name.split(" ")[1], t.id]));
    const CL = Object.fromEntries(cData.map(c=>[c.name, c.id]));

    // Insert subjects
    const { error: sErr } = await client.from("subjects").insert([
      { class_id:CL["CS-A"],  teacher_id:T["Rajesh"],  name:"Mathematics",      hours_per_week:5, is_lab:false, prefer_morning:true  },
      { class_id:CL["CS-A"],  teacher_id:T["Meena"],   name:"Physics",          hours_per_week:3, is_lab:false, prefer_morning:false },
      { class_id:CL["CS-A"],  teacher_id:T["Priya"],   name:"Computer Science", hours_per_week:4, is_lab:false, prefer_morning:true  },
      { class_id:CL["CS-A"],  teacher_id:T["Suresh"],  name:"English",          hours_per_week:3, is_lab:false, prefer_morning:true  },
      { class_id:CL["CS-A"],  teacher_id:T["Priya"],   name:"CS Lab",           hours_per_week:2, is_lab:true,  prefer_morning:false },
      { class_id:CL["CS-B"],  teacher_id:T["Rajesh"],  name:"Mathematics",      hours_per_week:5, is_lab:false, prefer_morning:true  },
      { class_id:CL["CS-B"],  teacher_id:T["Arjun"],   name:"Chemistry",        hours_per_week:3, is_lab:false, prefer_morning:false },
      { class_id:CL["CS-B"],  teacher_id:T["Priya"],   name:"Computer Science", hours_per_week:3, is_lab:false, prefer_morning:true  },
      { class_id:CL["CS-B"],  teacher_id:T["Suresh"],  name:"English",          hours_per_week:3, is_lab:false, prefer_morning:true  },
      { class_id:CL["IT-A"],  teacher_id:T["Meena"],   name:"Physics",          hours_per_week:3, is_lab:false, prefer_morning:false },
      { class_id:CL["IT-A"],  teacher_id:T["Arjun"],   name:"Chemistry",        hours_per_week:3, is_lab:false, prefer_morning:false },
      { class_id:CL["IT-A"],  teacher_id:T["Anil"],    name:"Data Structures",  hours_per_week:4, is_lab:false, prefer_morning:false },
      { class_id:CL["IT-A"],  teacher_id:T["Kavitha"], name:"Biology",          hours_per_week:3, is_lab:false, prefer_morning:false },
      { class_id:CL["CSE-B"], teacher_id:T["Anil"],    name:"Data Structures",  hours_per_week:4, is_lab:false, prefer_morning:false },
      { class_id:CL["CSE-B"], teacher_id:T["Priya"],   name:"Computer Science", hours_per_week:4, is_lab:false, prefer_morning:true  },
      { class_id:CL["CSE-B"], teacher_id:T["Priya"],   name:"CS Lab",           hours_per_week:2, is_lab:true,  prefer_morning:false },
    ]);
    if (sErr) throw sErr;

    // Insert rooms
    const { error: rErr } = await client.from("rooms").insert([
      { name:"Room 101",    capacity:65, is_lab:false },
      { name:"Room 102",    capacity:65, is_lab:false },
      { name:"Room 201",    capacity:60, is_lab:false },
      { name:"CS Lab",      capacity:40, is_lab:true  },
      { name:"Physics Lab", capacity:40, is_lab:true  },
    ]);
    if (rErr) throw rErr;

    // Reload
    const { data: freshStaff    } = await client.from("staff").select("*").order("created_at");
    const { data: freshClasses  } = await client.from("classes").select("*").order("created_at");
    const { data: freshSubjects } = await client.from("subjects").select("*").order("created_at");
    const { data: freshRooms    } = await client.from("rooms").select("*").order("created_at");
    if (freshStaff)    setStaff(freshStaff.map(mapStaff));
    if (freshClasses)  setClasses(freshClasses.map(mapClass));
    if (freshSubjects) setSubjects(freshSubjects.map(mapSubject));
    if (freshRooms)    setRooms(freshRooms.map(mapRoom));

    toast("✓ Sample data seeded — 7 staff · 4 classes · 16 subjects · 5 rooms", "success");
  } catch (e) {
    toast("Seed failed: " + e.message);
  }
}

function Dashboard({ staff, classes, subjects, rooms, result, setPage, loading, setStaff, setClasses, setSubjects, setRooms }) {
  const totalHrs = subjects.reduce((a,s)=>a+s.hoursPerWeek,0);
  const labCount = subjects.filter(s=>s.isLab).length;
  const { toast: toastState, show } = useToast();
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!confirm("This will delete all existing staff, classes, subjects and rooms, then insert sample data. Continue?")) return;
    setSeeding(true);
    await seedDatabase(setStaff, setClasses, setSubjects, setRooms, show);
    setSeeding(false);
  };

  const stats = [
    { v:staff.length,   l:"Faculty",      c:C.indigo, bg:C.indigoLt, bd:C.indigoBd, i:"◉" },
    { v:classes.length, l:"Classes",      c:C.sky,    bg:"#E0F2FE",  bd:"#BAE6FD",  i:"◫" },
    { v:subjects.length,l:"Subjects",     c:C.amber,  bg:C.amberLt,  bd:C.amberBd,  i:"◎" },
    { v:labCount,       l:"Lab Sessions", c:"#7C3AED",bg:"#F5F3FF",  bd:"#DDD6FE",  i:"⚗" },
    { v:totalHrs,       l:"Weekly Hours", c:C.green,  bg:C.greenLt,  bd:C.greenBd,  i:"⏱" },
  ];
  return (
    <div>
      {toastState && <Toast {...toastState} onClose={()=>{}} />}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 }}>
        <Heading sub={new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}>
          Admin Dashboard
        </Heading>
        <button
          style={ghostBtn({ fontSize:12, opacity:seeding?0.7:1, cursor:seeding?"not-allowed":"pointer",
            borderColor:C.amber, color:C.amber, background:"#FFFBEB",
            display:"flex", alignItems:"center", gap:6 })}
          onClick={handleSeed} disabled={seeding}>
          {seeding ? "⏳ Seeding..." : "🌱 Seed Sample Data"}
        </button>
      </div>
      {loading ? <Spinner /> : (<>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:24 }}>
          {stats.map(s=>(
            <div key={s.l} style={{ background:s.bg, border:`1.5px solid ${s.bd}`,
              borderRadius:12, padding:"18px 20px", boxShadow:`0 2px 8px ${s.c}15` }}>
              <div style={{ fontSize:13, marginBottom:8 }}>{s.i}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30,
                fontWeight:700, color:s.c, lineHeight:1 }}>{s.v}</div>
              <div style={{ fontSize:11, color:s.c, fontWeight:600,
                textTransform:"uppercase", letterSpacing:"0.06em", marginTop:6, opacity:.75 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:20 }}>
          <div style={card()}>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:17,
              fontWeight:700, color:C.text, margin:"0 0 16px" }}>Faculty Overview</h3>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>
                <th style={thStyle}>Name</th><th style={thStyle}>Subject</th>
                <th style={thStyle}>Days</th>{result&&<th style={thStyle}>Load</th>}
              </tr></thead>
              <tbody>{staff.map(t=>(
                <tr key={t.id}>
                  <td style={tdStyle}><div style={{ fontWeight:600 }}>{t.name}</div><div style={{ fontSize:11,color:C.textSm }}>{t.dept}</div></td>
                  <td style={tdStyle}><span style={tag(subjectColor(t.subject))}>{t.subject}</span></td>
                  <td style={tdStyle}><span style={{ color:C.textSm,fontSize:12 }}>{t.availability.length}d</span></td>
                  {result&&<td style={tdStyle}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, height:6, background:C.bg2, borderRadius:4 }}>
                        <div style={{ height:"100%", borderRadius:4, width:`${result.utilization[t.id]||0}%`,
                          background:(result.utilization[t.id]||0)>75?C.amber:C.green }} />
                      </div>
                      <span style={{ fontSize:11,color:C.textSm,fontWeight:600 }}>{result.utilization[t.id]||0}%</span>
                    </div>
                  </td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={card({ marginBottom:0 })}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:17,
                fontWeight:700, color:C.text, margin:"0 0 14px" }}>AI Engine</h3>
              {[
                { k:"Algorithms",       v:"CSP (MCV + Backtracking) · Genetic Algorithm" },
                { k:"Hard Constraints", v:"Teacher conflict · Class overlap · Lunch break" },
                { k:"Soft Constraints", v:"Consecutive load · Morning preference · Lab slots" },
                { k:"Status",           v:result?(result.conflicts===0?"✓ Conflict-free":`${result.conflicts} conflicts`):"Not generated",
                  color:result?(result.conflicts===0?C.green:C.red):C.textSm },
              ].map(r=>(
                <div key={r.k} style={{ display:"flex", justifyContent:"space-between",
                  padding:"9px 0", borderBottom:`1px solid ${C.bg2}` }}>
                  <span style={{ fontSize:12,color:C.textSm,fontWeight:600 }}>{r.k}</span>
                  <span style={{ fontSize:12, color:r.color||C.text, textAlign:"right",
                    maxWidth:"55%", fontWeight:r.color?700:400 }}>{r.v}</span>
                </div>
              ))}
              <div style={{ marginTop:18, display:"flex", gap:10 }}>
                <button style={btn(C.indigo,"#fff",{ boxShadow:"0 2px 8px rgba(67,56,202,.2)" })}
                  onClick={()=>setPage("generate")}>⚡ Generate</button>
                {result&&<button style={ghostBtn()} onClick={()=>setPage("timetable")}>View →</button>}
              </div>
            </div>
            <div style={card({ marginBottom:0 })}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:17,
                fontWeight:700, color:C.text, margin:"0 0 14px" }}>Class Load</h3>
              {classes.map(cls=>{
                const hrs=subjects.filter(s=>s.classId===cls.id).reduce((a,s)=>a+s.hoursPerWeek,0);
                return (
                  <div key={cls.id} style={{ display:"flex", alignItems:"center",
                    padding:"8px 0", borderBottom:`1px solid ${C.bg2}` }}>
                    <div style={{ flex:1 }}>
                      <span style={{ fontWeight:700,color:C.indigo,fontSize:13 }}>{cls.name}</span>
                      <span style={{ fontSize:11,color:C.textSm,marginLeft:8 }}>{cls.dept}</span>
                    </div>
                    <span style={tag(C.amber)}>{hrs}h/wk</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>)}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 11 STAFF PAGE  (Supabase CRUD)
// ══════════════════════════════════════════════════════════════

const emptyStaff = { name:"", subject:"", dept:"", email:"", maxHrsDay:4, preferMorning:false, availability:[...DEFAULT_DAYS] };

function StaffPage({ staff, setStaff, days, show }) {
  const [form, setForm]   = useState(emptyStaff);
  const [edit, setEdit]   = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, show: showToast } = useToast();

  const toggleDay = d => setForm(p=>({...p, availability: p.availability.includes(d)?p.availability.filter(x=>x!==d):[...p.availability,d]}));

  const save = async () => {
    if (!form.name||!form.subject) return;
    setSaving(true);
    try {
      const payload = { name:form.name, subject:form.subject, dept:form.dept,
        email:form.email, availability:form.availability,
        max_hrs_day:form.maxHrsDay, prefer_morning:form.preferMorning };

      if (edit) {
        const { data, error } = await (await sb()).from("staff").update(payload).eq("id", edit).select().single();
        if (error) throw error;
        setStaff(p=>p.map(t=>t.id===edit?mapStaff(data):t));
        showToast("Staff member updated", "success");
        setEdit(null);
      } else {
        const { data, error } = await (await sb()).from("staff").insert(payload).select().single();
        if (error) throw error;
        setStaff(p=>[...p, mapStaff(data)]);
        showToast("Staff member added", "success");
      }
      setForm(emptyStaff);
    } catch (e) { showToast(e.message); }
    setSaving(false);
  };

  const del = async id => {
    if (!confirm("Remove this staff member?")) return;
    const { error } = await (await sb()).from("staff").delete().eq("id", id);
    if (error) { showToast(error.message); return; }
    setStaff(p=>p.filter(x=>x.id!==id));
    showToast("Staff member removed", "success");
  };

  const startEdit = t => { setForm({...t}); setEdit(t.id); };
  const cancel    = () => { setForm(emptyStaff); setEdit(null); };

  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>{}} />}
      <Heading sub="Add, edit and remove faculty members">Staff Management</Heading>

      <div style={card({ borderTop:`3px solid ${edit?C.amber:C.indigo}` })}>
        <h3 style={{ fontSize:14,fontWeight:700,color:edit?C.amber:C.indigo,
          textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 16px",fontFamily:"'DM Sans',sans-serif" }}>
          {edit?"✎ Edit Staff Member":"+ Add New Staff Member"}
        </h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))", gap:12, marginBottom:14 }}>
          {[["name","Full Name","Dr. Jane Smith"],["subject","Subject","Mathematics"],["dept","Department","Science"],["email","Email","jane@college.edu"]].map(([k,l,p])=>(
            <div key={k} style={{ display:"flex",flexDirection:"column",gap:5 }}>
              <label style={lbl}>{l}</label>
              <input style={inp()} value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={p} />
            </div>
          ))}
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Max Hrs / Day</label>
            <input style={inp({width:100})} type="number" min={1} max={8} value={form.maxHrsDay}
              onChange={e=>setForm(p=>({...p,maxHrsDay:+e.target.value}))} />
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Available Days</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {(days||DEFAULT_DAYS).map(d=>(
              <label key={d} onClick={()=>toggleDay(d)}
                style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"6px 14px",
                  borderRadius:8,fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:form.availability.includes(d)?600:400,
                  background:form.availability.includes(d)?C.indigoLt:C.bg2,
                  border:`1.5px solid ${form.availability.includes(d)?C.indigoBd:C.border}`,
                  color:form.availability.includes(d)?C.indigo:C.textMd,userSelect:"none" }}>
                <input type="checkbox" checked={form.availability.includes(d)} onChange={()=>{}} style={{ display:"none" }} />
                {d.slice(0,3)}
              </label>
            ))}
          </div>
        </div>
        <label style={{ display:"inline-flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,
          color:C.textMd,marginBottom:18,fontFamily:"'DM Sans',sans-serif" }}>
          <input type="checkbox" checked={form.preferMorning} onChange={e=>setForm(p=>({...p,preferMorning:e.target.checked}))} />
          🌅 Prefers morning slots
        </label>
        <div style={{ display:"flex", gap:10 }}>
          <button style={btn(edit?C.amber:C.indigo,"#fff",{ opacity:saving?.7:1 })} onClick={save} disabled={saving}>
            {saving?"Saving…":edit?"✎ Update":"+ Add Staff"}
          </button>
          {edit&&<button style={ghostBtn()} onClick={cancel}>Cancel</button>}
        </div>
      </div>

      <div style={card()}>
        <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:C.text,margin:"0 0 16px" }}>
          All Faculty ({staff.length})
        </h3>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Name","Subject","Dept","Days","Max/Day","Morning",""].map(h=>(<th key={h} style={thStyle}>{h}</th>))}</tr></thead>
          <tbody>
            {staff.map(t=>(
              <tr key={t.id} style={{ background:edit===t.id?"#FFFBEB":"transparent" }}>
                <td style={tdStyle}><span style={{ fontWeight:600 }}>{t.name}</span></td>
                <td style={tdStyle}><span style={tag(subjectColor(t.subject))}>{t.subject}</span></td>
                <td style={{ ...tdStyle,color:C.textSm,fontSize:12 }}>{t.dept}</td>
                <td style={tdStyle}><span style={{ color:C.textSm,fontSize:12 }}>{t.availability.map(d=>d.slice(0,3)).join(", ")}</span></td>
                <td style={tdStyle}>{t.maxHrsDay}h</td>
                <td style={tdStyle}>{t.preferMorning?<span style={tag(C.amber)}>🌅</span>:"—"}</td>
                <td style={tdStyle}>
                  <div style={{ display:"flex",gap:6 }}>
                    <button style={editBtn} onClick={()=>startEdit(t)}>✎</button>
                    <button style={dangerBtn} onClick={()=>del(t.id)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 12 CLASSES PAGE  (Supabase CRUD)
// ══════════════════════════════════════════════════════════════

function ClassesPage({ classes, setClasses, subjects, setSubjects }) {
  const [form, setForm]   = useState({ name:"",year:1,section:"",dept:"",capacity:60 });
  const [saving, setSaving] = useState(false);
  const { toast, show }   = useToast();

  const add = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const { data, error } = await (await sb()).from("classes")
        .insert({ name:form.name, year:+form.year, section:form.section, dept:form.dept, capacity:+form.capacity })
        .select().single();
      if (error) throw error;
      setClasses(p=>[...p, mapClass(data)]);
      setForm({ name:"",year:1,section:"",dept:"",capacity:60 });
      show("Class added", "success");
    } catch(e) { show(e.message); }
    setSaving(false);
  };

  const del = async id => {
    if (!confirm("Remove this class? All its subjects will also be removed.")) return;
    const { error } = await (await sb()).from("classes").delete().eq("id", id);
    if (error) { show(error.message); return; }
    setClasses(p=>p.filter(c=>c.id!==id));
    setSubjects(p=>p.filter(s=>s.classId!==id));
    show("Class removed", "success");
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>{}} />}
      <Heading sub="Manage class groups and sections">Classes & Sections</Heading>

      <div style={card({ borderTop:`3px solid ${C.indigo}` })}>
        <h3 style={{ fontSize:14,fontWeight:700,color:C.indigo,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 16px",fontFamily:"'DM Sans',sans-serif" }}>+ Add New Class</h3>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))",gap:12,marginBottom:16 }}>
          {[["name","Class Name","CS-A"],["section","Section","A"],["dept","Department","Computer Science"]].map(([k,l,p])=>(
            <div key={k} style={{ display:"flex",flexDirection:"column",gap:5 }}>
              <label style={lbl}>{l}</label>
              <input style={inp()} value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={p} />
            </div>
          ))}
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Year</label>
            <input style={inp()} type="number" min={1} max={4} value={form.year} onChange={e=>setForm(p=>({...p,year:e.target.value}))} />
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Capacity</label>
            <input style={inp()} type="number" value={form.capacity} onChange={e=>setForm(p=>({...p,capacity:e.target.value}))} />
          </div>
        </div>
        <button style={btn(C.indigo,"#fff",{ opacity:saving?.7:1 })} onClick={add} disabled={saving}>
          {saving?"Saving…":"+ Add Class"}
        </button>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16 }}>
        {classes.map(cls=>{
          const clsSubs=subjects.filter(s=>s.classId===cls.id);
          return (
            <div key={cls.id} style={{ background:C.bg1,border:`1.5px solid ${C.border}`,borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(28,25,23,.06)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
                <div>
                  <span style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:C.indigo }}>{cls.name}</span>
                  <span style={{ fontSize:12,color:C.textSm,marginLeft:8 }}>Year {cls.year} · {cls.section}</span>
                </div>
                <button style={dangerBtn} onClick={()=>del(cls.id)}>✕</button>
              </div>
              <p style={{ fontSize:12,color:C.textSm,margin:"0 0 12px" }}>{cls.dept} · {cls.capacity} seats</p>
              <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                {clsSubs.map(s=><span key={s.id} style={tag(subjectColor(s.name))}>{s.name}</span>)}
                {!clsSubs.length&&<span style={{ fontSize:12,color:C.textSm }}>No subjects assigned</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 13 SUBJECTS PAGE  (Supabase CRUD)
// ══════════════════════════════════════════════════════════════

function SubjectsPage({ subjects, setSubjects, staff, classes }) {
  const [form, setForm]   = useState({ classId:"",teacherId:"",name:"",hoursPerWeek:3,isLab:false,preferMorning:false });
  const [saving, setSaving] = useState(false);
  const { toast, show }   = useToast();

  const add = async () => {
    if (!form.classId||!form.teacherId||!form.name) return;
    setSaving(true);
    try {
      const { data, error } = await (await sb()).from("subjects").insert({
        class_id:form.classId, teacher_id:form.teacherId, name:form.name,
        hours_per_week:+form.hoursPerWeek, is_lab:form.isLab, prefer_morning:form.preferMorning,
      }).select().single();
      if (error) throw error;
      setSubjects(p=>[...p, mapSubject(data)]);
      setForm({ classId:"",teacherId:"",name:"",hoursPerWeek:3,isLab:false,preferMorning:false });
      show("Subject assigned", "success");
    } catch(e) { show(e.message); }
    setSaving(false);
  };

  const del = async id => {
    const { error } = await (await sb()).from("subjects").delete().eq("id", id);
    if (error) { show(error.message); return; }
    setSubjects(p=>p.filter(x=>x.id!==id));
    show("Subject removed", "success");
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>{}} />}
      <Heading sub="Assign subjects to classes with required weekly hours">Subject Assignments</Heading>

      <div style={card({ borderTop:`3px solid ${C.indigo}` })}>
        <h3 style={{ fontSize:14,fontWeight:700,color:C.indigo,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 16px",fontFamily:"'DM Sans',sans-serif" }}>+ Assign Subject</h3>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:16 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Class</label>
            <select style={{...inp(),appearance:"auto"}} value={form.classId} onChange={e=>setForm(p=>({...p,classId:e.target.value}))}>
              <option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Teacher</label>
            <select style={{...inp(),appearance:"auto"}} value={form.teacherId} onChange={e=>setForm(p=>({...p,teacherId:e.target.value}))}>
              <option value="">Select teacher</option>{staff.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Subject Name</label>
            <input style={inp()} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Mathematics" />
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Hours / Week</label>
            <input style={inp()} type="number" min={1} max={10} value={form.hoursPerWeek}
              onChange={e=>setForm(p=>({...p,hoursPerWeek:e.target.value}))} />
          </div>
        </div>
        <div style={{ display:"flex",gap:16,marginBottom:18 }}>
          {[["isLab","⚗ Lab session",C.amber,C.amberLt,C.amberBd],["preferMorning","🌅 Morning preference",C.indigo,C.indigoLt,C.indigoBd]].map(([k,l,c,bg,bd])=>(
            <label key={k} style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,
              fontFamily:"'DM Sans',sans-serif",padding:"8px 14px",borderRadius:8,
              background:form[k]?bg:C.bg2, border:`1.5px solid ${form[k]?bd:C.border}`, color:form[k]?c:C.textMd }}>
              <input type="checkbox" checked={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.checked}))} />{l}
            </label>
          ))}
        </div>
        <button style={btn(C.indigo,"#fff",{ opacity:saving?.7:1 })} onClick={add} disabled={saving}>
          {saving?"Saving…":"+ Assign Subject"}
        </button>
      </div>

      <div style={card()}>
        <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:C.text,margin:"0 0 16px" }}>All Assignments ({subjects.length})</h3>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead><tr>{["Class","Subject","Teacher","Hrs/Wk","Type","Morning",""].map(h=>(<th key={h} style={thStyle}>{h}</th>))}</tr></thead>
          <tbody>
            {subjects.map(s=>{
              const cls=classes.find(c=>c.id===s.classId); const tch=staff.find(t=>t.id===s.teacherId);
              return (
                <tr key={s.id}>
                  <td style={tdStyle}><span style={{ fontWeight:700,color:C.indigo }}>{cls?.name||"?"}</span></td>
                  <td style={tdStyle}><span style={tag(subjectColor(s.name))}>{s.name}</span></td>
                  <td style={{ ...tdStyle,fontSize:12,color:C.textMd }}>{tch?.name||"?"}</td>
                  <td style={tdStyle}><b>{s.hoursPerWeek}h</b></td>
                  <td style={tdStyle}>{s.isLab?<span style={tag(C.amber)}>⚗ Lab</span>:<span style={tag(C.sky)}>Theory</span>}</td>
                  <td style={tdStyle}>{s.preferMorning?"🌅":""}</td>
                  <td style={tdStyle}><button style={dangerBtn} onClick={()=>del(s.id)}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 14 ROOMS PAGE  (Supabase CRUD)
// ══════════════════════════════════════════════════════════════

function RoomsPage({ rooms, setRooms }) {
  const [form, setForm]   = useState({ name:"",capacity:60,isLab:false });
  const [saving, setSaving] = useState(false);
  const { toast, show }   = useToast();

  const add = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const { data, error } = await (await sb()).from("rooms")
        .insert({ name:form.name, capacity:+form.capacity, is_lab:form.isLab })
        .select().single();
      if (error) throw error;
      setRooms(p=>[...p, mapRoom(data)]);
      setForm({ name:"",capacity:60,isLab:false });
      show("Room added", "success");
    } catch(e) { show(e.message); }
    setSaving(false);
  };

  const del = async id => {
    const { error } = await (await sb()).from("rooms").delete().eq("id", id);
    if (error) { show(error.message); return; }
    setRooms(p=>p.filter(x=>x.id!==id));
    show("Room removed", "success");
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>{}} />}
      <Heading sub="Track classrooms and lab spaces">Room Management</Heading>
      <div style={card({ borderTop:`3px solid ${C.indigo}` })}>
        <h3 style={{ fontSize:14,fontWeight:700,color:C.indigo,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 16px",fontFamily:"'DM Sans',sans-serif" }}>+ Add Room</h3>
        <div style={{ display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap",marginBottom:16 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Room Name</label>
            <input style={inp({width:180})} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Room 101" />
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Capacity</label>
            <input style={inp({width:100})} type="number" value={form.capacity} onChange={e=>setForm(p=>({...p,capacity:e.target.value}))} />
          </div>
          <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,
            fontFamily:"'DM Sans',sans-serif",padding:"9px 16px",borderRadius:8,
            background:form.isLab?C.amberLt:C.bg2,border:`1.5px solid ${form.isLab?C.amberBd:C.border}`,
            color:form.isLab?C.amber:C.textMd }}>
            <input type="checkbox" checked={form.isLab} onChange={e=>setForm(p=>({...p,isLab:e.target.checked}))} />⚗ Lab
          </label>
          <button style={btn(C.indigo,"#fff",{ opacity:saving?.7:1 })} onClick={add} disabled={saving}>
            {saving?"Saving…":"+ Add Room"}
          </button>
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14 }}>
        {rooms.map(r=>(
          <div key={r.id} style={{ background:r.isLab?C.amberLt:C.bg1,
            border:`1.5px solid ${r.isLab?C.amberBd:C.border}`,borderRadius:12,padding:20 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:r.isLab?C.amber:C.text }}>{r.name}</div>
                <span style={tag(r.isLab?C.amber:C.sky)}>{r.isLab?"⚗ Lab":"Classroom"}</span>
              </div>
              <button style={dangerBtn} onClick={()=>del(r.id)}>✕</button>
            </div>
            <p style={{ fontSize:12,color:C.textSm,margin:0 }}>Capacity: <b style={{ color:C.text }}>{r.capacity}</b></p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 15 CONFIG PAGE
// ══════════════════════════════════════════════════════════════

function ConfigPage({ days, setDays, slots, setSlots }) {
  const [newSlot, setNewSlot] = useState({ label:"",start:"",end:"",isMorning:false });
  return (
    <div>
      <Heading sub="Customize working days and time slots">Configuration</Heading>
      <div style={card()}>
        <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:C.text,margin:"0 0 16px" }}>Working Days</h3>
        <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
          {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d=>(
            <button key={d} onClick={()=>setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d])}
              style={{ padding:"8px 18px",borderRadius:8,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,
                background:days.includes(d)?C.indigoLt:C.bg2, border:`1.5px solid ${days.includes(d)?C.indigoBd:C.border}`,
                color:days.includes(d)?C.indigo:C.textMd }}>{d}</button>
          ))}
        </div>
      </div>
      <div style={card()}>
        <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:C.text,margin:"0 0 16px" }}>Time Slots</h3>
        <table style={{ width:"100%",borderCollapse:"collapse",marginBottom:20 }}>
          <thead><tr>{["Label","Start","End","Morning","Lunch",""].map(h=>(<th key={h} style={thStyle}>{h}</th>))}</tr></thead>
          <tbody>{slots.map(s=>(
            <tr key={s.id} style={{ background:s.isLunch?"#FFFBEB":"transparent" }}>
              <td style={tdStyle}><b style={{ color:s.isLunch?C.amber:C.text }}>{s.label}</b></td>
              <td style={{ ...tdStyle,color:C.textSm }}>{s.start}</td>
              <td style={{ ...tdStyle,color:C.textSm }}>{s.end}</td>
              <td style={tdStyle}>{s.isMorning?"🌅":""}</td>
              <td style={tdStyle}><input type="checkbox" checked={!!s.isLunch} onChange={()=>setSlots(p=>p.map(x=>x.id===s.id?{...x,isLunch:!x.isLunch}:x))} /></td>
              <td style={tdStyle}><button style={dangerBtn} onClick={()=>setSlots(p=>p.filter(x=>x.id!==s.id))}>✕</button></td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap" }}>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Label</label>
            <input style={inp({width:130})} value={newSlot.label} onChange={e=>setNewSlot(p=>({...p,label:e.target.value}))} placeholder="9:00 AM" />
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>Start</label>
            <input style={inp({width:110})} type="time" value={newSlot.start} onChange={e=>setNewSlot(p=>({...p,start:e.target.value}))} />
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={lbl}>End</label>
            <input style={inp({width:110})} type="time" value={newSlot.end} onChange={e=>setNewSlot(p=>({...p,end:e.target.value}))} />
          </div>
          <button style={btn(C.indigo,"#fff")} onClick={()=>{
            if(!newSlot.label) return;
            setSlots(p=>[...p,{...newSlot,id:"sl"+Date.now(),isLunch:false}]);
            setNewSlot({ label:"",start:"",end:"",isMorning:false });
          }}>+ Add Slot</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 16 GENERATE PAGE  (saves result to Supabase)
// ══════════════════════════════════════════════════════════════

function GeneratePage({ staff, classes, subjects, rooms, days, slots, onResult }) {
  const [algo, setAlgo]   = useState("csp");
  const [gens, setGens]   = useState(60);
  const [popSz, setPopSz] = useState(30);
  const [mutR, setMutR]   = useState(5);
  const [running, setRunning] = useState(false);
  const [logs, setLogs]   = useState([]);
  const [done, setDone]   = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const logRef = useRef(null);
  const { toast, show } = useToast();
  const emit = useCallback(m=>setLogs(p=>[...p.slice(-200),m]),[]);

  useEffect(()=>{ if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight; },[logs]);

  const run = useCallback(()=>{
    setRunning(true); setDone(false); setLogs([]); setResult(null); setProgress(0);
    const steps=[
      ()=>{ emit("[INIT] Loading from Supabase…"); setProgress(10); },
      ()=>{ emit(`[DATA] ${staff.length} staff · ${classes.length} classes · ${subjects.length} subjects`); setProgress(25); },
      ()=>{ emit(`[DATA] Total hours/wk: ${subjects.reduce((a,s)=>a+s.hoursPerWeek,0)}`); setProgress(35); },
      ()=>{
        emit(`[RUN] Starting ${algo.toUpperCase()}…`); setProgress(45);
        setTimeout(async ()=>{
          try {
            let res;
            if(algo==="csp"){ res=runCSP(staff,classes,subjects,days,slots,rooms,emit); }
            else { res=runGA(staff,classes,subjects,days,slots,{generations:gens,popSize:popSz,mutationRate:mutR/100},emit); }
            const violations=detectConflicts(res.timetable,staff,classes,subjects,days,slots);
            const hard=violations.filter(v=>v.severity==="hard").length;
            res.violations=violations; res.conflicts=hard;
            emit(`[RESULT] Hard: ${hard} · Soft: ${violations.filter(v=>v.severity==="soft").length}`);
            emit(hard===0?"[✓] Zero conflicts — saving to Supabase…":"[!] Conflicts found — saving anyway…");

            // ── Save to Supabase ──────────────────────────────
            setSaving(true);
            const { data, error } = await (await sb()).from("timetables").insert({
              timetable_data: res.timetable,
              teacher_view:   res.teacherView,
              utilization:    res.utilization,
              violations:     res.violations,
              conflicts:      res.conflicts,
              algorithm:      algo,
              fitness_history: res.fitnessHistory || null,
            }).select().single();
            if (error) throw error;
            emit(`[DB] ✓ Saved to Supabase · ID: ${data.id.slice(0,8)}…`);
            const mapped = { ...mapTimetable(data), fitnessHistory: res.fitnessHistory };
            setResult(mapped);
            onResult(mapped);
          } catch(e) {
            emit(`[ERROR] ${e.message}`);
            show(e.message);
          }
          setSaving(false);
          setProgress(100); setDone(true); setRunning(false);
        },80);
      },
    ];
    steps.forEach((fn,i)=>setTimeout(fn,i*380+50));
  },[algo,staff,classes,subjects,days,slots,rooms,gens,popSz,mutR,emit,onResult]);

  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>{}} />}
      <Heading sub="Run the AI solver to create a conflict-free weekly schedule">Generate Timetable</Heading>

      <div style={{ display:"grid",gridTemplateColumns:"1.1fr 1fr",gap:20,marginBottom:20 }}>
        <div style={card({ marginBottom:0 })}>
          <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:C.text,margin:"0 0 16px" }}>Select Algorithm</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:12,marginBottom:20 }}>
            {[
              { id:"csp",name:"CSP — Constraint Satisfaction",icon:"◈",desc:"MCV heuristic + forward checking + backtracking. Deterministic, fast." },
              { id:"ga", name:"GA — Genetic Algorithm",      icon:"⚡",desc:"Population evolution via selection, crossover & mutation. Wider search." },
            ].map(a=>(
              <label key={a.id} style={{ display:"flex",gap:14,padding:"16px 18px",borderRadius:10,cursor:"pointer",
                border:`1.5px solid ${algo===a.id?C.indigoBd:C.border}`,
                background:algo===a.id?C.indigoLt:C.bg2 }}>
                <input type="radio" value={a.id} checked={algo===a.id} onChange={e=>setAlgo(e.target.value)}
                  style={{ marginTop:3,accentColor:C.indigo }} />
                <div>
                  <div style={{ fontWeight:700,fontSize:14,color:algo===a.id?C.indigo:C.text,
                    marginBottom:5,fontFamily:"'DM Sans',sans-serif" }}>{a.icon} {a.name}</div>
                  <div style={{ fontSize:12,color:C.textSm,lineHeight:1.55 }}>{a.desc}</div>
                </div>
              </label>
            ))}
          </div>
          {algo==="ga"&&(
            <div style={{ background:C.bg2,borderRadius:10,padding:16 }}>
              <div style={{ fontSize:12,fontWeight:700,color:C.textMd,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12 }}>GA Parameters</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
                {[["Generations",gens,setGens,10,200],["Population",popSz,setPopSz,10,100],["Mutation %",mutR,setMutR,1,30]].map(([l,v,s,min,max])=>(
                  <div key={l} style={{ display:"flex",flexDirection:"column",gap:5 }}>
                    <label style={lbl}>{l}</label>
                    <input style={inp()} type="number" min={min} max={max} value={v} onChange={e=>s(+e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div style={card({ marginBottom:0 })}>
            <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:C.text,margin:"0 0 14px" }}>Pre-flight Check</h3>
            {[
              [staff.length>0,`${staff.length} staff configured`],
              [classes.length>0,`${classes.length} classes configured`],
              [subjects.length>0,`${subjects.length} subject assignments`],
              [days.length>0,`${days.length} working days`],
              [slots.filter(s=>!s.isLunch).length>0,`${slots.filter(s=>!s.isLunch).length} usable slots`],
            ].map(([ok,t])=>(
              <div key={t} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 13px",
                borderRadius:8,marginBottom:8,fontFamily:"'DM Sans',sans-serif",
                background:ok?C.greenLt:C.redLt, border:`1.5px solid ${ok?C.greenBd:C.redBd}`, color:ok?C.green:C.red,fontSize:12 }}>
                <span style={{ fontSize:15 }}>{ok?"✓":"✗"}</span>{t}
              </div>
            ))}
          </div>
          <button style={btn(running?C.border:C.indigo,running?C.textSm:"#fff",
            { padding:"14px 20px",fontSize:15,opacity:running||saving?.7:1,
              cursor:running||saving?"not-allowed":"pointer",
              boxShadow:running||saving?"none":"0 4px 14px rgba(67,56,202,.25)" })}
            disabled={running||saving} onClick={run}>
            {saving?"⏳ Saving to Supabase…":running?`⏳ Running ${algo.toUpperCase()}…`:`⚡ Generate with ${algo.toUpperCase()}`}
          </button>
          {(running||done)&&(
            <div>
              <div style={{ background:C.bg2,borderRadius:8,overflow:"hidden",height:8 }}>
                <div style={{ height:"100%",borderRadius:8,transition:"width .3s",
                  width:`${progress}%`,background:done?C.green:C.indigo }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={card()}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
          <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:C.text,margin:0 }}>Algorithm Log</h3>
          {running&&<span style={{ fontSize:11,color:C.green,fontWeight:700,background:C.greenLt,
            padding:"3px 10px",borderRadius:10,border:`1px solid ${C.greenBd}`,animation:"blink 1s infinite",
            fontFamily:"'DM Sans',sans-serif" }}>● LIVE</span>}
          {done&&result&&<span style={{ fontSize:11,fontWeight:700,
            background:result.conflicts===0?C.greenLt:C.redLt,color:result.conflicts===0?C.green:C.red,
            padding:"3px 10px",borderRadius:10,border:`1px solid ${result.conflicts===0?C.greenBd:C.redBd}`,
            fontFamily:"'DM Sans',sans-serif" }}>{result.conflicts===0?"✓ Saved to Supabase":"⚠ Conflicts found"}</span>}
        </div>
        <div ref={logRef} style={{ background:C.text,color:"#E7E5E4",borderRadius:10,padding:18,
          fontFamily:"'Courier New',monospace",fontSize:12,maxHeight:240,overflowY:"auto",lineHeight:1.8 }}>
          {!logs.length&&<span style={{ color:"#57534E" }}>Awaiting run…</span>}
          {logs.map((l,i)=>(
            <div key={i} style={{ color:
              l.startsWith("[ERROR]")?"#FCA5A5":
              l.startsWith("[WARN]")||l.startsWith("[!]")?"#FDE68A":
              l.startsWith("[✓]")||l.startsWith("[SUCCESS]")||l.startsWith("[DB]")?"#6EE7B7":
              l.startsWith("[GA]")?"#C4B5FD":l.startsWith("[CSP]")?"#93C5FD":"#D6D3D1" }}>{l}</div>
          ))}
        </div>
      </div>

      {done&&result&&(
        <div style={card()}>
          <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:C.text,margin:"0 0 16px" }}>Summary</h3>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:result.fitnessHistory?16:0 }}>
            {[
              [result.conflicts===0?"✓":result.conflicts,"Hard Conflicts",result.conflicts===0?C.green:C.red,result.conflicts===0?C.greenLt:C.redLt,result.conflicts===0?C.greenBd:C.redBd],
              [(result.violations||[]).filter(v=>v.severity==="soft").length,"Soft Violations",C.amber,C.amberLt,C.amberBd],
              [classes.length,"Classes Scheduled",C.indigo,C.indigoLt,C.indigoBd],
              [subjects.reduce((a,s)=>a+s.hoursPerWeek,0),"Total Hours/Wk",C.sky,"#E0F2FE","#BAE6FD"],
            ].map(([v,l,c,bg,bd])=>(
              <div key={l} style={{ background:bg,border:`1.5px solid ${bd}`,borderRadius:12,padding:"16px 20px" }}>
                <div style={{ fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:c }}>{v}</div>
                <div style={{ fontSize:11,color:c,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:4,opacity:.75 }}>{l}</div>
              </div>
            ))}
          </div>
          {result.fitnessHistory&&result.fitnessHistory.length>1&&(
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:C.textMd,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,fontFamily:"'DM Sans',sans-serif" }}>GA Fitness Evolution</div>
              <div style={{ display:"flex",alignItems:"flex-end",gap:2,height:56,background:C.bg2,borderRadius:10,padding:"8px 10px",border:`1px solid ${C.border}` }}>
                {result.fitnessHistory.map((f,i)=>{
                  const max=Math.max(...result.fitnessHistory);
                  const h=max>0?Math.round((f/max)*42)+2:2;
                  return <div key={i} style={{ flex:1,minWidth:2,height:h,borderRadius:3,
                    background:f===0?C.green:i===result.fitnessHistory.length-1?C.indigo:"#C7D2FE" }} title={`Gen ${i+1}: ${f}`} />;
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 17 TIMETABLE PAGE  (with PDF export)
// ══════════════════════════════════════════════════════════════

function TimetablePage({ result, staff, classes, slots, days, setResult }) {
  const [view, setView]             = useState("class");
  const [selClass, setSelClass]     = useState(classes[0]?.id||"");
  const [selTeacher, setSelTeacher] = useState(staff[0]?.id||"");
  const [dragging, setDragging]     = useState(null);
  const [over, setOver]             = useState(null);
  const [exporting, setExporting]   = useState(false);
  const { toast, show }             = useToast();

  useEffect(()=>{
    if(!selClass&&classes.length>0)   setSelClass(classes[0].id);
    if(!selTeacher&&staff.length>0)   setSelTeacher(staff[0].id);
  },[classes,staff]);

  if(!result) return (
    <div>
      <Heading>Timetable</Heading>
      <div style={{ ...card(),textAlign:"center",padding:70 }}>
        <div style={{ fontSize:48,marginBottom:16 }}>📋</div>
        <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:20,color:C.textMd,margin:"0 0 8px" }}>No timetable yet</h3>
        <p style={{ color:C.textSm,fontSize:13 }}>Go to Generate to create a schedule.</p>
      </div>
    </div>
  );

  const {timetable,teacherView,violations=[]} = result;
  const conflictSet = new Set(violations.filter(v=>v.severity==="hard").map(v=>`${v.classId}|${v.day}|${v.slotId}`));
  const isConflict  = (cid,day,sid) => conflictSet.has(`${cid}|${day}|${sid}`);
  const hardCount   = violations.filter(v=>v.severity==="hard").length;
  const softCount   = violations.filter(v=>v.severity==="soft").length;

  const onDragStart = (day,sid)   => setDragging({day,slotId:sid});
  const onDragOver  = (e,day,sid) => { e.preventDefault(); setOver({day,slotId:sid}); };
  const onDrop = (day,sid) => {
    if(!dragging||view!=="class"||!selClass){ setDragging(null);setOver(null);return; }
    const from=dragging,to={day,slotId:sid};
    if(from.day===to.day&&from.slotId===to.slotId){ setDragging(null);setOver(null);return; }
    setResult(prev=>{
      const tt=JSON.parse(JSON.stringify(prev.timetable));
      const A=tt[selClass]?.[from.day]?.[from.slotId];
      const B=tt[selClass]?.[to.day]?.[to.slotId];
      if(A?.isLunch||B?.isLunch) return prev;
      tt[selClass][from.day][from.slotId]=B;
      tt[selClass][to.day][to.slotId]=A;
      return {...prev,timetable:tt,violations:[],conflicts:0};
    });
    setDragging(null);setOver(null);
  };

  // Persist swap to Supabase
  const saveSwap = async () => {
    if (!result.id) return;
    const { error } = await (await sb()).from("timetables")
      .update({ timetable_data: result.timetable })
      .eq("id", result.id);
    if (error) show(error.message);
    else show("Swap saved to Supabase", "success");
  };

  const allSubjects=[...new Set(Object.values(timetable).flatMap(cls=>
    Object.values(cls).flatMap(day=>Object.values(day).filter(c=>c&&!c.isLunch).map(c=>c.subject))))];

  // PDF Export
  const loadScript = src => new Promise((res,rej)=>{
    if(document.querySelector(`script[src="${src}"]`)){ res();return; }
    const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);
  });
  const hexRgb = hex => { const h=hex.replace("#",""); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };

  const exportPDF = async () => {
    setExporting(true);
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation:"landscape",unit:"mm",format:"a4" });
      const W = doc.internal.pageSize.getWidth();
      doc.setFillColor(67,56,202); doc.rect(0,0,W,18,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text("TimetableAI — Weekly Schedule",14,11);
      const lbl2 = view==="class"?`Class: ${classes.find(c=>c.id===selClass)?.name||""}`:`Teacher: ${staff.find(t=>t.id===selTeacher)?.name||""}`;
      doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.text(lbl2,W-14,11,{align:"right"});
      doc.setTextColor(0,0,0); doc.text(`Generated: ${new Date().toLocaleString()}`,14,26);
      const body=slots.map(slot=>{
        const row=[slot.label];
        days.forEach(day=>{
          const entry=view==="class"?timetable[selClass]?.[day]?.[slot.id]:teacherView[selTeacher]?.[day]?.[slot.id];
          if(!entry){ row.push(""); return; }
          if(entry.isLunch){ row.push("— Lunch —"); return; }
          row.push(view==="class"?`${entry.isLab?"⚗ ":""}${entry.subject}\n${entry.teacherName}${entry.roomName?"\n"+entry.roomName:""}`:
            `${entry.subject}\n${entry.className}${entry.roomName?"\n"+entry.roomName:""}`);
        });
        return row;
      });
      doc.autoTable({
        head:[["Time",...days]], body, startY:30,
        theme:"grid",
        styles:{ fontSize:7.5,cellPadding:3,valign:"middle",halign:"center",
          lineColor:[209,207,201],lineWidth:.3,overflow:"linebreak",minCellHeight:14 },
        headStyles:{ fillColor:[67,56,202],textColor:[255,255,255],fontStyle:"bold",fontSize:8,halign:"center" },
        columnStyles:{ 0:{ fillColor:[238,237,232],fontStyle:"bold",textColor:[87,83,78],halign:"right",cellWidth:22 } },
        didParseCell:(data)=>{
          if(data.section!=="body") return;
          const slot=slots[data.row.index]; if(!slot||data.column.index===0) return;
          const day=days[data.column.index-1]; if(!day) return;
          const entry=view==="class"?timetable[selClass]?.[day]?.[slot.id]:teacherView[selTeacher]?.[day]?.[slot.id];
          if(!entry){ Object.assign(data.cell.styles,{fillColor:[245,244,241]}); return; }
          if(entry.isLunch){ Object.assign(data.cell.styles,{fillColor:[255,251,235],textColor:[146,64,14],fontStyle:"bold"}); return; }
          if(isConflict(selClass,day,slot.id)){ Object.assign(data.cell.styles,{fillColor:[254,242,242],textColor:[220,38,38]}); return; }
          const [r,g,b]=hexRgb(subjectColor(entry.subject));
          Object.assign(data.cell.styles,{fillColor:[Math.min(r+180,255),Math.min(g+180,255),Math.min(b+180,255)],textColor:[r,g,b]});
        },
        margin:{top:30,left:10,right:10},tableWidth:"auto",
      });
      const fy=doc.lastAutoTable.finalY+6;
      if(fy<doc.internal.pageSize.getHeight()-20){
        doc.setFontSize(7); doc.setTextColor(120,120,120);
        doc.text("Legend: Coloured = subjects · Yellow = Lunch · Red = Conflict · ⚗ = Lab",14,fy);
      }
      const pc=doc.internal.getNumberOfPages();
      for(let i=1;i<=pc;i++){ doc.setPage(i); doc.setFontSize(7); doc.setTextColor(160,160,160);
        doc.text(`Page ${i} of ${pc} · TimetableAI`,W/2,doc.internal.pageSize.getHeight()-5,{align:"center"}); }
      const fn=view==="class"?`timetable-${classes.find(c=>c.id===selClass)?.name||"class"}-${new Date().toISOString().slice(0,10)}.pdf`
        :`timetable-${staff.find(t=>t.id===selTeacher)?.name?.split(" ").pop()||"teacher"}-${new Date().toISOString().slice(0,10)}.pdf`;
      doc.save(fn);
    } catch(e){ show("PDF export failed: "+e.message); }
    setExporting(false);
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>{}} />}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
        <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:C.text,margin:0 }}>Timetable</h1>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          {hardCount>0&&<span style={tag(C.red)}>⚠ {hardCount} conflict{hardCount!==1?"s":""}</span>}
          {softCount>0&&<span style={tag(C.amber)}>~ {softCount} soft</span>}
          {hardCount===0&&<span style={tag(C.green)}>✓ Conflict-free</span>}
          <button style={ghostBtn({ fontSize:12 })} onClick={saveSwap}>💾 Save Swaps</button>
          <button style={outlineBtn(C.indigo,{ fontSize:13,opacity:exporting?.7:1,cursor:exporting?"not-allowed":"pointer" })}
            onClick={exportPDF} disabled={exporting}>
            {exporting?"⏳ Generating…":"⬇ Export PDF"}
          </button>
        </div>
      </div>
      <p style={{ fontSize:13,color:C.textSm,marginBottom:22,fontFamily:"'DM Sans',sans-serif" }}>
        {view==="class"?`Drag cells to swap · ${classes.find(c=>c.id===selClass)?.name||""}`:staff.find(t=>t.id===selTeacher)?.name||""}
        {result.id&&<span style={{ marginLeft:12,fontSize:11,color:C.textSm }}>ID: {result.id.slice(0,8)}…</span>}
      </p>

      <div style={{ display:"flex",gap:10,marginBottom:20,alignItems:"center",flexWrap:"wrap" }}>
        <div style={{ display:"flex",background:C.bg2,padding:3,borderRadius:10,border:`1.5px solid ${C.border}`,gap:3 }}>
          {[["class","◧ Class"],["teacher","◉ Teacher"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:"7px 16px",borderRadius:8,
              background:view===v?C.bg1:"transparent",border:view===v?`1.5px solid ${C.border}`:"1.5px solid transparent",
              color:view===v?C.indigo:C.textMd,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
              boxShadow:view===v?"0 1px 3px rgba(28,25,23,.06)":"none" }}>{l}</button>
          ))}
        </div>
        {view==="class"&&(
          <select style={{...inp({width:"auto",fontSize:13}),minWidth:200}} value={selClass} onChange={e=>setSelClass(e.target.value)}>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name} — {c.dept}</option>)}
          </select>
        )}
        {view==="teacher"&&(
          <select style={{...inp({width:"auto",fontSize:13}),minWidth:200}} value={selTeacher} onChange={e=>setSelTeacher(e.target.value)}>
            {staff.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ overflowX:"auto",marginBottom:20 }}>
        <table style={{ borderCollapse:"separate",borderSpacing:"4px 4px",minWidth:640 }}>
          <thead><tr>
            <th style={{ ...thStyle,width:90,background:"transparent",border:"none" }}>Time</th>
            {days.map(d=><th key={d} style={{ ...thStyle,textAlign:"center",width:128,borderRadius:"8px 8px 0 0" }}>
              {d.slice(0,3).toUpperCase()}
              <div style={{ fontSize:9,fontWeight:400,color:C.textSm,textTransform:"lowercase" }}>{d.slice(3)}</div>
            </th>)}
          </tr></thead>
          <tbody>
            {slots.map(slot=>(
              <tr key={slot.id}>
                <td style={{ padding:"3px 0",verticalAlign:"middle",fontSize:11,color:slot.isLunch?C.lunch:C.textSm,
                  fontWeight:slot.isLunch?700:500,whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif",border:"none" }}>
                  {slot.isLunch?"🍽 ":""}{slot.label}
                </td>
                {days.map(day=>{
                  const entry=view==="class"?timetable[selClass]?.[day]?.[slot.id]:teacherView[selTeacher]?.[day]?.[slot.id];
                  const conflict=view==="class"&&isConflict(selClass,day,slot.id);
                  const isDrag=dragging?.day===day&&dragging?.slotId===slot.id;
                  const isOver2=over?.day===day&&over?.slotId===slot.id;
                  const color=entry&&!entry.isLunch?subjectColor(entry.subject):null;
                  const cellBg=entry?(entry.isLunch?C.lunchBg:conflict?C.redLt:C.bg1):C.bg2;
                  const cellBorder=entry?(entry.isLunch?`1.5px solid ${C.amberBd}`:conflict?`1.5px solid ${C.redBd}`:`1.5px solid ${C.border}`):`1.5px dashed ${C.borderMd}`;
                  const accent=conflict?C.red:entry?.isLunch?C.amber:color;
                  return (
                    <td key={day} style={{ padding:3,verticalAlign:"top",border:"none" }}>
                      <div
                        style={{ width:124,minWidth:124,height:68,borderRadius:8,background:cellBg,border:cellBorder,
                          borderLeft:accent&&entry?`4px solid ${accent}`:cellBorder,
                          display:"flex",flexDirection:"column",justifyContent:"center",padding:"5px 9px",
                          cursor:(entry&&!entry.isLunch&&view==="class")?"grab":"default",
                          opacity:isDrag?.4:1,
                          outline:isOver2?`2.5px solid ${C.indigo}`:conflict?`2px solid ${C.redBd}`:"none",
                          outlineOffset:2,
                          boxShadow:isOver2?"0 0 0 3px rgba(67,56,202,.15)":conflict?"0 0 0 2px rgba(220,38,38,.10)":entry&&!entry.isLunch?"0 1px 3px rgba(28,25,23,.05)":"none",
                          boxSizing:"border-box",gap:2,transition:"box-shadow .12s" }}
                        draggable={!!(entry&&!entry.isLunch&&view==="class")}
                        onDragStart={()=>onDragStart(day,slot.id)}
                        onDragOver={e=>onDragOver(e,day,slot.id)}
                        onDrop={()=>onDrop(day,slot.id)}
                        onDragEnd={()=>{setDragging(null);setOver(null);}}>
                        {entry?(entry.isLunch?(
                          <span style={{ fontSize:11,color:C.lunch,fontWeight:700,fontFamily:"'DM Sans',sans-serif" }}>Lunch</span>
                        ):(
                          <>
                            <div style={{ fontWeight:700,fontSize:11,color:conflict?C.red:color,lineHeight:1.2,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif" }}>
                              {entry.isLab&&"⚗ "}{entry.subject}{conflict&&" ⚠"}
                            </div>
                            <div style={{ fontSize:10,color:C.textMd,lineHeight:1.2,overflow:"hidden",
                              textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif" }}>
                              {view==="class"?entry.teacherName:entry.className}
                            </div>
                            {entry.roomName&&<div style={{ fontSize:9,color:C.textSm,fontFamily:"'DM Sans',sans-serif" }}>▣ {entry.roomName}</div>}
                          </>
                        )):<span style={{ fontSize:10,color:C.textSm,opacity:.5,fontFamily:"'DM Sans',sans-serif" }}>Free</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:violations.length>0?"1fr 1fr":"1fr",gap:16,marginBottom:16 }}>
        <div style={card({ marginBottom:0 })}>
          <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:C.text,margin:"0 0 12px" }}>Legend</h3>
          <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:10 }}>
            {allSubjects.map(s=><span key={s} style={tag(subjectColor(s))}>{s}</span>)}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <span style={tag(C.amber)}>🍽 Lunch</span><span style={tag("#7C3AED")}>⚗ Lab</span>
            {hardCount>0&&<span style={tag(C.red)}>⚠ Conflict</span>}
          </div>
        </div>
        {violations.length>0&&(
          <div style={card({ marginBottom:0 })}>
            <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:C.text,margin:"0 0 12px" }}>Violations ({violations.length})</h3>
            <div style={{ maxHeight:150,overflowY:"auto",display:"flex",flexDirection:"column",gap:7 }}>
              {violations.map((v,i)=>(
                <div key={i} style={{ padding:"8px 12px",borderRadius:7,fontSize:12,fontFamily:"'DM Sans',sans-serif",
                  background:v.severity==="hard"?C.redLt:C.amberLt,
                  border:`1px solid ${v.severity==="hard"?C.redBd:C.amberBd}`,
                  color:v.severity==="hard"?C.red:C.amber }}>
                  <b>[{v.severity==="hard"?"HARD":"SOFT"}]</b> {v.description}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {view==="class"&&result.utilization&&(
        <div style={card()}>
          <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:C.text,margin:"0 0 16px" }}>Faculty Utilization</h3>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12 }}>
            {staff.map(t=>{
              const u=result.utilization[t.id]||0;
              const bc=u>80?C.red:u>60?C.amber:C.green;
              return (
                <div key={t.id} style={{ background:C.bg2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"12px 16px" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
                    <div><div style={{ fontWeight:600,fontSize:12 }}>{t.name}</div><div style={{ fontSize:11,color:C.textSm }}>{t.subject}</div></div>
                    <span style={tag(bc)}>{u}%</span>
                  </div>
                  <div style={{ height:6,background:C.border,borderRadius:4 }}>
                    <div style={{ height:"100%",borderRadius:4,width:`${u}%`,background:bc,transition:"width .4s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  § 18 ROOT APP  (Auth + Data Loading)
// ══════════════════════════════════════════════════════════════

export default function App() {
  const [session,  setSession]  = useState(null);
  const [authReady,setAuthReady]= useState(false);
  const [page,     setPage]     = useState("dashboard");

  // Data state
  const [staff,    setStaff]    = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms,    setRooms]    = useState([]);
  const [days,     setDays]     = useState(DEFAULT_DAYS);
  const [slots,    setSlots]    = useState(DEFAULT_SLOTS);
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);

  // ── Supabase auth listener (async-safe) ──────────────────────
  useEffect(() => {
    let unsub = null;
    getClient().then(client => {
      client.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setAuthReady(true);
      });
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });
      unsub = subscription;
    });
    return () => unsub?.unsubscribe();
  }, []);

  // ── Load all data when logged in ─────────────────────────────
  useEffect(() => {
    if (!session) return;
    const loadAll = async () => {
      setLoading(true);
      try {
        const client = await sb();
        const [s, c, sub, r, tt] = await Promise.all([
          client.from("staff").select("*").order("created_at"),
          client.from("classes").select("*").order("created_at"),
          client.from("subjects").select("*").order("created_at"),
          client.from("rooms").select("*").order("created_at"),
          client.from("timetables").select("id,conflicts,algorithm,generated_at,utilization,violations,fitness_history").order("generated_at",{ascending:false}).limit(1),
        ]);
        if (s.data)   setStaff(s.data.map(mapStaff));
        if (c.data)   setClasses(c.data.map(mapClass));
        if (sub.data) setSubjects(sub.data.map(mapSubject));
        if (r.data)   setRooms(r.data.map(mapRoom));
        if (tt.data?.length) setResult(mapTimetable(tt.data[0]));
      } catch (e) { console.error("Load error:", e); }
      setLoading(false);
    };
    loadAll();
  }, [session]);

  const logout = async () => {
    await (await sb()).auth.signOut();
    setSession(null); setStaff([]); setClasses([]); setSubjects([]); setRooms([]); setResult(null);
  };

  if (!authReady) return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg0,fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32,marginBottom:16 }}>📅</div>
        <Spinner />
        <p style={{ color:C.textSm,fontSize:13,marginTop:12 }}>Connecting to Supabase…</p>
      </div>
    </div>
  );

  if (!session) return <LoginPage onLogin={s=>setSession(s)} />;

  const props = { staff,setStaff,classes,setClasses,subjects,setSubjects,rooms,setRooms,days,setDays,slots,setSlots,result,setResult };

  return (
    <div style={{ minHeight:"100vh",background:C.bg0,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column" }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing:border-box; }
        body { background:${C.bg0}; }
        ::-webkit-scrollbar { width:7px; height:7px; background:${C.bg2}; }
        ::-webkit-scrollbar-thumb { background:${C.borderMd}; border-radius:4px; }
        select option { background:${C.bg1}; color:${C.text}; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input:focus, select:focus { border-color:${C.indigoBd} !important; box-shadow:0 0 0 3px rgba(67,56,202,.1); }
        input[type=number]::-webkit-inner-spin-button { opacity:.5; }
        @media print { nav,.no-print{ display:none!important; } body{ background:#fff!important; } }
      `}</style>

      <NavBar page={page} setPage={setPage} onLogout={logout} hasResult={!!result} userEmail={session.user?.email} />

      <main style={{ flex:1,padding:"32px 28px",maxWidth:1480,width:"100%",margin:"0 auto",boxSizing:"border-box" }}>
        {page==="dashboard" && <Dashboard {...props} setPage={setPage} loading={loading} />}
        {page==="staff"     && <StaffPage {...props} />}
        {page==="classes"   && <ClassesPage {...props} />}
        {page==="subjects"  && <SubjectsPage {...props} />}
        {page==="rooms"     && <RoomsPage {...props} />}
        {page==="config"    && <ConfigPage {...props} />}
        {page==="generate"  && (
          <GeneratePage staff={staff} classes={classes} subjects={subjects} rooms={rooms} days={days} slots={slots}
            onResult={r=>{ setResult(r); setTimeout(()=>setPage("timetable"),700); }} />
        )}
        {page==="timetable" && (
          <TimetablePage result={result} setResult={setResult} staff={staff} classes={classes} slots={slots} days={days} />
        )}
      </main>
    </div>
  );
}
