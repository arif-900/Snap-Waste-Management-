# Smart Waste Management Backend (FastAPI + Firebase)

This directory contains the fully modular, RESTful backend codebase for the **Smart Waste Management Monitoring System** designed for Hyderabad. The API integrates **FastAPI**, **Firebase Firestore**, **Firebase Storage**, and the **Gemini Vision AI API** to classify waste images and store reports with metadata and geolocations.

---

## 1. Directory Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI Router & Endpoint Definitions (CORS, Static serve, Errors)
│   ├── config.py            # Configuration settings (Pydantic Settings wrapper)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── firebase_service.py # Firestore operations & Storage uploads (with mock database fallback)
│   │   └── gemini_service.py   # Google Generative AI (Gemini) SDK integration (with mock classification fallback)
│   └── schemas/
│       ├── __init__.py
│       └── models.py        # Pydantic schemas for request validation & responses
├── requirements.txt         # Package dependencies
├── .env.example             # Configuration templates
└── README.md                # Development instructions (This document)
```

---

## 2. Dependencies (`requirements.txt`)

The core dependencies include:
- `fastapi` & `uvicorn` for high-performance async REST hosting.
- `pydantic` & `pydantic-settings` for type safety and dotenv-based configurations.
- `firebase-admin` for communicating with Firestore NoSQL Database and Cloud Storage bucket.
- `google-generativeai` & `pillow` for converting image files and executing Gemini Vision requests.
- `python-multipart` to support file uploads (`multipart/form-data`) in routes.

---

## 3. Configuration Setup (`.env`)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill out the environment parameters:
   - **`GEMINI_API_KEY`**: Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
   - **`FIREBASE_CREDENTIALS_PATH`**: Download the private key configuration file (`serviceAccountKey.json`) from your Firebase Console (Project Settings > Service Accounts > Generate New Private Key). Place it in the `backend/` root directory.
   - **`FIREBASE_STORAGE_BUCKET`**: Find your Storage Bucket URL in your Firebase Console (Storage tab). Put it here without the `gs://` prefix (e.g. `my-project-id.appspot.com`).

> [!NOTE]
> **Hackathon Ready / Offline Support**: If `firebase-admin` is not initialized or a credentials key is not found, the server automatically switches to **Mock mode**. It will write complaints in memory and save images to a local directory (`static/uploads/`). Similarly, if no `GEMINI_API_KEY` is present, it uses a mock waste classifier. This allows frontend developers to test API endpoints immediately without setting up accounts.

---

## 4. How to Run Locally

### Step A: Initialize Virtual Environment
```bash
# Create python environment
python -m venv venv

# Activate on Windows:
venv\Scripts\activate
# Activate on MacOS/Linux:
source venv/bin/activate
```

### Step B: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step C: Run FastAPI Server
```bash
# Run server with live reloading
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Interactive API Documentation (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
- Alternative Documentation (Redoc): [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 5. API Reference Table

All endpoints are hosted relative to the prefix `/api/v1`.

| Method | Endpoint | Request Payload | Response Body | Description |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/complaints/report` | `multipart/form-data`:<br>- `image`: File (required)<br>- `latitude`: Float (required)<br>- `longitude`: Float (required)<br>- `phone`: String (optional)<br>- `notes`: String (optional) | `ComplaintResponse` (JSON) | Uploads photo, triggers Gemini AI analysis, geocodes Hyderabad address, saves to database, and returns the full JSON record. |
| **GET** | `/complaints` | Query Params:<br>- `status`: String (optional)<br>- `waste_type`: String (optional) | `List[ComplaintResponse]` | Fetches all complaints sorted by creation time. Filtering by status or waste category is supported. |
| **GET** | `/complaints/{id}` | Path Parameter:<br>- `id`: String | `ComplaintResponse` | Retrieves details for a specific complaint report. |
| **PATCH**| `/complaints/{id}/status` | Body JSON:<br>`{ "status": "In Progress" }` | `ComplaintResponse` | Modifies the resolution state (`Pending`, `In Progress`, `Resolved`). |
| **DELETE**| `/complaints/{id}` | Path Parameter:<br>- `id`: String | `{ "success": true, "message": "..." }` | Deletes a complaint record from the database. |
| **GET** | `/analytics/summary` | None | `AnalyticsSummaryResponse` | Aggregated counters: total complaints, pending, resolved, and counts grouped by severity/type. |
| **GET** | `/analytics/hotspots` | None | `List[HotspotResponse]` | Returns coordinate groups clustered by grid proximity (~100m) for heatmap charting. |
