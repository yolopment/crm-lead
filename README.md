# Lead CRM — Full-Stack Call Tracking & Sales Management Platform

A production-grade, multi-tenant SaaS CRM built with feature parity to **LeadZam**. Features automatic call tracking, audio recording sync via a native Android companion app, team performance analytics, and round-robin lead distribution with leave management.

---

## Architecture Overview

* **`server/`**: Node.js & TypeScript REST API (Express, Prisma ORM, PostgreSQL, HTTP Range Audio Streamer, Meta Lead Ads Webhook Receiver).
* **`web/`**: Next.js 14 App Router, React 18, Tailwind CSS, Lucide icons (Dashboard, Calls list with inline audio player, Reports, Leads management, Settings, Team & Device Management).
* **`android/`**: Native Android companion app (Kotlin, Jetpack Compose, Room SQLite, AndroidX WorkManager, Persistent Foreground Service, Call Audio File Observer).
* **`deploy/`**: Hostinger Cloud VPS production deployment scripts (Nginx reverse proxy with HTTP Range support, PM2 process manager, automated setup script).

---

## Seed Accounts & Default Credentials

| Field | Value |
|---|---|
| **Organization** | YOLOPMENT PRIVATE LIMITED |
| **Email** | `yolopment@gmail.com` |
| **Password** | `admin123` |
| **Role** | ADMIN |
| **Android Pairing Token** | `c89fae019b88231c` |
| **Meta Webhook Verify Token** | `leadzam_meta_verify_token_secure` |

---

## Quick Start (Local Development)

### 1. Database & Backend API
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
```
* Backend API runs on: `http://localhost:5001`
* Health check: `curl http://localhost:5001/health`

### 2. Web Dashboard
```bash
cd web
npm install
npm run dev
```
* Web dashboard opens at: `http://localhost:3000`
* Routes:
  * `/login` & `/register` — Authentication
  * `/dashboard/calls` — Overview, Team Leaderboard, Calls with Audio Playback & Notes
  * `/dashboard/leads` — Lead Stages (New, Contacted, Qualified, Won, Lost), Filters, CSV Export
  * `/dashboard/call-activity` — Analytics, Direction breakdown, Bar chart, Daily breakdown
  * `/dashboard/settings` — Profile, Mark Leave toggle, Team members, Android Pairing tokens, Webhook URL

### 3. Android Companion App
Open the `android/` directory in **Android Studio**:
1. Build and install the APK onto the agent's phone.
2. Enter the server URL (`http://YOUR_LOCAL_IP:5001` for local dev or `https://yourdomain.com` for production).
3. Enter the device pairing token generated in **Settings > Team**.
4. Tap **Connect & Authorize**.
5. Grant required permissions (Call log, Phone State, Audio Files, Battery Optimization).
6. The foreground service automatically detects calls, identifies recordings, and syncs both metadata and audio files to the CRM backend!

---

## Deploying on Hostinger Cloud Server (Ubuntu VPS)

### 1. SSH into VPS
```bash
ssh root@YOUR_SERVER_IP
```

### 2. Run Automated Setup Script
```bash
git clone <YOUR_GIT_REPO> /var/www/crm-lead
cd /var/www/crm-lead
chmod +x deploy/setup-hostinger.sh
./deploy/setup-hostinger.sh
```

### 3. Configure Production Environment
Edit `/var/www/crm-lead/server/.env`:
```env
PORT=5000
DATABASE_URL="postgresql://crm_user:YOUR_SECURE_PASSWORD@localhost:5432/crm_lead"
JWT_SECRET="YOUR_RANDOM_64_CHAR_SECRET"
AUDIO_STORAGE_PATH="/var/crm/recordings"
META_VERIFY_TOKEN="YOUR_META_VERIFY_TOKEN"
```

### 4. Build and Run with PM2
```bash
# Build server
cd /var/www/crm-lead/server
npm install && npm run build
npx prisma db push

# Build web frontend
cd /var/www/crm-lead/web
npm install && npm run build

# Start both services
cd /var/www/crm-lead
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Configure Nginx Reverse Proxy & SSL
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/crm-lead
sudo ln -s /etc/nginx/sites-available/crm-lead /etc/nginx/sites-enabled/
# Replace yourdomain.com in /etc/nginx/sites-available/crm-lead
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com
```

---

## LeadZam Matching Capabilities

- ✅ **Automatic Call Detection & Sync**: Native Android listener triggers on `CALL_STATE_IDLE`.
- ✅ **OEM Call Recording Extractor**: Scans Samsung, Xiaomi (MIUI), Vivo, Oppo, OnePlus, and Google Pixel recording directories.
- ✅ **HTTP Range Audio Streaming**: Fast audio seeking directly in browser dashboard with JWT query param authentication.
- ✅ **Round-Robin Lead Distribution**: Ingests Meta Ads / Google Ads leads and routes them evenly to available agents.
- ✅ **Mark Leave Exclusion**: Agents marked "On Leave" are excluded from lead distribution.
- ✅ **Multi-Tenant Architecture**: Organization-scoped isolation for all users, leads, calls, notes, and audio assets.
- ✅ **CSV Export**: One-click CSV export on Calls, Reports, and Leads views.
