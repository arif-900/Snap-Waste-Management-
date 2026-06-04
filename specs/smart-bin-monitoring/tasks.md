# Task List: IoT Smart Bin Fullness Monitoring

## 1. Development Tasks
- `[ ]` **Database Configuration**
  - `[ ]` Run migration script to create `smart_bins` table.
  - `[ ]` Enable RLS and insert initial mock bin dataset.
- `[ ]` **Backend Service**
  - `[ ]` Define Pydantic request models in `app/schemas/models.py`.
  - `[ ]` Add `/api/v1/telemetry/report` POST handler inside `app/main.py`.
  - `[ ]` Implement SSE broadcaster route in `/api/v1/telemetry/stream`.
- `[ ]` **Frontend Layout**
  - `[ ]` Integrate new Leaflet marker pins for smart bins.
  - `[ ]` Build fullness indicators panel in the admin command panel.

## 2. Testing Tasks
- `[ ]` **Unit Validation**
  - `[ ]` Test Pydantic parser thresholds (boundaries for 0-100% capacity).
- `[ ]` **Integration Tests**
  - `[ ]` Mock sensor telemetry updates and confirm Supabase insert triggers.

## 3. Deployment Tasks
- `[ ]` Run migrations in Supabase production dashboard.
- `[ ]` Deploy changes to Vercel production server.
