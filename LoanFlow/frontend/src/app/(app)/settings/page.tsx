'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { getStaff, createStaff, updateStaff, deleteStaff, getQrCodes, createQrCode, deleteQrCode, getBranches, changePassword, updateProfile } from '@/lib/api'
import { getInitials, getAvatarGradient } from '@/lib/utils'
import { User, Shield, Building2, Lock, LogOut, QrCode, Plus, Trash2, Edit2, Check, X } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { user, setUser, logout, isAdmin } = useAuthStore()
  const [staffList, setStaffList] = useState<any[]>([])
  const [qrCodes, setQrCodes] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [activeQr, setActiveQr] = useState<string | null>(null)
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [editingStaff, setEditingStaff] = useState<any>(null)
  const [showAddQr, setShowAddQr] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [qrForm, setQrForm] = useState({ name: '', upiId: '' })
  const [passForm, setPassForm] = useState({ current: '', newPass: '', confirm: '' })
  const [passMsg, setPassMsg] = useState('')
  const [passErr, setPassErr] = useState('')

  useEffect(() => {
    getQrCodes().then(r => { setQrCodes(r.data); if (r.data[0]) setActiveQr(r.data[0].id) })
    if (isAdmin()) {
      getStaff().then(r => setStaffList(r.data))
      getBranches().then(r => setBranches(r.data))
    }
  }, [])

  const handleLogout = () => { logout(); router.push('/login') }

  const handleAddQr = async (e: any) => {
    e.preventDefault()
    await createQrCode(qrForm)
    const r = await getQrCodes()
    setQrCodes(r.data)
    setQrForm({ name: '', upiId: '' })
    setShowAddQr(false)
  }

  const handleDeleteQr = async (id: string) => {
    await deleteQrCode(id)
    const r = await getQrCodes()
    setQrCodes(r.data)
    if (activeQr === id) setActiveQr(r.data[0]?.id || null)
  }

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Deactivate this staff member?')) return
    await deleteStaff(id)
    const r = await getStaff()
    setStaffList(r.data)
  }

  const handleChangePassword = async (e: any) => {
    e.preventDefault()
    setPassMsg(''); setPassErr('')
    if (passForm.newPass !== passForm.confirm) { setPassErr('Passwords do not match'); return }
    try {
      await changePassword(passForm.current, passForm.newPass)
      setPassMsg('Password changed successfully!')
      setPassForm({ current: '', newPass: '', confirm: '' })
    } catch (err: any) {
      setPassErr(err.response?.data?.error || 'Failed to change password')
    }
  }

  const selectedQr = qrCodes.find(q => q.id === activeQr)
  const qrImageUrl = (upiId: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=LoanFlow`)}`

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(user?.name || '')} flex items-center justify-center text-white text-lg font-bold flex-shrink-0`}>
          {getInitials(user?.name || '')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-white">{user?.name}</div>
          <div className="text-sm text-slate-400 break-all">{user?.email}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={user?.role === 'ADMIN' ? 'badge-admin' : 'badge-staff'} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
              {user?.role}
            </span>
            {user?.branch && (
              <span className="text-xs text-slate-500">{user.branch.code} - {user.branch.name}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowEditProfile(true)}
          className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-blue-500/20 transition-colors flex-shrink-0"
          title="Edit profile"
        >
          <Edit2 className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      {/* Staff Management (Admin only) */}
      {isAdmin() && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" /> Staff Management
            </h2>
            <button
              onClick={() => setShowAddStaff(true)}
              className="flex items-center gap-1 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Staff
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {staffList.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-sm">No staff added yet</div>
            ) : (
              staffList.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getAvatarGradient(s.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {getInitials(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{s.name}</div>
                    <div className="text-xs text-slate-500 break-all">{s.email} - {s.branch?.code || 'No branch'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingStaff(s)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-blue-500/20 transition-colors">
                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button onClick={() => handleDeleteStaff(s.id)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-red-500/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* QR Codes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-blue-400" /> Payment QR Codes
          </h2>
          {isAdmin() && (
            <button
              onClick={() => setShowAddQr(!showAddQr)}
              className="flex items-center gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" /> Add QR
            </button>
          )}
        </div>

        {showAddQr && (
          <form onSubmit={handleAddQr} className="bg-card border border-border rounded-xl p-4 mb-3 space-y-3">
            <input value={qrForm.name} onChange={e => setQrForm({...qrForm, name: e.target.value})} placeholder="QR Label (e.g. B01 Main Counter)" className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 transition-colors" required />
            <input value={qrForm.upiId} onChange={e => setQrForm({...qrForm, upiId: e.target.value})} placeholder="UPI ID (e.g. loanflow@oksbi)" className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 transition-colors" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowAddQr(false)} className="border border-border text-slate-400 py-2 rounded-xl text-sm font-semibold">Cancel</button>
              <button type="submit" className="bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold">Add</button>
            </div>
          </form>
        )}

        {qrCodes.length > 0 ? (
          <div className="bg-card border border-border rounded-xl p-5">
            {/* QR Tabs */}
            {qrCodes.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {qrCodes.map(q => (
                  <button
                    key={q.id}
                    onClick={() => setActiveQr(q.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                      activeQr === q.id
                        ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                        : 'border-border text-slate-500'
                    }`}
                  >
                    {q.name}
                  </button>
                ))}
              </div>
            )}

            {selectedQr && (
              <div className="text-center">
                <img
                  src={qrImageUrl(selectedQr.upiId)}
                  alt={selectedQr.name}
                  className="w-44 h-44 mx-auto rounded-2xl border-2 border-border mb-4 object-contain bg-white p-2"
                />
                <div className="text-sm font-bold text-white">{selectedQr.name}</div>
                <div className="text-xs text-slate-400 font-mono mt-1">{selectedQr.upiId}</div>
                {isAdmin() && (
                  <button
                    onClick={() => handleDeleteQr(selectedQr.id)}
                    className="mt-3 text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1 mx-auto"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-slate-600 text-sm">
            No QR codes configured yet
          </div>
        )}
      </div>

      {/* Change Password */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-amber-400" /> Change Password
        </h2>
        <div className="bg-card border border-border rounded-xl p-5">
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input type="password" value={passForm.current} onChange={e => setPassForm({...passForm, current: e.target.value})} placeholder="Current password" className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 transition-colors" />
            <input type="password" value={passForm.newPass} onChange={e => setPassForm({...passForm, newPass: e.target.value})} placeholder="New password" className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 transition-colors" />
            <input type="password" value={passForm.confirm} onChange={e => setPassForm({...passForm, confirm: e.target.value})} placeholder="Confirm new password" className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 transition-colors" />
            {passErr && <p className="text-xs text-red-400">{passErr}</p>}
            {passMsg && <p className="text-xs text-emerald-400">{passMsg}</p>}
            <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-2.5 rounded-xl text-sm">
              Update Password
            </button>
          </form>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-5 py-4 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-semibold">Sign Out</span>
        </button>
      </div>

      {/* Staff Modals */}
      {showAddStaff && (
        <StaffModal
          branches={branches}
          onClose={() => setShowAddStaff(false)}
          onSuccess={async () => { setShowAddStaff(false); const r = await getStaff(); setStaffList(r.data) }}
        />
      )}
      {editingStaff && (
        <StaffModal
          staff={editingStaff}
          branches={branches}
          onClose={() => setEditingStaff(null)}
          onSuccess={async () => { setEditingStaff(null); const r = await getStaff(); setStaffList(r.data) }}
        />
      )}
      {showEditProfile && user && (
        <ProfileModal
          user={user}
          onClose={() => setShowEditProfile(false)}
          onSuccess={(nextUser: any) => {
            setUser(nextUser)
            setShowEditProfile(false)
          }}
        />
      )}
    </div>
  )
}

function ProfileModal({ user, onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await updateProfile(form)
      onSuccess(r.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 lg:hidden" />
        <h2 className="text-lg font-bold text-white mb-5">Edit Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" />
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button type="button" onClick={onClose} className="border border-border text-slate-400 py-3 rounded-xl text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <div className="spinner" /> : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StaffModal({ staff, branches, onClose, onSuccess }: any) {
  const isEdit = !!staff
  const [form, setForm] = useState({
    name: staff?.name || '', email: staff?.email || '', phone: staff?.phone || '',
    branchId: staff?.branch?.id || staff?.branchId || '', password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload: any = { name: form.name, email: form.email, phone: form.phone, branchId: form.branchId || null }
      if (form.password) payload.password = form.password
      if (!isEdit) payload.password = form.password
      if (isEdit) await updateStaff(staff.id, payload)
      else await createStaff(payload)
      await onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save staff')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 lg:hidden" />
        <h2 className="text-lg font-bold text-white mb-5">{isEdit ? 'Edit Staff' : 'Add New Staff'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} type="tel" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Assign Branch</label>
            <select value={form.branchId} onChange={e => setForm({...form, branchId: e.target.value})} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors">
              <option value="">No branch</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Password {isEdit && <span className="text-slate-600 font-normal">(leave blank to keep)</span>}
            </label>
            <input value={form.password} onChange={e => setForm({...form, password: e.target.value})} type="password" placeholder={isEdit ? 'New password (optional)' : 'Set password'} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors" required={!isEdit} />
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button type="button" onClick={onClose} className="border border-border text-slate-400 py-3 rounded-xl text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <div className="spinner" /> : (isEdit ? 'Save Changes' : 'Create Staff')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

