'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { format } from 'date-fns'
import { Calendar, Clock, Users, DollarSign } from 'lucide-react'

export default function MasterDashboard() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  // Базовая защита (layout уже проверяет, но дублируем для безопасности)
  useEffect(() => {
    if (!user) {
      console.log('❌ No user found in page, redirecting to login')
      router.push('/login')
      return
    }

    if (user.role !== 'master') {
      console.log('❌ User is not a master in page, role:', user.role)
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

    console.log('✅ Master page access granted for:', user.email)
  }, [user, router])

  // Получаем информацию о мастере
  const { data: masterInfo, error: masterError } = useQuery({
    queryKey: ['master-info', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-profile')
      return response.data
    },
    enabled: !!user?.id && user?.role === 'master',
  })

  // Получаем сегодняшние записи
  const { data: todayBookings, error: bookingsError } = useQuery({
    queryKey: ['master-today-bookings'],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-bookings/today')
      return response.data
    },
    enabled: !!user?.id && user?.role === 'master',
  })

  // Получаем статистику мастера
  const { data: stats, error: statsError } = useQuery({
    queryKey: ['master-stats'],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-stats')
      return response.data
    },
    enabled: !!user?.id && user?.role === 'master',
  })

  // Если пользователь не мастер, не рендерим контент
  if (!user || user.role !== 'master') {
    return null
  }

  // Обработка ошибок API
  if (masterError || bookingsError || statsError) {
    console.log('API Errors:', { masterError, bookingsError, statsError })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.first_name}!
        </h2>
        <p className="text-muted-foreground">
          Here's your dashboard overview for today
        </p>
      </div>

      {/* Статистические карточки */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayBookings?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {todayBookings?.length === 1 ? 'appointment' : 'appointments'} scheduled
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
              {todayBookings?.[0]?.time ? format(new Date(todayBookings[0].time), 'HH:mm') : '--:--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayBookings?.[0]?.client_name || 'No upcoming appointments'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.week_bookings || 0}</div>
            <p className="text-xs text-muted-foreground">appointments completed</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.month_revenue || 0}</div>
            <p className="text-xs text-muted-foreground">revenue generated</p>
          </CardContent>
        </Card>
      </div>

      {/* Сегодняшние записи */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Schedule</CardTitle>
          <CardDescription>Your appointments for today</CardDescription>
        </CardHeader>
        <CardContent>
          {todayBookings && todayBookings.length > 0 ? (
            <div className="space-y-4">
              {todayBookings.map((booking: any) => (
                <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-lg font-semibold">
                      {format(new Date(booking.time), 'HH:mm')}
                    </div>
                    <div>
                      <p className="font-medium">{booking.client_name}</p>
                      <p className="text-sm text-muted-foreground">{booking.service_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${booking.service_price}</p>
                    <p className="text-sm text-muted-foreground">{booking.duration}min</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No appointments scheduled for today</p>
              <p className="text-sm">Enjoy your free time!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Информация о мастере */}
      {masterInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>Master information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Experience</p>
                <p className="text-lg">{masterInfo.experience_years || 0} years</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Specialization</p>
                <p className="text-lg">{masterInfo.specialization || 'General'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}