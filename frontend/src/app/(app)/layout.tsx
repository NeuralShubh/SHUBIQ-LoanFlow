'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { getDashboardStats, getEmiReport } from '@/lib/api'
import { formatCurrencyFull, formatDate } from '@/lib/utils'
import { LayoutDashboard, Users, CreditCard, BarChart3, Settings, Landmark, Bell, AlertTriangle } from 'lucide-react'

const adminNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/loans', label: 'Loans', icon: CreditCard },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const staffNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/loans', label: 'Loans', icon: CreditCard },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, token, isLoading, initFromStorage } = useAuthStore()

  const [overdueCount, setOverdueCount] = useState(0)
  const [overdueEmis, setOverdueEmis] = useState<any[]>([])
  const [loadingOverdue, setLoadingOverdue] = useState(false)
  const [showOverduePopup, setShowOverduePopup] = useState(false)

  useEffect(() => {
    initFromStorage()
  }, [])

  useEffect(() => {
    if (!isLoading && !token) router.push('/login')
  }, [isLoading, token])

  const loadOverdueData = async () => {
    if (!token) return
    setLoadingOverdue(true)
    try {
      const [statsRes, overdueRes] = await Promise.all([
        getDashboardStats(),
        getEmiReport({ status: 'OVERDUE' }),
      ])
      setOverdueCount(statsRes.data?.overdueEmis || 0)
      setOverdueEmis(overdueRes.data || [])
    } catch {
      setOverdueCount(0)
      setOverdueEmis([])
    } finally {
      setLoadingOverdue(false)
    }
  }

  useEffect(() => {
    if (!token) return
    loadOverdueData()
  }, [token])

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
      <aside className="hidden lg:flex lg:w-64 xl:w-72 border-r border-border bg-card/70 backdrop-blur-sm">
        <div className="w-full p-4 flex flex-col">
          <div className="flex items-center gap-3 px-2 py-2 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_8px_20px_rgba(37,99,235,0.35)]">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-white leading-none">LoanFlow</div>
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
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-40 px-2 sm:px-3 lg:px-4 pt-safe">
          <div className="h-[60px] rounded-2xl border border-blue-500/20 bg-gradient-to-r from-slate-950/95 via-blue-950/40 to-slate-950/95 shadow-[0_10px_24px_rgba(2,6,23,0.45)] backdrop-blur-xl px-3 sm:px-4 flex items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_8px_20px_rgba(37,99,235,0.35)] flex-shrink-0">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white leading-none tracking-tight">LoanFlow</div>
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => {
              setShowOverduePopup(true)
              loadOverdueData()
            }}
            className="relative w-10 h-10 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-blue-500/10 transition-colors flex items-center justify-center"
            title="Overdue EMIs"
            aria-label="Overdue EMIs"
          >
            <Bell className="w-4.5 h-4.5 text-slate-100" />
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-slate-950">
                {overdueCount > 99 ? '99+' : overdueCount}
              </span>
            )}
          </button>
          </div>
        </header>

        <div className="flex-1 p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6">{children}</div>

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

      {showOverduePopup && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end lg:items-start lg:justify-end"
          onClick={() => setShowOverduePopup(false)}
        >
          <div
            className="w-full lg:w-[420px] bg-card border border-border rounded-t-2xl lg:rounded-2xl lg:m-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold text-white">Overdue EMIs</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                {overdueCount}
              </span>
            </div>

            <div className="max-h-[65vh] overflow-y-auto divide-y divide-border">
              {loadingOverdue ? (
                <div className="py-10 flex justify-center">
                  <div className="spinner" />
                </div>
              ) : overdueEmis.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No overdue EMIs</div>
              ) : (
                overdueEmis.map((emi) => (
                  <button
                    key={emi.id}
                    type="button"
                    onClick={() => {
                      setShowOverduePopup(false)
                      if (emi.loan?.memberId) router.push(`/members/${emi.loan.memberId}`)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{emi.loan?.member?.name || 'Member'}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {emi.loan?.member?.memberId || '-'} - EMI #{emi.emiNumber} - Due {formatDate(emi.dueDate)}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-red-300 whitespace-nowrap">{formatCurrencyFull(emi.amount)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
