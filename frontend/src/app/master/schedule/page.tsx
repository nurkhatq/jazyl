'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { format } from 'date-fns'
import { Clock, Calendar as CalendarIcon, Plus, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function MasterSchedulePage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockData, setBlockData] = useState({
    start_time: '',
    end_time: '',
    reason: '',
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
    queryKey: ['master-schedule', masterInfo?.id, selectedDate],
    queryFn: async () => {
      if (!masterInfo?.id) return null
      const response = await api.get(`/api/masters/${masterInfo.id}/schedule`, {
        params: {
          date_from: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
          date_to: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
        }
      })
      return response.data
    },
    enabled: !!masterInfo?.id
  })

  // Получаем записи на выбранную дату
  const { data: bookings } = useQuery({
    queryKey: ['master-bookings', masterInfo?.id, selectedDate],
    queryFn: async () => {
      if (!masterInfo?.id || !selectedDate) return []
      const response = await api.get('/api/bookings', {
        params: {
          master_id: masterInfo.id,
          date_from: format(selectedDate, 'yyyy-MM-dd'),
          date_to: format(selectedDate, 'yyyy-MM-dd'),
        }
      })
      return response.data
    },
    enabled: !!masterInfo?.id && !!selectedDate
  })

  // Мутация для блокировки времени
  const blockTimeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/api/masters/${masterInfo?.id}/block-time`, data)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Time Blocked",
        description: "The time slot has been blocked successfully",
      })
      queryClient.invalidateQueries({ queryKey: ['master-schedule'] })
      setBlockDialogOpen(false)
      setBlockData({
        start_time: '',
        end_time: '',
        reason: '',
        description: ''
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to block time",
        variant: "destructive",
      })
    }
  })

  const handleBlockTime = () => {
    if (!selectedDate) return
    
    const startDateTime = `${format(selectedDate, 'yyyy-MM-dd')} ${blockData.start_time}:00`
    const endDateTime = `${format(selectedDate, 'yyyy-MM-dd')} ${blockData.end_time}:00`
    
    blockTimeMutation.mutate({
      start_time: startDateTime,
      end_time: endDateTime,
      reason: blockData.reason,
      description: blockData.description
    })
  }

  const getDaySchedule = () => {
    if (!schedule?.regular_schedule || !selectedDate) return null
    const dayOfWeek = selectedDate.getDay()
    const dayMap = [6, 0, 1, 2, 3, 4, 5] // Sunday = 0 in JS, but 6 in our schema
    return schedule.regular_schedule.find((s: any) => s.day_of_week === dayMap[dayOfWeek])
  }

  const daySchedule = getDaySchedule()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Schedule</h2>
        <p className="text-muted-foreground">
          Manage your working hours and availability
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md"
            />
          </CardContent>
        </Card>

        {/* Schedule Details */}
        <div className="space-y-6">
          {/* Working Hours */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>
                    {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </CardTitle>
                  <CardDescription>
                    {daySchedule?.is_working 
                      ? `Working hours: ${daySchedule.start_time} - ${daySchedule.end_time}`
                      : 'Day off'
                    }
                  </CardDescription>
                </div>
                <Button onClick={() => setBlockDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Block Time
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Bookings for the day */}
              <div className="space-y-4">
                <h4 className="font-semibold">Appointments</h4>
                {bookings && bookings.length > 0 ? (
                  bookings.map((booking: any) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {format(new Date(booking.date), 'HH:mm')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {booking.service_name || 'Service'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        booking.status === 'confirmed' ? 'default' : 
                        booking.status === 'completed' ? 'secondary' : 
                        'outline'
                      }>
                        {booking.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No appointments scheduled</p>
                )}

                {/* Blocked Times */}
                {schedule?.block_times && schedule.block_times.length > 0 && (
                  <>
                    <h4 className="font-semibold mt-6">Blocked Time</h4>
                    {schedule.block_times.map((block: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <X className="h-4 w-4 text-red-500" />
                          <div>
                            <p className="font-medium">
                              {format(new Date(block.start_time), 'HH:mm')} - {format(new Date(block.end_time), 'HH:mm')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {block.reason || 'Blocked'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Schedule Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>Your regular working hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
                  const daySchedule = schedule?.regular_schedule?.find((s: any) => s.day_of_week === index)
                  return (
                    <div key={day} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="font-medium">{day}</span>
                      <span className="text-muted-foreground">
                        {daySchedule?.is_working 
                          ? `${daySchedule.start_time} - ${daySchedule.end_time}`
                          : 'Day off'
                        }
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Block Time Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Time Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={blockData.start_time}
                  onChange={(e) => setBlockData({ ...blockData, start_time: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={blockData.end_time}
                  onChange={(e) => setBlockData({ ...blockData, end_time: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={blockData.reason}
                onChange={(e) => setBlockData({ ...blockData, reason: e.target.value })}
                placeholder="Lunch break, Personal time, etc."
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={blockData.description}
                onChange={(e) => setBlockData({ ...blockData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBlockTime} disabled={blockTimeMutation.isPending}>
                {blockTimeMutation.isPending ? 'Blocking...' : 'Block Time'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}