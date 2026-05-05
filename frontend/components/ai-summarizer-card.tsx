"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, Terminal, Bell, AlertCircle, ChevronRight, Zap, TrendingDown } from "lucide-react"

interface Alert {
  id: string
  time: string
  message: string
  priority: "high" | "low"
}

const pinnedAlerts: Alert[] = [
  { id: "1", time: "10:32", message: "Borewell Level Critical: 0.12ft drop observed", priority: "high" },
  { id: "2", time: "10:35", message: "High Turbidity Detected in Main Pipe", priority: "high" },
]

const liveFeed: Alert[] = [
  { id: "3", time: "10:40", message: "Pump turned ON - System normal", priority: "low" },
  { id: "4", time: "10:42", message: "Water level stabilized at 11.2ft", priority: "low" },
  { id: "5", time: "10:45", message: "Power usage efficiency optimized: 8.4A", priority: "low" },
  { id: "6", time: "10:50", message: "Daily usage predicted: 1.2k Liters", priority: "low" },
  { id: "7", time: "10:52", message: "Leak Detection scan complete: All clear", priority: "low" },
]

export function AiSummarizerCard() {
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic for the terminal feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [liveFeed]);

  return (
    <div className="card-vibrant relative flex h-full flex-col overflow-hidden rounded-xl bg-slate-900/40 !p-3 backdrop-blur-md lg:backdrop-blur-xl border border-emerald-500/10">
      {/* 1. FIXED HEADER */}
      <div className="mb-2 shrink-0 flex items-center justify-between border-b border-white/5 pb-2">
        <h3 className="text-[13px] font-black uppercase tracking-[0.1em] text-emerald-400 flex items-center gap-2 whitespace-nowrap">
          <Bot className="h-4 w-4" />
          AI Summarizer
        </h3>
        <span className="mr-3 text-[9px] font-mono text-slate-500 whitespace-nowrap uppercase tracking-tighter">V2.2_LIVE</span>
      </div>

      {/* 2. DUAL-CHANNEL VIEWPORT (Side-by-Side Split) */}
      <div className="flex-1 min-h-0 flex flex-row gap-3 py-1">

        {/* Left Channel: Pinned Critical Alerts */}
        <div className="flex-[0.4] min-w-0 flex flex-col border-r border-white/5 pr-2">
          <div className="flex items-center gap-1.5 mb-2 shrink-0">
            <Bell className="h-3 w-3 text-red-500 animate-pulse" />
            <span className="text-[9px] font-black uppercase text-red-400 tracking-wider">Alerts</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-none hover:scrollbar-thin scrollbar-thumb-red-500/10">
            {pinnedAlerts.map(alert => (
              <div key={alert.id} className="rounded-lg bg-red-500/5 border border-red-500/10 px-2 py-1.5 group hover:bg-red-500/10 transition-all border-l-2 border-l-red-500">
                <div className="text-[9px] font-bold text-white leading-tight mb-1">{alert.message}</div>
                <div className="text-[8px] font-mono text-red-400/50 uppercase">{alert.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Channel: Live System Feed (Terminal Style) */}
        <div className="flex-[0.6] min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 mb-2 shrink-0">
            <ChevronRight className="h-3 w-3 text-emerald-500" />
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Live Feed</span>
          </div>
          <div
            ref={feedRef}
            className="flex-1 overflow-y-auto space-y-2 bg-black/30 rounded-lg p-2 border border-white/5 scrollbar-thin scrollbar-thumb-emerald-500/10 custom-scroll"
          >
            {liveFeed.map(item => (
              <div key={item.id} className="flex gap-2 items-start opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-[8px] font-mono text-emerald-500/40 shrink-0 mt-0.5">[{item.time}]</span>
                <p className="text-[9px] text-slate-300 leading-snug font-medium italic select-none">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. MINIMALIST FOOTER (Power Predict) */}
      <div className="mt-2 shrink-0 rounded-lg bg-emerald-500/5 px-2 py-2 flex items-center justify-between border border-emerald-500/10 group hover:border-emerald-500/30 transition-all">
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-amber-500 fill-amber-500/10" />
          <span className="text-[9px] font-black text-emerald-400/70 uppercase tracking-widest">Power Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full w-[88%] bg-emerald-500/50" />
          </div>
          <span className="text-[9px] font-mono font-bold text-amber-300">8.4A</span>
        </div>
      </div>
    </div>
  )
}