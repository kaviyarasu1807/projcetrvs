import React, { useState } from "react";
import { supabase } from "../api/supabase";
import { C, card, inp, lbl, btn } from "../styles/theme";

export function LoginPage({ onLogin }) {
  const [email,    setEmail]    = useState("admin@timetableai.com");
  const [password, setPassword] = useState("");
  const [err,      setErr]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [mode,     setMode]     = useState("login"); 

  const submit = async () => {
    if (!email || !password) { setErr("Please fill in all fields"); return; }
    setLoading(true); setErr("");
    try {
      let res;
      if (mode === "signup") {
        res = await supabase.auth.signUp({ email, password });
        if (res.error) throw res.error;
        if (res.data?.user && !res.data.session) {
          setErr("✓ Check your email to confirm your account, then sign in.");
          setMode("login"); setLoading(false); return;
        }
      } else {
        res = await supabase.auth.signInWithPassword({ email, password });
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
          <img src="/logo.png" alt="Logo" style={{ width:100, height:100, marginBottom:16, objectFit:"contain" }} />
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28,
            fontWeight:700, color:C.text, margin:"0 0 6px" }}>R.V.S. College</h1>
          <p style={{ fontSize:14, color:C.textSm, margin:"0 0 10px" }}>TimetableAI Optimizer</p>
          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"center" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:C.green }} />
            <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>Connected to Supabase</span>
          </div>
        </div>

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
            boxShadow:"0 2px 8px rgba(67,56,202,.25)", opacity:loading ? 0.7 : 1 })}
            onClick={submit} disabled={loading}>
            {loading ? "Please wait…" : mode==="signup" ? "Create Account" : "Sign In →"}
          </button>

          {/* Development Bypass */}
          <button 
            style={{ ...btn("transparent", C.textSm), border:`1.5px dashed ${C.border}`, color:C.textSm, fontSize:12, width:"100%", marginTop:8 }}
            onClick={() => onLogin({ user: { email: "dev@timetableai.local", id: "dev-user-id" } })}
          >
            🚧 Skip Auth (Development Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
