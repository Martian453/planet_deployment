"use client"

import { useEffect, useState } from "react"
import { Bar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, Title, Tooltip, Legend)

interface RegionData {
  name: string
  aqi: number
  waterLevel: number
  color: string
}

export function RegionGraph() {
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const regionData: RegionData[] = [
    { name: "North Zone", aqi: 42, waterLevel: 7.2, color: "rgba(124, 255, 154, 0.8)" },
    { name: "South Zone", aqi: 58, waterLevel: 5.8, color: "rgba(143, 211, 255, 0.8)" },
    { name: "East Zone", aqi: 35, waterLevel: 8.1, color: "rgba(255, 211, 106, 0.8)" },
    { name: "West Zone", aqi: 67, waterLevel: 4.5, color: "rgba(182, 143, 255, 0.8)" },
    { name: "Central", aqi: 48, waterLevel: 6.3, color: "rgba(0, 245, 255, 0.8)" },
  ]

  const chartData = {
    labels: regionData.map((r) => r.name),
    datasets: [
      {
        label: "AQI Index",
        data: regionData.map((r) => r.aqi),
        backgroundColor: regionData.map((r) => (hoveredRegion === r.name ? r.color.replace("0.8", "1") : r.color)),
        borderRadius: 6,
        barThickness: 24,
        hoverBackgroundColor: regionData.map((r) => r.color.replace("0.8", "1")),
      },
      {
        label: "Water Level (ft)",
        data: regionData.map((r) => r.waterLevel),
        backgroundColor: regionData.map((r) =>
          hoveredRegion === r.name ? r.color.replace("0.8", "0.6") : r.color.replace("0.8", "0.5"),
        ),
        borderRadius: 6,
        barThickness: 24,
        hoverBackgroundColor: regionData.map((r) => r.color.replace("0.8", "0.7")),
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          color: "#9aa7d9",
          font: { size: 11, family: "'Exo 2', system-ui, sans-serif" },
          padding: 15,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(10, 15, 40, 0.95)",
        titleColor: "#fff",
        titleFont: { family: "'Exo 2', system-ui, sans-serif" },
        bodyColor: "#9aa7d9",
        bodyFont: { family: "'Exo 2', system-ui, sans-serif" },
        borderColor: "rgba(124, 255, 154, 0.3)",
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || ""
            const value = context.parsed.y
            if (label.includes("Water")) {
              return `${label}: ${value?.toFixed(1) ?? 'N/A'} ft`
            }
            return `${label}: ${value ?? 'N/A'}`
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#5a6b9f",
          font: { size: 10, family: "'Exo 2', system-ui, sans-serif" },
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: "#5a6b9f",
          font: { size: 10, family: "'Exo 2', system-ui, sans-serif" },
        },
        grid: { color: "rgba(124, 255, 154, 0.05)" },
      },
    },
    animation: {
      duration: 750,
      easing: "easeInOutQuart" as const,
    },
  }

  return (
    <div
      className={`card-vibrant relative mt-4 transition-all duration-700 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
      style={{ transitionDelay: "300ms" }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 animate-blob rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="animation-delay-2000 absolute -right-1/4 bottom-1/4 h-1/2 w-1/2 animate-blob rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <h2 className="relative z-10 mb-4 bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-center text-sm font-medium uppercase tracking-[0.2em] text-transparent">
        Regional Environmental Overview
      </h2>

      {/* Region Stats Grid */}
      <div className="relative z-10 mb-4 grid grid-cols-5 gap-2">
        {regionData.map((region) => (
          <div
            key={region.name}
            className={`cursor-pointer rounded-xl border bg-slate-900/50 p-2 text-center backdrop-blur-sm transition-all duration-300 ${
              hoveredRegion === region.name
                ? "scale-105 border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(124,255,154,0.2)]"
                : "border-white/5 hover:border-emerald-500/30 hover:bg-slate-800/50"
            }`}
            onMouseEnter={() => setHoveredRegion(region.name)}
            onMouseLeave={() => setHoveredRegion(null)}
          >
            <div className="mb-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500">
              {region.name}
            </div>
            <div
              className="text-lg font-bold transition-all duration-300"
              style={{ color: region.color.replace("0.8", "1") }}
            >
              {region.aqi}
            </div>
            <div className="text-[9px] text-slate-500">AQI</div>
          </div>
        ))}
      </div>

      {/* Chart Section */}
      <div className="relative z-10 h-[160px]">
        <Bar data={chartData} options={chartOptions} />
      </div>

      {/* Animated border */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-emerald-500/10 transition-colors duration-300 group-hover:border-emerald-500/30" />
    </div>
  )
}

