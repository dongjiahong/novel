import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { calculateStatsSummary } from '../utils/statisticsUtils';
import { ReadingStatsSummary } from '../types';
import { BarChart2, Clock, Calendar, TrendingUp, Loader2 } from 'lucide-react';

const StatisticsTab: React.FC = () => {
  const [summary, setSummary] = useState<ReadingStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const allStats = await storageService.loadAllReadingStats();
        // Convert array to Record for calculateStatsSummary
        const statsMap: any = {};
        allStats.forEach(s => statsMap[s.date] = s);
        
        const result = calculateStatsSummary({ stats: statsMap, updatedAt: '' });
        setSummary(result);
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    
    // Listen for updates
    const handleUpdate = () => loadStats();
    window.addEventListener('sync-stats-updated', handleUpdate);
    return () => window.removeEventListener('sync-stats-updated', handleUpdate);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  if (!summary) return null;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}分钟`;
    const hours = (mins / 60).toFixed(1);
    return `${hours}小时`;
  };

  const maxWeeklyDuration = Math.max(...summary.weeklyStats.map(s => s.duration), 1);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 概览卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <Clock size={16} />
            <span className="text-xs font-medium">今日阅读</span>
          </div>
          <div className="text-2xl font-bold">{formatDuration(summary.todayDuration)}</div>
        </div>
        
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-muted">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">累计时长</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{formatDuration(summary.totalDuration)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-muted">
            <Calendar size={16} />
            <span className="text-xs font-medium">总天数</span>
          </div>
          <div className="text-xl font-bold text-foreground">{summary.totalDays} 天</div>
        </div>
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-muted">
            <BarChart2 size={16} />
            <span className="text-xs font-medium">连续阅读</span>
          </div>
          <div className="text-xl font-bold text-foreground">{summary.currentStreak} 天</div>
        </div>
      </div>

      {/* 最近7天趋势图 */}
      <section className="bg-surface p-4 sm:p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-6">最近 7 天</h3>
        <div className="flex items-end justify-between h-32 gap-2">
          {summary.weeklyStats.map((stat, idx) => {
            const height = (stat.duration / maxWeeklyDuration) * 100;
            const date = new Date(stat.date);
            const dayLabel = idx === 6 ? '今日' : ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
            
            return (
              <div key={stat.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                <div 
                  className="w-full bg-indigo-100 dark:bg-indigo-900/40 rounded-t-md transition-all duration-500 hover:bg-indigo-500 dark:hover:bg-indigo-500"
                  style={{ height: `${Math.max(height, 5)}%` }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {formatDuration(stat.duration)}
                  </div>
                </div>
                <span className="text-[10px] text-muted uppercase">{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 阅读时长统计 */}
      <section className="bg-surface p-4 sm:p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">详情统计</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted">今日阅读</span>
            <span className="font-medium text-foreground">{formatDuration(summary.todayDuration)}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted">本周总计</span>
            <span className="font-medium text-foreground">
              {formatDuration(summary.weeklyStats.reduce((a, b) => a + b.duration, 0))}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted">本月总计</span>
            <span className="font-medium text-foreground">
              {formatDuration(summary.monthlyStats[summary.monthlyStats.length - 1].duration)}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted">本年总计</span>
            <span className="font-medium text-foreground">
              {formatDuration(summary.monthlyStats.reduce((a, b) => a + b.duration, 0))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StatisticsTab;