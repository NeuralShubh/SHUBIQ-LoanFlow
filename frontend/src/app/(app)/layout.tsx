'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { LayoutDashboard, Users, CreditCard, BarChart3, Settings, Landmark, Clock, UserCog } from 'lucide-react'

const adminNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/loans', label: 'Loans', icon: CreditCard },
  { href: '/emis', label: 'EMI', icon: Clock },
  { href: '/staff', label: 'Staff', icon: UserCog },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const staffNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/loans', label: 'Loans', icon: CreditCard },
  { href: '/emis', label: 'EMI', icon: Clock },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, token, isLoading, initFromStorage } = useAuthStore()

  useEffect(() => {
    initFromStorage()
  }, [])

  useEffect(() => {
    if (!isLoading && !token) router.push('/login')
  }, [isLoading, token])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center glow-blue">
            <Landmark className="w-6 h-6 text-white" />
          </div>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  const nav = user.role === 'ADMIN' ? adminNav : staffNav

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex lg:w-64 xl:w-72 border-r border-border bg-card/70 backdrop-blur-sm overflow-hidden">
        <div className="w-full p-4 flex flex-col">
          <div className="flex items-center gap-3 px-2 py-2 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_8px_20px_rgba(37,99,235,0.35)]">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-white leading-none">Pragati Finance</div>
              <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">{user.role}</div>
            </div>
          </div>

          <nav className="space-y-1.5">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-muted/60 border border-transparent'
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto pt-6 px-2 text-[11px] text-slate-500">
            <a
              href="https://shubiq.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-slate-300 transition-colors"
            >
              Made by <span className="text-slate-300 font-semibold">SHUBIQ Studio</span>
            </a>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-40 px-2 sm:px-3 lg:px-4 pt-safe">
          <div className="h-[60px] rounded-2xl border border-blue-500/20 bg-gradient-to-r from-slate-950/95 via-blue-950/40 to-slate-950/95 shadow-[0_10px_24px_rgba(2,6,23,0.45)] backdrop-blur-xl px-3 sm:px-4 flex items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_8px_20px_rgba(37,99,235,0.35)] flex-shrink-0">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white leading-none tracking-tight">Pragati Finance</div>
          </div>

          <div className="flex-1" />

          </div>
        </header>

        <div className="flex-1 p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6">{children}</div>

        <div className="lg:hidden fixed bottom-[56px] left-0 right-0 z-40 flex justify-center pb-safe">
          <div className="text-[10px] text-slate-500 bg-card/80 border border-border rounded-full px-3 py-1">
            Dashboard
          </div>
        </div>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-40 flex pb-safe">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} className="bottom-nav-item">
                <Icon size={20} className={active ? 'text-blue-400' : 'text-slate-500'} />
                <span className={`text-[10px] leading-none font-semibold ${active ? 'text-blue-400' : 'text-slate-600'}`}>
                  {label}
                </span>
                {active && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-b" />}
              </Link>
            )
          })}
        </nav>
      </main>

    </div>
  )
}
