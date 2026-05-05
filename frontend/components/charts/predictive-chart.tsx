"use client"

import { useEffect, useState, useMemo } from "react"
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarController,
    PointElement,
    LineElement,
    LineController,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js"
import { Line } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarController, PointElement, LineElement, LineController, Title, Tooltip, Legend, Filler)

interface PredictiveChartProps {
    data?: {
        labels: string[]
        level: number[]
    }
}

export function PredictiveChart({ data: historicalData }: PredictiveChartProps) {
    const [chartData, setChartData] = useState<any>(null)

    useEffect(() => {
        if (!historicalData || historicalData.level.length === 0 || historicalData.labels.length === 0) {
            setChartData(null);
            return;
        }

        const trimmedLevels = historicalData.level.slice(-100);
        const trimmedLabels = historicalData.labels.slice(-100);

        setChartData({
            labels: trimmedLabels,
            datasets: [
                {
                    label: 'Water Level (ft)',
                    data: trimmedLevels,
                    borderColor: 'rgba(56, 189, 248, 0.9)', // cyan-400
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    pointBackgroundColor: 'rgba(56, 189, 248, 1)',
                }
            ],
        })
    }, [historicalData])

    // Options (same as before)
    const options = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: { color: '#94a3b8', font: { size: 10 } }
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#e2e8f0',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(148, 163, 184, 0.1)',
                borderWidth: 1,
                callbacks: {
                    label: (ctx: any) => {
                        const v = ctx.parsed.y;
                        if (typeof v === "number") return `Water level: ${v.toFixed(2)} ft`;
                        return 'Water level';
                    }
                }
            },
        },
        scales: {
            x: {
                grid: { display: false, drawBorder: false },
                ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 6 },
            },
            y: {
                grid: { color: 'rgba(148, 163, 184, 0.05)', drawBorder: false },
                ticks: { color: '#64748b', font: { size: 10 } },
                suggestedMin: 0,
            },
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false,
        },
    }), []);

    if (!chartData) {
        return (
            <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-xl flex items-center justify-center">
                <p className="text-slate-500 text-xs">Collecting data for forecast...</p>
            </div>
        )
    }

    return (
        <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                        Water Level (Live)
                    </h3>
                    <p className="text-[10px] text-slate-500">Last 100 samples from water sensor</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-emerald-400">REAL-TIME FEED</span>
                </div>
            </div>

            <div className="h-[250px] w-full">
                <Line options={options} data={chartData} />
            </div>
        </div>
    )
}
