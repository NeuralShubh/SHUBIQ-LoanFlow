'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { getDashboardStats, getDashboardChart, getLoans, getApprovals, approveApproval, rejectApproval } from '@/lib/api'
import { formatCurrency, formatCurrencyFull, getInitials, getAvatarGradient } from '@/lib/utils'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js'
import {
  Users, CreditCard, TrendingUp,
  Wallet, ArrowRight, CheckCircle, IndianRupee, Bell
} from 'lucide-react'
import Link from 'next/link'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface Stats {
  totalMembers: number
  activeLoans: number
  todayCollected: number
  todayTarget: number
  totalDisbursed: number
  totalRecovered: number
  outstanding: number
  weeklyProgress: number
  monthlyProgress: number
  todayDueEmis: any[]
  storage?: {
    usedBytes: number
    usedMB: number
    usedGB: number
  } | null
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [activeLoansList, setActiveLoansList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(true)
  const [chartUpdatedAt, setChartUpdatedAt] = useState<string | null>(null)

  const [approvals, setApprovals] = useState<any[]>([])
  const [approvalsOpen, setApprovalsOpen] = useState(false)
  const [approvalsLoading, setApprovalsLoading] = useState(false)

  const loadApprovals = async () => {
    if (user?.role !== 'ADMIN') return
    setApprovalsLoading(true)
    try {
      const r = await getApprovals({ status: 'PENDING' })
      setApprovals(Array.isArray(r.data) ? r.data : [])
    } finally {
      setApprovalsLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    const loadStats = async (showInitialLoader = false) => {
      if (showInitialLoader) setLoading(true)
      try {
        const s = await getDashboardStats()
        if (!active) return
        setStats(s.data)
      } finally {
        if (active && showInitialLoader) setLoading(false)
      }
    }

    const loadChart = async (showInitialLoader = false) => {
      if (showInitialLoader) setChartLoading(true)
      try {
        const c = await getDashboardChart()
        if (!active) return

        const payload = c.data
        if (Array.isArray(payload)) {
          setChartData(payload)
          setChartUpdatedAt(new Date().toISOString())
          return
        }

        setChartData(Array.isArray(payload?.data) ? payload.data : [])
        setChartUpdatedAt(payload?.updatedAt || new Date().toISOString())
      } finally {
        if (active && showInitialLoader) setChartLoading(false)
      }
    }

    loadStats(true)
    loadChart(true)
    getLoans({ status: 'ACTIVE' }).then((r) => {
      if (!active) return
      setActiveLoansList(Array.isArray(r.data) ? r.data.slice(0, 10) : [])
    })

    if (user?.role === 'ADMIN') loadApprovals()

    const intervalId = setInterval(() => {
      loadStats(false)
      loadChart(false)
      getLoans({ status: 'ACTIVE' }).then((r) => {
        if (!active) return
        setActiveLoansList(Array.isArray(r.data) ? r.data.slice(0, 10) : [])
      })
      if (user?.role === 'ADMIN') loadApprovals()
    }, 2500)

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadStats(false)
        loadChart(false)
        getLoans({ status: 'ACTIVE' }).then((r) => {
          if (!active) return
          setActiveLoansList(Array.isArray(r.data) ? r.data.slice(0, 10) : [])
        })
        if (user?.role === 'ADMIN') loadApprovals()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityOrFocus)
    window.addEventListener('focus', onVisibilityOrFocus)

    return () => {
      active = false
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
      window.removeEventListener('focus', onVisibilityOrFocus)
    }
  }, [])

  const handleApprove = async (id: string) => {
    await approveApproval(id)
    await loadApprovals()
  }

  const handleReject = async (id: string) => {
    await rejectApproval(id)
    await loadApprovals()
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const chartConfig = {
    data: {
      labels: chartData.map(d => d.label),
      datasets: [
        {
          label: 'Disbursed',
          data: chartData.map(d => d.disbursed),
          backgroundColor: 'rgba(59, 130, 246, 0.88)',
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.9,
          categoryPercentage: 0.72,
          maxBarThickness: 28,
        },
        {
          label: 'Collected',
          data: chartData.map(d => d.collected),
          backgroundColor: 'rgba(16, 185, 129, 0.84)',
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.9,
          categoryPercentage: 0.72,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          position: 'top' as const,
          align: 'start' as const,
          labels: {
            color: '#94a3b8',
            font: { size: 11, weight: '600' as const },
            usePointStyle: false,
            boxWidth: 14,
            boxHeight: 9,
            padding: 10,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(148, 163, 184, 0.25)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#cbd5e1',
          padding: 10,
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${formatCurrencyFull(ctx.parsed.y || 0)}`,
          },
        },
      },
      scales: {
        x: {
          offset: true,
          ticks: {
            color: '#7f8ea6',
            font: { size: 12, weight: '500' as const },
          },
          grid: {
            color: 'rgba(255,255,255,0.03)',
            drawBorder: false,
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax: Math.max(60000, ...chartData.map((d: any) => Number(d?.disbursed || 0), 0)),
          ticks: {
            color: '#7f8ea6',
            font: { size: 11 },
            callback: (v: any) => formatCurrency(v),
            maxTicksLimit: 6,
          },
          grid: {
            color: 'rgba(255,255,255,0.03)',
            drawBorder: false,
          },
        },
      },
    },
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner scale-150" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name.split(' ')[0]} ??
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => {
                setApprovalsOpen(true)
                loadApprovals()
              }}
              className="relative w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-blue-500/20 transition-colors"
              title="Approvals"
            >
              <Bell className="w-5 h-5 text-slate-300" />
              {approvals.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {approvals.length}
                </span>
              )}
            </button>
          )}
          {user?.role === 'STAFF' && user.branch && (
            <div className="text-right">
              <div className="text-xs text-slate-500">Your Branch</div>
              <div className="text-sm font-semibold text-white">{user.branch.name}</div>
              <div className="text-xs text-slate-500">{user.branch.code}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Members"
          value={stats?.totalMembers ?? 0}
          icon={Users}
          color="blue"
          format="number"
        />
        <StatCard
          label="Active Loans"
          value={stats?.activeLoans ?? 0}
          icon={CreditCard}
          color="gold"
          format="number"
        />
        <StatCard
          label="Total Disbursed"
          value={stats?.totalDisbursed ?? 0}
          icon={IndianRupee}
          color="blue"
          format="currency"
        />
        <StatCard
          label="Total Recovered"
          value={stats?.totalRecovered ?? 0}
          icon={Wallet}
          color="green"
          format="currency"
        />
        <StatCard
          label="Outstanding"
          value={stats?.outstanding ?? 0}
          icon={TrendingUp}
          color="purple"
          format="currency"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-start-2">
          <StatCard
            label="Today's Target"
            value={stats?.todayTarget ?? 0}
            icon={IndianRupee}
            color="gold"
            format="currency"
          />
        </div>
        <div className="lg:col-start-3">
          <StatCard
            label="Collected Today"
            value={stats?.todayCollected ?? 0}
            icon={Wallet}
            color="green"
            format="currency"
          />
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Recovery Progress</h3>
        <ProgressBar label="Weekly EMI Target" pct={stats?.weeklyProgress ?? 0} color="green" />
        <ProgressBar label="Monthly Recovery" pct={stats?.monthlyProgress ?? 0} color="gold" />
      </div>

      {user?.role === 'ADMIN' && stats?.storage && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Database Usage (PostgreSQL)</h3>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-300">{stats.storage.usedMB.toFixed(2)} MB</span>
            <span className="text-sm font-bold font-mono text-blue-400">{stats.storage.usedGB.toFixed(3)} GB</span>
          </div>
          <p className="text-xs text-slate-500">Current database size in this VPS PostgreSQL instance.</p>
        </div>
      )}

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-sm font-semibold text-white">6-Month Collection vs Disbursement</h3>
          {chartUpdatedAt && (
            <span className="text-[11px] text-slate-500">
              Live · {new Date(chartUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        <div className="h-48">
          {chartLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="spinner" />
            </div>
          ) : (
            <Bar data={chartConfig.data} options={chartConfig.options as any} />
          )}
        </div>
      </div>

      {/* Today's Due EMIs */}
      <div className="bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-400" />
            Active Loans
            {activeLoansList.length > 0 && (
              <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {activeLoansList.length}
              </span>
            )}
          </h3>
          <Link href="/loans" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {activeLoansList.length > 0 ? (
          <div className="divide-y divide-border">
            {activeLoansList.map((loan: any) => (
              <Link
                key={loan.id}
                href={`/members/${loan.memberId}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(loan.member?.name || '')} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {getInitials(loan.member?.name || 'U')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{loan.member?.name}</div>
                  <div className="text-xs text-slate-500">
                    {loan.loanId} · {loan.branch?.code} · {loan.centre?.code}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-amber-400">{formatCurrencyFull(loan.totalPayable)}</div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md badge-active">ACTIVE</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600">
            <CheckCircle className="w-10 h-10 mb-2 text-emerald-500/40" />
            <p className="text-sm font-medium">No active loans</p>
          </div>
        )}
      </div>

      {approvalsOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={() => setApprovalsOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 lg:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Pending Approvals</h2>
              <button onClick={() => setApprovalsOpen(false)} className="text-xs text-slate-400 hover:text-white">Close</button>
            </div>

            {approvalsLoading ? (
              <div className="flex items-center justify-center h-32"><div className="spinner" /></div>
            ) : approvals.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">No pending approvals</div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {approvals.map((a) => (
                  <div key={a.id} className="border border-border rounded-xl p-4">
                    <div className="text-sm font-semibold text-white">
                      {a.actionType.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Requested by {a.requestedBy?.name || 'Admin'}
                    </div>
                    {a.payload && (
                      <div className="text-xs text-slate-400 mt-2">
                        {a.targetType}: {a.payload.code || a.payload.memberId || a.payload.name || a.payload.upiId || a.targetId}
                        {a.payload.name ? ` • ${a.payload.name}` : ''}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleApprove(a.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(a.id)}
                        className="border border-border text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, format }: {
  label: string; value: number; icon: any; color: string; format: 'number' | 'currency'
}) {
  const colors: Record<string, { border: string; text: string; bg: string; icon: string }> = {
    blue: { border: 'stat-border-blue', text: 'text-blue-400', bg: 'bg-blue-glow', icon: 'text-blue-400' },
    gold: { border: 'stat-border-gold', text: 'text-gold', bg: 'bg-gold-glow', icon: 'text-amber-400' },
    green: { border: 'stat-border-green', text: 'text-green', bg: 'bg-green-glow', icon: 'text-emerald-400' },
    red: { border: 'stat-border-red', text: 'text-red', bg: 'bg-red-glow', icon: 'text-red-400' },
    purple: { border: 'stat-border-purple', text: 'text-purple', bg: 'bg-purple-glow', icon: 'text-purple-400' },
  }
  const c = colors[color]
  const display = format === 'currency' ? formatCurrency(value) : value.toLocaleString()

  return (
    <div className={`bg-card border border-border ${c.border} rounded-xl p-4 relative overflow-hidden`}>
      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
        <Icon size={16} className={c.icon} />
      </div>
      <div className={`text-2xl font-bold font-mono ${c.text} leading-none`}>{display}</div>
      <div className="text-xs text-slate-500 mt-1.5 font-medium">{label}</div>
    </div>
  )
}

function ProgressBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const fill = color === 'gold' ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
  const textColor = color === 'gold' ? 'text-gold' : 'text-green'

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className={`text-sm font-bold font-mono ${textColor}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${fill} progress-animated`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}
