'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { format, isToday } from 'date-fns'
import { 
  Calendar, 
  Clock, 
  Users, 
  DollarSign,
  Phone,
  ChevronRight,
  PlayCircle,
  PauseCircle,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import Link from 'next/link'

export default function MasterDashboard() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Обновляем время каждую минуту
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Защита роута
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

  // Получаем статистику
  const { data: stats } = useQuery({
    queryKey: ['master-stats'],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-stats')
      return response.data
    },
    enabled: !!user?.id && user?.role === 'master',
  })

  if (!user || user.role !== 'master') {
    return null
  }

  const bookings = todayBookings?.bookings ?? []

  const nextBooking = bookings.find((booking: any) => {
    const bookingTime = new Date(booking.date)
    return bookingTime > currentTime
  })

  const currentBooking = bookings.find((booking: any) => {
    const start = new Date(booking.date)
    const end = new Date(booking.end_time)
    return start <= currentTime && currentTime <= end
  })

  const formatTime = (iso: string) => format(new Date(iso), 'HH:mm')
  const getDurationMinutes = (startIso: string, endIso: string) =>
    Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000))

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'cancelled': return 'bg-red-500'
      case 'pending': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Привет, {user.first_name}!
            </h1>
            <p className="text-sm text-gray-500">
              {format(currentTime, 'EEEE, dd MMMM')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${masterInfo?.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium">
              {masterInfo?.is_active ? 'Работаю' : 'Оффлайн'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Статус и быстрые действия */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Статус работы</h2>
              <Button 
                size="sm" 
                variant={masterInfo?.is_active ? "secondary" : "default"}
                className="flex items-center gap-2"
              >
                {masterInfo?.is_active ? (
                  <>
                    <PauseCircle className="h-4 w-4" />
                    Пауза
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    Начать
                  </>
                )}
              </Button>
            </div>
            
            {currentBooking ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-blue-800">Сейчас с клиентом</span>
                </div>
                <p className="font-medium">Запись</p>
                <p className="text-sm text-gray-600">
                  {formatTime(currentBooking.date)}–{formatTime(currentBooking.end_time)} ({getDurationMinutes(currentBooking.date, currentBooking.end_time)} мин)
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span>Время: {formatTime(currentBooking.date)}</span>
                  <span>Цена: ${currentBooking.price}</span>
                </div>
              </div>
            ) : nextBooking ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Следующий клиент</span>
                </div>
                <p className="font-medium">Запись</p>
                <p className="text-sm text-gray-600">
                  {formatTime(nextBooking.date)}–{formatTime(nextBooking.end_time)} ({getDurationMinutes(nextBooking.date, nextBooking.end_time)} мин)
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span>Время: {formatTime(nextBooking.date)}</span>
                  <span>Цена: ${nextBooking.price}</span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <span className="text-gray-500">Нет записей на сегодня</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Быстрая статистика */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {bookings.length}
              </div>
              <div className="text-sm text-gray-600">Записей сегодня</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                ${bookings.reduce((sum: number, booking: any) =>
                  booking.status !== 'cancelled' ? sum + (booking.price || 0) : sum, 0)}
              </div>
              <div className="text-sm text-gray-600">Доход сегодня</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats?.weekBookings || 0}
              </div>
              <div className="text-sm text-gray-600">На этой неделе</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats?.totalClients || 0}
              </div>
              <div className="text-sm text-gray-600">Всего клиентов</div>
            </CardContent>
          </Card>
        </div>

        {/* Записи на сегодня */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Расписание на сегодня</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/master/schedule">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings && bookings.length > 0 ? (
              bookings.map((booking: any) => {
                const bookingTime = new Date(booking.date)
                const isPast = bookingTime < currentTime
                const isCurrent = currentBooking?.id === booking.id
                
                return (
                  <div 
                    key={booking.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isCurrent ? 'bg-blue-50 border-blue-200' :
                      isPast ? 'bg-gray-50 border-gray-200' : 
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex-shrink-0 text-center">
                      <div className={`text-sm font-medium ${
                        isCurrent ? 'text-blue-700' :
                        isPast ? 'text-gray-500' : 'text-gray-900'
                      }`}>
                        {formatTime(booking.date)}
                      </div>
                      <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${getStatusColor(booking.status)}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        isPast ? 'text-gray-600' : 'text-gray-900'
                      }`}>
                        Запись
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {formatTime(booking.date)}–{formatTime(booking.end_time)} ({getDurationMinutes(booking.date, booking.end_time)} мин)
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-medium">${booking.price}</div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Нет записей на сегодня</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Быстрые действия */}
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="h-16 flex-col gap-2">
            <Link href="/master/schedule">
              <Calendar className="h-5 w-5" />
              <span className="text-sm">Расписание</span>
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="h-16 flex-col gap-2">
            <Link href="/master/bookings">
              <Users className="h-5 w-5" />
              <span className="text-sm">Все записи</span>
            </Link>
          </Button>
        </div>

        {/* Уведомления/Предупреждения */}
        {!masterInfo?.is_active && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-orange-800">
                    Вы оффлайн
                  </p>
                  <p className="text-xs text-orange-600">
                    Включите работу, чтобы принимать новые записи
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}