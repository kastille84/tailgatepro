# Product Requirements Document (PRD): Digital Toolbox Safety Talks

**Document Status:** 🚧 Work in Progress (WIP) 🚧
**Target Platform:** Mobile-First Progressive Web App (PWA)
**Primary Architecture:** Client (React) / Server (Node.js)

## 1. Executive Summary

The Digital Toolbox Safety Talks application digitizes mandatory safety meetings (toolbox/tailgate talks) for the construction industry. By transitioning from paper-based logs to an offline-capable digital platform, it ensures strict OSHA compliance, guarantees persistent record-keeping, and provides real-time oversight for General Contractors over their active job sites.

## 2. Target Audience & Monetization Strategy

### 2.1 Subcontractors (The Data Creators)

- **Role:** Foremen and field supervisors conducting daily/weekly safety meetings.
- **Pricing Tier:** $29–$99/month (Per User or Per Project).
- **Value Proposition:** Eliminate paper, easily access OSHA-compliant content, and automatically submit required proof of compliance to GCs.

### 2.2 General Contractors (The Data Consumers)

- **Role:** Safety Directors and Project Managers auditing compliance across multiple sites and trades.
- **Pricing Tier:** $250–$1,000+/month (Based on number of active job sites).
- **Value Proposition:** A unified dashboard to monitor, audit, and collect all subcontractor safety logs simultaneously without chasing paper copies.

## 3. Technology Stack

- **Frontend:** React.js, StyledComponents, Tanstack ReactQuery, ReactRouter.
- **Backend:** Node.js, Express.
- **Database & Auth:** Supabase (PostgreSQL).
- **Payments:** Stripe.
- **PDF Generation:** Node.js native libraries (Puppeteer or PDFKit) to maintain a unified backend architecture.
- **Offline Storage:** IndexedDB (via wrapper like Dexie.js or localForage) to handle heavy binary data (photos, offline PDFs) asynchronously without blocking the UI.

## 4. Core Features & Functional Requirements

### 4.1 Offline-First Sync Engine (IndexedDB)

- **Requirement:** Users must be able to load the app, select a topic, record attendance, and save the meeting while completely disconnected from the internet.
- **Mechanism:** Data is written locally to IndexedDB. Once network connectivity is restored, a background sync process pushes queued data to the Supabase backend.
- **Conflict Resolution:** _(🚧 WIP: Needs detailed conflict resolution logic for edge cases where multiple offline updates occur)_.

### 4.2 Automated Content Library

- **Data Source:** Bootstrapped via an LLM script that cleans, formats, and parses public-domain materials from Federal OSHA and state agencies (e.g., Texas Dept of Insurance, Ohio BWC).
- **Tagging & Filtering:** Content must be tagged by trade (e.g., Roofing, Electrical, Demolition, Excavation) allowing instant filtering.
- **Favorites System:** Foremen can bookmark their "Top 10" most-used topics for two-tap access.
- **Custom Talks:** Users must have the ability to author and save their own site-specific safety talks.

### 4.3 Digital Signatures & Attendance Proof

- **Signatures:** Field workers can sign directly on the tablet/phone screen (saved as base64/blob).
- **Photo Capture:** Option to snap a quick photo of the crew.
- **Compliance Warning:** Ensure UX clearly communicates that photo capture is for attendance proof; strictly avoid unconsented biometric scanning/facial recognition to comply with state laws (e.g., BIPA).

### 4.4 Multi-lingual Audio & Verification

- **Audio Playback:** Text-to-speech functionality to read safety topics aloud in English, Spanish, and other requested languages.
- **Comprehension:** A mandatory 3-question digital quiz post-playback to verify worker comprehension before signing.

### 4.5 GC-to-Subcontractor Real-Time Sync

- **Workflow:** Upon meeting completion, a PDF log is instantly generated on the server (using Puppeteer/PDFKit) and routed to the GC's safety dashboard.

## 5. UX/UI Guidelines (Field-Tested Design)

- **Environmental Considerations:** High contrast UI, massive touch targets (buttons), and minimal typing to accommodate bright sunlight, dirty screens, and gloved hands.
- **Voice-to-Text Input:** Integrate Speech-to-Text for foreman notes.
  - _Implementation:_ Web Speech API for the MVP (free/native), with an upgrade path to OpenAI Whisper API or Deepgram (Nova-3) for handling heavy accents and background construction noise.

## 6. Integrations

### 6.1 Procore API Integration

Allow GCs to push final PDF reports directly into existing Procore project folders.

- **Auth:** OAuth 2.0 to obtain project-level write permissions.
- **Upload Flow (4-Steps):**
  1.  Authenticate.
  2.  `POST /rest/v1.1/projects/{project_id}/uploads` (Get upload instructions & presigned URL).
  3.  Upload PDF bytes directly to the provided storage service URL.
  4.  Ping Procore to associate the uploaded file with the GC's Documents tool.

## 7. Open Questions / Work In Progress (🚧 WIP)

1.  **Viral Loop / Onboarding:** Exactly how will GCs invite Subcontractors into the system? Should Subs have a "freemium" view-only account first?
2.  **Data Retention Policies:** Define how long crew photos will be stored on Supabase to balance GC audit needs with worker privacy.
3.  **App Store vs. Web PWA:** Confirm if a true native wrapper (Capacitor/React Native) will eventually be needed for push notifications, or if standard PWA service workers suffice for the MVP.
