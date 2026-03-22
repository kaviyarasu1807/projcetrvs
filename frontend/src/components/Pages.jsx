import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase, mapStaff, mapClass, mapSubject, mapRoom, mapTimetable } from "../api/supabase";
import { C, card, inp, lbl, btn, tag, thStyle, tdStyle, editBtn, dangerBtn, ghostBtn, outlineBtn } from "../styles/theme";
import { Heading, Spinner, Toast } from "./Common";
import { DEFAULT_DAYS, DEFAULT_SLOTS, subjectColor } from "../logic/utils";

// ── STAFF PAGE ────────────────────────────────────────────────
export function StaffPage({ staff, setStaff, show }) {
  const [form, setForm] = useState({ name: "", subject: "", dept: "", email: "", maxHrsDay: 4, preferMorning: false, availability: [...DEFAULT_DAYS] });
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggleDay = d => setForm(p => ({ ...p, availability: p.availability.includes(d) ? p.availability.filter(x => x !== d) : [...p.availability, d] }));

  const save = async () => {
    if (!form.name || !form.subject) return;
    setSaving(true);
    try {
      const p = { name: form.name, subject: form.subject, dept: form.dept, email: form.email, availability: form.availability, max_hrs_day: form.maxHrsDay, prefer_morning: form.preferMorning };
      if (edit) {
        const { data, error } = await supabase.from("staff").update(p).eq("id", edit).select().single();
        if (error) throw error;
        setStaff(prev => prev.map(t => t.id === edit ? mapStaff(data) : t));
        show("Staff member updated", "success");
        setEdit(null);
      } else {
        const { data, error } = await supabase.from("staff").insert(p).select().single();
        if (error) throw error;
        setStaff(prev => [...prev, mapStaff(data)]);
        show("Staff member added", "success");
      }
      setForm({ name: "", subject: "", dept: "", email: "", maxHrsDay: 4, preferMorning: false, availability: [...DEFAULT_DAYS] });
    } catch (e) { show(e.message); }
    setSaving(false);
  };

  const del = async id => {
    if (!confirm("Remove this staff member?")) return;
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) { show(error.message); return; }
    setStaff(prev => prev.filter(x => x.id !== id));
    show("Staff member removed", "success");
  };

  return (
    <div>
      <Heading sub="Manage Faculty">Staff Management</Heading>
      <div style={card({ borderTop: `3px solid ${edit ? C.amber : C.indigo}` })}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: edit ? C.amber : C.indigo, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>
          {edit ? "✎ Edit Staff Member" : "+ Add New Staff Member"}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lbl}>Name</label>
            <input style={inp()} placeholder="Dr. Rajesh Kumar" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lbl}>Subject</label>
            <input style={inp()} placeholder="Mathematics" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lbl}>Dept</label>
            <input style={inp()} placeholder="Science" value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lbl}>Max Hrs/Day</label>
            <input style={inp()} type="number" value={form.maxHrsDay} onChange={e => setForm({ ...form, maxHrsDay: +e.target.value })} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Availability</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DEFAULT_DAYS.map(d => (
              <label key={d} onClick={() => toggleDay(d)} style={{
                cursor: "pointer", padding: "6px 12px", borderRadius: 8, fontSize: 12,
                background: form.availability.includes(d) ? C.indigoLt : C.bg2,
                border: `1.5px solid ${form.availability.includes(d) ? C.indigoBd : C.border}`,
                color: form.availability.includes(d) ? C.indigo : C.textMd,
                fontWeight: form.availability.includes(d) ? 600 : 400
              }}>
                {d.slice(0, 3)}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btn(edit ? C.amber : C.indigo)} onClick={save} disabled={saving}>{saving ? "Saving..." : edit ? "✎ Update" : "+ Add Staff"}</button>
          {edit && <button style={ghostBtn()} onClick={() => { setEdit(null); setForm({ name: "", subject: "", dept: "", email: "", maxHrsDay: 4, preferMorning: false, availability: [...DEFAULT_DAYS] }); }}>Cancel</button>}
        </div>
      </div>
      <div style={card()}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Name", "Subject", "Dept", "Days", "Max", "Actions"].map(h => (<th key={h} style={thStyle}>{h}</th>))}</tr></thead>
          <tbody>{staff.map(t => (
            <tr key={t.id}><td style={tdStyle}><b>{t.name}</b></td><td style={tdStyle}><span style={tag(subjectColor(t.subject))}>{t.subject}</span></td>
              <td style={tdStyle}>{t.dept}</td><td style={tdStyle}>{t.availability.length}d</td><td style={tdStyle}>{t.maxHrsDay}h</td>
              <td style={tdStyle}>
                <button style={editBtn} onClick={() => { setForm({ ...t }); setEdit(t.id); }}>✎</button>
                <button style={{ ...dangerBtn, marginLeft: 8 }} onClick={() => del(t.id)}>✕</button>
              </td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── CLASSES PAGE ──────────────────────────────────────────────
export function ClassesPage({ classes, setClasses, show }) {
  const [form, setForm] = useState({ name: "", year: 1, section: "", dept: "", capacity: 60 });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("classes").insert(form).select().single();
      if (error) throw error;
      setClasses(prev => [...prev, mapClass(data)]);
      show("Class added", "success");
      setForm({ name: "", year: 1, section: "", dept: "", capacity: 60 });
    } catch (e) { show(e.message); }
    setSaving(false);
  };

  const del = async id => {
    if (!confirm("Remove this class? All assignments will be lost.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) { show(error.message); return; }
    setClasses(prev => prev.filter(c => c.id !== id));
    show("Class removed", "success");
  };

  return (
    <div>
      <Heading sub="Manage Sections">Classes Management</Heading>
      <div style={card()}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>+ Add New Class</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
          <input style={inp()} placeholder="Class Name (e.g. CS-A)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input style={inp()} type="number" placeholder="Year" value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })} />
          <input style={inp()} placeholder="Dept" value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })} />
          <button style={btn()} onClick={save} disabled={saving}>{saving ? "Saving..." : "Add Class"}</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
        {classes.map(c => (
          <div key={c.id} style={card({ marginBottom: 0 })}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.indigo }}>{c.name}</span>
              <button style={dangerBtn} onClick={() => del(c.id)}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: C.textSm, margin: "0 0 8px" }}>Year {c.year} · {c.dept} · {c.capacity} seats</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SUBJECTS PAGE ─────────────────────────────────────────────
export function SubjectsPage({ subjects, setSubjects, staff, classes, show }) {
  const [form, setForm] = useState({ classId: "", teacherId: "", name: "", hoursPerWeek: 3, isLab: false });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.classId || !form.teacherId || !form.name) return;
    setSaving(true);
    try {
      const payload = { class_id: form.classId, teacher_id: form.teacherId, name: form.name, hours_per_week: form.hoursPerWeek, is_lab: form.isLab };
      const { data, error } = await supabase.from("subjects").insert(payload).select().single();
      if (error) throw error;
      setSubjects(prev => [...prev, mapSubject(data)]);
      show("Subject assigned", "success");
      setForm({ classId: "", teacherId: "", name: "", hoursPerWeek: 3, isLab: false });
    } catch (e) { show(e.message); }
    setSaving(false);
  };

  const del = async id => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) { show(error.message); return; }
    setSubjects(prev => prev.filter(s => s.id !== id));
    show("Assignment removed", "success");
  };

  return (
    <div>
      <Heading sub="Assign subjects to classes">Subjects Management</Heading>
      <div style={card()}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>+ Assign Subject</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
          <select style={inp()} value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })}>
            <option value="">Select Class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={inp()} value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">Select Teacher</option>
            {staff.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input style={inp()} placeholder="Subject Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input style={inp()} type="number" value={form.hoursPerWeek} onChange={e => setForm({ ...form, hoursPerWeek: +e.target.value })} />
          <button style={btn()} onClick={save} disabled={saving}>{saving ? "Saving..." : "Assign Subject"}</button>
        </div>
      </div>
      <div style={card()}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={thStyle}>Class</th><th style={thStyle}>Subject</th><th style={thStyle}>Teacher</th><th style={thStyle}>Hrs</th><th></th></tr></thead>
          <tbody>{subjects.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            const tch = staff.find(t => t.id === s.teacherId);
            return (
              <tr key={s.id}>
                <td style={tdStyle}><b>{cls?.name}</b></td>
                <td style={tdStyle}><span style={tag(subjectColor(s.name))}>{s.name}</span></td>
                <td style={tdStyle}>{tch?.name}</td>
                <td style={tdStyle}>{s.hoursPerWeek}h</td>
                <td style={tdStyle}><button style={dangerBtn} onClick={() => del(s.id)}>✕</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── ROOMS PAGE ────────────────────────────────────────────────
export function RoomsPage({ rooms, setRooms, show }) {
  const [form, setForm] = useState({ name: "", capacity: 60, isLab: false });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("rooms").insert({ name: form.name, capacity: form.capacity, is_lab: form.isLab }).select().single();
      if (error) throw error;
      setRooms(prev => [...prev, mapRoom(data)]);
      show("Room added", "success");
      setForm({ name: "", capacity: 60, isLab: false });
    } catch (e) { show(e.message); }
    setSaving(false);
  };

  const del = async id => {
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) { show(error.message); return; }
    setRooms(prev => prev.filter(r => r.id !== id));
    show("Room removed", "success");
  };

  return (
    <div>
      <Heading sub="Track rooms and labs">Rooms Management</Heading>
      <div style={card()}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
          <input style={inp()} placeholder="Room Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.isLab} onChange={e => setForm({ ...form, isLab: e.target.checked })} /> ⚗ Lab
          </label>
          <button style={btn()} onClick={save} disabled={saving}>{saving ? "Saving..." : "Add Room"}</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
        {rooms.map(r => (
          <div key={r.id} style={card({ background: r.isLab ? C.amberLt : C.bg1, border: `1.5px solid ${r.isLab ? C.amberBd : C.border}` })}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: r.isLab ? C.amber : C.text }}>{r.name}</div>
              <button style={dangerBtn} onClick={() => del(r.id)}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: C.textMd, margin: 0 }}>Cap: {r.capacity} · {r.isLab ? "⚗ Lab" : "Classroom"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TIME SLOTS PAGE ──────────────────────────────────────────
export function TimeSlotsPage({ slots, setSlots, days, setDays, show }) {
  const [newSlot, setNewSlot] = useState({ label: "", start: "09:00", end: "10:00", isLunch: false });
  const [activeTab, setActiveTab] = useState("slots");

  const addSlot = () => {
    if (!newSlot.label) return;
    const id = "sl_" + Math.random().toString(36).slice(2, 7);
    setSlots(p => [...p, { ...newSlot, id, isMorning: parseInt(newSlot.start) < 12 }]);
    setNewSlot({ label: "", start: "09:00", end: "10:00", isLunch: false });
    show("Time slot added locally", "success");
  };

  const removeSlot = (id) => {
    setSlots(p => p.filter(s => s.id !== id));
    show("Time slot removed", "success");
  };

  const toggleDay = (d) => {
    setDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  };

  const sortedSlots = [...slots].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div>
      <Heading sub="Manage daily schedule and working days">Time Slots & Days</Heading>
      
      <div style={{ display: "flex", background: C.bg2, padding: 4, borderRadius: 12, marginBottom: 20, width: "fit-content", border: `1.5px solid ${C.border}` }}>
        <button onClick={() => setActiveTab("slots")} style={{ padding: "8px 16px", borderRadius: 9, background: activeTab === "slots" ? C.bg1 : "transparent", border: "none", fontWeight: 600, color: activeTab === "slots" ? C.indigo : C.textSm, fontSize: 13 }}>🕒 Time Slots</button>
        <button onClick={() => setActiveTab("days")} style={{ padding: "8px 16px", borderRadius: 9, background: activeTab === "days" ? C.bg1 : "transparent", border: "none", fontWeight: 600, color: activeTab === "days" ? C.indigo : C.textSm, fontSize: 13 }}>📅 Working Days</button>
      </div>

      {activeTab === "slots" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card()}>
            <h3 style={{ margin: "0 0 16px" }}>+ Add New Time Slot</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={lbl}>Label (e.g. 1st Hour, Lunch)</label>
                <input style={inp()} placeholder="Math Lab" value={newSlot.label} onChange={e => setNewSlot({ ...newSlot, label: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={lbl}>Start Time</label>
                  <input style={inp()} type="time" value={newSlot.start} onChange={e => setNewSlot({ ...newSlot, start: e.target.value })} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={lbl}>End Time</label>
                  <input style={inp()} type="time" value={newSlot.end} onChange={e => setNewSlot({ ...newSlot, end: e.target.value })} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={newSlot.isLunch} onChange={e => setNewSlot({ ...newSlot, isLunch: e.target.checked })} />
                Is this a break / lunch slot?
              </label>
              <button style={btn()} onClick={addSlot}>Add Time Slot</button>
            </div>
          </div>

          <div style={card()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ margin:0 }}>Defined Slots</h3>
              <button style={{ ...ghostBtn(), fontSize:12, color:C.indigo }} onClick={() => { setSlots([...DEFAULT_SLOTS]); show("Standard hours loaded", "success"); }}>
                🔄 Load Standard Hours
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sortedSlots.map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: s.isLunch ? C.lunchBg : C.bg1, border: `1.5px solid ${s.isLunch ? C.amberBd : C.border}`, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: s.isLunch ? C.lunch : C.text }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: C.textSm }}>{s.start} — {s.end}</div>
                  </div>
                  <button style={dangerBtn} onClick={() => removeSlot(s.id)}>✕</button>
                </div>
              ))}
              {slots.length === 0 && <div style={{ color: C.textSm, textAlign: "center", padding: 20 }}>No slots defined.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "days" && (
        <div style={card()}>
          <h3 style={{ margin: "0 0 16px" }}>Working Days</h3>
          <p style={{ fontSize: 13, color: C.textSm, marginBottom: 16 }}>Select the days of the week when classes are held.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
              <label key={d} onClick={() => toggleDay(d)} style={{
                cursor: "pointer", padding: "12px 20px", borderRadius: 10, fontSize: 14,
                background: days.includes(d) ? C.indigoLt : C.bg2,
                border: `2px solid ${days.includes(d) ? C.indigoBd : C.border}`,
                color: days.includes(d) ? C.indigo : C.textSm,
                fontWeight: days.includes(d) ? 700 : 400,
                transition: "all .2s"
              }}>
                {d}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CONFIG PAGE ───────────────────────────────────────────────
export function ConfigPage() {
  return (
    <div>
      <Heading sub="System settings">Configuration</Heading>
      <div style={card()}>Advanced university settings coming soon.</div>
    </div>
  );
}

// ── GENERATE PAGE ─────────────────────────────────────────────
export function GeneratePage({ staff, classes, subjects, rooms, setResult, setHistory, setPage, show }) {
  const [algo, setAlgo] = useState("csp");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const run = async () => {
    setRunning(true); setProgress(10);
    setLogs(["[INIT] Connecting to AI Engine (Backend)..."]);
    try {
      setProgress(30);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teachers: staff, classes, subjects, rooms, algorithm: algo }),
      });
      setProgress(80);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setLogs(p => [...p, "[AI] Generation completed", `[AI] Hard Conflicts: ${data.conflicts}`]);

      const { data: dbData, error } = await supabase.from("timetables").insert({
        timetable_data: data.timetable, teacher_view: data.teacherView, utilization: data.utilization,
        violations: data.violations, conflicts: data.conflicts, algorithm: algo,
      }).select().single();
      if (error) throw error;

      setLogs(p => [...p, "[DB] ✓ Result stored in Supabase"]);
      setProgress(100);
      const mapped = mapTimetable(dbData);
      setResult(mapped);
      setHistory(prev => [mapped, ...prev]);
      setTimeout(() => setPage("timetable"), 500);
    } catch (e) {
      setLogs(p => [...p, `[ERROR] ${e.message}`]);
      show(e.message);
    }
    setRunning(false);
  };

  return (
    <div>
      <Heading sub="AI Scheduler">Generate Timetable</Heading>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={card()}>
          <h3 style={{ margin: "0 0 16px" }}>Generation Engine</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ cursor: "pointer", padding: "12px", borderRadius: 10, background: algo === "csp" ? C.indigoLt : C.bg2, border: `1.5px solid ${algo === "csp" ? C.indigoBd : C.border}` }}>
              <input type="radio" checked={algo === "csp"} onChange={() => setAlgo("csp")} style={{ marginRight: 10 }} />
              <b>CSP (Deterministic)</b> - High speed, guaranteed local optimum.
            </label>
            <label style={{ cursor: "pointer", padding: "12px", borderRadius: 10, background: algo === "ga" ? C.indigoLt : C.bg2, border: `1.5px solid ${algo === "ga" ? C.indigoBd : C.border}` }}>
              <input type="radio" checked={algo === "ga"} onChange={() => setAlgo("ga")} style={{ marginRight: 10 }} />
              <b>Genetic Algorithm</b> - Better for complex, large datasets.
            </label>
            <button style={{ ...btn(), marginTop: 10, padding: 14, fontSize: 15 }} onClick={run} disabled={running}>
              {running ? "⏳ Processing..." : "⚡ Run Generator"}
            </button>
            {running && <div style={{ height: 6, background: C.bg2, borderRadius: 4 }}><div style={{ height: "100%", background: C.indigo, width: `${progress}%`, borderRadius: 4, transition: "width .3s" }} /></div>}
          </div>
        </div>
        <div style={card({ background: C.text, color: "#fff" })}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, opacity: .6 }}>CONSOLE LOGS</span>
            {running && <span style={{ fontSize: 10, color: C.green }}>● ACTIVE</span>}
          </div>
          <div ref={logRef} style={{ height: 200, overflowY: "auto", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
            {!logs.length && <div style={{ color: "#555" }}>Ready...</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TIMETABLE PAGE ────────────────────────────────────────────
export function TimetablePage({ result, setResult, staff, classes, show }) {
  const [view, setView] = useState("class");
  const [selClass, setSelClass] = useState(classes[0]?.id || "");
  const [selTeacher, setSelTeacher] = useState(staff[0]?.id || "");
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [exporting, setExporting] = useState(false);

  const days = DEFAULT_DAYS;
  const slots = DEFAULT_SLOTS;

  if (!result) return <div style={card()}>No result. Go to Generate.</div>;

  const { timetable, teacherView, violations = [] } = result;
  const hardCount = result.conflicts || 0;

  const onDragStart = (day, sid) => setDragging({ day, slotId: sid });
  const onDragOver = (e, day, sid) => { e.preventDefault(); setOver({ day, slotId: sid }); };
  const onDrop = (day, sid) => {
    if (!dragging || view !== "class" || !selClass) { setDragging(null); setOver(null); return; }
    const from = dragging, to = { day, slotId: sid };
    if (from.day === to.day && from.slotId === to.slotId) { setDragging(null); setOver(null); return; }

    setResult(prev => {
      const tt = JSON.parse(JSON.stringify(prev.timetable));
      const A = tt[selClass]?.[from.day]?.[from.slotId];
      const B = tt[selClass]?.[to.day]?.[to.slotId];
      if (A?.isLunch || B?.isLunch) return prev;
      tt[selClass][from.day][from.slotId] = B;
      tt[selClass][to.day][to.slotId] = A;
      return { ...prev, timetable: tt, conflicts: 0 }; // Temporarily reset conflicts for visual swap
    });
    setDragging(null); setOver(null);
  };

  const saveSwap = async () => {
    if (!result.id) return;
    const { error } = await supabase.from("timetables").update({ timetable_data: result.timetable }).eq("id", result.id);
    if (error) show(error.message); else show("Changes saved", "success");
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const loadScript = src => new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
        const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.text("TimetableAI - Schedule", 14, 15);

      const rows = [];
      slots.forEach(slot => {
        const row = [slot.label];
        days.forEach(day => {
          const entry = view === "class" ? timetable[selClass]?.[day]?.[slot.id] : teacherView[selTeacher]?.[day]?.[slot.id];
          row.push(entry ? (entry.isLunch ? "LUNCH" : entry.subject) : "");
        });
        rows.push(row);
      });

      doc.autoTable({ head: [["Time", ...days]], body: rows, startY: 20 });
      doc.save("timetable.pdf");
    } catch (e) { show("PDF Failed: " + e.message); }
    setExporting(false);
  };

  const currentGrid = view === "class" ? (timetable[selClass] || {}) : (teacherView[selTeacher] || {});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Heading sub="Drag cells to swap slots if in Class view">Weekly Schedule</Heading>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={ghostBtn()} onClick={saveSwap}>💾 Save Changes</button>
          <button style={outlineBtn(C.indigo)} onClick={exportPDF} disabled={exporting}>{exporting ? "⏳..." : "⬇ Export PDF"}</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div style={{ display: "flex", background: C.bg2, padding: 3, borderRadius: 10, border: `1.5px solid ${C.border}` }}>
          <button onClick={() => setView("class")} style={{ padding: "6px 14px", borderRadius: 7, background: view === "class" ? C.bg1 : "transparent", border: "none", color: view === "class" ? C.indigo : C.textMd, fontWeight: 600 }}>◧ Class</button>
          <button onClick={() => setView("teacher")} style={{ padding: "6px 14px", borderRadius: 7, background: view === "teacher" ? C.bg1 : "transparent", border: "none", color: view === "teacher" ? C.indigo : C.textMd, fontWeight: 600 }}>◉ Teacher</button>
        </div>
        {view === "class" ? (
          <select style={inp({ width: 180 })} value={selClass} onChange={e => setSelClass(e.target.value)}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <select style={inp({ width: 180 })} value={selTeacher} onChange={e => setSelTeacher(e.target.value)}>
            {staff.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: "4px", width: "100%", minWidth: 800 }}>
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              {days.map(d => <th key={d} style={{ ...thStyle, textAlign: "center" }}>{d.toUpperCase()}</th>)}
            </tr>
          </thead>
          <tbody>
            {slots.map(slot => (
              <tr key={slot.id}>
                <td style={{ ...tdStyle, fontWeight: 700, fontSize: 11, color: C.textSm }}>{slot.label}</td>
                {days.map(day => {
                  const cell = currentGrid[day]?.[slot.id];
                  const isDrag = dragging?.day === day && dragging?.slotId === slot.id;
                  const isOver = over?.day === day && over?.slotId === slot.id;

                  return (
                    <td key={day} style={{ padding: 2 }}>
                      <div
                        style={{
                          height: 60, borderRadius: 8, background: cell ? (cell.isLunch ? C.lunchBg : C.bg1) : C.bg2,
                          border: `1.5px solid ${cell ? (cell.isLunch ? C.amberBd : C.border) : C.borderMd}`,
                          borderLeft: cell && !cell.isLunch ? `4px solid ${subjectColor(cell.subject)}` : undefined,
                          padding: "6px 10px", cursor: cell && !cell.isLunch && view === "class" ? "grab" : "default",
                          opacity: isDrag ? 0.4 : 1, outline: isOver ? `2px solid ${C.indigo}` : "none",
                          display: "flex", flexDirection: "column", justifyContent: "center"
                        }}
                        draggable={!!(cell && !cell.isLunch && view === "class")}
                        onDragStart={() => onDragStart(day, slot.id)}
                        onDragOver={e => onDragOver(e, day, slot.id)}
                        onDrop={() => onDrop(day, slot.id)}
                        onDragEnd={() => { setDragging(null); setOver(null); }}
                      >
                        {cell ? (
                          cell.isLunch ? <span style={{ fontSize: 11, color: C.lunch, fontWeight: 700 }}>Lunch</span> : (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.subject}</div>
                              <div style={{ fontSize: 9, color: C.textSm }}>{view === "class" ? cell.teacherName : cell.className}</div>
                            </>
                          )
                        ) : <span style={{ fontSize: 9, color: C.textSm, opacity: 0.4 }}>Free</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {violations.length > 0 && (
        <div style={card({ marginTop: 20 })}>
          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Active Violations ({violations.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {violations.map((v, i) => (
              <div key={i} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, background: C.redLt, border: `1px solid ${C.redBd}`, color: C.red }}>
                {v.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
