"use client"

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
} from "recharts"
import { useState, useMemo } from "react"

interface WaterDonutChartProps {
    waterData?: {
        tds: number
        ph: number
        level: number
        irms?: number
        flow?: number
        flowRate?: number
        totalLiters?: number
        liters?: string | number
        turbidity?: number
    }
    transparent?: boolean
    sideBySide?: boolean
}

export function WaterDonutChart({ waterData, transparent = false, sideBySide = false }: WaterDonutChartProps) {
    const [activeIndex, setActiveIndex] = useState(0)

    const data = useMemo(() => {
        if (!waterData) return [
            { name: "Loading...", value: 1, chartValue: 25, rawValue: 0, unit: "", color: "#334155" }
        ];

        // Scientific scoring for the WQI analysis (normalized 0-100)
        const volumeValue = waterData.totalLiters !== undefined 
            ? waterData.totalLiters 
            : (waterData.liters !== undefined ? Number(waterData.liters) : 0.0);
            
        const turbidityValue = waterData.turbidity !== undefined ? waterData.turbidity : 0.0;
        const tdsValue = waterData.tds !== undefined ? waterData.tds : 0.0;
        const phValue = waterData.ph !== undefined ? waterData.ph : 7.0;

        const scores = [
            { 
                name: "Volume", 
                value: Math.min(100, (volumeValue / 2000) * 100), // Scale target of 2000 L
                chartValue: 25,
                rawValue: volumeValue, 
                unit: "L", 
                color: "#34d399" 
            },
            {
                name: "pH Balance",
                // Centers 100% at pH 7.0; drops as it deviates
                value: Math.max(0, (7 - Math.abs(7 - phValue)) * 14.28),
                chartValue: 25,
                rawValue: phValue,
                unit: "pH",
                color: "#60a5fa"
            },
            {
                name: "Turbidity",
                value: Math.max(0, 100 - (turbidityValue * 20)),
                chartValue: 25,
                rawValue: turbidityValue,
                unit: "NTU",
                color: "#a855f7"
            },
            {
                name: "TDS",
                // Proportional impact (normalized for donut display)
                value: Math.min(100, (tdsValue / 500) * 100),
                chartValue: 25,
                rawValue: tdsValue,
                unit: "ppm",
                color: "#fb923c"
            },
        ];

        return scores;
    }, [waterData]);

    const activeItem = data[activeIndex] || data[0];

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index)
    }

    return (
        <div className={`${transparent ? '' : 'card-vibrant bg-slate-900/40 rounded-2xl border border-blue-500/20 p-3'} h-full min-h-[160px] w-full flex flex-col backdrop-blur-md lg:backdrop-blur-xl relative overflow-hidden group`}>
            <div className={`flex-1 w-full flex ${sideBySide ? 'flex-row items-start justify-between gap-1 pt-2' : 'flex-col'} min-h-0 relative z-10`}>
                <div className={`${sideBySide ? 'w-[60%]' : 'w-full'} relative h-full min-h-[120px]`}>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                        <span className={`${sideBySide ? 'text-xl' : 'text-2xl'} font-bold text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-transform duration-500`}>
                            {activeItem.name === "pH Balance" || activeItem.name === "Turbidity" 
                                ? activeItem.rawValue.toFixed(1) 
                                : Math.round(activeItem.rawValue)}
                        </span>
                        <span className={`${sideBySide ? 'text-[8px]' : 'text-[10px]'} uppercase font-black tracking-widest`} style={{ color: activeItem.color }}>
                            {activeItem.unit}
                        </span>
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                innerRadius={sideBySide ? 31 : 46}
                                outerRadius={sideBySide ? 51 : 61}
                                paddingAngle={4}
                                dataKey="chartValue"
                                onMouseEnter={onPieEnter}
                                stroke="none"
                                cornerRadius={6}
                                cx="50%"
                                cy="50%"
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                        style={{
                                            filter: index === activeIndex ? `drop-shadow(0 0 12px ${entry.color})` : 'none',
                                            opacity: index === activeIndex ? 1 : 0.6,
                                            transform: index === activeIndex ? 'scale(1.05)' : 'scale(1)',
                                            transformOrigin: 'center',
                                            outline: 'none',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className={`flex ${sideBySide ? 'flex-col items-center justify-center gap-1 w-[38%] pr-1 mt-15' : 'flex-wrap justify-center gap-0.5 mt-1'} relative z-10`}>
                    {data.map((entry, index) => (
                        <div
                            key={index}
                            className={`flex flex-col cursor-pointer transition-all duration-300 ${index === activeIndex ? "opacity-100 translate-x-1" : "opacity-40 hover:opacity-100"}`}
                            onMouseEnter={() => setActiveIndex(index)}
                        >
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color, boxShadow: `0 0 5px ${entry.color}` }} />
                                <span className="text-[9px] font-black text-white/90 uppercase tracking-tighter truncate w-full">
                                    {entry.name}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
