export const C = {
  bg0:"#F7F5F0", bg1:"#FFFFFF", bg2:"#F0EDE8", bg3:"#E8E4DD",
  border:"#DDD9D0", borderMd:"#C8C3B8",
  text:"#1C1917", textMd:"#57534E", textSm:"#A8A29E",
  indigo:"#4338CA", indigoLt:"#EEF2FF", indigoBd:"#C7D2FE",
  amber:"#D97706", amberLt:"#FFFBEB", amberBd:"#FDE68A",
  green:"#059669", greenLt:"#ECFDF5", greenBd:"#A7F3D0",
  red:"#DC2626", redLt:"#FEF2F2", redBd:"#FECACA",
  sky:"#0284C7", lunch:"#92400E", lunchBg:"#FEF3C7",
};

export const card  = (x={}) => ({ background:C.bg1, border:`1px solid ${C.border}`, borderRadius:12, padding:24, marginBottom:20, boxShadow:"0 1px 3px rgba(28,25,23,.06),0 4px 12px rgba(28,25,23,.04)", ...x });
export const inp   = (x={}) => ({ background:C.bg3, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"9px 13px", color:C.text, fontSize:13, fontFamily:"'DM Sans',sans-serif", width:"100%", boxSizing:"border-box", outline:"none", transition:"border-color .15s", ...x });
export const lbl   = { fontSize:11, fontWeight:600, color:C.textMd, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:5, display:"block", fontFamily:"'DM Sans',sans-serif" };
export const btn   = (bg=C.indigo, tc="#fff", x={}) => ({ padding:"9px 20px", background:bg, border:`1.5px solid ${bg}`, borderRadius:8, color:tc, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .15s", ...x });
export const ghostBtn = (x={}) => ({ padding:"8px 18px", background:"transparent", border:`1.5px solid ${C.border}`, borderRadius:8, color:C.textMd, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", ...x });
export const outlineBtn = (color=C.indigo, x={}) => ({ padding:"8px 18px", background:"transparent", border:`1.5px solid ${color}`, borderRadius:8, color, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .15s", ...x });
export const dangerBtn  = { padding:"5px 11px", background:C.redLt, border:`1.5px solid ${C.redBd}`, borderRadius:6, color:C.red, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" };
export const editBtn    = { padding:"5px 11px", background:C.indigoLt, border:`1.5px solid ${C.indigoBd}`, borderRadius:6, color:C.indigo, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" };
export const tag   = color => ({ display:"inline-flex", alignItems:"center", padding:"3px 9px", borderRadius:20, background:color+"15", color, border:`1px solid ${color}30`, fontSize:11, fontWeight:600, fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" });
export const thStyle = { background:C.bg2, color:C.textSm, padding:"10px 14px", textAlign:"left", fontWeight:700, borderBottom:`1px solid ${C.border}`, letterSpacing:"0.07em", textTransform:"uppercase", fontSize:10, whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" };
export const tdStyle = { padding:"11px 14px", borderBottom:`1px solid ${C.bg2}`, color:C.text, verticalAlign:"middle", fontSize:13, fontFamily:"'DM Sans',sans-serif" };

export const FONT_IMPORT = `https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap`;
