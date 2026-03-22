import React, { useState, useEffect, useCallback } from "react";
import { supabase, mapStaff, mapClass, mapSubject, mapRoom, mapTimetable } from "./api/supabase";
import { DEFAULT_DAYS, DEFAULT_SLOTS } from "./logic/utils";
import { C, FONT_IMPORT } from "./styles/theme";
import { Toast, Spinner } from "./components/Common";
import { LoginPage } from "./components/LoginPage";
import { NavBar } from "./components/NavBar";
import { Dashboard } from "./components/Dashboard";

// For demo purposes, we'll keep sub-pages in a separate file or define them here if they are small.
// In a real project, each would be in its own file under components/pages/
import { StaffPage, ClassesPage, SubjectsPage, RoomsPage, TimeSlotsPage, ConfigPage, GeneratePage, TimetablePage } from "./components/Pages";

export default function App() {
  const [session, setSession] = useState(null);
  const [page,    setPage]    = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);

  // Data State
  const [staff,    setStaff]    = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms,    setRooms]    = useState([]);
  const [days,     setDays]     = useState(DEFAULT_DAYS);
  const [slots,    setSlots]    = useState(DEFAULT_SLOTS);
  const [history,  setHistory]  = useState([]);
  const [result,   setResult]   = useState(null);

  const showToast = useCallback((msg, type="error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: s } = await supabase.from("staff").select("*").order("created_at");
      const { data: c } = await supabase.from("classes").select("*").order("created_at");
      const { data: b } = await supabase.from("subjects").select("*").order("created_at");
      const { data: r } = await supabase.from("rooms").select("*").order("created_at");
      const { data: h } = await supabase.from("timetables").select("*").order("generated_at", { ascending: false });

      if (s) setStaff(s.map(mapStaff));
      if (c) setClasses(c.map(mapClass));
      if (b) setSubjects(b.map(mapSubject));
      if (r) setRooms(r.map(mapRoom));
      if (h) {
        setHistory(h.map(mapTimetable));
        if (h[0]) setResult(mapTimetable(h[0]));
      }
    } catch (e) { showToast(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData(); else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData();
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg0 }}><Spinner /></div>;
  if (!session) return <LoginPage onLogin={setSession} />;

  return (
    <div style={{ minHeight:"100vh", background:C.bg0, fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('${FONT_IMPORT}'); @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      <NavBar 
        page={page} 
        setPage={setPage} 
        userEmail={session.user.email}
        hasResult={!!result}
        onLogout={() => supabase.auth.signOut()} 
      />

      <main style={{ maxWidth:1200, margin:"0 auto", padding:32 }}>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}

        {page === "dashboard" && (
          <Dashboard 
            staff={staff} classes={classes} subjects={subjects} rooms={rooms} 
            result={result} setPage={setPage} loading={loading}
            setStaff={setStaff} setClasses={setClasses} setSubjects={setSubjects} setRooms={setRooms}
            showToast={showToast}
          />
        )}
        {page === "staff"    && <StaffPage staff={staff} setStaff={setStaff} show={showToast} />}
        {page === "classes"  && <ClassesPage classes={classes} setClasses={setClasses} show={showToast} />}
        {page === "subjects" && <SubjectsPage subjects={subjects} setSubjects={setSubjects} staff={staff} classes={classes} show={showToast} />}
        {page === "rooms"    && <RoomsPage rooms={rooms} setRooms={setRooms} show={showToast} />}
        {page === "slots"    && <TimeSlotsPage slots={slots} setSlots={setSlots} days={days} setDays={setDays} show={showToast} />}
        {page === "config"   && <ConfigPage days={days} setDays={setDays} show={showToast} />}
        {page === "generate" && (
          <GeneratePage 
            staff={staff} classes={classes} subjects={subjects} rooms={rooms} 
            setResult={setResult} setHistory={setHistory} setPage={setPage} show={showToast}
          />
        )}
        {page === "timetable" && <TimetablePage result={result} setResult={setResult} classes={classes} staff={staff} show={showToast} />}
      </main>
    </div>
  );
}
