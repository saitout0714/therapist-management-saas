"use client";

interface TimeSelectHMProps {
  value: string;                // "HH:mm" 形式
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  wrapperClassName?: string;
  selectClassName?: string;
  minHour?: number;             // デフォルト 8
  maxHour?: number;             // デフォルト 29
  placeholder?: boolean;        // 「時」「分」の空選択肢を表示するか
}

import MobileTimePicker from './MobileTimePicker';

export default function TimeSelectHM({
  value,
  onChange,
  disabled,
  required,
  wrapperClassName = 'flex gap-1',
  selectClassName = 'flex-1 px-1.5 sm:px-3 py-1 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all disabled:opacity-40',
  minHour = 6,
  maxHour = 29,
  placeholder = false,
}: TimeSelectHMProps) {
  const parts = value ? value.split(':') : [];
  const hourStr = parts[0] ?? '';
  const minuteStr = parts[1] ?? '';

  const handleHourChange = (h: string) => {
    if (!h) { onChange(''); return; }
    const m = minuteStr || '00';
    onChange(`${h}:${m}`);
  };

  const handleMinuteChange = (m: string) => {
    if (!m) { onChange(''); return; }
    const h = hourStr || String(minHour).padStart(2, '0');
    onChange(`${h}:${m}`);
  };

  return (
    <>
      <div className={`${wrapperClassName} hidden sm:flex`}>
        <select
          value={hourStr}
          onChange={e => handleHourChange(e.target.value)}
          disabled={disabled}
          required={required}
          className={selectClassName}
        >
          {placeholder && <option value="">時</option>}
          {Array.from({ length: maxHour - minHour + 1 }, (_, i) => {
            const h = minHour + i;
            const hs = String(h).padStart(2, '0');
            return <option key={h} value={hs}>{hs}時</option>;
          })}
        </select>
        <select
          value={minuteStr}
          onChange={e => handleMinuteChange(e.target.value)}
          disabled={disabled}
          required={required}
          className={selectClassName}
        >
          {placeholder && <option value="">分</option>}
          {Array.from({ length: 12 }, (_, i) => {
            const m = i * 5;
            const ms = String(m).padStart(2, '0');
            return <option key={m} value={ms}>{ms}分</option>;
          })}
        </select>
      </div>
      
      {/* スマホ用: カスタムドラムロール */}
      <div className={`${wrapperClassName} sm:hidden`}>
        <MobileTimePicker
          value={value}
          onChange={onChange}
          disabled={disabled}
          minHour={minHour}
          maxHour={maxHour}
        />
      </div>
    </>
  );
}
