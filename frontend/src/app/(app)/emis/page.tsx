'use client'

import { useEffect, useMemo, useState } from 'react'
import { getCentres, getPendingEmis, payEmi } from '@/lib/api'
import { formatCurrencyFull, formatDate, getInitials, getAvatarGradient } from '@/lib/utils'
import { CheckCircle, ChevronDown } from 'lucide-react'

export default function EmiPage() {
  const [centres, setCentres] = useState<any[]>([])
  const [centreId, setCentreId] = useState('')
  const [emis, setEmis] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [centreSearch, setCentreSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [payingEmi, setPayingEmi] = useState<any>(null)
  const [bulkPayOpen, setBulkPayOpen] = useState(false)
  const [payData, setPayData] = useState({ paidAmount: '', paymentMethod: 'CASH', notes: '' })
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    getCentres().then((r) => setCentres(r.data || []))
  }, [])

  const loadEmis = async (selectedCentreId: string) => {
    if (!selectedCentreId) {
      setEmis([])
      return
    }
    setLoading(true)
    try {
      const r = await getPendingEmis({ centreId: selectedCentreId })
      setEmis(Array.isArray(r.data) ? r.data : [])
      setSelectedIds(new Set())
    } finally {
      setLoading(false)
    }
  }

  const selectedEmis = useMemo(
    () => emis.filter((e) => selectedIds.has(e.id)),
    [emis, selectedIds]
  )

  const selectedTotal = selectedEmis.reduce((sum, e) => sum + (e.amount || 0), 0)

  const filteredEmis = emis.filter((emi) => {
    if (!search) return true
    const term = search.toLowerCase()
    const memberName = emi.loan?.member?.name?.toLowerCase() || ''
    const memberId = emi.loan?.member?.memberId?.toLowerCase() || ''
    const loanId = emi.loan?.loanId?.toLowerCase() || ''
    return memberName.includes(term) || memberId.includes(term) || loanId.includes(term)
  })

  const toggleSelect = (emiId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(emiId)) next.delete(emiId)
      else next.add(emiId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEmis.length) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(filteredEmis.map((e) => e.id)))
  }

  const handlePayEmi = async (e: any) => {
    e.preventDefault()
    setPaying(true)
    try {
      await payEmi(payingEmi.id, {
        paidAmount: parseFloat(payData.paidAmount),
        paymentMethod: payData.paymentMethod,
        notes: payData.notes,
      })
      setPayingEmi(null)
      await loadEmis(centreId)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  const handleBulkPay = async (e: any) => {
    e.preventDefault()
    if (selectedEmis.length === 0) return
    setPaying(true)
    const failed: any[] = []
    try {
      for (const emi of selectedEmis) {
        try {
          await payEmi(emi.id, {
            paidAmount: emi.amount,
            paymentMethod: payData.paymentMethod,
            notes: payData.notes,
          })
        } catch (err) {
          failed.push(emi)
        }
      }
      setBulkPayOpen(false)
      setSelectedIds(new Set())
      await loadEmis(centreId)
      if (failed.length > 0) {
        alert(`Paid ${selectedEmis.length - failed.length} EMIs. Failed: ${failed.length}`)
      }
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white">EMI</h1>
        <p className="text-sm text-slate-400 mt-0.5">Pay pending EMIs (today and past)</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Centre</label>
        <div className="mb-2">
          <input
            value={centreSearch}
            onChange={(e) => setCentreSearch(e.target.value)}
            placeholder="Search centre by code or name..."
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="relative">
          <select
            value={centreId}
            onChange={(e) => {
              setCentreId(e.target.value)
              loadEmis(e.target.value)
            }}
            className="w-full appearance-none bg-muted border border-border rounded-lg px-3 pr-9 py-2 text-xs text-white focus:border-blue-500 transition-colors"
          >
            <option value="">Select centre</option>
            {centres
              .filter((c) => {
                if (!centreSearch) return true
                const term = centreSearch.toLowerCase()
                return `${c.code} ${c.name}`.toLowerCase().includes(term)
              })
              .map((c) => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by member name or ID..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="spinner scale-150" /></div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Pending EMIs</h3>
            <span className="text-xs text-slate-400">
              Total: <span className="text-white font-semibold">{filteredEmis.length}</span>
            </span>
          </div>
          {filteredEmis.length > 0 && (
            <div className="px-5 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === filteredEmis.length}
                  onChange={toggleSelectAll}
                  className="accent-blue-500"
                />
                Select all
              </label>
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500">
                  Selected: <span className="text-white font-semibold">{selectedIds.size}</span>
                </div>
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  onClick={() => {
                    setPayData({ paidAmount: selectedTotal.toFixed(2), paymentMethod: 'CASH', notes: '' })
                    setBulkPayOpen(true)
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white"
                >
                  Pay Selected
                </button>
              </div>
            </div>
          )}
          {filteredEmis.length === 0 ? (
            <div className="py-12 text-center text-slate-600 text-sm">No pending EMIs</div>
          ) : (
            filteredEmis.map((emi: any) => (
              <div
                key={emi.id}
                className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(emi.id)}
                  onChange={() => toggleSelect(emi.id)}
                  className="accent-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPayingEmi(emi)
                    setPayData({ paidAmount: emi.amount.toFixed(2), paymentMethod: 'CASH', notes: '' })
                  }}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(emi.loan?.member?.name || '')} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {getInitials(emi.loan?.member?.name || 'U')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{emi.loan?.member?.name}</div>
                    <div className="text-xs text-slate-500">
                      EMI #{emi.emiNumber} · {formatDate(emi.dueDate)} · {emi.loan?.branch?.code} · {emi.loan?.centre?.code}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-amber-400">{formatCurrencyFull(emi.amount)}</div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md badge-pending">PENDING</span>
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {payingEmi && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={() => setPayingEmi(null)}>
          <div className="bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 lg:hidden" />
            <h2 className="text-lg font-bold text-white mb-1">Pay EMI</h2>
            <p className="text-sm text-slate-400 mb-5">
              EMI #{payingEmi.emiNumber} - {formatCurrencyFull(payingEmi.amount)} - {formatDate(payingEmi.dueDate)}
            </p>
            <form onSubmit={handlePayEmi} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Payment Amount (Rs)</label>
                <input
                  type="number"
                  value={payData.paidAmount}
                  onChange={(e) => setPayData({ ...payData, paidAmount: e.target.value })}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'NEFT'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayData({ ...payData, paymentMethod: m })}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        payData.paymentMethod === m
                          ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                          : 'border-border text-slate-500 hover:border-slate-500'
                      }`}
                    >
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes (optional)</label>
                <input
                  value={payData.notes}
                  onChange={(e) => setPayData({ ...payData, notes: e.target.value })}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setPayingEmi(null)} className="border border-border text-slate-400 py-3 rounded-xl text-sm font-semibold">Cancel</button>
                <button type="submit" disabled={paying} className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {paying ? <div className="spinner" /> : <><CheckCircle className="w-4 h-4" /> Confirm</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bulkPayOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={() => setBulkPayOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 lg:hidden" />
            <h2 className="text-lg font-bold text-white mb-1">Pay Selected EMIs</h2>
            <p className="text-sm text-slate-400 mb-5">
              {selectedEmis.length} EMIs • Total {formatCurrencyFull(selectedTotal)}
            </p>
            <form onSubmit={handleBulkPay} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'NEFT'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayData({ ...payData, paymentMethod: m })}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        payData.paymentMethod === m
                          ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                          : 'border-border text-slate-500 hover:border-slate-500'
                      }`}
                    >
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes (optional)</label>
                <input
                  value={payData.notes}
                  onChange={(e) => setPayData({ ...payData, notes: e.target.value })}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setBulkPayOpen(false)} className="border border-border text-slate-400 py-3 rounded-xl text-sm font-semibold">Cancel</button>
                <button type="submit" disabled={paying} className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {paying ? <div className="spinner" /> : <><CheckCircle className="w-4 h-4" /> Confirm</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}