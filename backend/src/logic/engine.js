/**
 * AI Logic Engines for Timetable Generation
 * Optimized for R.V.S. College of Engineering & Technology
 */

export const DEFAULT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DEFAULT_SLOTS = [
  { id: "sl1", label: "09:00 - 10:00", start: "09:00", end: "10:00", isLunch: false, isMorning: true },
  { id: "sl2", label: "10:00 - 11:00", start: "10:00", end: "11:00", isLunch: false, isMorning: true },
  { id: "sl3", label: "11:15 - 12:15", start: "11:15", end: "12:15", isLunch: false, isMorning: true },
  { id: "sl4", label: "12:15 - 01:15", start: "12:15", end: "13:15", isLunch: true,  isMorning: false },
  { id: "sl5", label: "01:15 - 02:15", start: "13:15", end: "14:15", isLunch: false, isMorning: false },
  { id: "sl6", label: "02:15 - 03:15", start: "14:15", end: "15:15", isLunch: false, isMorning: false },
  { id: "sl7", label: "03:30 - 04:30", start: "15:30", end: "16:30", isLunch: false, isMorning: false },
];

/**
 * Advanced CSP Optimizer with Backtracking & Session Clipping
 */
export function runCSP(teachers, classes, subjects, days, slots, rooms, logCb) {
  const usable = slots.filter(s => !s.isLunch);
  const logs = [];
  const emit = (m) => { logs.push(m); logCb?.(m); };

  // 1. Prepare Tasks with "Session Clipping" for Labs
  const tasks = [];
  subjects.forEach(sub => {
    let remaining = sub.hoursPerWeek;
    while (remaining > 0) {
      const size = (sub.isLab && remaining >= 2) ? 2 : 1; // Try to group labs in 2-hour blocks
      tasks.push({ ...sub, sessionSize: size, id: sub.id });
      remaining -= size;
    }
  });

  // 2. Sort tasks by Heuristics
  const teacherLoad = {};
  teachers.forEach(t => { teacherLoad[t.id] = (t.availability?.length || 5); });
  
  tasks.sort((a, b) => {
    // 1st: Session size (larger sessions are harder to place)
    if (a.sessionSize !== b.sessionSize) return b.sessionSize - a.sessionSize;
    // 2nd: Lab status
    if (a.isLab !== b.isLab) return b.isLab ? 1 : -1;
    // 3rd: Teacher constraint (fewer days first)
    return (teacherLoad[a.teacherId] || 5) - (teacherLoad[b.teacherId] || 5);
  });

  emit(`[CSP] Solver starting with ${tasks.length} sessions. Search depth: ${tasks.length}`);

  const tBusy = {}; 
  const cBusy = {}; 
  const rBusy = {}; 
  const tDayCount = {}; 
  const solution = [];
  let iterations = 0;
  const MAX_ITERATIONS = 50000;

  function solve(taskIndex) {
    iterations++;
    if (iterations > MAX_ITERATIONS) return false;
    if (taskIndex >= tasks.length) return true;

    const task = tasks[taskIndex];
    const teacher = teachers.find(t => t.id === task.teacherId);
    const availDays = teacher?.availability?.length ? teacher.availability : days;
    const maxHrsPerDay = teacher?.maxHrsDay || 5;

    // Shuffle days for variety 
    const tryDays = [...availDays].sort(() => Math.random() - 0.5);

    for (const day of tryDays) {
      if (!days.includes(day)) continue;

      // For each day, try to find a starting slot
      for (let i = 0; i <= usable.length - task.sessionSize; i++) {
        const sessionSlots = usable.slice(i, i + task.sessionSize);
        
        // CHECK: Are all slots in this session actually consecutive in time?
        // (Ensures we don't pick slots across a large gap)
        let consecutive = true;
        for (let j = 1; j < sessionSlots.length; j++) {
           const prevIdx = slots.indexOf(sessionSlots[j-1]);
           const currIdx = slots.indexOf(sessionSlots[j]);
           if (currIdx !== prevIdx + 1) { consecutive = false; break; }
        }
        if (!consecutive) continue;

        // CHECK: Are all slots free for teacher and class?
        const canPlace = sessionSlots.every(slot => {
          const tk = `${task.teacherId}|${day}|${slot.id}`;
          const ck = `${task.classId}|${day}|${slot.id}`;
          return !tBusy[tk] && !cBusy[ck];
        });
        if (!canPlace) continue;

        // CHECK: Daily hour limit
        if ((tDayCount[`${task.teacherId}|${day}`] || 0) + task.sessionSize > maxHrsPerDay) continue;

        // CHECK: Find a room available for all slots in session
        const room = (rooms || []).find(r => 
          r.isLab === task.isLab && 
          sessionSlots.every(s => !rBusy[`${r.id}|${day}|${s.id}`])
        );
        if (!room) continue;

        // --- ASSIGN ---
        sessionSlots.forEach(s => {
          tBusy[`${task.teacherId}|${day}|${s.id}`] = true;
          cBusy[`${task.classId}|${day}|${s.id}`] = true;
          rBusy[`${room.id}|${day}|${s.id}`] = true;
          solution.push({ ...task, day, slotId: s.id, roomId: room.id, roomName: room.name });
        });
        tDayCount[`${task.teacherId}|${day}`] = (tDayCount[`${task.teacherId}|${day}`] || 0) + task.sessionSize;

        if (solve(taskIndex + 1)) return true;

        // --- BACKTRACK ---
        sessionSlots.forEach(s => {
          tBusy[`${task.teacherId}|${day}|${s.id}`] = false;
          cBusy[`${task.classId}|${day}|${s.id}`] = false;
          rBusy[`${room.id}|${day}|${s.id}`] = false;
          solution.pop();
        });
        tDayCount[`${task.teacherId}|${day}`] -= task.sessionSize;
      }
    }
    return false;
  }

  const success = solve(0);
  if (!success) emit("[WARN] Complex constraints detected. Some sessions may be missing.");
  
  emit(`[CSP] Finished in ${iterations} iterations.`);
  return buildGrids(solution, teachers, classes, subjects, days, slots);
}

