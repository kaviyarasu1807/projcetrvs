import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL || "https://ygkjdnhtjqyrcxblwijw.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_isuBYAPVbxwBuisHV_mgHw_FM919Qp8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const mapStaff = (r) => ({
  id: r.id,
  name: r.name,
  subject: r.subject,
  dept: r.dept || "",
  email: r.email || "",
  availability: r.availability || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  maxHrsDay: r.max_hrs_day || 4,
  preferMorning: r.prefer_morning || false,
});

export const mapClass = (r) => ({
  id: r.id,
  name: r.name,
  year: r.year || 1,
  section: r.section || "",
  dept: r.dept || "",
  capacity: r.capacity || 60,
});

export const mapSubject = (r) => ({
  id: r.id,
  classId: r.class_id,
  teacherId: r.teacher_id,
  name: r.name,
  hoursPerWeek: r.hours_per_week || 3,
  isLab: r.is_lab || false,
  preferMorning: r.prefer_morning || false,
});

export const mapRoom = (r) => ({
  id: r.id,
  name: r.name,
  capacity: r.capacity || 60,
  isLab: r.is_lab || false,
});

export const mapTimetable = (r) => ({
  id: r.id,
  timetable: r.timetable_data,
  teacherView: r.teacher_view,
  utilization: r.utilization || {},
  violations: r.violations || [],
  conflicts: r.conflicts || 0,
  algorithm: r.algorithm || "csp",
  fitnessHistory: r.fitness_history || null,
  generatedAt: r.generated_at,
});
