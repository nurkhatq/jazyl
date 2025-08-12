'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { TodayBookings } from '@/components/dashboard/today-bookings'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { PopularServices } from '@/components/dashboard/popular-services'

export default function DashboardPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.push('/login')
    }
  }, [user, router])

  if (!user) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome back, {user.first_name}!
          </p>
        </div>

        <StatsCards />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-4">
            <TodayBookings />
          </div>
          <div className="col-span-3">
            <PopularServices />
          </div>
        </div>

        <RevenueChart />
      </div>
    </DashboardLayout>
  )
}