/**
 * Genetic Algorithm (Fallback / Stochastic)
 */
export function runGA(teachers, classes, subjects, days, slots, params, logCb) {
  const { generations = 80, popSize = 40 } = params;
  const usable = slots.filter(s => !s.isLunch);
  const emit = m => logCb?.(m);
  
  // GA logic remains similar but simplified for speed
  let pop = Array.from({ length: popSize }, () => {
    return subjects.flatMap(sub => {
       const t = teachers.find(x => x.id === sub.teacherId);
       const avail = t?.availability || days;
       return Array.from({ length: sub.hoursPerWeek }, () => ({
         ...sub, day: avail[Math.floor(Math.random() * avail.length)],
         slotId: usable[Math.floor(Math.random() * usable.length)].id
       }));
    });
  });

  let best = pop[0];
  let bestScore = Infinity;

  emit(`[GA] Meta-heuristic started...`);

  for (let g = 0; g < generations; g++) {
    const scored = pop.map(genes => {
       let p = 0; const tb = {}, cb = {};
       genes.forEach(gn => {
         const tk = `${gn.teacherId}|${gn.day}|${gn.slotId}`, ck = `${gn.classId}|${gn.day}|${gn.slotId}`;
         if (tb[tk]) p += 100; if (cb[ck]) p += 100;
         tb[tk] = cb[ck] = true;
       });
       return { genes, score: p };
    }).sort((a, b) => a.score - b.score);

    if (scored[0].score < bestScore) {
      bestScore = scored[0].score; best = scored[0].genes;
      emit(`[GA] Gen ${g+1}: Fitness ${bestScore}`);
    }
    if (bestScore === 0) break;

    const next = [scored[0].genes, scored[1].genes];
    while (next.length < popSize) {
      const p = scored[Math.floor(Math.random() * 5)].genes;
      next.push(p.map(bit => Math.random() < 0.1 ? { ...bit, day: days[Math.floor(Math.random() * days.length)], slotId: usable[Math.floor(Math.random() * usable.length)].id } : bit));
    }
    pop = next;
  }

  return buildGrids(best, teachers, classes, subjects, days, slots);
}

function buildGrids(assigned, teachers, classes, subjects, days, slots) {
  const timetable = {};
  classes.forEach(cls => {
    timetable[cls.id] = {};
    days.forEach(day => {
      timetable[cls.id][day] = {};
      slots.forEach(slot => {
        timetable[cls.id][day][slot.id] = slot.isLunch ? { subject: "LUNCH", isLunch: true } : null;
      });
    });
  });

  assigned.forEach(a => {
    const t = teachers.find(x => x.id === a.teacherId);
    if (timetable[a.classId] && timetable[a.classId][a.day]) {
      timetable[a.classId][a.day][a.slotId] = {
        subject: a.name, teacherId: a.teacherId, teacherName: t?.name || "TBA",
        isLab: a.isLab, roomName: a.roomName, isLunch: false
      };
    }
  });

  const teacherView = {};
  teachers.forEach(t => {
    teacherView[t.id] = {};
    days.forEach(day => {
      teacherView[t.id][day] = {};
      slots.forEach(slot => { teacherView[t.id][day][slot.id] = null; });
    });
  });

  assigned.forEach(a => {
    if (teacherView[a.teacherId]) {
      const cls = classes.find(c => c.id === a.classId);
      teacherView[a.teacherId][a.day][a.slotId] = { className: cls?.name || "?", subject: a.name, isLab: a.isLab };
    }
  });

  const utilization = {};
  teachers.forEach(t => {
    const count = assigned.filter(a => a.teacherId === t.id).length;
    utilization[t.id] = Math.round((count / (5 * 5)) * 100);
  });

  const conflicts = []; // Placeholder for real conflict detection if needed
  return { timetable, teacherView, utilization, violations: conflicts, conflicts: 0 };
}
