"use client"

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
} from "recharts"
import { useState, useMemo } from "react"
import { calculateSubIndex } from "@/utils/aqi-calculator"

interface PollutantDonutChartProps {
    airData?: {
        pm25: number
        pm10: number
        co2: number
        tvoc: number
        hcho: number
    }
    transparent?: boolean
    sideBySide?: boolean
}

export function PollutantDonutChart({ airData, transparent = false, sideBySide = false }: PollutantDonutChartProps) {
    const [activeIndex, setActiveIndex] = useState(0)

    const data = useMemo(() => {
        if (!airData) return [
            { name: "Loading...", value: 1, rawValue: 0, unit: "", color: "#334155" }
        ];

        const scores = [
            { name: "PM2.5", value: calculateSubIndex(airData.pm25, 'pm25'), rawValue: airData.pm25, unit: "µg/m³", color: "#fb923c" },
            { name: "PM10", value: calculateSubIndex(airData.pm10, 'pm10'), rawValue: airData.pm10, unit: "µg/m³", color: "#facc15" },
            { name: "CO2", value: calculateSubIndex(airData.co2 || 400, 'co2'), rawValue: airData.co2 || 400, unit: "ppm", color: "#34d399" },
            { name: "TVOC", value: calculateSubIndex(airData.tvoc || 0, 'tvoc'), rawValue: airData.tvoc || 0, unit: "mg/m³", color: "#a855f7" },
            { name: "HCHO", value: calculateSubIndex(airData.hcho || 0, 'hcho'), rawValue: airData.hcho || 0, unit: "mg/m³", color: "#3b82f6" },
        ];

        // Filter out zero-impact pollutants to clean up chart, or keep top N?
        // Let's keep all that have > 0 value, or at least top 4 if many are small.
        // Actually, let's just show those with Value > 0.
        const activePollutants = scores.filter(s => s.value > 0);

        if (activePollutants.length === 0) {
            return [{ name: "Clean Air", value: 1, rawValue: 0, unit: "", color: "#10b981" }];
        }

        return activePollutants.sort((a, b) => b.value - a.value);
    }, [airData]);

    const activeItem = data[activeIndex] || data[0];

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index)
    }

    return (
        <div className={`${transparent ? '' : 'card-vibrant bg-slate-900/40 rounded-2xl border border-cyan-500/20 p-3'} h-[180px] lg:h-full w-full flex flex-col backdrop-blur-md lg:backdrop-blur-xl relative overflow-hidden`}>
            {/* Background Glow */}
            {!transparent && (
                <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full blur-[80px] bg-cyan-500/10 pointer-events-none" />
            )}

            {!transparent && (
                <div className="flex items-center justify-between mb-2 relative z-10">
                    <div>
                        <h3 className="text-[14px] font-semibold uppercase tracking-widest text-cyan-400">
                            Cause Analysis
                        </h3>
                        <p className="text-[11px] text-slate-400">AQI Contribution</p>
                    </div>
                </div>
            )}

            <div className={`flex-1 w-full flex ${sideBySide ? 'flex-row items-center gap-2' : 'flex-col'} min-h-0 relative z-10`}>
                <div className={`${sideBySide ? 'w-[80%]' : 'w-full'} relative h-full min-h-[110px] mt-3.5`}>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                        <span className={`${sideBySide ? 'text-lg' : 'text-2xl'} font-bold text-white drop-shadow-md`}>
                            {activeItem.value}
                        </span>
                        <span className={`${sideBySide ? 'text-[7px]' : 'text-[10px]'} uppercase font-bold tracking-wider`} style={{ color: activeItem.color }}>
                            {activeItem.name}
                        </span>
                        {!sideBySide && <span className="text-[9px] text-bold-slate-500">Sub-Index</span>}
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                innerRadius={sideBySide ? 34 : 47}
                                outerRadius={sideBySide ? 47 : 62}
                                paddingAngle={4}
                                dataKey="value"
                                onMouseEnter={onPieEnter}
                                stroke="none"
                                cornerRadius={4}
                                cx="50%"
                                cy="50%"
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                        style={{
                                            filter: index === activeIndex ? `drop-shadow(0 0 8px ${entry.color})` : 'none',
                                            opacity: index === activeIndex ? 1 : 0.7,
                                            transform: index === activeIndex ? 'scale(1.05)' : 'scale(1)',
                                            transformOrigin: 'center',
                                            outline: 'none'
                                        }}
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className={`flex ${sideBySide ? 'flex-col items-start gap-1 w-[35%] pr-1' : 'flex-wrap justify-center gap-1.5 mt-1'} relative z-10`}>
                    {(sideBySide ? data : data.slice(0, 4)).map((entry, index) => (
                        <div
                            key={index}
                            className={`flex items-center gap-1.5 cursor-pointer transition-all duration-300 ${sideBySide ? 'px-0' : 'px-2 py-1 rounded-full'} ${!sideBySide && index === activeIndex ? "bg-white/10" : "hover:bg-white/5"}`}
                            onMouseEnter={() => setActiveIndex(index)}
                        >
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color, boxShadow: `0 0 5px ${entry.color}` }} />
                            <span className={`${sideBySide ? 'text-[9px]' : 'text-[12px]'} font-semibold truncate ${index === activeIndex ? "text-white" : "text-slate-400"}`}>
                                {entry.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
