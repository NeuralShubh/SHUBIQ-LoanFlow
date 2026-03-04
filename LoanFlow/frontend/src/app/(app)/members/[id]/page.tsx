'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getMember, payEmi, undoEmi, updateMember, deleteMember } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { formatDate, formatCurrencyFull, getInitials, getAvatarGradient } from '@/lib/utils'
import { ArrowLeft, Phone, CreditCard, CheckCircle, Clock, IndianRupee, Calendar, Edit2, Trash2 } from 'lucide-react'

export default function MemberDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { isAdmin, user } = useAuthStore()

  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [payingEmi, setPayingEmi] = useState<any>(null)
  const [payData, setPayData] = useState({ paidAmount: '', paymentMethod: 'CASH', notes: '' })
  const [paying, setPaying] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editData, setEditData] = useState({ name: '', phone: '', aadhar: '', area: '', status: 'ACTIVE' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    getMember(id as string)
      .then((r) => setMember(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner scale-150" />
      </div>
    )
  }

  if (!member) return <div className="text-center py-20 text-slate-500">Member not found</div>

  const activeLoan =
    member.loans?.find((l: any) => l.status === 'ACTIVE' || l.status === 'OVERDUE') || member.loans?.[0]

  const paidEmis = activeLoan?.emis?.filter((e: any) => e.status === 'PAID') ?? []
  const totalPaid = paidEmis.reduce((s: number, e: any) => s + (e.paidAmount || 0), 0)
  const remaining = activeLoan ? activeLoan.totalPayable - totalPaid : 0
  const progress = activeLoan ? (paidEmis.length / activeLoan.durationWeeks) * 100 : 0
  const emisLeft = activeLoan ? activeLoan.durationWeeks - paidEmis.length : 0

  const paymentMethods = ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'NEFT']

  const openEdit = () => {
    setEditData({
      name: member.name || '',
      phone: member.phone || '',
      aadhar: member.aadhar || '',
      area: member.area || '',
      status: member.status || 'ACTIVE',
    })
    setShowEdit(true)
  }

  const handleSaveEdit = async (e: any) => {
    e.preventDefault()
    setSavingEdit(true)
    try {
      await updateMember(id as string, editData)
      setShowEdit(false)
      load()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update member')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteMember = async () => {
    const canDelete = isAdmin() || (user?.role === 'STAFF' && member?.staffId === user.id)
    if (!canDelete) return
    if (!confirm('Deactivate this member?')) return
    setDeleting(true)
    try {
      await deleteMember(id as string)
      router.push('/members')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to deactivate member')
    } finally {
      setDeleting(false)
    }
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
      load()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  const handleUndoEmi = async (emiId: string) => {
    if (!confirm('Undo this EMI payment?')) return
    try {
      await undoEmi(emiId)
      load()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Undo failed')
    }
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex gap-2 justify-end">
        <button
          onClick={openEdit}
          className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" /> Edit
        </button>
        {(isAdmin() || (user?.role === 'STAFF' && member?.staffId === user.id)) && (
          <button
            onClick={handleDeleteMember}
            disabled={deleting}
            className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 text-center">
        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getAvatarGradient(member.name)} flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 glow-blue`}>
          {getInitials(member.name)}
        </div>
        <h2 className="text-xl font-bold text-white">{member.name}</h2>
        <p className="text-sm text-slate-400 mt-1">Member ID: {member.memberId}</p>
        <div className="flex justify-center gap-2 mt-3">
          <span className="badge-active text-[10px] px-2 py-0.5 rounded-full font-semibold">{member.status}</span>
          <span className="badge-staff text-[10px] px-2 py-0.5 rounded-full font-semibold">{member.branch?.code}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-muted text-slate-400 border border-border">{member.centre?.code}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Member Info</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Phone', value: member.phone },
            { label: 'Aadhar', value: member.aadhar || '-' },
            { label: 'Area', value: member.area || '-' },
            { label: 'Branch', value: member.branch?.name },
            { label: 'Centre', value: member.centre?.name },
            { label: 'Member Since', value: formatDate(member.createdAt) },
          ].map((item) => (
            <div key={item.label} className="bg-muted rounded-xl p-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{item.label}</div>
              <div className="text-sm font-semibold text-white font-mono">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {activeLoan && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border stat-border-gold rounded-xl p-4">
              <IndianRupee className="w-4 h-4 text-amber-400 mb-2" />
              <div className="text-xl font-bold font-mono text-amber-400">{formatCurrencyFull(activeLoan.principal)}</div>
              <div className="text-xs text-slate-500 mt-1">Loan Amount</div>
            </div>
            <div className="bg-card border border-border stat-border-green rounded-xl p-4">
              <CheckCircle className="w-4 h-4 text-emerald-400 mb-2" />
              <div className="text-xl font-bold font-mono text-green">{formatCurrencyFull(totalPaid)}</div>
              <div className="text-xs text-slate-500 mt-1">EMI Paid</div>
            </div>
            <div className="bg-card border border-border stat-border-red rounded-xl p-4">
              <Clock className="w-4 h-4 text-red-400 mb-2" />
              <div className="text-xl font-bold font-mono text-red">{formatCurrencyFull(remaining)}</div>
              <div className="text-xs text-slate-500 mt-1">Remaining</div>
            </div>
            <div className="bg-card border border-border stat-border-blue rounded-xl p-4">
              <Calendar className="w-4 h-4 text-blue-400 mb-2" />
              <div className="text-xl font-bold font-mono text-blue-400">{emisLeft}</div>
              <div className="text-xs text-slate-500 mt-1">EMIs Left</div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Loan Details</div>
            <div className="bg-muted rounded-xl divide-y divide-border">
              {[
                { label: 'Principal', value: formatCurrencyFull(activeLoan.principal), color: '' },
                { label: 'Rate of Interest', value: `${activeLoan.interestRate}% p.a.`, color: 'text-amber-400' },
                { label: 'Duration', value: `${activeLoan.durationWeeks} weeks`, color: '' },
                { label: 'Fixed Fee (2%)', value: formatCurrencyFull(activeLoan.fixedFee), color: 'text-amber-400' },
                { label: 'Total Payable', value: formatCurrencyFull(activeLoan.totalPayable), color: 'text-white font-bold' },
                { label: 'Weekly EMI', value: formatCurrencyFull(activeLoan.weeklyEmi), color: 'text-blue-400' },
                { label: 'Loan Date', value: formatDate(activeLoan.loanDate), color: '' },
                { label: 'EMI Start Date', value: formatDate(activeLoan.emiStartDate), color: '' },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-xs text-slate-400">{r.label}</span>
                  <span className={`text-sm font-mono font-semibold ${r.color || 'text-white'}`}>{r.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-slate-400 font-medium">Repayment Progress</span>
                <span className="text-sm font-bold font-mono text-emerald-400">{progress.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full progress-animated"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-white">EMI Schedule</h3>
            </div>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {activeLoan.emis?.map((emi: any) => (
                <div key={emi.id} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                      emi.status === 'PAID'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : emi.status === 'OVERDUE'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-muted text-slate-500'
                    }`}
                  >
                    {emi.status === 'PAID' ? <CheckCircle className="w-4 h-4" /> : emi.emiNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">EMI #{emi.emiNumber}</div>
                    <div className="text-xs text-slate-500">{formatDate(emi.dueDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-white">{formatCurrencyFull(emi.amount)}</div>
                    {emi.status === 'PAID' ? (
                      <div className="space-y-1">
                        <div className="text-[10px] text-slate-500">{emi.paymentMethod?.replace('_', ' ')}</div>
                        <button
                          onClick={() => handleUndoEmi(emi.id)}
                          className="text-[10px] bg-red-500/15 hover:bg-red-500/25 text-red-300 px-2 py-0.5 rounded-md font-semibold transition-colors"
                        >
                          Undo
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPayingEmi(emi)
                          setPayData({ paidAmount: emi.amount.toFixed(2), paymentMethod: 'CASH', notes: '' })
                        }}
                        className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded-md font-semibold transition-colors mt-0.5"
                      >
                        Pay
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!activeLoan && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No active loans</p>
        </div>
      )}

      {payingEmi && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={() => setPayingEmi(null)}>
          <div className="bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 lg:hidden" />
            <h2 className="text-lg font-bold text-white mb-1">Mark EMI as Paid</h2>
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
                  {paymentMethods.map((m) => (
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

      {showEdit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={() => setShowEdit(false)}>
          <div className="bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 lg:hidden" />
            <h2 className="text-lg font-bold text-white mb-4">Edit Member</h2>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Name</label>
                <input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone</label>
                <input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Aadhar</label>
                <input value={editData.aadhar} onChange={(e) => setEditData({ ...editData, aadhar: e.target.value })} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Area</label>
                <input value={editData.area} onChange={(e) => setEditData({ ...editData, area: e.target.value })} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</label>
                <select value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="border border-border text-slate-400 py-3 rounded-xl text-sm font-semibold">Cancel</button>
                <button type="submit" disabled={savingEdit} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-60">
                  {savingEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
