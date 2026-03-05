# LoanFlow — Loan Management System

A premium full-stack loan management platform for microfinance operations with role-based access control.  

## Tech Stack

| Layer | Technology |
|-------|-----------| 
| Frontend | Next.js 14 + Tailwind CSS + Shadcn UI |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT — Role Based (Admin / Staff) |
| Charts | Chart.js + react-chartjs-2 |
| Hosting | Vercel (Frontend) + Supabase (DB) |

---

## Features

### Admin
- Full dashboard with stats, charts, recovery progress
- Branch & Centre management (create, navigate tree)
- Member management across all branches
- Give loans, view all loans, filter by status
- EMI payment recording with payment method selection
- Full reports (Loans, EMI, Branch summary, Staff summary)
- Staff management — add, edit, deactivate staff
- QR Code management for UPI payments
- Password change

### Staff
- Dashboard filtered to their own branch data
- Members — only their branch members
- Loans — only their branch loans
- EMI payments — can record payments
- Reports — filtered to their branch
- Settings — view QR codes, change own password

---

## Project Structure

```
loanflow/
├── frontend/           # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/          # Login page
│   │   │   └── (app)/          # Protected routes
│   │   │       ├── dashboard/
│   │   │       ├── members/
│   │   │       ├── loans/
│   │   │       ├── reports/
│   │   │       └── settings/
│   │   ├── lib/
│   │   │   ├── api.ts          # All API calls
│   │   │   └── utils.ts        # Helpers
│   │   └── store/
│   │       └── auth.ts         # Zustand auth store
│   └── package.json
└── backend/
    ├── prisma/
    │   └── schema.prisma       # DB schema
    ├── src/
    │   ├── middleware/auth.js
    │   ├── routes/
    │   │   ├── auth.js
    │   │   ├── dashboard.js
    │   │   ├── branches.js
    │   │   ├── centres.js
    │   │   ├── members.js
    │   │   ├── loans.js
    │   │   ├── emis.js
    │   │   ├── reports.js
    │   │   └── settings.js
    │   ├── seed.js
    │   └── index.js
    └── package.json
```

---

## Local Development Setup

### 1. Prerequisites
- Node.js 18+
- PostgreSQL (or use Supabase)

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy env file
cp .env.example .env

# Edit .env with your database URL and JWT secret
# DATABASE_URL="postgresql://user:password@localhost:5432/loanflow"
# JWT_SECRET="your-secret-key"
# FRONTEND_URL="http://localhost:3000"

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with demo data
npm run db:seed

# Start dev server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy env file
cp .env.example .env.local

# Edit .env.local
# NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Start dev server
npm run dev
```

App runs at `http://localhost:3000`

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@loanflow.com | admin1234 |
| Staff (Pune) | ravi@loanflow.com | staff1234 |
| Staff (Pimpri) | suresh@loanflow.com | staff1234 |

---

## Deployment

### Supabase (Database)
1. Create a new project at [supabase.com](https://supabase.com)
2. Copy the PostgreSQL connection string from Settings → Database
3. Use it as `DATABASE_URL` in backend

### Backend (Vercel / Railway / Render)
1. Deploy the `backend/` folder
2. Set environment variables:
   - `DATABASE_URL` (Supabase connection string)
   - `JWT_SECRET` (random secure string)
   - `FRONTEND_URL` (your Vercel frontend URL)
3. Run `npm run db:push` and `npm run db:seed`

### Frontend (Vercel)
1. Import the `frontend/` folder on [vercel.com](https://vercel.com)
2. Set environment variable:
   - `NEXT_PUBLIC_API_URL` (your backend URL + `/api`)
3. Deploy

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET | /api/dashboard/stats | Dashboard stats |
| GET | /api/dashboard/chart | 6-month chart data |
| GET | /api/branches | All branches |
| POST | /api/branches | Create branch (admin) |
| GET | /api/centres | Centres (filterable by branchId) |
| GET | /api/members | Members (role-filtered) |
| GET | /api/members/:id | Member detail |
| POST | /api/members | Create member |
| GET | /api/loans | Loans (role-filtered) |
| POST | /api/loans | Create loan + auto EMI schedule |
| POST | /api/emis/:id/pay | Mark EMI as paid |
| GET | /api/reports/loans | Loan report |
| GET | /api/reports/emis | EMI report |
| GET | /api/reports/branch-summary | Branch summary |
| GET | /api/reports/staff-summary | Staff summary |
| GET | /api/settings/staff | Staff list (admin) |
| POST | /api/settings/staff | Add staff (admin) |
| GET | /api/settings/qr | QR codes |
| POST | /api/settings/qr | Add QR (admin) |

---

## Design System

- **Theme**: Dark mode, deep navy background (#0a0f1e)
- **Font**: Sora (UI) + JetBrains Mono (numbers)
- **Primary**: Blue (#3b82f6)
- **Accent Colors**: Gold (₹ amounts), Green (collected), Red (overdue), Purple (admin)
- **Layout**: Sidebar on desktop, bottom nav on mobile

---

## License
MIT
