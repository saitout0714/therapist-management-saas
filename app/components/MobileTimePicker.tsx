"use client";

import { useEffect, useRef, useState } from 'react';

function WheelPicker({
  items,
  value,
  onChange,
}: {
  items: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const itemHeight = 44; // px

  useEffect(() => {
    const index = items.findIndex((item) => item.value === value);
    if (index !== -1 && containerRef.current) {
      const currentIndex = Math.round(containerRef.current.scrollTop / itemHeight);
      if (currentIndex !== index && !isScrolling.current) {
        // スクロール中でない場合のみ、外部からの値変更を反映する
        containerRef.current.scrollTop = index * itemHeight;
      }
    }
  }, [value, items]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    isScrolling.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
    }, 150);

    const target = e.target as HTMLDivElement;
    const index = Math.round(target.scrollTop / itemHeight);
    if (items[index] && items[index].value !== value) {
      onChange(items[index].value);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[220px] overflow-x-hidden overflow-y-scroll overscroll-none touch-pan-y snap-y snap-mandatory relative w-full flex flex-col items-center [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div style={{ minHeight: `${itemHeight * 2}px` }} className="w-full shrink-0" />
      {items.map((item) => (
        <div
          key={item.value}
          style={{ height: `${itemHeight}px` }}
          className={`snap-center shrink-0 w-full flex items-center justify-center text-xl transition-all duration-200 select-none ${
            item.value === value ? 'text-slate-800 font-bold scale-110' : 'text-slate-300 font-medium'
          }`}
        >
          {item.label}
        </div>
      ))}
      <div style={{ minHeight: `${itemHeight * 2}px` }} className="w-full shrink-0" />
    </div>
  );
}

export default function MobileTimePicker({
  value,
  onChange,
  disabled,
  minHour = 8,
  maxHour = 29,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  minHour?: number;
  maxHour?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const parts = value ? value.split(':') : [];
  const initialHour = parts[0] || String(minHour).padStart(2, '0');
  const initialMinute = parts[1] || '00';
  
  const [tempHour, setTempHour] = useState(initialHour);
  const [tempMinute, setTempMinute] = useState(initialMinute);

  useEffect(() => {
    if (isOpen) {
      const p = value ? value.split(':') : [];
      setTempHour(p[0] || String(minHour).padStart(2, '0'));
      setTempMinute(p[1] || '00');
    }
  }, [isOpen, value, minHour]);

  const hourItems = Array.from({ length: maxHour - minHour + 1 }, (_, i) => {
    const h = minHour + i;
    const hs = String(h).padStart(2, '0');
    return { label: hs, value: hs };
  });

  const minuteItems = Array.from({ length: 12 }, (_, i) => {
    const m = i * 5;
    const ms = String(m).padStart(2, '0');
    return { label: ms, value: ms };
  });

  const handleSave = () => {
    onChange(`${tempHour}:${tempMinute}`);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[15px] focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-center ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:bg-slate-100'} ${!value ? 'text-slate-400' : 'text-slate-800'}`}
      >
        {value || '時間を選択'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 transition-opacity" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Bottom Sheet */}
          <div className="relative bg-white rounded-t-2xl w-full flex flex-col shadow-2xl animate-slide-up pb-safe">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <button 
                type="button" 
                onClick={() => setIsOpen(false)} 
                className="text-[15px] text-slate-500 font-medium px-2 py-1 active:bg-slate-100 rounded-lg"
              >
                キャンセル
              </button>
              <div className="text-[15px] font-bold text-slate-800">時間を選択</div>
              <button 
                type="button" 
                onClick={handleSave} 
                className="text-[15px] text-indigo-600 font-bold px-2 py-1 active:bg-indigo-50 rounded-lg"
              >
                保存
              </button>
            </div>
            
            <div className="relative flex justify-center items-center h-[220px] w-full px-8 bg-white overflow-hidden">
              {/* Center Highlight */}
              <div className="absolute top-1/2 left-4 right-4 h-[44px] -translate-y-1/2 bg-slate-100 rounded-xl pointer-events-none" />
              
              <div className="flex-1 flex justify-end pr-4 relative z-10">
                <WheelPicker items={hourItems} value={tempHour} onChange={setTempHour} />
              </div>
              
              <div className="text-2xl font-bold text-slate-800 relative z-10 pb-1 mb-1">:</div>

              <div className="flex-1 flex justify-start pl-4 relative z-10">
                <WheelPicker items={minuteItems} value={tempMinute} onChange={setTempMinute} />
              </div>
            </div>
            {/* Safe area padding for iPhone X+ */}
            <div className="h-4 sm:h-0" />
          </div>
        </div>
      )}
    </>
  );
}
