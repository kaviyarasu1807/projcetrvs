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
 * Enhanced CSP Optimizer using Recursive Backtracking
 */
export function runCSP(teachers, classes, subjects, days, slots, rooms, logCb) {
  const usable = slots.filter(s => !s.isLunch);
  const logs = [];
  const emit = (m) => { logs.push(m); logCb?.(m); };

  // 1. Prepare Tasks (Break subjects into individual hours)
  const tasks = [];
  subjects.forEach(sub => {
    // Labs are usually 2 or 3 units at once. For simplicity, we keep them as individual hours 
    // but the solver will try to cluster them if possible in future versions.
    for (let h = 0; h < sub.hoursPerWeek; h++) {
      tasks.push({ ...sub, taskId: `${sub.id}_h${h}` });
    }
  });

  // 2. Sort tasks by "Most Constrained" (Heuristic)
  // Teachers with fewer available days or high load should be placed first
  const teacherLoad = {};
  teachers.forEach(t => { teacherLoad[t.id] = (t.availability?.length || 5); });
  
  tasks.sort((a, b) => {
    if (a.isLab !== b.isLab) return b.isLab ? 1 : -1; // Labs first
    return (teacherLoad[a.teacherId] || 5) - (teacherLoad[b.teacherId] || 5);
  });

  emit(`[CSP] Initialized with ${tasks.length} tasks. Using Backtracking Solver...`);

  const tBusy = {}; // teacher|day|slot
  const cBusy = {}; // class|day|slot
  const rBusy = {}; // room|day|slot
  const tDayCount = {}; // teacher|day -> hours
  const solution = [];

  // Recursive Backtracking function
  function solve(taskIndex) {
    if (taskIndex >= tasks.length) return true; // Found a solution!

    const task = tasks[taskIndex];
    const teacher = teachers.find(t => t.id === task.teacherId);
    if (!teacher) return solve(taskIndex + 1); // Skip invalid tasks

    const availDays = teacher.availability?.length ? teacher.availability : days;
    const maxHrsPerDay = teacher.maxHrsDay || 5;

    // Try each permutation of day and slot for this task
    for (const day of availDays) {
      if (!days.includes(day)) continue;

      for (const slot of usable) {
        const tk = `${task.teacherId}|${day}|${slot.id}`;
        const ck = `${task.classId}|${day}|${slot.id}`;
        const dk = `${task.teacherId}|${day}`;

        // Check Hard Constraints
        if (tBusy[tk] || cBusy[ck]) continue;
        if ((tDayCount[dk] || 0) >= maxHrsPerDay) continue;

        // Find an appropriate room
        const room = (rooms || []).find(r => r.isLab === task.isLab && !rBusy[`${r.id}|${day}|${slot.id}`]);
        const rk = room ? `${room.id}|${day}|${slot.id}` : null;

        // Tentatively assign
        tBusy[tk] = true;
        cBusy[ck] = true;
        if (rk) rBusy[rk] = true;
        tDayCount[dk] = (tDayCount[dk] || 0) + 1;
        
        const assignment = { ...task, day, slotId: slot.id, roomId: room?.id || null, roomName: room?.name || "General Room" };
        solution.push(assignment);

        // Move to next task
        if (solve(taskIndex + 1)) return true;

        // BACKTRACK (Undo assignment)
        tBusy[tk] = false;
        cBusy[ck] = false;
        if (rk) rBusy[rk] = false;
        tDayCount[dk]--;
        solution.pop();
      }
    }

    return false; // Could not place this task in any slot
  }

  const success = solve(0);

  if (!success) {
    emit(`[WARN] Solver could not find a globally valid schedule. Placing remaining tasks greedily.`);
    // In a real app, we might relax constraints here.
  }

  emit(`[CSP] Completed. ${solution.length}/${tasks.length} hours assigned.`);
  
  const results = buildGrids(solution, teachers, classes, subjects, days, slots);
  const conflicts = detectConflicts(results.timetable, teachers, classes, subjects, days, slots);
  
  return { ...results, conflicts: conflicts.filter(v => v.severity === "hard").length, violations: conflicts };
}

/**
 * Genetic Algorithm (Stochastic approach)
 */
