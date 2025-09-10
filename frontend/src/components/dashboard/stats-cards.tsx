'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getDashboardStats } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Calendar, DollarSign, TrendingUp, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function StatsCards() {
  const user = useAuthStore((state) => state.user)
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    // ИСПРАВЛЕНО: убираем tenant_id из параметров - он передается через headers автоматически
    queryFn: () => getDashboardStats(),
    enabled: !!user?.tenant_id,
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: 'Total Revenue',
      value: `$${stats?.total_revenue?.toFixed(2) || '0.00'}`,
      description: 'Last 30 days',
      icon: DollarSign,
    },
    {
      title: 'Total Bookings',
      value: stats?.total_bookings || 0,
      description: `${stats?.completed_bookings || 0} completed`,
      icon: Calendar,
    },
    {
      title: 'Unique Clients',
      value: stats?.unique_clients || 0,
      description: 'Active clients',
      icon: Users,
    },
    {
      title: 'Completion Rate',
      value: `${((stats?.completed_bookings / stats?.total_bookings) * 100 || 0).toFixed(1)}%`,
      description: `${stats?.cancelled_bookings || 0} cancelled`,
      icon: TrendingUp,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}