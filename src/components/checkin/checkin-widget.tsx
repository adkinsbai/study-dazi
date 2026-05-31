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

  // Month navigation: { year, month (0-11) }
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

  // Build calendar for viewMonth/viewYear
  const calendar = useMemo(() => {
    const checkinSet = new Set(heatmap.map(h => h.date));

    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDow = firstDay.getDay(); // 0=Sun

    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = [];

    // Pad leading empty cells
    for (let i = 0; i < startDow; i++) week.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      week.push(checkinSet.has(dateStr) ? d : -d); // positive = checked in, negative = missed
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    const checkedCount = heatmap.filter(h => {
      const d = new Date(h.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }).length;

    return { weeks, checkedCount, daysInMonth };
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
  const dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

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

      {/* Month calendar */}
      <div>
        {/* Month header */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="text-sm text-gray-400 hover:text-gray-600 px-1">◀</button>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">
              {viewYear}年 {monthNames[viewMonth]}
            </p>
            <p className="text-[10px] text-gray-400">
              签到 {calendar.checkedCount}/{calendar.daysInMonth} 天
            </p>
          </div>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className={`text-sm px-1 ${isCurrentMonth ? 'text-gray-200 cursor-default' : 'text-gray-400 hover:text-gray-600'}`}
          >
            ▶
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayHeaders.map(d => (
            <div key={d} className="text-center text-[10px] text-gray-400">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendar.weeks.flat().map((day, i) => (
            <div
              key={i}
              className={`aspect-square rounded-sm flex items-center justify-center text-[10px] ${
                day === null
                  ? ''
                  : day > 0
                  ? 'bg-emerald-500 text-white font-medium'
                  : 'bg-gray-100 text-gray-400'
              }`}
              title={day ? `${viewYear}-${viewMonth + 1}-${Math.abs(day)}` : ''}
            >
              {day !== null ? Math.abs(day) : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
