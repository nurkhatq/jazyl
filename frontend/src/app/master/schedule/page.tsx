'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { format, startOfDay, isSameDay } from 'date-fns'
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Plus, 
  X, 
  Pause,
  Play,
  Settings,
  AlertCircle,
  Eye,
  EyeOff,
  DollarSign
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function MasterSchedulePage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
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

  // Получаем записи на выбранную дату
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
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

  // Получаем расписание работы
  const { data: workingHours } = useQuery({
    queryKey: ['master-working-hours', masterInfo?.id],
    queryFn: async () => {
      if (!masterInfo?.id) return null
      const response = await api.get(`/api/masters/${masterInfo.id}/schedule`)
      return response.data
    },
    enabled: !!masterInfo?.id
  })

  // Получаем заблокированное время
  const { data: blockedTimes } = useQuery({
    queryKey: ['master-blocked-times', masterInfo?.id, selectedDate],
    queryFn: async () => {
      if (!masterInfo?.id || !selectedDate) return []
      const response = await api.get('/api/block-times', {
        params: {
          master_id: masterInfo.id,
          date: format(selectedDate, 'yyyy-MM-dd')
        }
      })
      return response.data
    },
    enabled: !!masterInfo?.id && !!selectedDate
  })

  // Блокировка времени
  const blockTimeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/api/masters/${masterInfo?.id}/block-time`, {
        ...data,
        date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined
      })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Time blocked successfully"
      })
      queryClient.invalidateQueries({ queryKey: ['master-blocked-times'] })
      setBlockDialogOpen(false)
      setBlockData({ start_time: '', end_time: '', reason: 'break', description: '' })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to block time",
        variant: "destructive"
      })
    }
  })

  // Переключение статуса мастера (активный/неактивный)
  const toggleStatusMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const response = await api.put(`/api/masters/${masterInfo?.id}`, {
        is_active: isActive
      })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Success", 
        description: "Status updated successfully"
      })
      queryClient.invalidateQueries({ queryKey: ['master-info'] })
    }
  })

  const handleBlockTime = () => {
    if (!blockData.start_time || !blockData.end_time) {
      toast({
        title: "Error",
        description: "Please select start and end time",
        variant: "destructive"
      })
      return
    }

    blockTimeMutation.mutate(blockData)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default'
      case 'completed': return 'secondary'
      case 'cancelled': return 'destructive'
      case 'pending': return 'outline'
      default: return 'outline'
    }
  }

  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 9; hour <= 21; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(time)
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()
  const selectedDateBookings = bookings || []
  const selectedDateBlocked = blockedTimes || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Schedule Management</h2>
          <p className="text-muted-foreground">
            Manage your working hours and appointments
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={masterInfo?.is_active ? "default" : "outline"}
            onClick={() => toggleStatusMutation.mutate(!masterInfo?.is_active)}
            disabled={toggleStatusMutation.isPending}
          >
            {masterInfo?.is_active ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Go Offline
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Go Online
              </>
            )}
          </Button>
          
          <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Block Time
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block Time</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Date</Label>
                  <div className="text-sm text-muted-foreground">
                    {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'No date selected'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Select value={blockData.start_time} onValueChange={(value) => setBlockData(prev => ({ ...prev, start_time: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select start time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Select value={blockData.end_time} onValueChange={(value) => setBlockData(prev => ({ ...prev, end_time: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select end time" />
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
                  <Label htmlFor="reason">Reason</Label>
                  <Select value={blockData.reason} onValueChange={(value) => setBlockData(prev => ({ ...prev, reason: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="break">Break</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="personal">Personal Time</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={blockData.description}
                    onChange={(e) => setBlockData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Add notes about this blocked time..."
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setBlockDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBlockTime}
                    disabled={blockTimeMutation.isPending}
                  >
                    {blockTimeMutation.isPending ? "Blocking..." : "Block Time"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${masterInfo?.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div>
                <p className="font-medium">
                  Status: {masterInfo?.is_active ? 'Online' : 'Offline'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {masterInfo?.is_active 
                    ? 'Available for new bookings' 
                    : 'Not accepting new bookings'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {masterInfo?.is_visible ? (
                <Badge variant="default">
                  <Eye className="mr-1 h-3 w-3" />
                  Visible to clients
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <EyeOff className="mr-1 h-3 w-3" />
                  Hidden from clients
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              modifiers={{
                hasBookings: (date) => {
                  // This would need actual data to highlight dates with bookings
                  return false
                }
              }}
            />
            
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span>Has appointments</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span>Blocked time</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 bg-gray-300 rounded-full" />
                <span>Available</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day Schedule */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select a date'}
                </CardTitle>
                <CardDescription>
                  {selectedDateBookings.length} appointments, {selectedDateBlocked.length} blocked slots
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('day')}
                >
                  Day
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  Week
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {timeSlots.map(timeSlot => {
                  const booking = selectedDateBookings.find((b: any) => 
                    format(new Date(b.date), 'HH:mm') === timeSlot
                  )
                  const blocked = selectedDateBlocked.find((b: any) => 
                    b.start_time <= timeSlot && b.end_time > timeSlot
                  )

                  return (
                    <div key={timeSlot} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-gray-50">
                      <div className="w-16 text-sm font-medium text-gray-600">
                        {timeSlot}
                      </div>
                      
                      <div className="flex-1">
                        {booking ? (
                          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div>
                                <p className="font-medium text-sm">{booking.client_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {booking.service_name} • {booking.duration || 30}min
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={getStatusColor(booking.status)}>
                                {booking.status}
                              </Badge>
                              <span className="text-sm font-medium">${booking.price}</span>
                            </div>
                          </div>
                        ) : blocked ? (
                          <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Pause className="h-4 w-4 text-red-600" />
                              <div>
                                <p className="font-medium text-sm text-red-900">Blocked</p>
                                <p className="text-xs text-red-600">
                                  {blocked.reason} {blocked.description && `• ${blocked.description}`}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="p-3 border-2 border-dashed border-gray-200 rounded-lg text-center">
                            <span className="text-sm text-gray-400">Available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedDate && isSameDay(selectedDate, new Date()) ? selectedDateBookings.length : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedDateBookings.filter((b: any) => b.status === 'confirmed').length} confirmed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Hours</CardTitle>
            <Pause className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedDateBlocked.length}</div>
            <p className="text-xs text-muted-foreground">slots blocked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeSlots.length - selectedDateBookings.length - selectedDateBlocked.length}
            </div>
            <p className="text-xs text-muted-foreground">slots available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${selectedDateBookings
                .filter((b: any) => b.status !== 'cancelled')
                .reduce((sum: number, booking: any) => sum + (booking.price || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">expected revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Working Hours Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Working Hours
              </CardTitle>
              <CardDescription>Configure your default working schedule</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Edit Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {workingHours ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                <div key={day} className="space-y-2">
                  <div className="font-medium text-sm">{day}</div>
                  <div className="text-sm text-muted-foreground">
                    9:00 AM - 6:00 PM
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No working hours configured</p>
              <p className="text-sm">Set up your default schedule to help clients book appointments</p>
              <Button className="mt-4" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Configure Working Hours
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}