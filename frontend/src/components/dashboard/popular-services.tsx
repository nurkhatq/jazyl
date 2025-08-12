'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Skeleton } from '@/components/ui/skeleton'

export function PopularServices() {
  const user = useAuthStore((state) => state.user)
  
  const { data: services, isLoading } = useQuery({
    queryKey: ['popular-services'],
    queryFn: async () => {
      const response = await api.get('/api/dashboard/services/popularity', {
        params: { limit: 5 },
        headers: { 'X-Tenant-ID': user?.tenant_id }
      })
      return response.data
    },
    enabled: !!user?.tenant_id,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Popular Services</CardTitle>
          <CardDescription>Most booked services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxBookings = Math.max(...(services?.map((s: any) => s.bookings_count) || [1]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Popular Services</CardTitle>
        <CardDescription>Most booked services</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services?.map((service: any, index: number) => (
            <div key={service.service_id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{service.name}</span>
                <span className="text-muted-foreground">{service.bookings_count} bookings</span>
              </div>
              <Progress value={(service.bookings_count / maxBookings) * 100} />
            </div>
          ))}
          {(!services || services.length === 0) && (
            <p className="text-center text-muted-foreground py-4">
              No service data available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}