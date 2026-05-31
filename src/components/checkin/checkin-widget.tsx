'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/auth';

interface HeatmapDay {
  date: string;
  duration: number;
}

export function CheckInWidget() {
  const token = useAuthStore((s) => s.token);
  const [streak, setStreak] = useState(0);
  const [todayDone, setTodayDone] = useState(false);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/checkins?year=${now.getFullYear()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setStreak(data.streak || 0);
      setHeatmap(data.heatmap || []);

      const today = new Date().toISOString().slice(0, 10);
      setTodayDone(data.heatmap?.some((d: HeatmapDay) => d.date === today));
    } catch { /* ignore */ }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStreak(data.streak || 0);
        setTodayDone(true);
        loadData();
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  // Build single-month tiny squares
  const monthSquares = useMemo(() => {
    const checkinSet = new Set(heatmap.map(h => h.date));
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const squares: { date: string; checked: boolean; isToday: boolean }[] = [];
    const todayStr = now.toISOString().slice(0, 10);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      squares.push({
        date: dateStr,
        checked: checkinSet.has(dateStr),
        isToday: dateStr === todayStr,
      });
    }

    const checkedCount = squares.filter(s => s.checked).length;
    return { squares, checkedCount, daysInMonth };
  }, [heatmap, viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
      {/* Check-in row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheckIn}
            disabled={todayDone || loading}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              todayDone
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
            }`}
          >
            {todayDone ? '✅ 今日已打卡' : loading ? '⏳' : '📅 打卡'}
          </button>
          <div>
            <p className="text-2xl font-bold text-gray-900">{streak}</p>
            <p className="text-xs text-gray-400">连续打卡</p>
          </div>
        </div>
      </div>

      {/* Month squares */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="text-xs text-gray-400 hover:text-gray-600 px-1">◀</button>
          <p className="text-xs text-gray-500">
            {viewYear}年{monthNames[viewMonth]} · {monthSquares.checkedCount}/{monthSquares.daysInMonth}天
          </p>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className={`text-xs px-1 ${isCurrentMonth ? 'text-gray-200 cursor-default' : 'text-gray-400 hover:text-gray-600'}`}
          >
            ▶
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {monthSquares.squares.map(s => (
            <div
              key={s.date}
              title={s.date}
              className={`w-4 h-4 rounded-sm ${s.checked ? 'bg-emerald-500' : 'bg-gray-100'} ${s.isToday ? 'ring-1 ring-indigo-400 ring-offset-1' : ''}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 mt-2">
          <div className="w-4 h-4 rounded-sm bg-gray-100" />
          <span className="text-[10px] text-gray-400 mr-2">未打卡</span>
          <div className="w-4 h-4 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-gray-400">已打卡</span>
        </div>
      </div>
    </div>
  );
}
