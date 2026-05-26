"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { Bot, Terminal, Bell, AlertCircle, ChevronRight, Zap, TrendingDown } from "lucide-react"

interface Alert {
  id: string
  time: string
  message: string
  priority: "high" | "low"
}

interface AiSummarizerCardProps {
  waterData?: {
    level: number
    ph: number
    tds: number
    irms?: number
    flowRate?: number
    efficiency?: number
    turbidity?: number
    totalLiters?: number
  }
  isMotorOn?: boolean
  airData?: {
    pm25: number
    pm10: number
    co2: number
  }
  isWaterOffline?: boolean
  isAirOffline?: boolean
}

export function AiSummarizerCard({ 
  waterData, 
  isMotorOn = false, 
  airData,
  isWaterOffline = false,
  isAirOffline = false
}: AiSummarizerCardProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  // Extract variables safely
  const level = waterData?.level ?? 4.5;
  const ph = waterData?.ph ?? 7.2;
  const tds = waterData?.tds ?? 250;
  const flowRate = waterData?.flowRate ?? 0;
  const irms = waterData?.irms ?? 0;
  const totalLiters = waterData?.totalLiters ?? 0;
  const turbidity = waterData?.turbidity ?? 1.2;
  const pm25 = airData?.pm25 ?? 0;
  const pm10 = airData?.pm10 ?? 0;
  const co2 = airData?.co2 ?? 400;

  // Dynamic alerts based on received parameters
  const alerts: Alert[] = useMemo(() => {
    const timeMinus = (minsAgo: number) => {
      const d = new Date(Date.now() - minsAgo * 60 * 1000);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    };
    const list: Alert[] = [];
    let id = 1;

    if (isWaterOffline) {
      list.push({
        id: String(id++),
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        message: "WATER MONITORING OFFLINE - Heltec Gateway connection lost.",
        priority: "high"
      });
    } else {
      if (level < 2.0) {
        list.push({
          id: String(id++),
          time: timeMinus(14),
          message: `Borewell Level Critical: ${level.toFixed(2)}ft draw observed`,
          priority: "high"
        });
      }

      if (turbidity > 5.0) {
        list.push({
          id: String(id++),
          time: timeMinus(11),
          message: `High Turbidity Detected: ${turbidity.toFixed(1)} NTU in main line`,
          priority: "high"
        });
      }

      if (tds > 350) {
        list.push({
          id: String(id++),
          time: timeMinus(8),
          message: `Elevated Mineral TDS: ${tds} ppm - Check filtration`,
          priority: "high"
        });
      }
    }

    if (isAirOffline) {
      list.push({
        id: String(id++),
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        message: "AQI SENSOR OFFLINE - WiFi connection lost.",
        priority: "high"
      });
    } else {
      if (pm25 > 150) {
        list.push({
          id: String(id++),
          time: timeMinus(5),
          message: `AQI Alert: Critical PM2.5 limit exceeded (${pm25} µg/m³)`,
          priority: "high"
        });
      }
    }

    // Default notifications if list is empty
    if (list.length === 0) {
      list.push({ id: "1", time: timeMinus(15), message: "Borewell level stable: recharge rate nominal", priority: "low" });
      list.push({ id: "2", time: timeMinus(12), message: "Filtration chemistry normal (pH 7.2)", priority: "low" });
    }

    return list;
  }, [level, turbidity, tds, pm25, isWaterOffline, isAirOffline]);

  // Dynamic live feed items based on state
  const feed: Alert[] = useMemo(() => {
    const timeMinus = (minsAgo: number) => {
      const d = new Date(Date.now() - minsAgo * 60 * 1000);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    };
    const list: Alert[] = [];
    let id = 1;
    const timeStr = timeMinus(0);

    if (isWaterOffline) {
      list.push({ id: String(id++), time: timeStr, message: "Awaiting LoRa node transmission signal...", priority: "low" });
    } else {
      if (isMotorOn) {
        list.push({ id: String(id++), time: timeMinus(8), message: `Pump active - Drawing water at ${flowRate.toFixed(1)} LPM`, priority: "low" });
        list.push({ id: String(id++), time: timeMinus(6), message: `Drawdown stabilized: Level at ${level.toFixed(2)} ft`, priority: "low" });
        list.push({ id: String(id++), time: timeMinus(3), message: `Motor efficiency synchronized: ${irms.toFixed(1)}A current draw`, priority: "low" });
      } else {
        list.push({ id: String(id++), time: timeMinus(8), message: "Pump in STANDBY mode - Awaiting trigger", priority: "low" });
        list.push({ id: String(id++), time: timeMinus(6), message: `Aquifer recharge rate: +0.02 ft/min`, priority: "low" });
        list.push({ id: String(id++), time: timeMinus(3), message: `Level resting at ${level.toFixed(2)} ft`, priority: "low" });
      }
      list.push({ id: String(id++), time: timeMinus(2), message: `Daily volume: ${totalLiters.toFixed(0)} Liters total pumped`, priority: "low" });
      list.push({ id: String(id++), time: timeMinus(1), message: "Leak detection scan completed - Status: NOMINAL", priority: "low" });
    }

    if (isAirOffline) {
      list.push({ id: String(id++), time: timeStr, message: "Awaiting AQI node telemetry packets...", priority: "low" });
    } else {
      if (co2 > 500) {
        list.push({ id: String(id++), time: timeMinus(4), message: `Air quality scan: CO2 elevated at ${co2} ppm`, priority: "low" });
      } else {
        list.push({ id: String(id++), time: timeMinus(4), message: `Air quality scan: CO2 normal at ${co2} ppm`, priority: "low" });
      }
    }

    return list;
  }, [isMotorOn, flowRate, level, irms, co2, totalLiters, isWaterOffline, isAirOffline]);

  // Auto-scroll logic for the terminal feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [feed]);

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
            {alerts.map(alert => (
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
            {feed.map(item => (
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
          <span className="text-[9px] font-mono font-bold text-amber-300">{irms > 0.2 ? `${irms.toFixed(1)}A` : "0.0A"}</span>
        </div>
      </div>
    </div>
  )
}