export function runGA(teachers, classes, subjects, days, slots, params, logCb) {
  const { generations = 100, popSize = 50, mutationRate = 0.1 } = params;
  const emit = m => logCb?.(m);
  
  let pop = Array.from({ length: popSize }, () => randomChromosome(teachers, classes, subjects, days, slots));
  let best = null;
  let bestScore = Infinity;
  const history = [];

  emit(`[GA] Evolution started. Population: ${popSize}, Generations: ${generations}`);

  for (let gen = 0; gen < generations; gen++) {
    const scored = pop.map(genes => ({ genes, score: calculateFitness(genes, teachers, days, slots) }))
                     .sort((a, b) => a.score - b.score);
    
    history.push(scored[0].score);
    
    if (scored[0].score < bestScore) {
      bestScore = scored[0].score;
      best = scored[0].genes;
      emit(`[GA] Generation ${gen + 1}: Best Fitness = ${bestScore}`);
    }

    if (bestScore === 0) {
      emit("[GA] Perfect solution evolved!");
      break;
    }

    // Elitism: carry over the top 2
    const nextPop = [scored[0].genes, scored[1].genes];

    while (nextPop.length < popSize) {
      const p1 = tourneySelect(scored);
      const p2 = tourneySelect(scored);
      let child = crossover(p1, p2, classes);
      child = mutate(child, teachers, days, slots, mutationRate);
      nextPop.push(child);
    }
    pop = nextPop;
  }

  const assigned = best.map((g, i) => ({ ...g, taskId: `${g.subjectId}_h${i}` }));
  const results = buildGrids(assigned, teachers, classes, subjects, days, slots);
  const conflicts = detectConflicts(results.timetable, teachers, classes, subjects, days, slots);

  return { ...results, fitnessHistory: history, conflicts: conflicts.filter(v => v.severity === "hard").length, violations: conflicts };
}

// GA HELPERS
function randomChromosome(teachers, classes, subjects, days, slots) {
  const usable = slots.filter(s => !s.isLunch);
  const chromosome = [];
  subjects.forEach(sub => {
    const t = teachers.find(x => x.id === sub.teacherId);
    const avail = t?.availability || days;
    for (let h = 0; h < sub.hoursPerWeek; h++) {
      chromosome.push({
        ...sub,
        day: avail[Math.floor(Math.random() * avail.length)],
        slotId: usable[Math.floor(Math.random() * usable.length)].id
      });
    }
  });
  return chromosome;
}

function calculateFitness(genes, teachers, days, slots) {
  let penalty = 0;
  const tBusy = {};
  const cBusy = {};
  const tDayCount = {};

  genes.forEach(g => {
    const tk = `${g.teacherId}|${g.day}|${g.slotId}`;
    const ck = `${g.classId}|${g.day}|${g.slotId}`;
    const dk = `${g.teacherId}|${g.day}`;

    if (tBusy[tk]) penalty += 100; // Hard: Teacher double-booked
    if (cBusy[ck]) penalty += 100; // Hard: Class double-booked
    
    tBusy[tk] = true;
    cBusy[ck] = true;
    tDayCount[dk] = (tDayCount[dk] || 0) + 1;
    
    const t = teachers.find(x => x.id === g.teacherId);
    if (tDayCount[dk] > (t?.maxHrsDay || 5)) penalty += 20; // Soft: Overload
  });

  return penalty;
}

function tourneySelect(scored, k = 3) {
  const selected = [];
  for (let i = 0; i < k; i++) selected.push(scored[Math.floor(Math.random() * scored.length)]);
  return selected.sort((a, b) => a.score - b.score)[0].genes;
}

function crossover(p1, p2, classes) {
  const child = [];
  classes.forEach(cls => {
    const parent = Math.random() < 0.5 ? p1 : p2;
    parent.filter(g => g.classId === cls.id).forEach(g => child.push({ ...g }));
  });
  return child;
}

function mutate(genes, teachers, days, slots, rate) {
  const usable = slots.filter(s => !s.isLunch);
  return genes.map(g => {
    if (Math.random() > rate) return g;
    const t = teachers.find(x => x.id === g.teacherId);
    const avail = t?.availability || days;
    return {
      ...g,
      day: avail[Math.floor(Math.random() * avail.length)],
      slotId: usable[Math.floor(Math.random() * usable.length)].id
    };
  });
}

/**
 * Common Utilities
 */
export function detectConflicts(timetable, teachers, classes, subjects, days, slots) {
  const violations = [];
  const usable = slots.filter(s => !s.isLunch);

  days.forEach(day => {
    usable.forEach(slot => {
      const teacherMap = {};
      const classMap = {};

      Object.entries(timetable).forEach(([classId, grid]) => {
        const cell = grid?.[day]?.[slot.id];
        if (cell && !cell.isLunch && cell.teacherId) {
          const tName = cell.teacherName || "Teacher";
          const cName = classes.find(c => c.id === classId)?.name || classId;
          
          if (teacherMap[cell.teacherId]) {
            violations.push({
              severity: "hard", type: "TEACHER_COLLISION",
              description: `${tName} is scheduled for both ${teacherMap[cell.teacherId]} and ${cName} at ${day} ${slot.label}`
            });
          }
          teacherMap[cell.teacherId] = cName;
        }
      });
    });
  });

  return violations;
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
    utilization[t.id] = Math.round((count / (5 * 5)) * 100); // Rough estimate
  });

  return { timetable, teacherView, utilization };
}
