"use client"

import { ShieldCheck, Info, Droplets, Droplet, AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'

interface WaterHealthGaugeProps {
  ph: number
  tds: number
  isOffline?: boolean
}

export function WaterHealthGauge({ ph, tds, isOffline = false }: WaterHealthGaugeProps) {
  // Calculate a "Safety Score" (0-100)
  // Optimal pH: 6.5 - 8.5 (Target 7.5)
  // Optimal TDS: < 500 (Target 300)
  const score = useMemo(() => {
    if (isOffline) return 0
    let phScore = 0
    if (ph >= 6.5 && ph <= 8.5) {
      phScore = 100 - Math.abs(ph - 7.5) * 50 // Penalty increases as we drift from 7.5
    } else {
      phScore = Math.max(0, 50 - Math.abs(ph - 7.5) * 10)
    }

    let tdsScore = 0
    if (tds <= 500) {
      tdsScore = 100 - (tds / 1000) * 50 // High TDS lowers score
    } else {
      tdsScore = Math.max(0, 75 - (tds / 1000) * 100)
    }

    return Math.round((phScore + tdsScore) / 2)
  }, [ph, tds, isOffline])

  const getStatus = (val: number) => {
    if (isOffline) return { text: "OFFLINE", color: "text-slate-500", glow: "rgba(100,116,139,0.3)" }
    if (val >= 90) return { text: "PRISTINE", color: "text-emerald-400", glow: "rgba(16,185,129,0.4)" }
    if (val >= 75) return { text: "OPTIMAL", color: "text-cyan-400", glow: "rgba(6,182,212,0.4)" }
    if (val >= 60) return { text: "MARCHAL", color: "text-amber-400", glow: "rgba(245,158,11,0.4)" }
    return { text: "CAUTION", color: "text-red-400", glow: "rgba(239,68,68,0.4)" }
  }

  const status = getStatus(score)
  const rotation = (score / 100) * 180 - 90 // -90 to 90 degrees

  return (
    <div className="card-vibrant relative flex h-full flex-col overflow-hidden rounded-xl bg-slate-900/40 backdrop-blur-md lg:backdrop-blur-xl border border-white/5 p-4 group">
      {/* Background Animated Glow */}
      <div 
        className="absolute -left-20 -top-20 h-54 w-54 rounded-full blur-[100px] transition-colors duration-1000" 
        style={{ backgroundColor: status.glow }}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2 relative z-10">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldCheck className={`h-3.5 w-3.5 ${status.color}`} />
            <h3 className={`text-[11px] font-black uppercase tracking-[0.25em] ${status.color}`}>Water Health Safety</h3>
          </div>
          <p className="text-[12px] text-slate-400 font-bold tracking-tight">VANTAGE SAFETY INDEX Γäó</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-3xl font-mono font-black text-white leading-none tracking-tighter">
            {isOffline ? "--" : score}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-widest ${status.color}`}>
            {status.text}
          </span>
        </div>
      </div>

      {/* Main Grand Gauge */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center relative z-10 py-2">
        <div className="relative h-full aspect-square max-h-[160px]">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 overflow-visible">
            {/* Defs for gradients */}
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Track */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="8"
              strokeDasharray="125.6 251.2" // Half circle
              strokeLinecap="round"
            />

            {/* Active Track */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="8"
              strokeDasharray={`${(score / 100) * 125.6} 251.2`}
              strokeLinecap="round"
              filter="url(#gaugeGlow)"
              className="transition-all duration-1000 ease-out"
            />

            {/* Scale Ticks */}
            {[0, 25, 50, 75, 100].map((val) => {
              const ang = (val / 100) * Math.PI
              const x1 = 50 + 34 * Math.cos(ang + Math.PI)
              const y1 = 50 + 34 * Math.sin(ang + Math.PI)
              const x2 = 50 + 44 * Math.cos(ang + Math.PI)
              const y2 = 50 + 44 * Math.sin(ang + Math.PI)
              return (
                <line key={val} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              )
            })}
          </svg>

          {/* Center Indicator */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
            <div className="relative group/icon">
              <Droplets className={`h-10 w-10 ${status.color} transition-all duration-500 group-hover/icon:scale-110`} />
              <div className={`absolute inset-0 blur-xl opacity-40 animate-pulse ${status.color.replace('text', 'bg')}`} />
            </div>
            <div className="mt-3 flex flex-col items-center">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Health Metric</span>
               <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400">PH: {ph.toFixed(1)}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400">TDS: {tds}</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Diagnostic Panel */}
      <div className="mt-auto grid grid-cols-2 gap-2">
        <div className="bg-white/5 rounded-lg p-2 border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <AlertTriangle className={`h-2.5 w-2.5 ${score < 50 ? 'text-red-400' : 'text-slate-500'}`} />
            <span className="text-[8px] font-black uppercase text-slate-500">Risk Factor</span>
          </div>
          <span className="text-[9px] font-bold text-slate-200">
            {score > 80 ? "Nominal Levels" : score > 50 ? "Mineral Shift" : "Purity Warning"}
          </span>
        </div>
        <div className="bg-white/5 rounded-lg p-2 border border-white/5 flex flex-col gap-1 text-right items-end">
          <div className="flex items-center gap-1">
            <Droplet className={`h-2.5 w-2.5 text-blue-400`} />
            <span className="text-[8px] font-black uppercase text-slate-500">Verdict</span>
          </div>
          <span className={`text-[9px] font-black ${status.color}`}>
            {status.text}
          </span>
        </div>
      </div>
    </div>
  )
}
