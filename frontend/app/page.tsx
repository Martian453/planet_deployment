"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { PrivateDashboard } from "@/components/dashboard/private-dashboard";
import { LoadingScreen } from "@/components/loading-screen";

export default function HomePage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.push("/login");
    }
  }, [token, isLoading, router]);

  if (isLoading || !token) {
    return <LoadingScreen />;
  }

  return <PrivateDashboard />;
}
