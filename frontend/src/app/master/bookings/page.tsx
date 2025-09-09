'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { 
  Search, 
  Filter,
  Phone,
  Check,
  X,
  Clock,
  DollarSign,
  Calendar,
  User,
  ChevronDown,
  AlertCircle,
  AlertTriangle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function MasterBookingsPage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('month')
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [bookingDetailsOpen, setBookingDetailsOpen] = useState(false)

  // Получаем информацию о мастере
  const { data: masterInfo } = useQuery({
    queryKey: ['master-info', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-profile')
      return response.data
    },
    enabled: !!user?.id,
  })

  // Вычисляем даты для фильтра
  const getDateRange = () => {
    const today = new Date()
    switch (dateFilter) {
      case 'today':
        return {
          from: format(today, 'yyyy-MM-dd'),
          to: format(today, 'yyyy-MM-dd')
        }
      case 'week':
        return {
          from: format(subDays(today, 7), 'yyyy-MM-dd'),
          to: format(today, 'yyyy-MM-dd')
        }
      case 'month':
        return {
          from: format(startOfMonth(today), 'yyyy-MM-dd'),
          to: format(endOfMonth(today), 'yyyy-MM-dd')
        }
      default:
        return {
          from: format(startOfMonth(today), 'yyyy-MM-dd'),
          to: format(endOfMonth(today), 'yyyy-MM-dd')
        }
    }
  }

  const dateRange = getDateRange()

  // Получаем записи мастера
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['master-bookings', masterInfo?.id, dateRange.from, dateRange.to, statusFilter],
    queryFn: async () => {
      if (!masterInfo?.id) return []
      
      const params: any = {
        master_id: masterInfo.id,
        date_from: dateRange.from,
        date_to: dateRange.to
      }
      
      if (statusFilter !== 'all') params.status = statusFilter
      
      const response = await api.get('/api/bookings', { params })
      return response.data
    },
    enabled: !!masterInfo?.id
  })

  // Обновление статуса записи
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string, status: string }) => {
      const response = await api.patch(`/api/bookings/${bookingId}`, { status })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Статус обновлен",
        description: "Статус записи успешно изменен"
      })
      queryClient.invalidateQueries({ queryKey: ['master-bookings'] })
      setBookingDetailsOpen(false)
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус",
        variant: "destructive"
      })
    }
  })

  // Фильтрация записей по поиску
  const filteredBookings = bookings?.filter((booking: any) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    const clientName = booking.client_name?.toLowerCase() || ''
    const serviceName = booking.service_name?.toLowerCase() || ''
    const clientPhone = booking.client_phone?.toLowerCase() || ''
    return clientName.includes(search) || serviceName.includes(search) || clientPhone.includes(search)
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'cancelled': return 'bg-red-500'
      case 'pending': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Подтверждено'
      case 'completed': return 'Завершено'
      case 'cancelled': return 'Отменено'
      case 'pending': return 'Ожидает'
      default: return status
    }
  }

  const stats = {
    total: filteredBookings?.length || 0,
    confirmed: filteredBookings?.filter((b: any) => b.status === 'confirmed').length || 0,
    completed: filteredBookings?.filter((b: any) => b.status === 'completed').length || 0,
    pending: filteredBookings?.filter((b: any) => b.status === 'pending').length || 0,
    revenue: filteredBookings?.reduce((sum: number, booking: any) => 
      booking.status === 'completed' ? sum + (booking.price || 0) : sum, 0) || 0
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-center">Мои записи</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs text-gray-600">Всего записей</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-green-600">${stats.revenue}</div>
              <div className="text-xs text-gray-600">Доход</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Поиск по клиенту или услуге..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={dateFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('today')}
                className="whitespace-nowrap"
              >
                Сегодня
              </Button>
              <Button
                variant={dateFilter === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('week')}
                className="whitespace-nowrap"
              >
                Неделя
              </Button>
              <Button
                variant={dateFilter === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('month')}
                className="whitespace-nowrap"
              >
                Месяц
              </Button>
            </div>

            {/* Status filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="whitespace-nowrap"
              >
                Все ({stats.total})
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('pending')}
                className="whitespace-nowrap"
              >
                Ожидают ({stats.pending})
              </Button>
              <Button
                variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('confirmed')}
                className="whitespace-nowrap"
              >
                Подтверждено ({stats.confirmed})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bookings List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : filteredBookings && filteredBookings.length > 0 ? (
            filteredBookings.map((booking: any) => (
              <Card key={booking.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => {
                      setSelectedBooking(booking)
                      setBookingDetailsOpen(true)
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{booking.client_name}</h3>
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(booking.status)}`} />
                        </div>
                        <p className="text-sm text-gray-600 truncate">{booking.service_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="font-medium">${booking.price}</div>
                        <div className="text-xs text-gray-500">
                          {booking.duration || 30}мин
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(booking.date), 'dd.MM')}
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="h-4 w-4" />
                          {format(new Date(booking.date), 'HH:mm')}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getStatusText(booking.status)}
                      </Badge>
                    </div>

                    {/* Quick actions for pending bookings */}
                    {booking.status === 'pending' && masterInfo?.can_manage_bookings && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            updateBookingMutation.mutate({
                              bookingId: booking.id,
                              status: 'confirmed'
                            })
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Принять
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            updateBookingMutation.mutate({
                              bookingId: booking.id,
                              status: 'cancelled'
                            })
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Отклонить
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium mb-2">Записей не найдено</p>
                <p className="text-sm text-gray-400">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Попробуйте изменить фильтры' 
                    : 'Ваши записи появятся здесь'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Booking Details Dialog */}
        <Dialog open={bookingDetailsOpen} onOpenChange={setBookingDetailsOpen}>
          <DialogContent className="max-w-sm mx-4">
            {selectedBooking && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {selectedBooking.client_name}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Basic info */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Услуга:</span>
                      <span className="font-medium">{selectedBooking.service_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Дата:</span>
                      <span className="font-medium">
                        {format(new Date(selectedBooking.date), 'dd MMMM, HH:mm')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Длительность:</span>
                      <span className="font-medium">{selectedBooking.duration || 30} мин</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Цена:</span>
                      <span className="font-medium text-lg">${selectedBooking.price}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Статус:</span>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedBooking.status)}`} />
                        {getStatusText(selectedBooking.status)}
                      </Badge>
                    </div>
                  </div>

                  {/* Contact info */}
                  {selectedBooking.client_phone && (
                    <div className="pt-3 border-t">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(`tel:${selectedBooking.client_phone}`)}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        Позвонить: {selectedBooking.client_phone}
                      </Button>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedBooking.notes && (
                    <div className="pt-3 border-t">
                      <div className="text-sm">
                        <span className="text-gray-600">Заметки:</span>
                        <p className="mt-1 p-2 bg-gray-50 rounded text-sm">
                          {selectedBooking.notes}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {masterInfo?.can_manage_bookings && selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
                    <div className="pt-3 border-t space-y-2">
                      <div className="text-sm font-medium text-gray-700 mb-2">Действия:</div>
                      
                      {selectedBooking.status === 'pending' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateBookingMutation.mutate({
                              bookingId: selectedBooking.id,
                              status: 'confirmed'
                            })}
                            disabled={updateBookingMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Принять
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateBookingMutation.mutate({
                              bookingId: selectedBooking.id,
                              status: 'cancelled'
                            })}
                            disabled={updateBookingMutation.isPending}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Отклонить
                          </Button>
                        </div>
                      )}
                      
                      {selectedBooking.status === 'confirmed' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateBookingMutation.mutate({
                              bookingId: selectedBooking.id,
                              status: 'completed'
                            })}
                            disabled={updateBookingMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Завершить
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateBookingMutation.mutate({
                              bookingId: selectedBooking.id,
                              status: 'cancelled'
                            })}
                            disabled={updateBookingMutation.isPending}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Отменить
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Permissions notice */}
                  {!masterInfo?.can_manage_bookings && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <div className="text-sm">
                          <p className="font-medium text-orange-800">Ограниченные права</p>
                          <p className="text-orange-600 text-xs">
                            Для управления записями обратитесь к менеджеру
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Summary for selected period */}
        {filteredBookings && filteredBookings.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Сводка за период</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Подтверждено</div>
                  <div className="font-medium text-blue-600">{stats.confirmed}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Завершено</div>
                  <div className="font-medium text-green-600">{stats.completed}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Ожидает</div>
                  <div className="font-medium text-orange-600">{stats.pending}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Доход</div>
                  <div className="font-medium text-green-600">${stats.revenue}</div>
                </div>
              </div>
              
              {stats.completed > 0 && (
                <div className="pt-3 border-t text-center">
                  <div className="text-xs text-gray-500">
                    Средний чек: ${(stats.revenue / stats.completed).toFixed(0)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}