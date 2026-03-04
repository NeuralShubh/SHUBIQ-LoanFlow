import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toFixed(0)}`
}

export function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function getAvatarGradient(name: string): string {
  const gradients = [
    'from-pink-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-purple-500 to-pink-600',
    'from-indigo-500 to-blue-600',
    'from-rose-500 to-red-600',
    'from-teal-500 to-green-600',
  ]
  const idx = name.charCodeAt(0) % gradients.length
  return gradients[idx]
}

export function getLoanStatusColor(status: string) {
  switch (status?.toUpperCase()) {
    case 'ACTIVE': return 'badge-active'
    case 'OVERDUE': return 'badge-overdue'
    case 'COMPLETED': return 'badge-completed'
    case 'CANCELLED': return 'badge-completed'
    default: return 'badge-pending'
  }
}

export function getEmiStatusColor(status: string) {
  switch (status?.toUpperCase()) {
    case 'PAID': return 'badge-active'
    case 'OVERDUE': return 'badge-overdue'
    case 'PENDING': return 'badge-pending'
    case 'PARTIAL': return 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
    default: return 'badge-pending'
  }
}

export function calculateLoan(principal: number, rate: number, weeks: number, feeRate = 2) {
  const interestAmount = (principal * rate * (weeks / 52)) / 100
  const fixedFee = (principal * feeRate) / 100
  const totalPayable = principal + interestAmount + fixedFee
  const weeklyEmi = totalPayable / weeks
  return { interestAmount, fixedFee, totalPayable, weeklyEmi }
}
