'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { login, wakeBackend } from '@/lib/api'
import { TrendingUp, Shield, Lock, Mail, Eye, EyeOff, Landmark } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { setUser, setToken, user, initFromStorage } = useAuthStore()
  const [role, setRole] = useState<'admin' | 'staff'>('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isWakingBackend, setIsWakingBackend] = useState(false)

  useEffect(() => {
    initFromStorage()
  }, [])

  useEffect(() => {
    if (user) router.push('/dashboard')
  }, [user])

  // Auto-fill demo credentials
  const fillDemo = (r: 'admin' | 'staff') => {
    setRole(r)
    if (r === 'admin') {
      setEmail('admin@loanflow.com')
      setPassword('admin1234')
    } else {
      setEmail('ram@loanflow.com')
      setPassword('ram1234')
    }
    setError('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await login(email.trim(), password.trim())
      setToken(res.data.token)
      setUser(res.data.user)
      router.push('/dashboard')
    } catch (err: any) {
      // Render free services may sleep; warm once and retry login.
      if (!err.response) {
        try {
          setIsWakingBackend(true)
          await wakeBackend()
          const retry = await login(email.trim(), password.trim())
          setToken(retry.data.token)
          setUser(retry.data.user)
          router.push('/dashboard')
          return
        } catch (retryErr: any) {
          if (retryErr.response?.data?.error) {
            setError(retryErr.response.data.error)
          } else if (retryErr.code === 'ECONNABORTED') {
            setError('Backend is waking up on Render. Wait 30-60 seconds and try again.')
          } else {
            setError('Cannot reach backend. Check Render URL and CORS environment variables.')
          }
        } finally {
          setIsWakingBackend(false)
        }
      } else {
        setError(err.response?.data?.error || 'Login failed. Check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-5">
      {/* Decorative orbs */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-amber-500/8 blur-[100px] pointer-events-none" />
      <div className="fixed top-1/2 right-0 w-[300px] h-[300px] rounded-full bg-purple-600/6 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center glow-blue">
            <Landmark className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">LoanFlow</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">LOAN MANAGEMENT SYSTEM</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-sm text-slate-400">Sign in to your account to continue</p>
          </div>

          {/* Role Toggle */}
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-muted rounded-xl">
            <button
              onClick={() => fillDemo('admin')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                role === 'admin'
                  ? 'bg-card text-blue-400 shadow-sm border border-blue-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
            <button
              onClick={() => fillDemo('staff')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                role === 'staff'
                  ? 'bg-card text-blue-400 shadow-sm border border-blue-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Staff
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            {isWakingBackend && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm rounded-xl px-4 py-3">
                Waking backend on Render. First request can take up to 60 seconds.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="spinner" />
              ) : (
                <>Sign In -></>
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-4 p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl">
            <p className="text-xs text-slate-500 text-center">
              <span className="text-blue-400 font-semibold">Demo:</span> Click Admin or Staff above to auto-fill credentials
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          LoanFlow v1.0 - Secure Microfinance Platform
        </p>
      </div>
    </div>
  )
}
