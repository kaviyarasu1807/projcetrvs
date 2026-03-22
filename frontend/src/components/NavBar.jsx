import React from "react";
import { C } from "../styles/theme";

export function NavBar({ page, setPage, onLogout, hasResult, userEmail }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: "⊞" },
    { id: "staff", label: "Staff", icon: "◉" },
    { id: "classes", label: "Classes", icon: "◫" },
    { id: "subjects", label: "Subjects", icon: "◎" },
    { id: "rooms", label: "Rooms", icon: "▣" },
    { id: "slots", label: "Time Slots", icon: "🕒" },
    { id: "config", label: "Config", icon: "⚙" },
    { id: "generate", label: "Generate", icon: "⚡" },
    { id: "timetable", label: "Timetable", icon: "📋", badge: hasResult },
  ];
  return (
    <nav style={{
      background: C.bg1, borderBottom: `1.5px solid ${C.border}`,
      padding: "0 24px", display: "flex", alignItems: "center", height: 58, gap: 2,
      position: "sticky", top: 0, zIndex: 200, boxShadow: "0 1px 4px rgba(28,25,23,.06)"
    }}>
      <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: C.text }}>RVSCET.AI</span>
            <span style={{ fontSize: 10, color: C.textSm, letterSpacing: "0.05em", textTransform: "uppercase" }}>DEPT OF IT</span>
          </div>
        </div>
        <span style={{
          fontSize: 10, color: C.green, background: C.greenLt, padding: "2px 8px",
          borderRadius: 10, border: `1px solid ${C.greenBd}`, fontWeight: 700,
          fontFamily: "'DM Sans',sans-serif"
        }}>● Supabase</span>
      </div>
      {items.map(n => (
        <button key={n.id} onClick={() => setPage(n.id)}
          style={{
            position: "relative", padding: "6px 13px", borderRadius: 8,
            background: page === n.id ? C.indigoLt : "transparent",
            border: page === n.id ? `1.5px solid ${C.indigoBd}` : "1.5px solid transparent",
            color: page === n.id ? C.indigo : C.textMd, fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", gap: 5
          }}>
          <span style={{ fontSize: 11 }}>{n.icon}</span>{n.label}
          {n.badge && <span style={{
            position: "absolute", top: 4, right: 4, width: 7, height: 7,
            borderRadius: "50%", background: C.green, border: `2px solid ${C.bg1}`
          }} />}
        </button>
      ))}
      <div style={{ marginLeft: 10, display: "flex", alignItems: "center", gap: 12 }}>
        {userEmail && (
          <div style={{ 
            width:30, height:30, borderRadius:"50%", background:C.indigoLt, 
            border:`1.5px solid ${C.indigoBd}`, color:C.indigo,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:14, fontWeight:800, cursor:"default"
          }} title={userEmail}>
            {userEmail[0].toUpperCase()}
          </div>
        )}
        <button style={{
          padding: "6px 14px", background: C.redLt, border: `1.5px solid ${C.redBd}`,
          borderRadius: 8, color: C.red, fontSize: 12, fontWeight: 600,
          cursor: "pointer", fontFamily: "'DM Sans',sans-serif"
        }}
          onClick={onLogout}>Sign Out</button>
      </div>
    </nav>
  );
}
