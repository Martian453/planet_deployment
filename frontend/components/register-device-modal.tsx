"use client"

import { useState } from "react"
import { X, Cpu, MapPin, Check, Loader2 } from "lucide-react"

interface RegisterDeviceModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    token: string | null
}

export function RegisterDeviceModal({ isOpen, onClose, onSuccess, token }: RegisterDeviceModalProps) {
    const [step, setStep] = useState<1 | 2>(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    // Form Data
    const [formData, setFormData] = useState({
        device_id: "",
        device_type: "aqi", // Default
        area: "",
        site_type: "Home",
        label: ""
    })

    if (!isOpen) return null;

    const getApiUrl = (path: string) => {
        if (typeof window === 'undefined') return `http://localhost:8000${path}`;
        const protocol = window.location.protocol;
        const host = window.location.hostname;
        return `${protocol}//${host}:8000${path}`;
    }

    const handleSubmit = async () => {
        setLoading(true)
        setError(null)

        try {
            if (!formData.device_id || !formData.area) {
                throw new Error("Device ID and Area are required.")
            }

            const payload = {
                device_id: formData.device_id,
                device_type: formData.device_type,
                location_input: {
                    area: formData.area,
                    site_type: formData.site_type,
                    label: formData.label || undefined
                }
            }

            const res = await fetch(getApiUrl("/api/devices/register"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || "Registration failed")
            }

            setSuccessMsg(`Success! ${data.message}`)
            setTimeout(() => {
                onSuccess()
                onClose()
                setStep(1)
                setSuccessMsg(null)
                setFormData({
                    device_id: "",
                    device_type: "aqi",
                    area: "",
                    site_type: "Home",
                    label: ""
                })
            }, 2000)

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Cpu className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Register Device</h2>
                            <p className="text-xs text-slate-400">Add new hardware to your account</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {successMsg ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in">
                            <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-4">
                                <Check className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Registration Complete!</h3>
                            <p className="text-slate-400 text-sm">{successMsg}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Step 1: Device Info */}
                            {step === 1 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Device ID</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. DEV_WATER_01"
                                            value={formData.device_id}
                                            onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        />
                                        <p className="text-[10px] text-slate-500">Found on the sticker or QR code on your hardware.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Device Type</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setFormData({ ...formData, device_type: 'aqi' })}
                                                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${formData.device_type === 'aqi' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-white/5'}`}
                                            >
                                                <span>Air Quality</span>
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, device_type: 'water' })}
                                                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${formData.device_type === 'water' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-white/5'}`}
                                            >
                                                <span>Water Quality</span>
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!formData.device_id}
                                        className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all mt-4"
                                    >
                                        Next: Location Details →
                                    </button>
                                </div>
                            )}

                            {/* Step 2: Location Info */}
                            {step === 2 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Area / City </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Yelahanka"
                                            value={formData.area}
                                            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Site Type</label>
                                        <select
                                            value={formData.site_type}
                                            onChange={(e) => setFormData({ ...formData, site_type: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        >
                                            <option value="Home">Home</option>
                                            <option value="Borewell">Borewell</option>
                                            <option value="Apartment">Apartment Complex</option>
                                            <option value="Industrial">Industrial Site</option>
                                            <option value="Road">Public Road</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Friendly Label (Optional)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Block A"
                                            value={formData.label}
                                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        />
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                                            {error}
                                        </div>
                                    )}

                                    <div className="flex gap-3 mt-6">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold py-3 rounded-xl transition-all"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={loading || !formData.area}
                                            className="flex-[2] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Registration"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
