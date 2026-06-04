# Feature Specification: IoT Smart Bin Fullness Monitoring

## 1. Problem Statement
Municipal authorities frequently struggle with inefficient collection routes, leading to overflowing trash bins in some areas while clean bins are visited unnecessarily. This increases fuel costs, labor times, and city pollution. By integrating IoT fullness sensors into municipal trash bins, the city can report fullness metrics in real-time, allowing sanitation crews to target only bins that exceed 80% capacity.

## 2. User Stories
*   **As a Citizen**, I want to see which public bins near me are full so that I can find an empty bin to deposit my recycling.
*   **As a Sanitation Operator**, I want a list of only bins exceeding 80% fullness so that I can plan optimized routing for my team.
*   **As a City Administrator**, I want an aggregate view of historical bin statistics to plan future bin distributions.

## 3. Functional Requirements
1.  **Sensor Intake Endpoint**: A public API endpoint allowing simulated IoT devices to POST fullness percentages, battery levels, and telemetry updates.
2.  **State Aggregation**: A service calculating running averages of bin utilization rates per sector.
3.  **Visual Command Overlay**: Render active fullness markers on the Leaflet administrative map interface, with color indicators (Green < 50%, Yellow 50-80%, Red > 80%).

## 4. Acceptance Criteria
*   IoT fullness updates must be rejected if the payload contains values outside the 0-100 percentage boundaries.
*   The map overlay must reload telemetries automatically every 30 seconds via Server-Sent Events (SSE).
*   Sanitation crew dispatch triggers must be restricted to authenticated administrative accounts.
