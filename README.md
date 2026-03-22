# TimetableAI — AI-Based Scheduler

This project has been restructured from a monolithic React file into a modern **Vite-based Frontend** and an **Express-based Backend**.

## Folder Structure

```
/project-root
  ├── /frontend           # React + Vite Application
  │   ├── /src
  │   │   ├── /api        # Supabase client & Mappers
  │   │   ├── /components # UI Components (Navigation, Dashboard, Pages)
  │   │   ├── /logic      # Frontend logic & Utils
  │   │   ├── /styles     # Theme and CSS
  │   │   ├── App.jsx     # Main Component
  │   │   └── main.jsx    # Entry point
  │   └── vite.config.js  # Vite config (proxies /api to backend)
  │
  ├── /backend            # Node/Express Server
  │   ├── /src
  │   │   ├── /logic      # AI Core Engines (CSP, Genetic Algorithm)
  │   │   └── app.js      # Express server with /api/generate endpoint
  │   └── package.json    # Backend dependencies
  │
  ├── schema.sql          # Supabase Postgres schema
  └── TimetableAI.jsx.old # Original monolithic backup
```

## Setup & Running

### 1. Backend
```bash
cd backend
npm install
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Key Improvements
- **Modularity:** UI, logic, styles, and API calls are separated.
- **Backend AI:** Computational heavy-lifting (CSP, GA) moved to Node.js backend.
- **Proxying:** Vite handles proxying `/api` requests to the local backend.
- **Scalability:** Easy to add new pages/features without bloating a single file.
