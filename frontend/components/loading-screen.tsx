"use client"
import React, { useEffect, useState } from 'react'

export function LoadingScreen() {
  const [stars, setStars] = useState<{ left: string; top: string; animationDelay: string; animationDuration: string }[]>([])

  useEffect(() => {
    // Generate random star configurations only on the client after hydration
    setStars(Array.from({ length: 70 }).map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${3 + Math.random() * 4}s`
    })))
  }, [])

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-950 overflow-hidden">
      {/* Dynamic Background Stars - Increased Brightness */}
      {stars.length > 0 && (
        <div className="absolute inset-0 opacity-80">
          <div className="absolute inset-0 animate-rotate-slow">
            {stars.map((style, i) => (
              <div
                key={i}
                className="absolute h-[3px] w-[3px] rounded-full bg-white animate-twinkle shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={style}
              />
            ))}
          </div>
        </div>
      )}

      {/* Light Rays / Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[120px] animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[80px] animate-pulse-slow" />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Pulsing Logo - Small as requested */}
        <div className="relative group">
          <img
            src="/loading-logo.png"
            alt="Planet Insights Logo"
            className="h-10 md:h-12 object-contain relative z-10 drop-shadow-2xl animate-float"
          />
        </div>

        {/* Techy Loading Text */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-sm font-mono font-bold uppercase tracking-[0.5em] text-emerald-400 animate-pulse">
            Scanning Environment...
          </h2>
          <div className="w-48 h-[1px] bg-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-full h-full animate-wave" />
          </div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-2">
            Initializing Planet Insights Dashboard
          </p>
        </div>
      </div>

      {/* Corner Scanning Brackets */}
      <div className="absolute top-10 left-10 w-16 h-16 border-t-2 border-l-2 border-emerald-500/20" />
      <div className="absolute top-10 right-10 w-16 h-16 border-t-2 border-r-2 border-emerald-500/20" />
      <div className="absolute bottom-10 left-10 w-16 h-16 border-b-2 border-l-2 border-emerald-500/20" />
      <div className="absolute bottom-10 right-10 w-16 h-16 border-b-2 border-r-2 border-emerald-500/20" />
    </div>
  )
}
