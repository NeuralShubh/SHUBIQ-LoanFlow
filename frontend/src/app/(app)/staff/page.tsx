'use client'

import { useEffect, useMemo, useState } from 'react'
import { getStaff, getBranchSummary, getCentreSummary, getMemberReport, getEmiReport } from '@/lib/api'
import { formatCurrency, formatCurrencyFull, formatDate, getEmiStatusColor, getInitials, getAvatarGradient } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { ChevronDown, Search } from 'lucide-react'

const tabs = ['Branch', 'Centre', 'Members', 'EMI'] as const
type Tab = typeof tabs[number]

export default function StaffPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [staffList, setStaffList] = useState<any[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('Branch')
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState({
    Branch: '',
    Centre: '',
    Members: '',
    EMI: '',
  })

  const [branchSummary, setBranchSummary] = useState<any[]>([])
  const [centreSummary, setCentreSummary] = useState<any[]>([])
  const [memberReport, setMemberReport] = useState<any>(null)
  const [emiReport, setEmiReport] = useState<any[]>([])

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId)

  useEffect(() => {
    if (!isAdmin) return
    getStaff().then((r) => {
      setStaffList(r.data || [])
      if (r.data?.[0]) setSelectedStaffId(r.data[0].id)
    })
  }, [isAdmin])

  const loadTabData = async (tab: Tab, staffId: string, searchTerm: string) => {
    if (!staffId) return
    setLoading(true)
    try {
      if (tab === 'Branch') {
        const r = await getBranchSummary({ staffId })
        setBranchSummary(r.data || [])
      } else if (tab === 'Centre') {
        const r = await getCentreSummary({ staffId })
        setCentreSummary(r.data || [])
      } else if (tab === 'Members') {
        const r = await getMemberReport({ staffId, search: searchTerm || undefined })
        setMemberReport(r.data)
      } else if (tab === 'EMI') {
        const r = await getEmiReport({ staffId, search: searchTerm || undefined, pendingOnly: true })
        setEmiReport(Array.isArray(r.data) ? r.data : [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedStaffId) return
    loadTabData(activeTab, selectedStaffId, search[activeTab])
  }, [activeTab, selectedStaffId])

  useEffect(() => {
    if (!selectedStaffId) return
    const handle = setTimeout(() => {
      loadTabData(activeTab, selectedStaffId, search[activeTab])
    }, 250)
    return () => clearTimeout(handle)
  }, [search, selectedStaffId, activeTab])

  const filteredBranchSummary = useMemo(() => {
    const term = search.Branch.trim().toLowerCase()
    if (!term) return branchSummary
    return branchSummary.filter((b) =>
      `${b.code} ${b.name}`.toLowerCase().includes(term)
    )
  }, [branchSummary, search.Branch])

  const filteredCentreSummary = useMemo(() => {
    const term = search.Centre.trim().toLowerCase()
    if (!term) return centreSummary
    return centreSummary.filter((c) =>
      `${c.code} ${c.name} ${c.branchCode || ''}`.toLowerCase().includes(term)
    )
  }, [centreSummary, search.Centre])

  if (!isAdmin) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-slate-400 text-sm">
        This page is available for admin users only.
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white">Staff</h1>
        <p className="text-sm text-slate-400 mt-0.5">Branch, centre, member, and EMI data by staff</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Staff</label>
        <div className="relative">
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="w-full appearance-none bg-muted border border-border rounded-lg px-3 pr-9 py-2 text-xs text-white focus:border-blue-500 transition-colors"
          >
            <option value="">Select staff</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.staffCode ? `${s.staffCode} - ` : ''}{s.name} ({s.branch?.code || 'No branch'})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {selectedStaff && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(selectedStaff.name)} flex items-center justify-center text-white text-xs font-bold`}>
            {getInitials(selectedStaff.name)}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              {selectedStaff.name} {selectedStaff.staffCode ? `(${selectedStaff.staffCode})` : ''}
            </div>
            <div className="text-xs text-slate-500">
              {selectedStaff.email} • {selectedStaff.branch?.code || 'No branch'}
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-1.5">
        <div className="flex w-full gap-1.5">
          {tabs.map(tab => (
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

      <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          value={search[activeTab]}
          onChange={(e) => setSearch((prev) => ({ ...prev, [activeTab]: e.target.value }))}
          placeholder={`Search ${activeTab.toLowerCase()}...`}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="spinner scale-150" /></div>
      ) : (
        <>
          {activeTab === 'Branch' && (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {filteredBranchSummary.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-sm">No branch data</div>
              ) : (
                filteredBranchSummary.map((b: any) => (
                  <div key={b.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{b.name}</div>
                      <div className="text-xs text-slate-500">{b.code} • {b.memberCount} members • {b.activeLoans} active</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-emerald-400">{formatCurrency(b.totalCollected)}</div>
                      <div className="text-xs text-slate-500">of {formatCurrency(b.totalDisbursed)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'Centre' && (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {filteredCentreSummary.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-sm">No centre data</div>
              ) : (
                filteredCentreSummary.map((c: any) => (
                  <div key={c.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.code} • {c.branchCode} • {c.memberCount} members</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-emerald-400">{formatCurrency(c.totalCollected)}</div>
                      <div className="text-xs text-slate-500">of {formatCurrency(c.totalDisbursed)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'Members' && (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {memberReport?.members?.length ? (
                memberReport.members.map((m: any) => (
                  <div key={m.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{m.name}</div>
                      <div className="text-xs text-slate-500">
                        {m.memberId} • {m.branch?.code} • {m.centre?.code}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md badge-active">{m.status}</span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-600 text-sm">No member data</div>
              )}
            </div>
          )}

          {activeTab === 'EMI' && (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {emiReport.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-sm">No EMI data</div>
              ) : (
                emiReport.map((e: any) => (
                  <div key={e.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{e.loan?.member?.name}</div>
                      <div className="text-xs text-slate-500">
                        EMI #{e.emiNumber} • {formatDate(e.dueDate)} • {e.loan?.branch?.code} • {e.loan?.centre?.code}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-amber-400">{formatCurrencyFull(e.amount)}</div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${getEmiStatusColor(e.status)}`}>
                        {e.status === 'OVERDUE' ? 'PENDING' : e.status}
                      </span>
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
