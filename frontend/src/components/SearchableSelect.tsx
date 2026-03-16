'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  options: SelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  onChange: (value: string) => void
}

export default function SearchableSelect({
  value,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  onChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)
  const filtered = options.filter((o) => {
    if (!search) return true
    return o.label.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div ref={wrapperRef} className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 transition-colors"
        >
          <span className={selected ? 'text-white' : 'text-slate-400'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      ) : (
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setSearch('')
            }
          }}
          placeholder={searchPlaceholder}
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 transition-colors"
          autoFocus
        />
      )}

      {open && (
        <div className="mt-2 max-h-56 overflow-y-auto bg-card border border-border rounded-xl divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-500">No results</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value || 'empty'}
                type="button"
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                  setSearch('')
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted/40 transition-colors ${
                  o.value === value ? 'text-blue-400 bg-blue-500/10' : 'text-white'
                }`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
