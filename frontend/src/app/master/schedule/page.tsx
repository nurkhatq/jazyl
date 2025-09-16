'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  Pause,
  AlertTriangle,
  Check,
  X
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function MasterSchedulePage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockData, setBlockData] = useState({
    start_time: '',
    end_time: '',
    reason: 'break',
    description: ''
  })

  // Получаем информацию о мастере
  const { data: masterInfo } = useQuery({
    queryKey: ['master-info', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-profile')
      return response.data
    },
    enabled: !!user?.id,
  })

  // Получаем расписание мастера
  const { data: schedule } = useQuery({
    queryKey: ['master-schedule', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-schedule')
      return response.data
    },
    enabled: !!user?.id
  })

  // Получаем записи на выбранную дату
  const { data: bookings } = useQuery({
    queryKey: ['master-bookings', masterInfo?.id, selectedDate],
    queryFn: async () => {
      if (!masterInfo?.id) return []
      const response = await api.get('/api/bookings', {
        params: {
          master_id: masterInfo.id,
          date_from: format(selectedDate, 'yyyy-MM-dd'),
          date_to: format(selectedDate, 'yyyy-MM-dd'),
        }
      })
      return response.data
    },
    enabled: !!masterInfo?.id
  })

  // Блокировка времени
  const blockTimeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/api/masters/block-time', {
        ...data,
        start_time: `${format(selectedDate, 'yyyy-MM-dd')} ${data.start_time}:00`,
        end_time: `${format(selectedDate, 'yyyy-MM-dd')} ${data.end_time}:00`,
      })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Время заблокировано",
        description: "Временной слот успешно заблокирован"
      })
      queryClient.invalidateQueries({ queryKey: ['master-bookings'] })
      setBlockDialogOpen(false)
      setBlockData({ start_time: '', end_time: '', reason: 'break', description: '' })
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось заблокировать время",
        variant: "destructive"
      })
    }
  })

  const handleBlockTime = () => {
    if (!blockData.start_time || !blockData.end_time) {
      toast({
        title: "Ошибка",
        description: "Выберите время начала и окончания",
        variant: "destructive"
      })
      return
    }
    blockTimeMutation.mutate(blockData)
  }

  // Генерация временных слотов
  const generateTimeSlots = (): string[] => {
    const slots: string[] = []
    for (let hour = 9; hour <= 21; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(time)
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Неделя для навигации
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

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
        <h1 className="text-lg font-semibold text-center">Расписание</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Week Navigation */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">
                {format(weekStart, 'dd MMM')} - {format(addDays(weekStart, 6), 'dd MMM')}
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, index) => {
                const isSelected = isSameDay(day, selectedDate)
                const isToday = isSameDay(day, new Date())
                
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={`p-2 rounded-lg text-center transition-colors ${
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : isToday
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      {format(day, 'EEE')}
                    </div>
                    <div className="text-sm font-medium">
                      {format(day, 'd')}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {format(selectedDate, 'EEEE, d MMMM')}
              </CardTitle>
              <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Блок
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm mx-4">
                  <DialogHeader>
                    <DialogTitle>Заблокировать время</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="start_time">Начало</Label>
                        <Select value={blockData.start_time} onValueChange={(value) => setBlockData(prev => ({ ...prev, start_time: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Время" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map(time => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="end_time">Конец</Label>
                        <Select value={blockData.end_time} onValueChange={(value) => setBlockData(prev => ({ ...prev, end_time: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Время" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map(time => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="reason">Причина</Label>
                      <Select value={blockData.reason} onValueChange={(value) => setBlockData(prev => ({ ...prev, reason: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="break">Перерыв</SelectItem>
                          <SelectItem value="lunch">Обед</SelectItem>
                          <SelectItem value="personal">Личное время</SelectItem>
                          <SelectItem value="sick">Больничный</SelectItem>
                          <SelectItem value="vacation">Отпуск</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="description">Заметка</Label>
                      <Textarea
                        id="description"
                        value={blockData.description}
                        onChange={(e) => setBlockData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Дополнительная информация..."
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setBlockDialogOpen(false)}
                        className="flex-1"
                      >
                        Отмена
                      </Button>
                      <Button
                        onClick={handleBlockTime}
                        disabled={blockTimeMutation.isPending}
                        className="flex-1"
                      >
                        {blockTimeMutation.isPending ? "Сохранение..." : "Сохранить"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-gray-600">
              Записей: {bookings?.length || 0} • 
              Доход: ${bookings?.reduce((sum: number, booking: any) => 
                booking.status !== 'cancelled' ? sum + (booking.price || 0) : sum, 0) || 0}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              График дня
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timeSlots.map(timeSlot => {
                const booking = bookings?.find((b: any) => 
                  format(new Date(b.date), 'HH:mm') === timeSlot
                )

                return (
                  <div key={timeSlot} className="flex items-center gap-3">
                    <div className="w-12 text-xs text-gray-500 font-mono">
                      {timeSlot}
                    </div>
                    
                    <div className="flex-1">
                      {booking ? (
                        <div className="bg-white border-l-4 border-blue-500 rounded-r-lg p-3 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{booking.client_name}</span>
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(booking.status)}`} />
                          </div>
                          <div className="text-xs text-gray-600 mb-1">
                            {booking.service_name}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">{booking.duration || 30}мин</span>
                            <span className="font-medium">${booking.price}</span>
                          </div>
                          {booking.status === 'pending' && (
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2">
                                <Check className="h-3 w-3 mr-1" />
                                Принять
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2">
                                <X className="h-3 w-3 mr-1" />
                                Отклонить
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-2 bg-gray-100 rounded-full" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Working Hours Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Рабочие часы</CardTitle>
          </CardHeader>
          <CardContent>
            {schedule?.regular_schedule ? (
              <div className="space-y-3">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => {
                  const daySchedule = schedule.regular_schedule.find((s: any) => s.day_of_week === index)
                  
                  return (
                    <div key={day} className="flex items-center justify-between">
                      <span className="text-sm font-medium w-8">{day}</span>
                      <div className="flex-1 mx-3">
                        {daySchedule?.is_working ? (
                          <span className="text-sm text-gray-600">
                            {daySchedule.start_time} - {daySchedule.end_time}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Выходной</span>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-12 text-xs"
                        disabled={!masterInfo?.can_edit_schedule}
                      >
                        {masterInfo?.can_edit_schedule ? 'Изменить' : 'Запросить'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Рабочие часы не настроены</p>
                <Button 
                  size="sm" 
                  className="mt-2"
                  disabled={!masterInfo?.can_edit_schedule}
                >
                  {masterInfo?.can_edit_schedule ? 'Настроить' : 'Запросить доступ'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-blue-600">
                {bookings?.filter((b: any) => b.status === 'confirmed').length || 0}
              </div>
              <div className="text-xs text-gray-600">Подтверждено</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-orange-600">
                {bookings?.filter((b: any) => b.status === 'pending').length || 0}
              </div>
              <div className="text-xs text-gray-600">Ожидает</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-green-600">
                {bookings?.filter((b: any) => b.status === 'completed').length || 0}
              </div>
              <div className="text-xs text-gray-600">Завершено</div>
            </CardContent>
          </Card>
        </div>

        {/* Status Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Статус работы</div>
                <div className="text-sm text-gray-600">
                  {masterInfo?.is_active ? 'Принимаю записи' : 'Не работаю'}
                </div>
              </div>
              <Button 
                variant={masterInfo?.is_active ? "secondary" : "default"}
                className="flex items-center gap-2"
              >
                <Pause className="h-4 w-4" />
                {masterInfo?.is_active ? 'Пауза' : 'Работать'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Permissions Notice */}
        {!masterInfo?.can_edit_schedule && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-800">
                    Ограниченные права
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    Для изменения расписания обратитесь к менеджеру
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                    Запросить доступ
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}