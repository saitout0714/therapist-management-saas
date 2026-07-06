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
  const [isFocused, setIsFocused] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get the display name of the selected therapist
  const getSelectedLabel = () => {
    if (!value) return ''
    if (value === 'unassigned') return 'フリー予約（未割当）'
    const found = therapists.find((t) => t.id === value)
    return found ? found.name : ''
  }

  // Sync searchQuery with selected label when not active/focused
  useEffect(() => {
    if (!isFocused) {
      setSearchQuery(getSelectedLabel())
    }
  }, [value, isFocused, therapists])

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsFocused(false)
        setSearchQuery(getSelectedLabel())
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [value, therapists])

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
    setIsFocused(false)
  }

  const handleInputFocus = () => {
    if (disabled) return
    setIsFocused(true)
    setIsOpen(true)
    setSearchQuery('')
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

      {/* Autocomplete Input Trigger */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={handleInputFocus}
          placeholder={getSelectedLabel() || '選択してください (検索可)'}
          className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs text-slate-800 font-medium ${
            disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer hover:bg-slate-100/50 focus:bg-white'
          }`}
          disabled={disabled}
        />
        {/* Dropdown Indicator Chevron */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
          <svg
            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
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
        </div>
      </div>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 rounded-xl shadow-xl bg-white border border-slate-200 focus:outline-none z-50 transform origin-top transition-all py-1.5 w-full flex flex-col max-h-60 overflow-hidden">
          {/* Options list */}
          <div className="overflow-y-auto flex-1 min-h-0 text-xs py-1 divide-y divide-slate-50/50">
            {/* 選択してください */}
            {showPlaceholder && (
              <button
                type="button"
                onMouseDown={() => handleSelect('')}
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
                onMouseDown={() => handleSelect('unassigned')}
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
                  onMouseDown={() => handleSelect(therapist.id)}
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
