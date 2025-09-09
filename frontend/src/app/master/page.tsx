'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { format, isToday, isTomorrow } from 'date-fns'
import { 
  Calendar, 
  Clock, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Phone, 
  MapPin,
  Star,
  ChevronRight,
  Activity
} from 'lucide-react'
import Link from 'next/link'

export default function MasterDashboard() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  // Базовая защита
  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    if (user.role !== 'master') {
      switch (user.role) {
        case 'owner':
        case 'admin':
          router.push('/dashboard')
          break
        case 'client':
          router.push('/profile')
          break
        default:
          router.push('/login')
      }
      return
    }
  }, [user, router])

  // Получаем информацию о мастере
  const { data: masterInfo } = useQuery({
    queryKey: ['master-info', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-profile')
      return response.data
    },
    enabled: !!user?.id && user?.role === 'master',
  })

  // Получаем сегодняшние записи
  const { data: todayBookings } = useQuery({
    queryKey: ['master-today-bookings'],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-bookings/today')
      return response.data
    },
    enabled: !!user?.id && user?.role === 'master',
  })

  // Получаем статистику мастера
  const { data: stats } = useQuery({
    queryKey: ['master-stats'],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-stats')
      return response.data
    },
    enabled: !!user?.id && user?.role === 'master',
  })

  // Получаем записи на завтра
  const { data: tomorrowBookings } = useQuery({
    queryKey: ['master-tomorrow-bookings'],
    queryFn: async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const response = await api.get('/api/bookings', {
        params: {
          master_id: masterInfo?.id,
          date_from: format(tomorrow, 'yyyy-MM-dd'),
          date_to: format(tomorrow, 'yyyy-MM-dd')
        }
      })
      return response.data
    },
    enabled: !!masterInfo?.id,
  })

  if (!user || user.role !== 'master') {
    return null
  }

  const nextBooking = todayBookings?.find((booking: any) => {
    const bookingTime = new Date(`${format(new Date(), 'yyyy-MM-dd')}T${booking.time}`)
    return bookingTime > new Date()
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default'
      case 'completed': return 'secondary' 
      case 'cancelled': return 'destructive'
      case 'pending': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.first_name}!
          </h2>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} • Here's your overview for today
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/master/schedule">
              <Calendar className="mr-2 h-4 w-4" />
              Schedule
            </Link>
          </Button>
          <Button asChild>
            <Link href="/master/bookings">
              <Activity className="mr-2 h-4 w-4" />
              All Bookings
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayBookings?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {todayBookings?.filter((b: any) => b.status === 'confirmed').length || 0} confirmed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Appointment</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nextBooking?.time || '--:--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {nextBooking?.client_name || 'No upcoming appointments'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.weekBookings || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalClients || 0} total clients
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.monthRevenue || 0}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +12% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Today's Schedule</CardTitle>
              <CardDescription>{format(new Date(), 'EEEE, MMMM d')}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/master/schedule">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todayBookings && todayBookings.length > 0 ? (
              <div className="space-y-3">
                {todayBookings.slice(0, 5).map((booking: any) => {
                  const bookingTime = new Date(`${format(new Date(), 'yyyy-MM-dd')}T${booking.time}`)
                  const isUpcoming = bookingTime > new Date()
                  
                  return (
                    <div 
                      key={booking.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isUpcoming ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`text-sm font-medium ${isUpcoming ? 'text-blue-900' : 'text-gray-600'}`}>
                          {booking.time}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{booking.client_name}</p>
                          <p className="text-xs text-muted-foreground">{booking.service_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getStatusColor(booking.status)}>
                          {booking.status}
                        </Badge>
                        <span className="text-sm font-medium">${booking.price}</span>
                      </div>
                    </div>
                  )
                })}
                {todayBookings.length > 5 && (
                  <Button asChild variant="ghost" className="w-full">
                    <Link href="/master/bookings">
                      View all {todayBookings.length} appointments
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">No appointments today</p>
                <p className="text-sm">Enjoy your free time!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tomorrow's Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Tomorrow's Preview</CardTitle>
              <CardDescription>{format(new Date(Date.now() + 86400000), 'EEEE, MMMM d')}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/master/schedule">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tomorrowBookings && tomorrowBookings.length > 0 ? (
              <div className="space-y-3">
                {tomorrowBookings.slice(0, 4).map((booking: any) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium text-green-900">
                        {format(new Date(booking.date), 'HH:mm')}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{booking.client_name}</p>
                        <p className="text-xs text-muted-foreground">{booking.service_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusColor(booking.status)}>
                        {booking.status}
                      </Badge>
                      <span className="text-sm font-medium">${booking.price}</span>
                    </div>
                  </div>
                ))}
                {tomorrowBookings.length > 4 && (
                  <p className="text-center text-sm text-muted-foreground">
                    +{tomorrowBookings.length - 4} more appointments
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">No appointments tomorrow</p>
                <p className="text-sm">Free day ahead!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Master Profile Info */}
      {masterInfo && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>Master information and stats</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/master/profile">
                Edit Profile <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 p-2 rounded-full">
                  <Star className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rating</p>
                  <p className="text-lg font-bold">{masterInfo.rating?.toFixed(1) || '0.0'}</p>
                  <p className="text-xs text-muted-foreground">{masterInfo.reviews_count || 0} reviews</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 p-2 rounded-full">
                  <Users className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                  <p className="text-lg font-bold">{stats?.totalClients || 0}</p>
                  <p className="text-xs text-muted-foreground">lifetime</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="bg-purple-100 p-2 rounded-full">
                  <Activity className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-lg font-bold">
                    {masterInfo.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {masterInfo.is_visible ? 'Visible to clients' : 'Hidden from clients'}
                  </p>
                </div>
              </div>
            </div>

            {masterInfo.specialization && masterInfo.specialization.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Specializations</p>
                <div className="flex flex-wrap gap-2">
                  {masterInfo.specialization.map((spec: string, index: number) => (
                    <Badge key={index} variant="outline">{spec}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button asChild variant="outline" className="h-auto p-4">
              <Link href="/master/schedule">
                <div className="flex flex-col items-center space-y-2">
                  <Calendar className="h-6 w-6" />
                  <span>Manage Schedule</span>
                </div>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4">
              <Link href="/master/bookings">
                <div className="flex flex-col items-center space-y-2">
                  <Users className="h-6 w-6" />
                  <span>View All Bookings</span>
                </div>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4">
              <Link href="/master/profile">
                <div className="flex flex-col items-center space-y-2">
                  <Star className="h-6 w-6" />
                  <span>Update Profile</span>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}