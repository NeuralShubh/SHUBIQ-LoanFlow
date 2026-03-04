import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'STAFF'
  branch?: { id: string; code: string; name: string } | null
  phone?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  setUser: (user: User) => void
  setToken: (token: string) => void
  logout: () => void
  isAdmin: () => boolean
  initFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  setUser: (user) => {
    set({ user })
    if (typeof window !== 'undefined') {
      localStorage.setItem('loanflow_user', JSON.stringify(user))
    }
  },
  setToken: (token) => {
    set({ token })
    if (typeof window !== 'undefined') {
      localStorage.setItem('loanflow_token', token)
    }
  },
  logout: () => {
    set({ user: null, token: null })
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loanflow_token')
      localStorage.removeItem('loanflow_user')
    }
  },
  isAdmin: () => get().user?.role === 'ADMIN',
  initFromStorage: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('loanflow_token')
      const userStr = localStorage.getItem('loanflow_user')
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr)
          set({ user, token, isLoading: false })
        } catch {
          set({ isLoading: false })
        }
      } else {
        set({ isLoading: false })
      }
    }
  },
}))
