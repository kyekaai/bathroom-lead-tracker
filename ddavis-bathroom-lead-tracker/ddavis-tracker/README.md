# DD Davis Bathroom Lead Tracker

A live, shared lead tracker for the DD Davis bathroom team. One place showing exactly where every customer is up to — and what needs doing today.

- **Frontend:** React (Vite), hosted on **Netlify**
- **Live database, login and file storage:** **Supabase** (Postgres + Auth + Storage + Realtime)
- When any team member updates a lead, everyone else's screen refreshes automatically.

---

## 1. Supabase setup (about 10 minutes)

1. Go to https://supabase.com → **New project**.
   - Name: `ddavis-lead-tracker`
   - Region: **West EU (London)** (closest to you)
   - Set a strong database password and keep it somewhere safe.
2. Wait for the project to finish provisioning.

### 1a. Database schema

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Open the file **`supabase/schema.sql`** from this project, paste the whole thing in, and click **Run**.

That single script creates:
- all tables: `profiles`, `leads`, `follow_ups`, `lead_files`, `import_history`, `activity`
- Row Level Security on every table — **no public access to customer data**; only logged-in users can read or write anything
- the private **`lead-files`** storage bucket for CAD drawings, PDFs, screenshots, selection forms and quotes
- realtime publication so all 4 users see live updates
- a trigger that automatically creates a profile whenever you add a user

### 1b. Turn off self-signup (important)

**Authentication → Sign In / Up → disable "Allow new users to sign up".**
Only the 4 accounts you create below will ever be able to log in.

### 1c. Create the 4 users

**Authentication → Users → Add user → Create new user**, one at a time. For each, tick **Auto Confirm User** and set a strong password:

| Email | Password | Then set role to |
|---|---|---|
| danny@ddavisltd.co.uk | (choose one) | management |
| kyle@ddavisltd.co.uk | (choose one) | management |
| claire@ddavisltd.co.uk | (choose one) | admin |
| crystal@ddavisltd.co.uk | (choose one) | designer |

A profile row is created automatically for each. To set names and roles, open **SQL Editor** and run (edit emails if yours differ):

```sql
update public.profiles p set name = 'Danny',   role = 'management' from auth.users u where u.id = p.id and u.email = 'danny@ddavisltd.co.uk';
update public.profiles p set name = 'Kyle',    role = 'management' from auth.users u where u.id = p.id and u.email = 'kyle@ddavisltd.co.uk';
update public.profiles p set name = 'Claire',  role = 'admin'      from auth.users u where u.id = p.id and u.email = 'claire@ddavisltd.co.uk';
update public.profiles p set name = 'Crystal', role = 'designer'   from auth.users u where u.id = p.id and u.email = 'crystal@ddavisltd.co.uk';
```

(Everyone can also change their own display name later in **Settings** inside the app.)

### 1d. Get your API keys

**Project Settings → API**. You need:
- **Project URL** (looks like `https://abcdefgh.supabase.co`)
- **anon public** key

These are safe to use in the frontend — Row Level Security is what protects the data.

---

## 2. Run it locally (optional but recommended first)

```bash
npm install
cp .env.example .env        # then paste in your URL and anon key
npm run dev                 # opens http://localhost:5173
```

Log in as one of the 4 users and check everything works.

---

## 3. Netlify deployment

1. Push this folder to a **private** GitHub repository.
2. In Netlify: **Add new site → Import an existing project → GitHub** → pick the repo.
3. Build settings are read automatically from `netlify.toml` (build `npm run build`, publish `dist`).
4. Before the first deploy, add the environment variables:
   **Site configuration → Environment variables → Add**
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
5. Click **Deploy site**. Done — share the URL with the team. It works on desktop, tablet and mobile (there's a floating Menu button on phones).

**Recommended:** in Supabase, **Authentication → URL Configuration**, set the Site URL to your Netlify URL.

---

## 4. Test the CSV import

1. Log in → **Import CRM Leads**.
2. Upload **`sample-data/crm-export-sample.csv`** (included in this project).
3. Check the column mapping screen auto-detected the columns, click **Next: review import**.
4. You should see: new leads, one row flagged as *missing key details* (Mr David Brown has no phone/email).
5. Click **Confirm import**, then upload the **same file again** — this time rows should appear under *existing leads to update / possible duplicates* instead of being imported twice.
6. Check **Import History** shows both runs with counts.

Then export a real CSV from your CRM and repeat. Duplicate matching uses **phone, email, customer name, address and postcode**.

---

## 5. How the automation works (no admin needed)

The app calculates stage colour, priority and **Next Action** from the data — staff never have to work it out:

- Survey complete + selection form not back after **4 days** → *chase selection form* (0–3 days normal · 4–7 amber · 8–14 red · 14+ critical)
- CAD required but not booked → *book CAD appointment*
- CAD approved + no quote sent → *send quote*
- Quote sent **more than 3 days** ago with no decision → *follow up quote*
- Any follow-up date in the past → highlighted red as overdue
- **5 follow-ups** with no response → the app asks you to confirm marking the lead **Lost — No Response** (never automatic)

Everything above feeds **Today's Actions** at the top of the dashboard — click any item to jump straight to the lead.

---

## 6. Project structure

```
supabase/schema.sql      ← the whole database (run once in Supabase)
sample-data/             ← CSV for import testing
src/lib/logic.js         ← all business rules (stages, priorities, next actions, duplicates)
src/lib/supabase.js      ← database client + activity logger
src/pages/               ← Login, Dashboard, Today's Actions, Leads, Add Lead, Lead Detail,
                           Import, Import History, CAD Designs, Quotes, Calendar, Reports,
                           Settings, User Management
```

### Design note
Follow-ups, files, imports and the activity timeline have their own tables. CAD and quote details live on the lead record itself (one lead = one CAD job = one quote), which keeps the app fast and the queries simple. All CAD and quote fields from the spec are tracked.

---

## 7. Adding or removing a user later

Supabase dashboard → **Authentication → Users**. Add (with Auto Confirm) or delete there; the app picks it up automatically. Roles can be changed in the app by a management user on the **User Management** page.
