'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import {
  getBranches,
  getCentres,
  getMembers,
  createMember,
  createBranch,
  createCentre,
  updateBranch,
  deleteBranch,
  updateCentre,
  deleteCentre,
} from '@/lib/api'
import { getInitials, getAvatarGradient, getLoanStatusColor } from '@/lib/utils'
import { Building2, Users, ChevronRight, ChevronDown, Search, Plus, Home, ArrowLeft, MapPin, Edit2, Trash2 } from 'lucide-react'

type View = 'branches' | 'centres' | 'members'

export default function MembersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()

  const [view, setView] = useState<View>('branches')
  const [branches, setBranches] = useState<any[]>([])
  const [centres, setCentres] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<any>(null)
  const [selectedCentre, setSelectedCentre] = useState<any>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [showAddCentre, setShowAddCentre] = useState(false)
  const [editingBranch, setEditingBranch] = useState<any>(null)
  const [editingCentre, setEditingCentre] = useState<any>(null)

  const canManageEntity = (entity: any) => user?.role === 'ADMIN' || (entity?.createdById && entity.createdById === user?.id)

  const refreshBranches = async () => {
    const r = await getBranches()
    setBranches(r.data)
  }

  const refreshCentres = async (branchId?: string) => {
    if (!branchId) return
    const r = await getCentres(branchId)
    setCentres(r.data)
  }

  useEffect(() => {
    refreshBranches().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const branchId = searchParams.get('branchId') || ''
    if (!branchId || branches.length === 0) return
    const centreId = searchParams.get('centreId') || ''
    const branch = branches.find((b) => b.id === branchId)
    if (!branch) return

    setSelectedBranch(branch)
    setLoading(true)
    getCentres(branchId).then((r) => {
      setCentres(r.data)
      if (centreId) {
        const centre = r.data.find((c: any) => c.id === centreId)
        if (centre) {
          setSelectedCentre(centre)
          loadMembers(branchId, centreId)
          setView('members')
          return
        }
      }
      setView('centres')
      setLoading(false)
    })
  }, [branches, searchParams])

  const loadMembers = (branchId?: string, centreId?: string) => {
    setLoading(true)
    const params: any = {}
    if (branchId) params.branchId = branchId
    if (centreId) params.centreId = centreId

    getMembers(params).then((r) => {
      setMembers(r.data)
      setLoading(false)
    })
  }

  const navToBranch = (branch: any) => {
    setSelectedBranch(branch)
    setLoading(true)
    refreshCentres(branch.id).then(() => {
      setView('centres')
      router.replace(`/members?branchId=${branch.id}`)
      setLoading(false)
    })
  }

  const navToCentre = (centre: any) => {
    setSelectedCentre(centre)
    loadMembers(selectedBranch?.id, centre.id)
    setView('members')
    if (selectedBranch?.id) {
      router.replace(`/members?branchId=${selectedBranch.id}&centreId=${centre.id}`)
    }
  }

  const navBack = () => {
    if (view === 'members') {
      setView('centres')
      setSelectedCentre(null)
      if (selectedBranch?.id) {
        router.replace(`/members?branchId=${selectedBranch.id}`)
      } else {
        router.replace('/members')
      }
      return
    }

    if (view === 'centres') {
      setView('branches')
      setSelectedBranch(null)
      router.replace('/members')
    }
  }

  const handleDeleteBranch = async (branch: any) => {
    if (!canManageEntity(branch)) return
    const msg = 'Delete this branch? It must have no active centres.'
    if (!confirm(msg)) return
    try {
      await deleteBranch(branch.id)
      await refreshBranches()
      if (selectedBranch?.id === branch.id) {
        setSelectedBranch(null)
        setSelectedCentre(null)
        setView('branches')
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete branch')
    }
  }

  const handleDeleteCentre = async (centre: any) => {
    if (!canManageEntity(centre)) return
    const msg = 'Delete this centre? It must have no members.'
    if (!confirm(msg)) return
    try {
      await deleteCentre(centre.id)
      await refreshCentres(selectedBranch?.id)
      if (selectedCentre?.id === centre.id) {
        setSelectedCentre(null)
        setView('centres')
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete centre')
    }
  }

  const filtered = members.filter((m) => {
    const matchSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.memberId.toLowerCase().includes(search.toLowerCase())

    const rawStatus = (m.loans?.[0]?.status || 'NONE').toLowerCase()
    const normalizedStatus = rawStatus === 'overdue' ? 'active' : rawStatus
    const matchStatus = statusFilter === 'all' || normalizedStatus === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {view !== 'branches' && (
            <button
              onClick={navBack}
              className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center hover:border-blue-500/40 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
          )}

          <div>
            <h1 className="text-xl font-bold text-white">Members</h1>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <button
                onClick={() => {
                  setView('branches')
                  setSelectedBranch(null)
                  setSelectedCentre(null)
                  router.replace('/members')
                }}
                className="hover:text-slate-300 transition-colors"
              >
                All Branches
              </button>

              {selectedBranch && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <button
                    onClick={() => {
                      setView('centres')
                      setSelectedCentre(null)
                      if (selectedBranch?.id) {
                        router.replace(`/members?branchId=${selectedBranch.id}`)
                      }
                    }}
                    className="hover:text-slate-300 transition-colors"
                  >
                    {selectedBranch.name}
                  </button>
                </>
              )}

              {selectedCentre && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-slate-300">{selectedCentre.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {view === 'members' && (
            <button
              onClick={() => setShowAddMember(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Member
            </button>
          )}

          {view === 'branches' && (
            <button
              onClick={() => setShowAddBranch(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Branch
            </button>
          )}

          {view === 'centres' && (
            <button
              onClick={() => setShowAddCentre(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Centre
            </button>
          )}
        </div>
      </div>

      {view === 'branches' && (
        <div className="space-y-2">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            branches.map((b) => (
              <button
                key={b.id}
                onClick={() => navToBranch(b)}
                className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-blue-500/30 transition-all card-hover text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{b.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {b.code} • {b.centres?.length ?? 0} centres • {b._count?.members ?? 0} members
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManageEntity(b) && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setEditingBranch(b)}
                        className="w-8 h-8 rounded-lg border border-border bg-muted text-slate-300 hover:text-white hover:border-blue-500/40 flex items-center justify-center transition-colors"
                        title="Edit branch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBranch(b)}
                        className="w-8 h-8 rounded-lg border border-border bg-muted text-red-300 hover:text-red-200 hover:border-red-500/40 flex items-center justify-center transition-colors"
                        title="Delete branch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <span className="badge-active text-[10px] px-2 py-0.5 rounded-full font-semibold">Active</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {view === 'centres' && (
        <div className="space-y-2">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            centres.map((c) => (
              <button
                key={c.id}
                onClick={() => navToCentre(c)}
                className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-blue-500/30 transition-all card-hover text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Home className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.code} • {c._count?.members ?? 0} members</div>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {canManageEntity(c) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingCentre(c)}
                        className="w-8 h-8 rounded-lg border border-border bg-muted text-slate-300 hover:text-white hover:border-blue-500/40 flex items-center justify-center transition-colors"
                        title="Edit centre"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCentre(c)}
                        className="w-8 h-8 rounded-lg border border-border bg-muted text-red-300 hover:text-red-200 hover:border-red-500/40 flex items-center justify-center transition-colors"
                        title="Delete centre"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {view === 'members' && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
              <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or member ID..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none ring-0 border-0 focus:ring-0 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {['all', 'active', 'completed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
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

          {loading ? (
            <LoadingSkeleton />
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                  <Users className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">No members found</p>
                </div>
              ) : (
                filtered.map((m) => {
                  const loan = m.loans?.[0]
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => router.push(`/members/${m.id}?branchId=${selectedBranch?.id || ''}&centreId=${selectedCentre?.id || ''}`)}
                      className="w-full flex items-start sm:items-center gap-3 px-4 sm:px-5 py-4 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(m.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {getInitials(m.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{m.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <span>{m.memberId}</span>
                          <span>•</span>
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate">{m.area || m.centre?.name}</span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {loan ? (
                          <>
                            <div className="text-xs font-bold font-mono text-amber-400">Rs {loan.principal?.toLocaleString()}</div>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${getLoanStatusColor(loan.status)}`}>
                              {loan.status === 'OVERDUE' ? 'ACTIVE' : loan.status}
                            </span>
                          </>
                        ) : (
                          <span className="badge-completed text-[10px] px-1.5 py-0.5 rounded-md font-semibold">No Loan</span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </>
      )}

      {showAddMember && (
        <AddMemberModal
          branchId={selectedBranch?.id || user?.branch?.id}
          centreId={selectedCentre?.id}
          onClose={() => setShowAddMember(false)}
          onSuccess={() => {
            setShowAddMember(false)
            loadMembers(selectedBranch?.id, selectedCentre?.id)
          }}
        />
      )}

      {showAddBranch && (
        <QuickModal
          title="Add New Branch"
          fields={[{ key: 'name', label: 'Branch Name', placeholder: 'e.g. Wakad' }]}
          onClose={() => setShowAddBranch(false)}
          onSubmit={async (data: any) => {
            await createBranch(data)
            await refreshBranches()
            setShowAddBranch(false)
          }}
        />
      )}

      {showAddCentre && (
        <QuickModal
          title="Add New Centre"
          fields={[{ key: 'name', label: 'Centre Name', placeholder: 'e.g. Kasba Peth Centre' }]}
          onClose={() => setShowAddCentre(false)}
          onSubmit={async (data: any) => {
            await createCentre({ ...data, branchId: selectedBranch.id })
            await refreshCentres(selectedBranch.id)
            setShowAddCentre(false)
          }}
        />
      )}

      {editingBranch && (
        <QuickModal
          title="Edit Branch"
          fields={[{ key: 'name', label: 'Branch Name', placeholder: 'e.g. Wakad' }]}
          initialData={{ name: editingBranch.name }}
          submitLabel="Save"
          onClose={() => setEditingBranch(null)}
          onSubmit={async (data: any) => {
            await updateBranch(editingBranch.id, { name: data.name })
            await refreshBranches()
            if (selectedBranch?.id === editingBranch.id) {
              setSelectedBranch({ ...selectedBranch, name: data.name })
            }
            setEditingBranch(null)
          }}
        />
      )}

      {editingCentre && (
        <QuickModal
          title="Edit Centre"
          fields={[{ key: 'name', label: 'Centre Name', placeholder: 'e.g. Kasba Peth Centre' }]}
          initialData={{ name: editingCentre.name }}
          submitLabel="Save"
          onClose={() => setEditingCentre(null)}
          onSubmit={async (data: any) => {
            await updateCentre(editingCentre.id, { name: data.name })
            await refreshCentres(selectedBranch?.id)
            if (selectedCentre?.id === editingCentre.id) {
              setSelectedCentre({ ...selectedCentre, name: data.name })
            }
            setEditingCentre(null)
          }}
        />
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-2.5 bg-muted rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AddMemberModal({ branchId, centreId, onClose, onSuccess }: any) {
  const [data, setData] = useState({
    name: '',
    phone: '',
    aadhar: '',
    area: '',
    branchId: branchId || '',
    centreId: centreId || '',
  })
  const [branches, setBranches] = useState<any[]>([])
  const [centres, setCentres] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getBranches().then((r) => setBranches(r.data))
    if (branchId) getCentres(branchId).then((r) => setCentres(r.data))
  }, [])

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await createMember(data)
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 lg:hidden" />
        <h2 className="text-lg font-bold text-white mb-1">Add New Member</h2>
        <p className="text-sm text-slate-400 mb-5">Fill in all member details</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="Full Name"
              value={data.name}
              onChange={(v: string) => setData({ ...data, name: v })}
              placeholder="Enter name"
              required
            />
            <FormField
              label="Phone"
              value={data.phone}
              onChange={(v: string) => setData({ ...data, phone: v })}
              placeholder="10-digit"
              type="tel"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Area</label>
            <input
              type="text"
              value={data.area}
              onChange={(e) => setData({ ...data, area: e.target.value })}
              placeholder="Enter area"
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Branch</label>
              <select
                value={data.branchId}
                onChange={(e) => {
                  setData({ ...data, branchId: e.target.value, centreId: '' })
                  getCentres(e.target.value).then((r) => setCentres(r.data))
                }}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors"
                required
              >
                <option value="">Select...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Centre</label>
              <div className="relative">
                <select
                  value={data.centreId}
                  onChange={(e) => setData({ ...data, centreId: e.target.value })}
                  className="w-full appearance-none bg-muted border border-border rounded-xl px-4 pr-10 py-3 text-sm text-white focus:border-blue-500 transition-colors"
                >
                  <option value="">Select...</option>
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          <FormField
            label="Aadhar Number"
            value={data.aadhar}
            onChange={(v: string) => setData({ ...data, aadhar: v })}
            placeholder="XXXX-XXXX-XXXX"
          />

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-border text-slate-400 hover:text-white py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <div className="spinner" /> : 'Save Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function QuickModal({ title, fields, onClose, onSubmit, initialData = {}, submitLabel = 'Create' }: any) {
  const [data, setData] = useState<any>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSubmit(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-5">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f: any) => (
            <FormField
              key={f.key}
              label={f.label}
              value={data[f.key] || ''}
              onChange={(v: string) => setData({ ...data, [f.key]: v })}
              placeholder={f.placeholder}
              required
            />
          ))}
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button type="button" onClick={onClose} className="border border-border text-slate-400 py-3 rounded-xl text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center">
              {loading ? <div className="spinner" /> : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text', required = false }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
      />
    </div>
  )
}
