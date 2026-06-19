<div align="center">

<img src="https://img.shields.io/badge/DeskGuard-Spatial%20Library-3B82F6?style=for-the-badge&logo=bookstack&logoColor=white" alt="DeskGuard" />

# DeskGuard
### Real-Time 3D Spatial Ledger & Seat Release Automation

[![React](https://img.shields.io/badge/Framework-React%2018-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Three.js](https://img.shields.io/badge/3D%20Graphics-Three.js-black?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**Stop seat-hoarding and ensure fair library workspace access.**  
3D digital twin · Background sweep daemon · Real-time socket sync · Vite React SPA

Built for [NextGenHacks 2026](https://nextgenhacks.devpost.com)

</div>

---

## 📸 System Mindmap

<div align="center">
  <img width="1200" alt="Homepage" src="/architecture.png" />
  <p><em>DeskGuard System Architecture & Mindmap</em></p>
</div>

---

## 💡 The Problem

Students frequently hoard library study desks by leaving books or bags on them for hours, preventing others from finding collaborative study zones. DeskGuard resolves this by providing a real-time WebGL 3D floor ledger coupled with automated sweep policies to automatically release abandoned seats.

---

## ✨ Features

| Module | What it does |
|--------|-------------|
| 🗺️ **3D Digital Twin Map** | A high-performance WebGL library floor model powered by Three.js. Visually displays real-time seat states (Free: green, Occupied: red, Away: orange, Abandoned: purple). |
| 🛡️ **Automated Sweep Daemon** | Simulates backend cron sweeps that monitor seat heartbeats. If a student leaves their desk "Away" for more than 20 minutes, the seat is reclaimed and released back into the pool. |
| ⏳ **Live Metrics Panel** | Renders dynamic metrics counters on the homepage showcasing sweep daemon active states, next sweep timer ticks, and database ledger sync rates. |
| 📡 **Real-Time Terminal Logs** | Features an interactive mock terminal emulator on the landing page showing cron checks, alerts, and seat release actions in real-time. |
| 🔒 **Auth & Role Routing** | Google OAuth via Supabase automatically routes users. Students access the check-in map; librarians bypass to control-center monitors. |
| 📱 **QR Code Check-In** | Integrated camera-based QR reader (Html5-Qrcode) with manual simulator fallback allows students to scan physical seats to lock the ledger. |
| 📊 **Librarian Command Center** | Provides real-time event logging, visual seat state tallies, check-in history lists, and manual sweep dispatch controls. |

---

## 🛠️ Tech Stack

- **Framework**: React 18 (Hooks, Context, Router guards)
- **Build Tooling**: Vite 8 (Fast dev server & optimized chunk building)
- **3D Engine**: Three.js (Mesh geometry, direction lights, OrbitControls, raycast hover hitboxes)
- **Database & Auth**: Supabase (PostgreSQL tables, auth profiles, realtime socket subscriptions)
- **Styling**: Vanilla CSS (Floating 3D cards, ambient glows, webkit scrollbars, terminal themes)
- **QR Reader**: Html5-Qrcode (Camera scanning with manual simulator bypass)

---

## 🗄️ Database Schema

DeskGuard uses three Supabase tables:

### 1. `seats`
Stores real-time floor ledger telemetry:
- `id` (Integer - Primary Key)
- `state` (String: `free`, `occupied`, `away`, `abandoned`)
- `user_id` (UUID - references Auth Users)
- `user_email` (String)
- `last_updated` (Timestamp)
- `alert_message` (String)

### 2. `profiles`
Stores student-specific university registration parameters:
- `id` (UUID - Primary Key)
- `full_name` (String)
- `reg_no` (String)
- `department` (String)
- `academic_year` (String)

### 3. `librarians`
Whitelist of librarian emails authorized to access the dashboard:
- `email` (String - Primary Key)

---

## 🚀 Running Locally

### 1. Clone the repository
```bash
git clone https://github.com/immanuel-thomas-j/DeskGuard-TeamVyomex.git
cd DeskGuard-TeamVyomex
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file in the root directory and add your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```
*(Note: A fallback configuration is embedded in the codebase to run immediately if keys are omitted).*

### 4. Run the development server
```bash
npm run dev
```
Then open `http://localhost:5173`.

### 5. Production build
To build and optimize the project for production deployment:
```bash
npm run build
npm run preview
```

---

## 📄 License

Distributed under the MIT License.

---

<div align="center">
  <sub>Built with ❤️ for NextGenHacks 2026</sub>
</div>
