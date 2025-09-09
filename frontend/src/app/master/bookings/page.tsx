'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { 
  Search, 
  Calendar, 
  Eye, 
  Phone, 
  Clock, 
  DollarSign,
  Filter,
  Download,
  ChevronDown,
  User,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function MasterBookingsPage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // Filters
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // UI State
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

  // Получаем записи мастера
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['master-bookings', masterInfo?.id, dateFrom, dateTo, statusFilter],
    queryFn: async () => {
      if (!masterInfo?.id) return []
      
      const params: any = {
        master_id: masterInfo.id,
      }
      
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
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
        title: "Success",
        description: "Booking status updated successfully"
      })
      queryClient.invalidateQueries({ queryKey: ['master-bookings'] })
      setBookingDetailsOpen(false)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update booking",
        variant: "destructive"
      })
    }
  })

  const filteredBookings = bookings?.filter((booking: any) => {
    if (!searchTerm) return true
    const clientName = booking.client_name?.toLowerCase() || ''
    const serviceName = booking.service_name?.toLowerCase() || ''
    const clientPhone = booking.client_phone?.toLowerCase() || ''
    const search = searchTerm.toLowerCase()
    return clientName.includes(search) || serviceName.includes(search) || clientPhone.includes(search)
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'default'
      case 'completed':
        return 'secondary'
      case 'cancelled':
        return 'destructive'
      case 'pending':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      case 'pending':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const stats = {
    total: filteredBookings?.length || 0,
    confirmed: filteredBookings?.filter((b: any) => b.status === 'confirmed').length || 0,
    completed: filteredBookings?.filter((b: any) => b.status === 'completed').length || 0,
    cancelled: filteredBookings?.filter((b: any) => b.status === 'cancelled').length || 0,
    revenue: filteredBookings?.reduce((sum: number, booking: any) => 
      booking.status === 'completed' ? sum + (booking.price || 0) : sum, 0) || 0
  }

  const quickFilters = [
    { label: 'Today', onClick: () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      setDateFrom(today)
      setDateTo(today)
    }},
    { label: 'This Week', onClick: () => {
      const today = new Date()
      const weekStart = subDays(today, today.getDay())
      setDateFrom(format(weekStart, 'yyyy-MM-dd'))
      setDateTo(format(today, 'yyyy-MM-dd'))
    }},
    { label: 'This Month', onClick: () => {
      setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
      setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
    }}
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Bookings</h2>
          <p className="text-muted-foreground">
            View and manage your appointments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">appointments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div>
            <p className="text-xs text-muted-foreground">upcoming</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
            <p className="text-xs text-muted-foreground">cancelled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.revenue}</div>
            <p className="text-xs text-muted-foreground">completed only</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by client or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Select>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Quick filters" />
                </SelectTrigger>
                <SelectContent>
                  {quickFilters.map(filter => (
                    <SelectItem 
                      key={filter.label} 
                      value={filter.label}
                      onSelect={filter.onClick}
                    >
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Appointments</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading...' : `${filteredBookings?.length || 0} appointments found`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings?.map((booking: any) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div className="font-medium">
                          {format(new Date(booking.date), 'MMM d, yyyy')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(booking.date), 'h:mm a')}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{booking.client_name}</div>
                            {booking.client_phone && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {booking.client_phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-medium">{booking.service_name}</div>
                        {booking.service_category && (
                          <div className="text-sm text-muted-foreground">{booking.service_category}</div>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {booking.duration || 30}min
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-medium">${booking.price}</div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant={getStatusColor(booking.status)} className="flex items-center gap-1">
                          {getStatusIcon(booking.status)}
                          {booking.status}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Dialog 
                            open={bookingDetailsOpen && selectedBooking?.id === booking.id}
                            onOpenChange={(open) => {
                              setBookingDetailsOpen(open)
                              if (open) setSelectedBooking(booking)
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Booking Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid gap-3">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Date:</span>
                                    <span className="font-medium">
                                      {format(new Date(booking.date), 'MMM d, yyyy')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Time:</span>
                                    <span className="font-medium">
                                      {format(new Date(booking.date), 'h:mm a')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Client:</span>
                                    <span className="font-medium">{booking.client_name}</span>
                                  </div>
                                  {booking.client_phone && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Phone:</span>
                                      <span className="font-medium">{booking.client_phone}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Service:</span>
                                    <span className="font-medium">{booking.service_name}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Duration:</span>
                                    <span className="font-medium">{booking.duration || 30}min</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Price:</span>
                                    <span className="font-medium">${booking.price}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status:</span>
                                    <Badge variant={getStatusColor(booking.status)}>
                                      {booking.status}
                                    </Badge>
                                  </div>
                                  {booking.notes && (
                                    <div className="mt-4">
                                      <span className="text-muted-foreground">Notes:</span>
                                      <p className="mt-1 text-sm bg-gray-50 p-2 rounded">
                                        {booking.notes}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Status Update Actions */}
                                {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Update Status:</h4>
                                    <div className="flex gap-2">
                                      {booking.status === 'pending' && (
                                        <Button
                                          size="sm"
                                          onClick={() => updateBookingMutation.mutate({
                                            bookingId: booking.id,
                                            status: 'confirmed'
                                          })}
                                          disabled={updateBookingMutation.isPending}
                                        >
                                          <CheckCircle className="mr-1 h-3 w-3" />
                                          Confirm
                                        </Button>
                                      )}
                                      {booking.status === 'confirmed' && (
                                        <Button
                                          size="sm"
                                          onClick={() => updateBookingMutation.mutate({
                                            bookingId: booking.id,
                                            status: 'completed'
                                          })}
                                          disabled={updateBookingMutation.isPending}
                                        >
                                          <CheckCircle className="mr-1 h-3 w-3" />
                                          Complete
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => updateBookingMutation.mutate({
                                          bookingId: booking.id,
                                          status: 'cancelled'
                                        })}
                                        disabled={updateBookingMutation.isPending}
                                      >
                                        <XCircle className="mr-1 h-3 w-3" />
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          {/* Quick Actions Dropdown */}
                          <Select>
                            <SelectTrigger className="h-8 w-8 p-0">
                              <ChevronDown className="h-4 w-4" />
                            </SelectTrigger>
                            <SelectContent align="end">
                              {booking.status === 'pending' && (
                                <SelectItem 
                                  value="confirm"
                                  onSelect={() => updateBookingMutation.mutate({
                                    bookingId: booking.id,
                                    status: 'confirmed'
                                  })}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Confirm
                                </SelectItem>
                              )}
                              {booking.status === 'confirmed' && (
                                <SelectItem 
                                  value="complete"
                                  onSelect={() => updateBookingMutation.mutate({
                                    bookingId: booking.id,
                                    status: 'completed'
                                  })}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Complete
                                </SelectItem>
                              )}
                              {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                                <SelectItem 
                                  value="cancel"
                                  onSelect={() => updateBookingMutation.mutate({
                                    bookingId: booking.id,
                                    status: 'cancelled'
                                  })}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel
                                </SelectItem>
                              )}
                              {booking.client_phone && (
                                <SelectItem value="call">
                                  <Phone className="mr-2 h-4 w-4" />
                                  Call Client
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {(!filteredBookings || filteredBookings.length === 0) && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p className="font-medium">No appointments found</p>
                        <p className="text-sm">
                          {searchTerm || statusFilter !== 'all' 
                            ? 'Try adjusting your filters' 
                            : 'Your appointments will appear here'}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Section */}
      {filteredBookings && filteredBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>
              Overview for selected period ({format(new Date(dateFrom), 'MMM d')} - {format(new Date(dateTo), 'MMM d, yyyy')})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Status Breakdown */}
              <div>
                <h4 className="text-sm font-medium mb-3">Status Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      <span className="text-sm">Confirmed</span>
                    </div>
                    <span className="text-sm font-medium">{stats.confirmed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span className="text-sm">Completed</span>
                    </div>
                    <span className="text-sm font-medium">{stats.completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                      <span className="text-sm">Pending</span>
                    </div>
                    <span className="text-sm font-medium">
                      {filteredBookings?.filter((b: any) => b.status === 'pending').length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span className="text-sm">Cancelled</span>
                    </div>
                    <span className="text-sm font-medium">{stats.cancelled}</span>
                  </div>
                </div>
              </div>

              {/* Revenue & Performance */}
              <div>
                <h4 className="text-sm font-medium mb-3">Revenue & Performance</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Revenue</span>
                    <span className="text-sm font-medium">${stats.revenue}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average per Appointment</span>
                    <span className="text-sm font-medium">
                      ${stats.completed > 0 ? (stats.revenue / stats.completed).toFixed(2) : '0.00'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Completion Rate</span>
                    <span className="text-sm font-medium">
                      {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Cancellation Rate</span>
                    <span className="text-sm font-medium">
                      {stats.total > 0 ? ((stats.cancelled / stats.total) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}