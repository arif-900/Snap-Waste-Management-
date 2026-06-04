# User Manual

Welcome to the **Smart Waste Management Platform** user guide. This platform connects citizens, municipal authorities, and AI tools to facilitate intelligent waste reporting, classification, and collection routing.

## Table of Contents
1. [Introduction](#introduction)
2. [Citizen Portal Guide](#citizen-portal-guide)
3. [Administrator Dashboard Guide](#administrator-dashboard-guide)
4. [Backend Administration](#backend-administration)
5. [Troubleshooting](#troubleshooting)

---

## Introduction

The Smart Waste Management Platform utilizes computer vision (YOLOv8) and generative AI (Google Gemini) to analyze images of waste submitted by citizens. It automatically categorizes the waste, assesses compliance risks, and schedules optimized pickups.

---

## Citizen Portal Guide

### 1. Submit a Waste Report
1. Navigate to the **Citizen Portal** page.
2. Select **Upload Image** to choose a photo of the waste pile or bin.
3. Fill in the location details (coordinates or address). If your device supports geolocation, it will be populated automatically.
4. Input any additional notes (e.g. "large pile of cardboard blocks the sidewalk").
5. Click **Submit Report**.

### 2. View AI Classification Results
Upon submission, the platform processes the image:
*   **Object Recognition**: Identifies items (e.g., plastic bottles, organic matter).
*   **Recyclability Rating**: Categorizes waste as recyclable, hazardous, compostable, or general waste.
*   **Actionable Suggestions**: Provides eco-friendly advice on disposal rules.

---

## Administrator Dashboard Guide

### 1. Monitoring Compliance
Administrators can log in to view real-time statistics:
*   **Total Scans**: Total volume of reported waste incidents.
*   **Average Compliance Score**: Overall health score of inspected sectors.
*   **Leaderboard**: Comparison of compliance score ratings across various city zones.

### 2. Live Stream Logs
The admin dashboard contains a live WebSocket/SSE streaming section showing system status audits, automated checks progress, and real-time AI generation processes.

### 3. Assigning Collection Actions
Admins can select any pending waste report and mark it for dispatch, instantly generating routes for sanitation trucks.

---

## Backend Administration

The backend is written in Python (FastAPI) and handles external service integration:
*   **Supabase PostgreSQL**: Database storing records of all incidents, compliance histories, and admin accounts.
*   **Gemini AI API**: Generates recycling and disposal suggestions.
*   **Ultralytics YOLO**: Locally parses images for object boundaries.

To inspect backend schema documentation, boot the server and navigate to:
*   Interactive Swagger Docs: `http://localhost:8000/docs`
*   Redoc Documentation: `http://localhost:8000/redoc`

---

## Troubleshooting

### Issue: AI Classification Fails
*   **Cause**: Invalid Gemini API key or YOLO model file missing.
*   **Solution**: Check that `GEMINI_API_KEY` is set in your `backend/.env` file. Ensure `yolov8n.pt` is downloaded to the `backend/` directory.

### Issue: Cannot connect to database
*   **Cause**: Invalid Supabase credentials.
*   **Solution**: Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `backend/.env` are correctly copied from your project dashboard.
