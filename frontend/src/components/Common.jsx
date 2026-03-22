import React from "react";
import { C } from "../styles/theme";

export const Spinner = () => (
  <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:60 }}>
    <div style={{ width:36, height:36, border:`3px solid ${C.indigoBd}`, borderTop:`3px solid ${C.indigo}`,
      borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
  </div>
);

export const Heading = ({ children, sub }) => (
  <div style={{ marginBottom:28 }}>
    <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:C.text, margin:"0 0 6px", letterSpacing:"-0.01em" }}>{children}</h1>
    {sub && <p style={{ fontSize:13, color:C.textSm, margin:0 }}>{sub}</p>}
  </div>
);

export const Toast = ({ msg, type="error", onClose }) => (
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
