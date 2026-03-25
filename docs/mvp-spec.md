# MVP Specification

Digital Event Planning Assistant (Nigeria)

## 1. MVP Goal

Validate that users want:

- A smart planning assistant
- Curated vendor recommendations
- Simple guest/gift management

The MVP should be fast to build, low-cost, and focused.

---

## 2. Core MVP Features

### A. Smart Event Onboarding & Planning Kickoff

When a user starts planning a new event, they are walked through a guided questionnaire — designed to feel like a conversation with an experienced event planner. Questions are presented one at a time (not a long form) and adapt based on prior answers.

**Sample questions:**

- What type of event are you planning? (wedding, birthday, naming ceremony, corporate, etc.)
- When is the event? (or do you have a rough timeframe?)
- Where would you like to host it? (city/area, or open to suggestions?)
- Approximately how many guests are you expecting?
- What is your approximate budget?
- Do you have a preferred style or theme?
- Are there any vendors you already have in mind, or are you starting from scratch?

**Outputs generated after questionnaire:**

- **Personalised planning checklist** — a step-by-step to-do list based on event type, guest count, and timeline (e.g. "Book venue 3 months out", "Send invites 6 weeks out")
- **Proposed event plan** — a summary of the event with budget allocation, suggested vendor categories, and key milestones
- **Recommended vendors** — curated matches from the vendor directory based on location, event type, and budget

### B. Vendor Discovery (Curated)

- 20–30 verified vendors
- Categories: venues, caterers, photographers, DJs, decorators
- Vendor profiles with pricing, photos, reviews

### C. Guest List & Smart Invite Management

**Invite creation:**
- Host adds guests (name + email)
- Host sets a plus-one allocation per guest (e.g. "you + 1", "you only", "you + 3")
- Each guest receives a unique invite link via email containing their personalised QR code

**Guest experience:**
- Guest opens their invite link, sees event details and their allocated spots
- If they want to bring more people than allocated, they can submit a plus-one request (specifying how many extra)

**Host approval flow:**
- Host receives an email notification when a guest requests extra spots
- Host approves or rejects the request from within the app
- Guest is notified by email of the outcome
- If approved, their QR code automatically updates to reflect the new allocation

**Event check-in:**
- At the door, host or coordinator opens the check-in interface on any device
- Scan or manually look up a guest's QR code
- System shows: guest name, approved guest count, number already checked in
- Validates entry and marks guests as arrived

### D. Gift List / Cash Contribution Link

- Simple gift list creation
- Cash contribution link (via Paystack/Flutterwave)

---

## 3. Non-Goals (Not in MVP)

- Full marketplace
- Vendor availability calendars
- Payment escrow
- Seating charts
- Asoebi management
- Mobile app (web-first MVP)

---

## 4. User Flows

### Flow 1: Create Event

1. User starts a new event
2. System walks them through a guided onboarding questionnaire (one question at a time)
3. Based on responses, system generates:
   - A personalised planning checklist
   - A proposed event plan with budget breakdown and milestones
   - Curated vendor recommendations
4. User reviews and saves the plan
5. User can edit checklist items, adjust budget, or swap vendor suggestions

### Flow 2: Vendor Discovery

1. User views recommended vendors
2. User contacts vendor via WhatsApp or phone

### Flow 3: Guest List & Check-in

1. Host adds guests and sets plus-one allocation per guest
2. System sends each guest a unique invite email with their QR code
3. Guest opens invite, views their allocation
4. If guest requests extra spots, host is notified by email
5. Host approves/rejects in the app → guest is notified by email
6. On event day, host opens check-in interface, scans QR codes to validate and track arrivals

---

## 5. Success Metrics

- Onboarding questionnaire completion rate
- % of users who save the generated plan
- Vendor contact clicks
- Guest list usage
- Gift list creation
- User retention after 7 days

---

## 6. MVP Tech Stack (Web-first)

- Frontend: React or Next.js (free hosting on Vercel)
- Backend: Node.js or Python (FastAPI) on free-tier Render/Fly.io
- Database: PostgreSQL (Supabase free tier)
- Auth: Supabase Auth or Firebase Auth
- File storage: Supabase storage (free tier)
- Payments: Paystack/Flutterwave
- Analytics: PostHog (free tier)
- Email: Resend or SendGrid (invite delivery, plus-one request/approval notifications)

---

## 7. Deployment (Free-tier)

- Frontend: Vercel (free)
- Backend: Render/Fly.io (free)
- Database: Supabase (free)
- CI/CD: GitHub Actions (free)

---

## 8. Privacy & Security

- JWT-based authentication
- Encrypted data at rest (Supabase default)
- HTTPS enforced
- Minimal data collection
- GDPR-friendly structure
- Vendor data stored separately from user data
