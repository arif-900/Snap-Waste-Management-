# Feature Specification: Automated Smart Pickup Scheduling

## 1. Overview & Requirements
*   **Summary**: Auto-schedule trash vehicle collections based on waste fullness and hazardous levels reported by citizens.
*   **Target Audience**: Sanitation crew, City Administrators.
*   **User Stories**:
    *   *As an Administrator, I want the system to auto-dispatch trucks to high-priority coordinates.*
    *   *As a Sanitation Operator, I want optimized directions to minimize fuel cost.*

## 2. Technical Architecture & Endpoints
*   **Endpoints**:
    *   `POST /api/v1/pickups/schedule`: Computes best path for vehicles and creates dispatch tickets.
    *   `GET /api/v1/pickups/routes`: Fetches current active routes.

## 3. UI/UX Flow
*   Admin views dynamic routes overlaid on Mapbox mapping interface in the Admin Dashboard.
*   Sanitation crew views navigation on mobile devices.

## 4. Verification Plan
*   Create unit tests to mock vehicle routing heuristics.
*   Mock Supabase database insertions for scheduled pickups.
