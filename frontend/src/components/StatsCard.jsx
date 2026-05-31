import React from 'react';
import { Clock, CheckCircle2, AlertTriangle, Play } from 'lucide-react';

const StatsCard = ({ summary = { total: 0, pending: 0, in_progress: 0, resolved: 0 } }) => {
  const cards = [
    {
      title: 'Total Incidents',
      value: summary.total || 0,
      icon: AlertTriangle,
      color: 'from-blue-500/20 to-sky-500/5 border-blue-500/20 text-blue-400',
      glow: 'shadow-blue-500/5',
      desc: 'Overall reported cases'
    },
    {
      title: 'Pending Review',
      value: summary.pending || 0,
      icon: Clock,
      color: 'from-amber-500/20 to-orange-500/5 border-amber-500/20 text-amber-400',
      glow: 'shadow-amber-500/5',
      desc: 'Awaiting AI/Staff review'
    },
    {
      title: 'In Progress',
      value: summary.in_progress || 0,
      icon: Play,
      color: 'from-sky-500/20 to-indigo-500/5 border-sky-500/20 text-sky-400',
      glow: 'shadow-sky-500/5',
      desc: 'Assigned to cleanup crews'
    },
    {
      title: 'Resolved',
      value: summary.resolved || 0,
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-teal-500/5 border-emerald-500/20 text-emerald-400',
      glow: 'shadow-emerald-500/5',
      desc: 'Successfully cleaned zones'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {cards.map((card, index) => {
        const IconComponent = card.icon;
        return (
          <div
            key={index}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${card.color} p-5 shadow-lg ${card.glow} transition-all duration-300 hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.title}</p>
                <h3 className="text-3xl font-bold text-white mt-1.5 font-sans tracking-tight">{card.value}</h3>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                <IconComponent className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">{card.desc}</p>
            {/* Absolute accent highlight */}
            <span className="absolute bottom-0 right-0 w-24 h-24 bg-white/2 rounded-full blur-2xl pointer-events-none" />
          </div>
        );
      })}
    </div>
  );
};

export default StatsCard;
