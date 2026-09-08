# MetroPulse NYC 🚇
> A real-time transit tracker, community incident board, and commuter safety network for New York City riders.

---

## 📌 Project Overview

Every day, millions of New Yorkers rely on the MTA subway system, yet riders constantly navigate two major pain points: **disconnected transit data** and **commuter safety concerns**. 

While general mapping platforms provide static schedules, they often fail to capture real-time delays, platform-level conditions, or sudden infrastructure failures as they happen. Simultaneously, late-night riders, students, and solo commuters frequently experience safety anxiety when waiting on empty platforms or navigating transit corridors alone.

**MetroPulse NYC** is a civic transit monitor and community safety web application engineered to make urban commuting more predictable, transparent, and secure. 

The platform bridges real-time infrastructure feeds with grassroots rider reports:
* **Live Transit Intelligence:** Ingests official MTA data to give riders direct access to live train arrivals, line disruptions, and station alerts.
* **Crowdsourced Incident Feed:** Functions as a localized "Citizen for Transit," empowering commuters to report and verify real-time platform conditions, hazards, delays, and equipment outages.
* **SafeCommute Coordination:** A community-first hub where verified riders can coordinate travel windows, find others moving along the same lines, and travel together for safer commutes.

By uniting operational transit feeds with community-driven collaboration, MetroPulse transforms passive transit navigation into an active, connected civic network.

---

## 🚀 Core Features

### 1. Live Transit Arrival & Station Monitor
* Ingests real-time MTA GTFS feeds to display live countdown clocks and upcoming train arrival times for stations across the network.
* Highlights active MTA service alerts, planned weekend maintenance, and emergency line reroutes via a real-time status banner.
* Features an interactive transit map allowing users to browse stations, explore lines, and inspect live arrival boards.

### 2. User Accounts & Commute Profiles
* Secure account registration and authentication (Email/Password or OAuth).
* Personalized commuter dashboards where users can bookmark frequent stops, save daily travel routes, and configure route-specific alert notifications.
* User profile badging to establish community trust and accountability across interaction boards.

### 3. "SafeCommute" Travel Coordination Hub
* Allows riders to publish upcoming planned trips (departure station, destination corridor, and departure time window) to connect with other commuters traveling along similar paths.
* Commuters can opt into a shared "Commute Group" to sync schedules for walking to stations or riding during late-night hours.
* Dedicated per-trip coordination threads where group members can confirm exact meetup spots (e.g., station turnstiles or specific platform markers).

### 4. Live Station Incident & Hazard Feed
* A community reporting system allowing riders to post immediate updates regarding platform conditions, unexpected delays, broken turnstiles, or safety concerns.
* Structured categorization tags (e.g., *Late Train*, *Station Hazard*, *Elevator Out of Service*, *Safety Alert*) for fast scanning.
* Community verification and upvoting system so fellow riders can vouch for active reports and confirm when an issue has cleared.

---

## 🛠️ Architecture & Tech Stack

This project is built as a decoupled **Single Page Application (SPA)** with **Client-Side Rendering (CSR)**, splitting UI presentation from backend service logic:

* **Client-Side Frontend:**
  * **Framework:** React.js (via Vite)
  * **Deployment/Hosting:** Vercel

* **Backend REST API:**
  * **Framework:** Python (FastAPI)
  * **Deployment/Hosting:** Render

* **Database & Storage:**
  * **Database:** Cloud PostgreSQL (managed via Supabase)
