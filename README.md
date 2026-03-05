# LoanFlow - Loan Management System

A premium full-stack loan management platform for microfinance operations with role-based access control.  

## Tech Stack

| Layer | Technology |
|-------|-----------| 
| Frontend | Next.js 14 + Tailwind CSS + Shadcn UI |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT - Role Based (Admin / Staff) |
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
- Staff management - add, edit, deactivate staff
- QR Code management for UPI payments
- Password change

### Staff
- Dashboard filtered to their own branch data
- Members - only their branch members
- Loans - only their branch loans
- EMI payments - can record payments
- Reports - filtered to their branch
- Settings - view QR codes, change own password

---

## Project Structure

```
loanflow/
├── frontend/          
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/          
│   │   │   └── (app)/          
│   │   │       ├── dashboard/
│   │   │       ├── members/
│   │   │       ├── loans/
│   │   │       ├── reports/
│   │   │       └── settings/
│   │   ├── lib/
│   │   │   ├── api.ts          
│   │   │   └── utils.ts        
│   │   └── store/
│   │       └── auth.ts       
│   └── package.json
└── backend/
    ├── prisma/
    │   └── schema.prisma       
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

## Design System

- **Theme**: Dark mode, deep navy background (#0a0f1e)
- **Font**: Sora (UI) + JetBrains Mono (numbers)
- **Primary**: Blue (#3b82f6)
- **Accent Colors**: Gold (₹ amounts), Green (collected), Red (overdue), Purple (admin)
- **Layout**: Sidebar on desktop, bottom nav on mobile

---

## License
SHUBIQ
