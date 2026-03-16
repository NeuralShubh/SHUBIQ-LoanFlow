'use client'

import { useEffect, useState } from 'react'
import {
  getLoanReport,
  getEmiReport,
  getBranchSummary,
  getStaffSummary,
  getBranches,
  getCentres,
  getMemberReport,
  getCentreSummary,
  exportReportsExcel,
} from '@/lib/api'
import { formatCurrencyFull, formatCurrency, formatDate, getLoanStatusColor, getEmiStatusColor } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { BarChart3, Filter, ChevronDown, FileSpreadsheet } from 'lucide-react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import SearchableSelect from '@/components/SearchableSelect'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const tabs = ['Loans', 'EMI', 'Members', 'Branch', 'Staff']

export default function ReportsPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [activeTab, setActiveTab] = useState('Loans')
  const [filters, setFilters] = useState({ from: '', to: '', branchId: '', centreId: '', status: '' })
  const [branches, setBranches] = useState<any[]>([])
  const [centres, setCentres] = useState<any[]>([])

  const [loanReport, setLoanReport] = useState<any>(null)
  const [emiReport, setEmiReport] = useState<any[]>([])
  const [memberReport, setMemberReport] = useState<any>(null)
  const [centreSummary, setCentreSummary] = useState<any[]>([])
  const [branchSummary, setBranchSummary] = useState<any[]>([])
  const [staffSummary, setStaffSummary] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    getBranches().then(r => setBranches(r.data))
    getCentres().then(r => setCentres(r.data))
  }, [])

  useEffect(() => {
    getCentres(filters.branchId || undefined).then(r => setCentres(r.data))
  }, [filters.branchId])

  const generateReport = async () => {
    setLoading(true)
    try {
      const params = { ...filters }
      if (activeTab === 'Loans') {
        const r = await getLoanReport(params)
        setLoanReport(r.data)
      } else if (activeTab === 'EMI') {
        const r = await getEmiReport(params)
        setEmiReport(r.data)
      } else if (activeTab === 'Members') {
        const r = await getMemberReport(params)
        setMemberReport(r.data)
      } else if (activeTab === 'Centre') {
        const r = await getCentreSummary(params)
        setCentreSummary(r.data)
      } else if (activeTab === 'Branch') {
        const r = await getBranchSummary(params)
        setBranchSummary(r.data)
      } else if (activeTab === 'Staff') {
        const r = await getStaffSummary(params)
        setStaffSummary(r.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generateReport()
  }, [activeTab])

  const handleExportExcel = async () => {
    if (!filters.from || !filters.to) {
      alert('Please select both start date and end date before export.')
      return
    }
    if (new Date(filters.from) > new Date(filters.to)) {
      alert('Start date cannot be after end date.')
      return
    }

    setExporting(true)
    try {
      const reportTypeMap: Record<string, string> = {
        Loans: 'loans',
        EMI: 'emi',
        Members: 'members',
        Branch: 'branch',
        Staff: 'staff',
      }
      const params = { ...filters, reportType: reportTypeMap[activeTab] || 'all' }
      const response = await exportReportsExcel(params)
      const blob = new Blob(
        [response.data],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      )
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      const tag = new Date().toISOString().slice(0, 10)
      link.download = `loanflow-${params.reportType}-report-${tag}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to export Excel')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const allowedStatus =
      activeTab === 'EMI'
        ? ['', 'PENDING', 'PAID', 'PARTIAL']
        : activeTab === 'Members'
          ? ['', 'ACTIVE', 'INACTIVE', 'SUSPENDED']
          : ['', 'ACTIVE', 'COMPLETED']

    if (!allowedStatus.includes(filters.status)) {
      setFilters(prev => ({ ...prev, status: '' }))
    }
  }, [activeTab, filters.status])

  const statusOptions = activeTab === 'EMI'
    ? [
        { label: 'All Status', value: '' },
        { label: 'Pending', value: 'PENDING' },
        { label: 'Paid', value: 'PAID' },
        { label: 'Partial', value: 'PARTIAL' },
      ]
    : activeTab === 'Members'
      ? [
          { label: 'All Status', value: '' },
          { label: 'Active', value: 'ACTIVE' },
          { label: 'Inactive', value: 'INACTIVE' },
          { label: 'Suspended', value: 'SUSPENDED' },
        ]
      : [
          { label: 'All Status', value: '' },
          { label: 'Active', value: 'ACTIVE' },
          { label: 'Completed', value: 'COMPLETED' },
        ]

  const branchChartData = {
    labels: branchSummary.map(b => b.code),
    datasets: [
      { label: 'Disbursed', data: branchSummary.map(b => b.totalDisbursed), backgroundColor: 'rgba(59, 130, 246, 0.7)', borderRadius: 6 },
      { label: 'Collected', data: branchSummary.map(b => b.totalCollected), backgroundColor: 'rgba(16, 185, 129, 0.7)', borderRadius: 6 },
    ],
  }

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#64748b', callback: (v: any) => formatCurrency(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
    },
  }

  const centreOptions = [
    { value: '', label: 'All Centres' },
    ...centres.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` })),
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Filter, analyse & export</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-1.5">
        <div className="flex w-full gap-1.5">
        {(isAdmin ? tabs : tabs.filter(t => t !== 'Staff')).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-0 h-10 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap text-center flex items-center justify-center leading-none ${
              activeTab === tab
                ? 'bg-blue-500/10 text-white border border-blue-500/50'
                : 'text-slate-500 hover:text-slate-300 border border-transparent hover:bg-white/[0.02]'
            }`}
          >
            {tab}
          </button>
        ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">From</label>
            <input
              type="date"
              value={filters.from}
              onChange={e => setFilters({ ...filters, from: e.target.value })}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">To</label>
            <input
              type="date"
              value={filters.to}
              onChange={e => setFilters({ ...filters, to: e.target.value })}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors"
            />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Branch</label>
              <div className="relative">
                <select
                  value={filters.branchId}
                  onChange={e => setFilters({ ...filters, branchId: e.target.value, centreId: '' })}
                  className="w-full appearance-none bg-muted border border-border rounded-xl px-4 pr-10 py-3 text-sm text-white focus:border-blue-500 transition-colors"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          )}
          {isAdmin && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Centre</label>
              <SearchableSelect
                value={filters.centreId}
                options={centreOptions}
                placeholder="All Centres"
                searchPlaceholder="Search centre by code or name..."
                onChange={(value) => setFilters({ ...filters, centreId: value })}
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
            <div className="relative">
              <select
                value={filters.status}
                onChange={e => setFilters({ ...filters, status: e.target.value })}
                className="w-full appearance-none bg-muted border border-border rounded-xl px-4 pr-10 py-3 text-sm text-white focus:border-blue-500 transition-colors"
              >
                {statusOptions.map(s => <option key={s.value || 'all'} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <button onClick={generateReport} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
            <BarChart3 className="w-4 h-4" /> Generate Report
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="spinner scale-150" /></div>
      ) : (
        <>
          {activeTab === 'Loans' && loanReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
                {[
                  { label: 'Total Loans', value: loanReport.summary.totalLoans, color: 'blue', format: 'n' },
                  { label: 'Disbursed', value: loanReport.summary.totalDisbursed, color: 'gold', format: 'c' },
                  { label: 'Collected', value: loanReport.summary.totalCollected, color: 'green', format: 'c' },
                ].map(s => (
                  <div key={s.label} className={`bg-card border border-border stat-border-${s.color} rounded-xl p-4`}>
                    <div className={`text-xl font-bold font-mono ${s.color === 'blue' ? 'text-blue-400' : s.color === 'gold' ? 'text-amber-400' : s.color === 'green' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.format === 'c' ? formatCurrency(s.value) : s.value}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-card border border-border rounded-xl divide-y divide-border">
                {loanReport.loans.slice(0, 20).map((l: any) => (
                  <div key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{l.member?.name}</div>
                      <div className="text-xs text-slate-500">{l.loanId} - {l.branch?.code} - {l.centre?.code} - {formatDate(l.loanDate)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold font-mono text-amber-400">{formatCurrencyFull(l.principal)}</div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${getLoanStatusColor(l.status)}`}>
                        {l.status === 'OVERDUE' ? 'ACTIVE' : l.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'EMI' && (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">EMI Results</h3>
                <span className="text-xs text-slate-400">
                  Total: <span className="text-white font-semibold">{emiReport.length}</span>
                </span>
              </div>
              {emiReport.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-sm">No EMI data</div>
              ) : (
                emiReport.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{e.loan?.member?.name}</div>
                      <div className="text-xs text-slate-500">EMI #{e.emiNumber} - {formatDate(e.dueDate)} - {e.loan?.branch?.code} - {e.loan?.centre?.code}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold font-mono text-white">{formatCurrencyFull(e.amount)}</div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${getEmiStatusColor(e.status)}`}>
                        {e.status === 'OVERDUE' ? 'PENDING' : e.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'Members' && memberReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Members', value: memberReport.summary.totalMembers, color: 'blue' },
                  { label: 'Active Members', value: memberReport.summary.activeMembers, color: 'green' },
                  { label: 'Inactive Members', value: memberReport.summary.inactiveMembers, color: 'gold' },
                  { label: 'Suspended Members', value: memberReport.summary.suspendedMembers, color: 'red' },
                ].map(s => (
                  <div key={s.label} className={`bg-card border border-border stat-border-${s.color} rounded-xl p-4`}>
                    <div className={`text-xl font-bold font-mono ${s.color === 'blue' ? 'text-blue-400' : s.color === 'gold' ? 'text-amber-400' : s.color === 'green' ? 'text-emerald-400' : 'text-red-400'}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-card border border-border rounded-xl divide-y divide-border">
                {memberReport.members.slice(0, 30).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{m.name}</div>
                      <div className="text-xs text-slate-500">{m.memberId} - {m.branch?.code} - {m.centre?.code} - {m.staff?.name || 'Unassigned'}</div>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${m.status === 'ACTIVE' ? 'badge-active' : m.status === 'INACTIVE' ? 'badge-pending' : 'badge-overdue'}`}>{m.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Centre' && (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {centreSummary.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-sm">No centre data</div>
              ) : (
                centreSummary.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.code} - {c.branchCode} - {c.memberCount} members - {c.activeLoans} active</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold font-mono text-emerald-400">{formatCurrency(c.totalCollected)}</div>
                      <div className="text-xs text-slate-500">of {formatCurrency(c.totalDisbursed)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'Branch' && branchSummary.length > 0 && (
            <div className="space-y-4">
              {branchSummary.length > 1 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Branch Comparison</h3>
                  <div className="h-48">
                    <Bar data={branchChartData} options={chartOptions} />
                  </div>
                </div>
              )}
              <div className="bg-card border border-border rounded-xl divide-y divide-border">
                {branchSummary.map(b => (
                  <div key={b.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-white">{b.name}</div>
                        <div className="text-xs text-slate-500">{b.code} - {b.memberCount} members - {b.activeLoans} active</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-emerald-400">{formatCurrency(b.totalCollected)}</div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${b.recoveryRate >= 90 ? 'badge-active' : b.recoveryRate >= 70 ? 'badge-pending' : 'badge-overdue'}`}>{b.recoveryRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(b.recoveryRate, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Staff' && (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {staffSummary.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-sm">No staff data</div>
              ) : (
                staffSummary.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.branch} - {s.memberCount} members - {s.activeLoans} loans</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold font-mono text-emerald-400">{formatCurrency(s.totalCollected)}</div>
                      <div className="text-xs text-slate-500">of {formatCurrency(s.totalDisbursed)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
