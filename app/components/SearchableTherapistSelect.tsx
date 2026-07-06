'use client'

import React, { useState, useEffect, useRef } from 'react'

export interface Therapist {
  id: string
  name: string
  [key: string]: any
}

interface SearchableTherapistSelectProps {
  value: string
  onChange: (value: string) => void
  therapists: Therapist[]
  availableShiftText?: (therapistId: string) => string
  disabled?: boolean
  required?: boolean
}

export default function SearchableTherapistSelect({
  value,
  onChange,
  therapists,
  availableShiftText,
  disabled = false,
  required = false
}: SearchableTherapistSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [])

  // Auto-focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const getSelectedLabel = () => {
    if (!value) return '選択してください'
    if (value === 'unassigned') return 'フリー予約（未割当）'
    const found = therapists.find((t) => t.id === value)
    return found ? found.name : '選択してください'
  }

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
  }

  const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase()
  const q = normalize(searchQuery)

  const filteredTherapists = therapists.filter((t) => {
    if (!q) return true
    return normalize(t.name).includes(q)
  })

  const showUnassigned = !q || normalize('フリー予約（未割当）').includes(q)
  const showPlaceholder = !q

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden select for HTML5 validation / form submission */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
      >
        <option value="">選択してください</option>
        <option value="unassigned">フリー予約（未割当）</option>
        {therapists.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {/* Styled Selector Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs flex items-center justify-between text-left ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer hover:bg-slate-100/50'
        }`}
        disabled={disabled}
      >
        <span className={`truncate ${!value ? 'text-slate-400' : 'text-slate-800 font-medium'}`}>
          {getSelectedLabel()}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ml-1.5 ${
            isOpen ? '-rotate-180 text-indigo-600' : ''
          }`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 rounded-xl shadow-xl bg-white border border-slate-200 focus:outline-none z-50 transform origin-top transition-all py-1.5 w-full flex flex-col max-h-60 overflow-hidden">
          {/* Search Bar */}
          <div className="px-2 pb-1.5 border-b border-slate-100 flex-shrink-0">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="セラピスト名で検索..."
                className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1 min-h-0 text-xs py-1 divide-y divide-slate-50/50">
            {/* 選択してください */}
            {showPlaceholder && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
                  !value ? 'text-indigo-600 bg-indigo-50/30 font-bold' : 'text-slate-500'
                }`}
              >
                選択してください
              </button>
            )}

            {/* フリー予約（未割当） */}
            {showUnassigned && (
              <button
                type="button"
                onClick={() => handleSelect('unassigned')}
                className={`w-full px-3 py-2 text-left hover:bg-amber-50/70 transition-colors ${
                  value === 'unassigned' ? 'text-amber-700 bg-amber-50 font-bold' : 'text-amber-700/85 font-medium'
                }`}
              >
                フリー予約（未割当）
              </button>
            )}

            {/* Therapists */}
            {filteredTherapists.map((therapist) => {
              const isSelected = value === therapist.id
              const shiftText = availableShiftText ? availableShiftText(therapist.id) : ''
              return (
                <button
                  key={therapist.id}
                  type="button"
                  onClick={() => handleSelect(therapist.id)}
                  className={`w-full px-3 py-2 text-left hover:bg-indigo-50/40 transition-colors flex items-center justify-between ${
                    isSelected ? 'text-indigo-600 bg-indigo-50/30 font-bold' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{therapist.name}</span>
                  {shiftText && (
                    <span className="text-[10px] text-slate-400 font-normal ml-2 flex-shrink-0">
                      {shiftText}
                    </span>
                  )}
                </button>
              )
            })}

            {/* Empty state */}
            {filteredTherapists.length === 0 && !showUnassigned && (
              <div className="px-3 py-3 text-center text-slate-400 text-xs italic">
                該当するセラピストが見つかりません
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
