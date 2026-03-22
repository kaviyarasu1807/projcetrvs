import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runCSP, runGA, DEFAULT_DAYS, DEFAULT_SLOTS } from "./logic/engine.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ── AI Generation Endpoint ────────────────────────────────────
app.post("/api/generate", (req, res) => {
  try {
    const { teachers, classes, subjects, rooms, algorithm, params } = req.body;
    
    if (!teachers || !classes || !subjects) {
      return res.status(400).json({ error: "Missing required data for generation" });
    }

    let result;
    const days = DEFAULT_DAYS;
    const slots = DEFAULT_SLOTS;

    if (algorithm === "ga") {
      result = runGA(teachers, classes, subjects, days, slots, params || {}, (m) => console.log(m));
    } else {
      result = runCSP(teachers, classes, subjects, days, slots, rooms || [], (m) => console.log(m));
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Generation error:", err);
    res.status(500).json({ error: "Internal server error during generation" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`🚀 TimetableAI Backend running on http://localhost:${PORT}`);
});
