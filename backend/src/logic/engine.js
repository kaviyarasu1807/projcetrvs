/**
 * AI Logic Engines for Timetable Generation
 * CSP and Genetic Algorithm
 */

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

export const DEFAULT_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];

export function detectConflicts(timetable, teachers, classes, subjects, days, slots) {
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

export function runCSP(teachers, classes, subjects, days, slots, rooms, logCb) {
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

// Genetic Algorithm
export function runGA(teachers,classes,subjects,days,slots,params,logCb){
  const {generations=60,popSize=30,mutationRate=.05}=params;
  const emit=m=>logCb?.(m);
  let pop=Array.from({length:popSize},()=>randomChrom(teachers,classes,subjects,days,slots));
  let best=null,bestScore=Infinity;
  const hist=[];
  for(let gen=0;gen<generations;gen++){
    const scored=pop.map(g=>({g,f:fitness(g,teachers,days,slots)})).sort((a,b)=>a.f-b.f);
    hist.push(scored[0].f);
    if(scored[0].f<bestScore){ bestScore=scored[0].f; best=scored[0].g; emit(`[GA] Gen ${gen+1} — fitness: ${bestScore}`); }
    if(bestScore===0){ emit("[GA] ✓ Perfect solution found"); break; }
    const np=[scored[0].g,scored[1].g];
    while(np.length<popSize){ np.push(mutate(crossover(tourney(scored),tourney(scored),classes),teachers,days,slots,mutationRate)); }
    pop=np;
  }
  const assigned=best.map((g,i)=>({...g,taskId:`${g.subjectId}_h${i}`,roomId:null,roomName:null}));
  return {...buildGrids(assigned,teachers,classes,subjects,days,slots),fitnessHistory:hist};
}

// Helper functions for GA
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
