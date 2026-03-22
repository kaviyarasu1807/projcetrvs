import React, { useState } from "react";
import { supabase, mapStaff, mapClass, mapSubject, mapRoom } from "../api/supabase";
import { C, card, thStyle, tdStyle, tag, ghostBtn, btn } from "../styles/theme";
import { Heading, Spinner } from "./Common";
import { subjectColor } from "../logic/utils";

export async function seedDatabase(setStaff, setClasses, setSubjects, setRooms, toast) {
  try {
    const client = supabase;
    await client.from("subjects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await client.from("staff").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await client.from("classes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await client.from("rooms").delete().neq("id", "00000000-0000-0000-0000-000000000000");

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

    const { data: cData, error: cErr } = await client.from("classes").insert([
      { name:"CS-A",  year:1, section:"A", dept:"Computer Science",        capacity:60 },
      { name:"CS-B",  year:1, section:"B", dept:"Computer Science",        capacity:60 },
      { name:"IT-A",  year:2, section:"A", dept:"Information Technology",  capacity:55 },
      { name:"CSE-B", year:3, section:"B", dept:"Computer Science & Eng.", capacity:50 },
    ]).select();
    if (cErr) throw cErr;

    const T = Object.fromEntries(tData.map(t=>[t.name.split(" ")[1], t.id]));
    const CL = Object.fromEntries(cData.map(c=>[c.name, c.id]));

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

    const { error: rErr } = await client.from("rooms").insert([
      { name:"Room 101",    capacity:65, is_lab:false },
      { name:"Room 102",    capacity:65, is_lab:false },
      { name:"Room 201",    capacity:60, is_lab:false },
      { name:"CS Lab",      capacity:40, is_lab:true  },
      { name:"Physics Lab", capacity:40, is_lab:true  },
    ]);
    if (rErr) throw rErr;

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

export function Dashboard({ staff, classes, subjects, rooms, result, setPage, loading, setStaff, setClasses, setSubjects, setRooms, showToast }) {
  const totalHrs = subjects.reduce((a,s)=>a+s.hoursPerWeek,0);
  const labCount = subjects.filter(s=>s.isLab).length;
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!confirm("This will delete all existing data and insert samples. Continue?")) return;
    setSeeding(true);
    await seedDatabase(setStaff, setClasses, setSubjects, setRooms, showToast);
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
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 }}>
        <Heading sub={new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}> Admin Dashboard </Heading>
        <button style={ghostBtn({ fontSize:12, borderColor:C.amber, color:C.amber, background:"#FFFBEB" })} onClick={handleSeed} disabled={seeding}>
          {seeding ? "⏳ Seeding..." : "🌱 Seed Sample Data"}
        </button>
      </div>
      {loading ? <Spinner /> : (
        <>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:24 }}>
          {stats.map(s=>(
            <div key={s.l} style={{ background:s.bg, border:`1.5px solid ${s.bd}`, borderRadius:12, padding:"18px 20px" }}>
              <div style={{ fontSize:13, marginBottom:8 }}>{s.i}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, fontWeight:700, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:11, color:s.c, fontWeight:600, textTransform:"uppercase", marginTop:6 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:20 }}>
          <div style={card()}>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, margin:"0 0 16px" }}>Faculty Overview</h3>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr><th style={thStyle}>Name</th><th style={thStyle}>Subject</th><th style={thStyle}>Load</th></tr></thead>
              <tbody>{staff.map(t=>(
                <tr key={t.id}>
                  <td style={tdStyle}><div style={{ fontWeight:600 }}>{t.name}</div></td>
                  <td style={tdStyle}><span style={tag(t.subject && t.subject.length > 0 ? "#4338CA" : "#A8A29E")}>{t.subject}</span></td>
                  <td style={tdStyle}>{result ? (result.utilization[t.id] || 0) + "%" : "-"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
