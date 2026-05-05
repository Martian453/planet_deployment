import { useEffect, useState, useRef } from "react";
import { getApiBaseUrl } from "@/lib/api-url";

type RealtimeData = {
    location_id: string;
    device_id: string;
    type: "aqi" | "water" | "heartbeat" | "water_sensor" | "aqi_camera";
    timestamp: string;
    data: Record<string, number>;
};

export function useRealtimeData(locationId: string, token: string | null) {
    const [data, setData] = useState<RealtimeData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    const [lastMessageTime, setLastMessageTime] = useState<number | null>(null);
    const lastMessageRef = useRef<number>(0);

    // Timeout check loop
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            if (lastMessageRef.current > 0 && now - lastMessageRef.current < 20000) {
                if (!isLive) setIsLive(true);
            } else {
                if (isLive) setIsLive(false);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isLive]);

    useEffect(() => {
        if (!locationId) {
            setIsLive(false);
            return;
        }

        const apiBase = getApiBaseUrl();
        const wsBase = apiBase.replace(/^http/, "ws"); // http->ws, https->wss
        // Connect to the root of the backend WS server (matching server.js setup)
        const wsUrl = `${wsBase}`;
        console.log(`🔌 Connecting to WS: ${wsUrl}`);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("✅ WebSocket Connected");
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const payload: RealtimeData = JSON.parse(event.data);
                // console.log("📩 Received Real-Time Data:", payload);

                // Update heartbeat
                lastMessageRef.current = Date.now();
                setLastMessageTime(Date.now());
                setIsLive(true); // Immediate feedback

                if (payload.type !== 'heartbeat') {
                    setData(payload);
                }
            } catch (err) {
                console.error("❌ Error parsing WS message:", err);
            }
        };

        ws.onclose = () => {
            console.log("❌ WebSocket Disconnected");
            setIsConnected(false);
            setIsLive(false);
        };

        return () => {
            ws.close();
        };
    }, [locationId, token]);

    // STABILITY: Pure Client-Side Offline Detection
    const [isOffline, setIsOffline] = useState(true);

    useEffect(() => {
        const checkOffline = () => {
            if (!lastMessageRef.current) {
                setIsOffline(true);
                return;
            }
            const diff = Date.now() - lastMessageRef.current;
            setIsOffline(diff > 30000); // 30s strict timeout
            setIsLive(diff < 30000);
        };

        const interval = setInterval(checkOffline, 2000); // Check every 2s
        checkOffline();

        return () => clearInterval(interval);
    }, []);

    return { data, isConnected, isLive, lastMessageTime, isOffline };
}
