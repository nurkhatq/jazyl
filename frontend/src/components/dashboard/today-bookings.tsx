'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTodayOverview } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

export function TodayBookings() {
  const user = useAuthStore((state) => state.user)
  
  const { data: overview, isLoading } = useQuery({
    queryKey: ['today-overview'],
    queryFn: () => getTodayOverview(user?.tenant_id || ''),
    enabled: !!user?.tenant_id,
    refetchInterval: 60000, // Refresh every minute
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Bookings</CardTitle>
          <CardDescription>
            {format(new Date(), 'MMMM d, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Bookings</CardTitle>
        <CardDescription>
          {overview?.total_bookings || 0} appointments scheduled
        </CardDescription>
      </CardHeader>
      <CardContent>
        {overview?.bookings && overview.bookings.length > 0 ? (
          <div className="space-y-4">
            {overview.bookings.map((booking: any) => (
              <div key={booking.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="font-semibold">{booking.time}</div>
                  <div>
                    <p className="text-sm font-medium">{booking.client_name || `Client #${booking.client_id.slice(0, 8)}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {booking.service_name || `Service #${booking.service_id.slice(0, 8)}`} • {booking.duration || 30}min
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">${booking.price}</span>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No bookings scheduled for today
          </p>
        )}
      </CardContent>
    </Card>
  )
}