'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getRevenueReport } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

export function RevenueChart() {
  const user = useAuthStore((state) => state.user)
  
  const { data: revenue, isLoading } = useQuery({
    queryKey: ['revenue-report'],
    // ИСПРАВЛЕНО: правильный порядок параметров - сначала period, потом tenant_id (но tenant_id передается через headers)
    queryFn: () => getRevenueReport('day'),
    enabled: !!user?.tenant_id,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Your revenue for the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  // ИСПРАВЛЕНО: обработка структуры ответа API
  const chartData = revenue?.revenue_data?.map((item: any) => ({
    date: new Date(item.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: item.revenue,
    bookings: item.bookings_count,
  })) || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Overview</CardTitle>
        <CardDescription>Your revenue for the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#000" name="Revenue ($)" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}