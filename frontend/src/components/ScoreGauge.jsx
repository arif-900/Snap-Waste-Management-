import React from "react";

export default function ScoreGauge({ score = 0, riskLevel = "Low", passed = 0, failed = 0, total = 0 }) {
  // Determine color matching risk level
  const getColorClass = () => {
    switch (riskLevel.toLowerCase()) {
      case "critical":
        return "text-red-500 stroke-red-500";
      case "high":
        return "text-orange-500 stroke-orange-500";
      case "medium":
        return "text-amber-500 stroke-amber-500";
      case "low":
      default:
        return "text-emerald-500 stroke-emerald-500";
    }
  };

  const getBgCircleColor = () => {
    return "stroke-slate-200 dark:stroke-slate-800";
  };

  // SVG parameters
  const radius = 80;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  // Calculate percentage stroke offset
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-6 glass-card rounded-2xl">
      <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">
        Overall Compliance Rating
      </h3>

      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* SVG Progress Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r={radius}
            className={`${getBgCircleColor()} transition-colors duration-300`}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="96"
            cy="96"
            r={radius}
            className={`${getColorClass().split(" ")[1]} transition-all duration-1000 ease-out`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Floating Centered Score Label */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {score}%
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 mt-1 rounded-full bg-slate-100 dark:bg-slate-800/80 ${getColorClass().split(" ")[0]}`}>
            {riskLevel} Risk
          </span>
        </div>
      </div>

      {/* Passed / Failed Counter Subtitle */}
      <div className="flex items-center gap-6 mt-6 w-full text-center border-t border-slate-100 dark:border-slate-800 pt-4 justify-around">
        <div>
          <span className="block text-xl font-bold text-emerald-500">{passed}</span>
          <span className="text-xs text-slate-400 font-medium">Passed Checks</span>
        </div>
        <div className="border-l border-slate-200 dark:border-slate-800 h-8" />
        <div>
          <span className="block text-xl font-bold text-red-500">{failed}</span>
          <span className="text-xs text-slate-400 font-medium">Failed Checks</span>
        </div>
        <div className="border-l border-slate-200 dark:border-slate-800 h-8" />
        <div>
          <span className="block text-xl font-bold text-slate-400">{total}</span>
          <span className="text-xs text-slate-400 font-medium">Total Rules</span>
        </div>
      </div>
    </div>
  );
}
