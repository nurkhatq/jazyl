'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateMySchedule } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Clock, Calendar } from 'lucide-react'

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentSchedule?: any
}

const DAYS = [
  { key: 0, name: 'Понедельник', short: 'Пн' },
  { key: 1, name: 'Вторник', short: 'Вт' },
  { key: 2, name: 'Среда', short: 'Ср' },
  { key: 3, name: 'Четверг', short: 'Чт' },
  { key: 4, name: 'Пятница', short: 'Пт' },
  { key: 5, name: 'Суббота', short: 'Сб' },
  { key: 6, name: 'Воскресенье', short: 'Вс' }
]

export function ScheduleDialog({ open, onOpenChange, currentSchedule }: ScheduleDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [schedules, setSchedules] = useState<Array<{
    day_of_week: number
    start_time: string
    end_time: string
    is_working: boolean
  }>>([])

  // Инициализируем расписание
  useEffect(() => {
    if (currentSchedule?.regular_schedule) {
      const newSchedules = DAYS.map(day => {
        const existing = currentSchedule.regular_schedule.find((s: any) => s.day_of_week === day.key)
        return {
          day_of_week: day.key,
          start_time: existing?.start_time || '09:00',
          end_time: existing?.end_time || '18:00',
          is_working: existing?.is_working ?? true
        }
      })
      setSchedules(newSchedules)
    } else {
      // Создаем расписание по умолчанию
      const defaultSchedules = DAYS.map(day => ({
        day_of_week: day.key,
        start_time: day.key < 5 ? '09:00' : day.key === 5 ? '10:00' : '00:00',
        end_time: day.key < 5 ? '18:00' : day.key === 5 ? '16:00' : '00:00',
        is_working: day.key < 6 // Понедельник-Суббота работаем, воскресенье - выходной
      }))
      setSchedules(defaultSchedules)
    }
  }, [currentSchedule, open])

  const updateScheduleMutation = useMutation({
    mutationFn: updateMySchedule,
    onSuccess: () => {
      toast({
        title: "Расписание обновлено",
        description: "Ваше расписание успешно сохранено",
      })
      queryClient.invalidateQueries({ queryKey: ['master-schedule'] })
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить расписание. Попробуйте еще раз.",
        variant: "destructive"
      })
    }
  })

  const handleTimeChange = (dayIndex: number, field: 'start_time' | 'end_time', value: string) => {
    setSchedules(prev => prev.map((schedule, index) => 
      index === dayIndex ? { ...schedule, [field]: value } : schedule
    ))
  }

  const handleWorkingToggle = (dayIndex: number, isWorking: boolean) => {
    setSchedules(prev => prev.map((schedule, index) => 
      index === dayIndex ? { 
        ...schedule, 
        is_working: isWorking,
        start_time: isWorking ? schedule.start_time : '00:00',
        end_time: isWorking ? schedule.end_time : '00:00'
      } : schedule
    ))
  }

  const handleSave = () => {
    updateScheduleMutation.mutate({ schedules })
  }

  const handleCopyToAll = (dayIndex: number) => {
    const sourceSchedule = schedules[dayIndex]
    setSchedules(prev => prev.map((schedule, index) => 
      index !== dayIndex ? {
        ...schedule,
        start_time: sourceSchedule.start_time,
        end_time: sourceSchedule.end_time,
        is_working: sourceSchedule.is_working
      } : schedule
    ))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Настройка расписания
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {schedules.map((schedule, index) => {
            const day = DAYS[index]
            return (
              <Card key={day.key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {day.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={schedule.is_working}
                        onCheckedChange={(checked) => handleWorkingToggle(index, checked)}
                      />
                      <Label className="text-sm">
                        {schedule.is_working ? 'Работаю' : 'Выходной'}
                      </Label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {schedule.is_working ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`start-${index}`} className="text-sm font-medium">
                          Время начала
                        </Label>
                        <Input
                          id={`start-${index}`}
                          type="time"
                          value={schedule.start_time}
                          onChange={(e) => handleTimeChange(index, 'start_time', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`end-${index}`} className="text-sm font-medium">
                          Время окончания
                        </Label>
                        <Input
                          id={`end-${index}`}
                          type="time"
                          value={schedule.end_time}
                          onChange={(e) => handleTimeChange(index, 'end_time', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">Выходной день</p>
                    </div>
                  )}
                  
                  {schedule.is_working && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyToAll(index)}
                        className="w-full"
                      >
                        Применить к остальным дням
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateScheduleMutation.isPending}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateScheduleMutation.isPending}
          >
            {updateScheduleMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
