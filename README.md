# 🕒 TimetableAI - R.V.S. College Scheduler

AI-powered scheduling application for R.V.S. College of Engineering & Technology. This project is a full-stack web application designed to optimize complex academic timetables using specialized algorithms.

## 🚀 Project Architecture 
The application is split into two main parts:
- **`frontend/`**: Modern React + Vite application for user interaction and data visualization.
- **`backend/`**: Node.js + Express API that houses the AI Generation Engine (CSP & GA algorithms).
- **`supabase/`**: Used for Authentication and Real-time Database storage.

## 🛠 Project Structure
```text
Root/
├── backend/        -- AI Engine (Node/Express)
│   ├── src/app.js  -- Express server entry
│   └── src/logic/  -- CSP/Genetic AI logic
├── frontend/       -- Modern UI (React/Vite)
│   ├── src/api/    -- Supabase client connection
│   ├── src/components/ -- UI Modules (NavBar, Pages, etc.)
│   └── src/logic/  -- Shared utils
├── schema.sql      -- SQL file to initialize Supabase
└── .gitignore      -- Git rules
```

## 🛠 Getting Started

### 1. Database Setup
1.  Create a project on [Supabase.com](https://app.supabase.com/).
2.  Open the **SQL Editor** in Supabase.
3.  Copy and run the contents of the `schema.sql` file from the root directory.

### 2. Environment Variables
Create a `.env` file in the root directory (based on `.env.example`) and add your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Installation & Development
From the root folder, run:
```bash
npm install                     # Install concurrently in root
npm run install:all             # Install all sub-dependencies
npm run dev                     # Start both frontend and backend
```

## 📜 Authors
- R.V.S. College Dept. of IT
- Refulgent ★ Virtuous ★ Splendour

---
*Powered by TimetableAI Engine*
