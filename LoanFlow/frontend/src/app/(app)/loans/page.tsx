'use client'

import { useEffect, useState } from 'react'
import { getLoans, createLoan, getMembers, getBranches } from '@/lib/api'
import { formatDate, formatCurrency, formatCurrencyFull, getInitials, getAvatarGradient, getLoanStatusColor, calculateLoan } from '@/lib/utils'
import { CreditCard, Search, Plus, IndianRupee, TrendingUp, AlertTriangle, CheckCircle, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'

export default function LoansPage() {
  const { user } = useAuthStore()
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showGiveLoan, setShowGiveLoan] = useState(false)

  const load = (status?: string) => {
    setLoading(true)
    const params: any = {}
    if (status && status !== 'all') params.status = status.toUpperCase()
    getLoans(params).then(r => { setLoans(r.data); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const filtered = loans.filter(l =>
    !search || l.member?.name.toLowerCase().includes(search.toLowerCase()) || l.loanId.includes(search)
  )

  const totalDisbursed = loans.reduce((s, l) => s + l.principal, 0)
  const totalPayable = loans.reduce((s, l) => s + l.totalPayable, 0)
  const totalRecovered = loans.reduce((s, l) => s + (l.emis?.filter((e: any) => e.status === 'PAID').reduce((a: number, e: any) => a + (e.paidAmount || 0), 0) || 0), 0)
  const outstanding = totalPayable - totalRecovered
  const overdueCount = loans.filter(l => l.status === 'OVERDUE').length

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Loans</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage & disburse loans</p>
        </div>
        <button
          onClick={() => setShowGiveLoan(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Give Loan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border stat-border-gold rounded-xl p-4">
          <IndianRupee className="w-4 h-4 text-amber-400 mb-2" />
          <div className="text-xl font-bold font-mono text-amber-400">{formatCurrency(totalDisbursed)}</div>
          <div className="text-xs text-slate-500 mt-1">Total Disbursed</div>
        </div>
        <div className="bg-card border border-border stat-border-green rounded-xl p-4">
          <TrendingUp className="w-4 h-4 text-emerald-400 mb-2" />
          <div className="text-xl font-bold font-mono text-green">{formatCurrency(totalRecovered)}</div>
          <div className="text-xs text-slate-500 mt-1">Recovered</div>
        </div>
        <div className="bg-card border border-border stat-border-blue rounded-xl p-4">
          <CreditCard className="w-4 h-4 text-blue-400 mb-2" />
          <div className="text-xl font-bold font-mono text-blue-400">{formatCurrency(outstanding)}</div>
          <div className="text-xs text-slate-500 mt-1">Outstanding</div>
        </div>
        <div className="bg-card border border-border stat-border-red rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-red-400 mb-2" />
          <div className="text-xl font-bold font-mono text-red">{overdueCount}</div>
          <div className="text-xs text-slate-500 mt-1">Overdue</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {['all', 'active', 'overdue', 'completed'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); load(s) }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              statusFilter === s
                ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                : 'border-border text-slate-500 hover:border-slate-500'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
        <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search member or loan ID..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
        />
      </div>

      {/* Loan List */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="spinner scale-150" /></div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <CreditCard className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No loans found</p>
            </div>
          ) : (
            filtered.map(l => (
              <Link
                key={l.id}
                href={`/members/${l.memberId}`}
                className="flex items-start sm:items-center gap-3 px-4 sm:px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(l.member?.name || '')} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {getInitials(l.member?.name || 'U')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {l.member?.name} - {l.member?.memberId}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {l.loanId} - {l.branch?.code} - {l.centre?.code} - {formatDate(l.loanDate)} - {l.durationWeeks}w
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold font-mono text-amber-400">{formatCurrencyFull(l.totalPayable)}</div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${getLoanStatusColor(l.status)}`}>
                    {l.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {showGiveLoan && (
        <GiveLoanModal
          onClose={() => setShowGiveLoan(false)}
          onSuccess={() => { setShowGiveLoan(false); load(statusFilter) }}
        />
      )}
    </div>
  )
}

function GiveLoanModal({ onClose, onSuccess }: any) {
  const [members, setMembers] = useState<any[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [showMemberSearch, setShowMemberSearch] = useState(false)
  const [form, setForm] = useState({
    memberId: '', principal: '', interestRate: '', durationWeeks: '',
    loanDate: new Date().toISOString().split('T')[0],
    emiStartDate: '', notes: '',
  })
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getMembers().then(r => setMembers(r.data))
    const next = new Date()
    next.setDate(next.getDate() + 7)
    setForm(f => ({ ...f, emiStartDate: next.toISOString().split('T')[0] }))
  }, [])

  useEffect(() => {
    if (form.principal && form.interestRate && form.durationWeeks) {
      const calc = calculateLoan(parseFloat(form.principal), parseFloat(form.interestRate), parseInt(form.durationWeeks))
      setPreview(calc)
    } else {
      setPreview(null)
    }
  }, [form.principal, form.interestRate, form.durationWeeks])

  const filteredMembers = members.filter((m: any) => {
    if (!memberSearch) return true
    const q = memberSearch.toLowerCase().trim()
    return m.name?.toLowerCase().includes(q) || m.memberId?.toLowerCase().includes(q)
  })
  const selectedMember = members.find((m: any) => m.id === form.memberId)

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!form.memberId) {
      setError('Please select a member')
      return
    }
    setLoading(true)
    setError('')
    try {
      await createLoan(form)
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disburse loan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 lg:hidden" />
        <h2 className="text-lg font-bold text-white mb-1">Give Loan</h2>
        <p className="text-sm text-slate-400 mb-5">Auto-calculates 2% fee - All fields required</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Member</label>
            {!showMemberSearch ? (
              <button
                type="button"
                onClick={() => setShowMemberSearch(true)}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-left text-white focus:border-blue-500 transition-colors flex items-center justify-between"
              >
                <span className={selectedMember ? 'text-white' : 'text-slate-400'}>
                  {selectedMember
                    ? `${selectedMember.name} - ${selectedMember.memberId} - ${selectedMember.centre?.code} - ${selectedMember.branch?.code}`
                    : 'Select member...'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            ) : (
              <input
                type="text"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowMemberSearch(false)
                    setMemberSearch('')
                  }
                }}
                placeholder="Search by name or member ID"
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 transition-colors"
                autoFocus
              />
            )}
            {showMemberSearch && (
              <div className="mt-2 max-h-56 overflow-y-auto bg-card border border-border rounded-xl divide-y divide-border">
                {filteredMembers.map((m: any) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, memberId: m.id })
                      setShowMemberSearch(false)
                      setMemberSearch('')
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted/40 transition-colors ${
                      form.memberId === m.id ? 'text-blue-400 bg-blue-500/10' : 'text-white'
                    }`}
                  >
                    {m.name} - {m.memberId} - {m.centre?.code} - {m.branch?.code}
                  </button>
                ))}
                {filteredMembers.length === 0 && (
                  <div className="px-4 py-3 text-xs text-slate-500">No members found for "{memberSearch}"</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Principal (Rs)</label>
              <input type="number" value={form.principal} onChange={e => setForm({...form, principal: e.target.value})} placeholder="Enter principal" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rate (% p.a.)</label>
              <input type="number" value={form.interestRate} onChange={e => setForm({...form, interestRate: e.target.value})} placeholder="Enter rate" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Duration (Weeks)</label>
            <input type="number" value={form.durationWeeks} onChange={e => setForm({...form, durationWeeks: e.target.value})} placeholder="Enter duration" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
          </div>

          {/* Loan Preview */}
          {preview && (
            <div className="bg-muted rounded-xl divide-y divide-border">
              {[
                { l: 'Interest Amount', v: formatCurrencyFull(preview.interestAmount), c: 'text-amber-400' },
                { l: 'Fixed Fee (2%)', v: formatCurrencyFull(preview.fixedFee), c: 'text-amber-400' },
                { l: 'Weekly EMI', v: formatCurrencyFull(preview.weeklyEmi), c: 'text-blue-400' },
                { l: 'Total Payable', v: formatCurrencyFull(preview.totalPayable), c: 'text-white font-bold' },
              ].map(r => (
                <div key={r.l} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-xs text-slate-500">{r.l}</span>
                  <span className={`text-sm font-mono font-semibold ${r.c}`}>{r.v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Loan Date</label>
              <input type="date" value={form.loanDate} onChange={e => setForm({...form, loanDate: e.target.value})} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">EMI Start</label>
              <input type="date" value={form.emiStartDate} onChange={e => setForm({...form, emiStartDate: e.target.value})} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Purpose of loan, remarks..." className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 resize-none h-20 focus:border-blue-500 transition-colors" />
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button type="button" onClick={onClose} className="border border-border text-slate-400 py-3 rounded-xl text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <div className="spinner" /> : 'Disburse Loan ->'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

