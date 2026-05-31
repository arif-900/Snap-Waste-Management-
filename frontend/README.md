# Smart Waste Management Frontend (React + Tailwind CSS)

This directory contains the premium, single-page React frontend application for the **Smart Waste Management Monitoring System** designed for Hyderabad. The app uses **Vite**, **Tailwind CSS v4**, **Lucide Icons**, and the **Leaflet Maps CDN**.

---

## 1. Directory Structure

```text
frontend/
├── public/                  # Static assets
├── src/
│   ├── components/
│   │   ├── MapViewer.jsx    # Sleek Leaflet dark-mode map integration (with pulsing severity pins)
│   │   └── StatsCard.jsx    # Analytics dashboard overview cards (Total, Pending, In Progress, Resolved)
│   ├── pages/
│   │   ├── CitizenReport.jsx# Citizen portal (drag-and-drop uploader, HTML5 GPS lookup, track report by phone)
│   │   └── AdminDashboard.jsx # Admin Command Center (dual-pane map and case list, status update/delete operations)
│   ├── services/
│   │   └── api.js           # Central Axios HTTP service handler for communicating with FastAPI
│   ├── App.jsx              # Main router gateway and responsive page layout
│   ├── index.css            # Tailwind base, customizations, and animations
│   └── main.jsx             # React entry point wrapper
├── postcss.config.js        # PostCSS configuration for Tailwind integration
├── package.json             # Scripts and packages manifest
└── README.md                # Development instructions (This document)
```

---

## 2. Configuration Settings (`.env`)

By default, the frontend attempts to talk to the FastAPI backend hosted at `http://localhost:8000`. If your backend is running on a different port or hosted in production (e.g. Render, Railway), create a `.env` file in the `frontend` directory:

```bash
# Create dotenv file
touch .env
```

Define the API gateway URL variable:
```env
VITE_API_URL=http://localhost:8000
```

---

## 3. How to Run Locally

### Step A: Install Dependencies
```bash
# Navigate to the frontend folder
cd frontend

# Install package dependencies
npm install
```

### Step B: Launch Development Server
```bash
npm run dev
```

The server will spin up and display the local hosting link:
- Local dev link: [http://localhost:5173/](http://localhost:5173/)

---

## 4. Key Highlights & Features

1. **Leaflet Map Viewer Compatibility**: Integrated directly using the browser Leaflet CDN window object inside standard React lifecycles. This bypasses React 19 package clashing and avoids third-party library wrapper weight.
2. **Citizen Image SNAPs & GPS Location Tracker**: Detects user latitude/longitude using browser HTML5 Geolocation. Integrates a fine-tune map picker allowing citizens to manually adjust the pins.
3. **Double-Click Administrative Actions**: Admins can update incident reports to `In Progress` or `Resolved` in real time, or delete reports from the database.
4. **Curated Glassmorphism Design Theme**: Styled in high-contrast slate dark layouts coupled with custom emerald highlights, smooth hover transitions, and responsive structures.
