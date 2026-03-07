import axios from 'axios'

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('loanflow_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err?.config as any
    const isGetRequest = (config?.method || '').toLowerCase() === 'get'
    const isTransient = !err?.response || err?.code === 'ECONNABORTED'

    if (config && isGetRequest && isTransient && !config.__retried) {
      config.__retried = true
      await new Promise((resolve) => setTimeout(resolve, 400))
      return api(config)
    }

    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('loanflow_token')
      localStorage.removeItem('loanflow_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const wakeBackend = () =>
  api.get('/health', {
    timeout: 60000,
    headers: { 'Cache-Control': 'no-cache' },
    params: { t: Date.now() },
  })

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password })

export const getMe = () => api.get('/auth/me')
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.put('/auth/change-password', { currentPassword, newPassword })

// Dashboard
export const getDashboardStats = () =>
  api.get('/dashboard/stats', {
    params: { t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' },
  })
export const getDashboardChart = () =>
  api.get('/dashboard/chart', {
    params: { t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' },
  })

// Branches
export const getBranches = () => api.get('/branches')
export const getBranch = (id: string) => api.get(`/branches/${id}`)
export const createBranch = (data: { name: string }) => api.post('/branches', data)
export const updateBranch = (id: string, data: { name: string }) => api.put(`/branches/${id}`, data)
export const deleteBranch = (id: string) => api.delete(`/branches/${id}`)

// Centres
export const getCentres = (branchId?: string) =>
  api.get('/centres', { params: branchId ? { branchId } : {} })
export const createCentre = (data: { name: string; branchId: string }) =>
  api.post('/centres', data)
export const updateCentre = (id: string, data: { name: string }) => api.put(`/centres/${id}`, data)
export const deleteCentre = (id: string) => api.delete(`/centres/${id}`)

// Members
export const getMembers = (params?: Record<string, string>) =>
  api.get('/members', { params })
export const getMember = (id: string) => api.get(`/members/${id}`)
export const createMember = (data: any) => api.post('/members', data)
export const updateMember = (id: string, data: any) => api.put(`/members/${id}`, data)
export const deleteMember = (id: string) => api.delete(`/members/${id}`)

// Loans
export const getLoans = (params?: Record<string, string>) =>
  api.get('/loans', { params })
export const getLoan = (id: string) => api.get(`/loans/${id}`)
export const createLoan = (data: any) => api.post('/loans', data)

// EMIs
export const payEmi = (emiId: string, data: { paidAmount: number; paymentMethod: string; notes?: string }) =>
  api.post(`/emis/${emiId}/pay`, data)
export const undoEmi = (emiId: string) => api.post(`/emis/${emiId}/undo`)

// Reports
export const getLoanReport = (params?: any) => api.get('/reports/loans', { params })
export const getEmiReport = (params?: any) => api.get('/reports/emis', { params })
export const getBranchSummary = (params?: any) => api.get('/reports/branch-summary', { params })
export const getStaffSummary = (params?: any) => api.get('/reports/staff-summary', { params })
export const getMemberReport = (params?: any) => api.get('/reports/members', { params })
export const getCentreSummary = (params?: any) => api.get('/reports/centre-summary', { params })

// Settings
export const getStaff = () => api.get('/settings/staff')
export const createStaff = (data: any) => api.post('/settings/staff', data)
export const updateStaff = (id: string, data: any) => api.put(`/settings/staff/${id}`, data)
export const deleteStaff = (id: string) => api.delete(`/settings/staff/${id}`)
export const getQrCodes = () => api.get('/settings/qr')
export const createQrCode = (data: { name: string; upiId: string }) => api.post('/settings/qr', data)
export const deleteQrCode = (id: string) => api.delete(`/settings/qr/${id}`)
export const updateProfile = (data: { name: string; email: string; phone?: string }) => api.put('/settings/profile', data)
