export const PALETTE = [
  "#4338CA","#0891B2","#059669","#D97706","#DC2626",
  "#7C3AED","#0284C7","#16A34A","#CA8A04","#E11D48",
  "#6D28D9","#0369A1","#15803D","#B45309","#BE185D",
];

export const subjectColor = name => {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h*31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
};

export const DEFAULT_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
export const DEFAULT_SLOTS = [
  { id:"sl1", label:"9:00 AM",  start:"09:00", end:"10:00", isLunch:false, isMorning:true  },
  { id:"sl2", label:"10:00 AM", start:"10:00", end:"11:00", isLunch:false, isMorning:true  },
  { id:"sl3", label:"11:00 AM", start:"11:00", end:"12:00", isLunch:false, isMorning:true  },
  { id:"sl4", label:"12:00 PM", start:"12:00", end:"13:00", isLunch:true,  isMorning:false },
  { id:"sl5", label:"1:00 PM",  start:"13:00", end:"14:00", isLunch:false, isMorning:false },
  { id:"sl6", label:"2:00 PM",  start:"14:00", end:"15:00", isLunch:false, isMorning:false },
  { id:"sl7", label:"3:00 PM",  start:"15:00", end:"16:00", isLunch:false, isMorning:false },
  { id:"sl8", label:"4:00 PM",  start:"16:00", end:"17:00", isLunch:false, isMorning:false },
];
