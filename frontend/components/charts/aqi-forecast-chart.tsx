"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Legend } from "recharts"
import { useMemo, useState } from "react"
import { Maximize2 } from "lucide-react"
import { generateWaveform, generateTimeLabels, type TimeRange } from "@/utils/data-simulator"

interface MetricHistoryChartProps {
    data: any[] // Array of history objects { label, pm25, pm10, co, no2 }
    activeMetric: string | null
    onMetricSelect?: (metric: string | null) => void
    timeRange: TimeRange
    onTimeRangeChange: (range: TimeRange) => void
    compact?: boolean
    onExpand?: () => void
}

export function MetricHistoryChart({ data, activeMetric, onMetricSelect, timeRange, onTimeRangeChange, compact = false, onExpand }: MetricHistoryChartProps) {
    const [hoveredTime, setHoveredTime] = useState<string | null>(null)
    const [activeLines, setActiveLines] = useState<string[]>([]) // Track which lines are visible

    // Process data based on time range
    const chartData = useMemo(() => {
        // For 1h, we prefer "real" data (or at least the data passed from parent)
        if (timeRange === "1h") {
            if (!data || data.length === 0) return [];
            return data.slice(-20).map(d => ({
                time: d.label && d.label.includes("T") 
                    ? new Date(d.label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : d.label || d.time,
                pm25: d.pm25 ?? 0,
                pm10: d.pm10 ?? 0,
                co2: d.co2 ?? 0,
                tvoc: d.tvoc ?? 0,
                hcho: d.hcho ?? 0,
                temp: d.temp ?? 0,
                humidity: d.humidity ?? 0,
            }));
        }

        // For 24h and 7d, we generate synthetic wavy data for demonstration/analysis purposes
        const count = timeRange === "24h" ? 100 : 300;
        const labels = generateTimeLabels(timeRange, count);
        
        // Get baseline from current data or fallback
        const base = data?.[data.length - 1] || { pm25: 12, pm10: 25, co2: 450, tvoc: 0.1, hcho: 0.02, temp: 24, humidity: 55 };

        const pm25Arr = generateWaveform(base.pm25, timeRange, { volatility: 1 });
        const pm10Arr = generateWaveform(base.pm10, timeRange, { volatility: 1.2 });
        const co2Arr = generateWaveform(base.co2, timeRange, { volatility: 0.8 });
        const tvocArr = generateWaveform(base.tvoc, timeRange, { volatility: 0.9 });
        const hchoArr = generateWaveform(base.hcho, timeRange, { volatility: 1.1 });
        const tempArr = generateWaveform(base.temp, timeRange, { volatility: 0.7 });
        const humArr = generateWaveform(base.humidity, timeRange, { volatility: 0.7 });

        return labels.map((l, i) => {
            const d = new Date(l);
            return {
                time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                pm25: pm25Arr[i],
                pm10: pm10Arr[i],
                co2: co2Arr[i],
                tvoc: tvocArr[i],
                hcho: hchoArr[i],
                temp: tempArr[i],
                humidity: humArr[i],
            };
        });
    }, [data, timeRange]);

    const metrics = [
        { key: 'pm25', label: 'PM2.5', color: '#f97316' }, // Orange
        { key: 'pm10', label: 'PM10', color: '#fbbf24' },  // Yellow
        { key: 'co2', label: 'CO2', color: '#34d399' },   // Green
        { key: 'tvoc', label: 'TVOC', color: '#a855f7' },  // Purple
        { key: 'hcho', label: 'HCHO', color: '#3b82f6' },  // Blue
        { key: 'temp', label: 'TEMP', color: '#f43f5e' },  // Rose
    ]


    // Sync activeMetric with activeLines
    useMemo(() => {
        if (activeMetric) {
            setActiveLines([activeMetric])
        } else {
            // Show All Mode
            setActiveLines(metrics.map(m => m.key))
        }
    }, [activeMetric])

    // Toggle line logic: Mirrors Tile Behavior (Single Select / Toggle)
    const toggleLine = (metric: string) => {
        if (onMetricSelect) {
            // If clicking the current active metric -> Deselect (Show All)
            // If clicking a different metric -> Select it
            // If currently Show All (null) -> Select it
            onMetricSelect(activeMetric === metric ? null : metric)
        } else {
            // Fallback local behavior if no callback (shouldn't happen in this integ)
            // But let's keep it simple: just do nothing or local toggle?
            // Local toggle multi-select logic:
            setActiveLines(prev => {
                if (prev.includes(metric)) {
                    if (prev.length === 1) return prev
                    return prev.filter(m => m !== metric)
                } else {
                    return [...prev, metric]
                }
            })
        }
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload) return null

        return (
            <div className="bg-slate-950/95 border border-white/20 rounded-xl p-4 shadow-2xl backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{label}</p>
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => {
                        if (!activeLines.includes(entry.dataKey)) return null
                        return (
                            <div key={index} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-sm font-medium text-white">{entry.name}:</span>
                                </div>
                                <span className="text-sm font-bold text-white">{entry.value.toFixed(1)}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className={`h-full w-full flex flex-col ${compact ? 'p-1' : 'p-6'} bg-slate-900/40 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden`}>
            {/* Background glow effect */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px]" />

            {/* Header (Hidden in compact mode used by Hub) */}
            {!compact && (
                <div className="relative z-10 flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold uppercase tracking-[0.2em] bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            AQI Pollutant Levels
                        </h3>
                        {onExpand && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onExpand(); }}
                                className="rounded-full bg-white/5 p-1 text-slate-400 hover:text-white transition-colors"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </button>
                        )}
                        <p className="text-[10px] text-slate-500 mt-1 ml-2 block">Click metrics to toggle visibility</p>
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex bg-slate-950/50 rounded-lg p-1 border border-white/10">
                        {(["1h", "24h", "7d"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => onTimeRangeChange(r)}
                                className={`px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${timeRange === r
                                    ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
                                    : "text-slate-500 hover:text-slate-300"
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Interactive Legend — hidden in compact */}
            {!compact && (
                <div className="relative z-10 flex flex-wrap gap-3 mb-4 items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2">Filters:</span>
                    {metrics.map((metric) => (
                        <button
                            key={metric.key}
                            onClick={() => toggleLine(metric.key)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 ${activeMetric === metric.key
                                // Strict single select highlighting
                                ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                : activeMetric && activeMetric !== metric.key
                                    ? "opacity-40 border-transparent text-slate-600" // Recede inactive
                                    : "border-white/5 bg-slate-900/50 hover:bg-slate-800" // Neutral (Show All)
                                }`}
                        >
                            <div
                                className={`w-3 h-3 rounded-full transition-all ${activeMetric === metric.key ? 'animate-pulse' : ''}`}
                                style={{
                                    backgroundColor: metric.color
                                }}
                            />
                            <span className={`text-xs font-semibold ${activeMetric === metric.key ? 'text-white' : 'text-slate-400'}`}>
                                {metric.label}
                            </span>
                        </button>
                    ))}

                    {/* Dynamically reveal 'Show All' or 'Reset' button */}
                    {activeMetric && (
                        <button
                            onClick={() => onMetricSelect && onMetricSelect(null)}
                            className="ml-auto text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors animate-in fade-in slide-in-from-left-2"
                        >
                            Reset View
                        </button>
                    )}
                </div>
            )}

            <div className={`relative z-10 flex-1 w-full ${compact ? 'min-h-0' : 'min-h-[200px]'}`}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 20 }}
                        onMouseMove={(e: any) => {
                            if (e && e.activeLabel) {
                                setHoveredTime(e.activeLabel)
                            }
                        }}
                        onMouseLeave={() => setHoveredTime(null)}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="time"
                            stroke="#475569"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#334155' }}
                            minTickGap={40}
                        />
                        <YAxis
                            stroke="#475569"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#334155' }}
                            domain={[0, 'auto']}
                            width={40}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine
                            y={100}
                            stroke="#ef4444"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            opacity={0.5}
                            label={{
                                position: 'insideTopRight',
                                value: 'Threshold',
                                fill: '#ef4444',
                                fontSize: 11,
                                fontWeight: 600
                            }}
                        />

                        {/* Render lines for all metrics */}
                        {metrics.map((metric) => (
                            <Line
                                key={metric.key}
                                type="monotone"
                                dataKey={metric.key}
                                name={metric.label}
                                stroke={metric.color}
                                strokeWidth={activeLines.includes(metric.key) ? 3 : 0}
                                dot={{
                                    r: activeLines.includes(metric.key) ? 4 : 0,
                                    fill: "#0f172a",
                                    stroke: metric.color,
                                    strokeWidth: 2
                                }}
                                activeDot={{
                                    r: 6,
                                    strokeWidth: 0,
                                    fill: metric.color,
                                    style: {
                                        filter: `drop-shadow(0 0 6px ${metric.color})`
                                    }
                                }}
                                isAnimationActive={true}
                                animationDuration={500}
                                connectNulls
                                hide={!activeLines.includes(metric.key)}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
