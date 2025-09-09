'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { format, formatDistanceToNow } from 'date-fns'
import { 
  Search, 
  Users, 
  Eye, 
  Phone, 
  Mail,
  Calendar,
  DollarSign,
  Star,
  TrendingUp,
  Clock,
  User,
  MessageSquare,
  Filter,
  SortAsc,
  MoreVertical,
  UserPlus
} from 'lucide-react'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  avatar_url?: string
  total_bookings: number
  completed_bookings: number
  cancelled_bookings: number
  total_spent: number
  average_rating?: number
  last_booking_date?: string
  created_at: string
  favorite_services: string[]
  notes?: string
}

interface ClientBooking {
  id: string
  date: string
  service_name: string
  price: number
  duration: number
  status: string
  rating?: number
  review?: string
}

export default function MasterClientsPage() {
  const user = useAuthStore((state) => state.user)
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'bookings' | 'spent' | 'last_booking'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterBy, setFilterBy] = useState<'all' | 'frequent' | 'new' | 'inactive'>('all')
  
  // UI State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false)

  // Получаем информацию о мастере
  const { data: masterInfo } = useQuery({
    queryKey: ['master-info', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-profile')
      return response.data
    },
    enabled: !!user?.id,
  })

  // Получаем клиентов мастера
  const { data: clients, isLoading } = useQuery({
    queryKey: ['master-clients', masterInfo?.id, sortBy, sortOrder],
    queryFn: async () => {
      if (!masterInfo?.id) return []
      
      const response = await api.get('/api/masters/my-clients', {
        params: {
          sort_by: sortBy,
          sort_order: sortOrder
        }
      })
      return response.data
    },
    enabled: !!masterInfo?.id
  })

  // Получаем историю бронирований выбранного клиента
  const { data: clientBookings } = useQuery({
    queryKey: ['client-bookings', selectedClient?.id, masterInfo?.id],
    queryFn: async () => {
      if (!selectedClient?.id || !masterInfo?.id) return []
      
      const response = await api.get('/api/bookings', {
        params: {
          client_id: selectedClient.id,
          master_id: masterInfo.id
        }
      })
      return response.data
    },
    enabled: !!selectedClient?.id && !!masterInfo?.id
  })

  // Фильтрация и поиск клиентов
  const filteredClients = clients?.filter((client: Client) => {
    // Поиск
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const fullName = `${client.first_name} ${client.last_name}`.toLowerCase()
      const email = client.email.toLowerCase()
      const phone = client.phone?.toLowerCase() || ''
      
      if (!fullName.includes(search) && !email.includes(search) && !phone.includes(search)) {
        return false
      }
    }

    // Фильтрация
    switch (filterBy) {
      case 'frequent':
        return client.total_bookings >= 5
      case 'new':
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        return new Date(client.created_at) > monthAgo
      case 'inactive':
        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        return client.last_booking_date ? new Date(client.last_booking_date) < threeMonthsAgo : true
      default:
        return true
    }
  })

  // Статистика
  const stats = {
    total: filteredClients?.length || 0,
    frequent: clients?.filter((c: Client) => c.total_bookings >= 5).length || 0,
    new: clients?.filter((c: Client) => {
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return new Date(c.created_at) > monthAgo
    }).length || 0,
    totalRevenue: clients?.reduce((sum: number, client: Client) => sum + client.total_spent, 0) || 0
  }

  const getClientStatusBadge = (client: Client) => {
    if (client.total_bookings >= 10) {
      return <Badge variant="default" className="bg-purple-100 text-purple-700">VIP</Badge>
    } else if (client.total_bookings >= 5) {
      return <Badge variant="default" className="bg-blue-100 text-blue-700">Frequent</Badge>
    } else if (new Date(client.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
      return <Badge variant="outline" className="border-green-200 text-green-700">New</Badge>
    }
    return <Badge variant="outline">Regular</Badge>
  }

  const getLastBookingText = (date?: string) => {
    if (!date) return 'Never'
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Clients</h2>
          <p className="text-muted-foreground">
            Manage your client relationships and history
          </p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">active clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frequent Clients</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.frequent}</div>
            <p className="text-xs text-muted-foreground">5+ bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.new}</div>
            <p className="text-xs text-muted-foreground">new clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue}</div>
            <p className="text-xs text-muted-foreground">from all clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Search Clients</label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Filter</label>
              <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  <SelectItem value="frequent">Frequent (5+)</SelectItem>
                  <SelectItem value="new">New (This Month)</SelectItem>
                  <SelectItem value="inactive">Inactive (3+ months)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Sort By</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="bookings">Total Bookings</SelectItem>
                  <SelectItem value="spent">Total Spent</SelectItem>
                  <SelectItem value="last_booking">Last Booking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Order</label>
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">
                    <div className="flex items-center gap-2">
                      <SortAsc className="h-4 w-4" />
                      Ascending
                    </div>
                  </SelectItem>
                  <SelectItem value="desc">
                    <div className="flex items-center gap-2">
                      <SortAsc className="h-4 w-4 rotate-180" />
                      Descending
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Client List</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading...' : `${filteredClients?.length || 0} clients found`}
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
                    <TableHead>Client</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Bookings</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients?.map((client: Client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={client.avatar_url} />
                            <AvatarFallback>
                              {client.first_name.charAt(0)}{client.last_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{client.first_name} {client.last_name}</div>
                            <div className="text-sm text-muted-foreground">
                              Client since {format(new Date(client.created_at), 'MMM yyyy')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span>{client.email}</span>
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span>{client.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-center">
                          <div className="font-medium">{client.total_bookings}</div>
                          <div className="text-xs text-green-600">{client.completed_bookings} completed</div>
                          {client.cancelled_bookings > 0 && (
                            <div className="text-xs text-red-600">{client.cancelled_bookings} cancelled</div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-medium">${client.total_spent}</div>
                        <div className="text-xs text-muted-foreground">
                          avg ${client.completed_bookings > 0 ? (client.total_spent / client.completed_bookings).toFixed(0) : '0'}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {getLastBookingText(client.last_booking_date)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {getClientStatusBadge(client)}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Dialog 
                            open={clientDetailsOpen && selectedClient?.id === client.id}
                            onOpenChange={(open) => {
                              setClientDetailsOpen(open)
                              if (open) setSelectedClient(client)
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={client.avatar_url} />
                                    <AvatarFallback>
                                      {client.first_name.charAt(0)}{client.last_name?.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {client.first_name} {client.last_name}
                                </DialogTitle>
                              </DialogHeader>
                              
                              <div className="grid gap-6 md:grid-cols-3">
                                {/* Client Info */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Contact Information</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <Mail className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm">{client.email}</span>
                                    </div>
                                    {client.phone && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">{client.phone}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm">
                                        Joined {format(new Date(client.created_at), 'MMM dd, yyyy')}
                                      </span>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Stats */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Statistics</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Total Bookings:</span>
                                      <span className="font-medium">{client.total_bookings}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Completed:</span>
                                      <span className="font-medium text-green-600">{client.completed_bookings}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Cancelled:</span>
                                      <span className="font-medium text-red-600">{client.cancelled_bookings}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Total Spent:</span>
                                      <span className="font-medium">${client.total_spent}</span>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Favorite Services */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Preferences</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {client.favorite_services && client.favorite_services.length > 0 ? (
                                      <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">Favorite Services:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {client.favorite_services.map((service, index) => (
                                            <Badge key={index} variant="outline" className="text-xs">
                                              {service}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No preferences recorded yet</p>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Booking History */}
                              <Card className="mt-6">
                                <CardHeader>
                                  <CardTitle>Booking History</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {clientBookings && clientBookings.length > 0 ? (
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                      {clientBookings.map((booking: ClientBooking) => (
                                        <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                                          <div className="flex items-center gap-3">
                                            <div>
                                              <div className="font-medium">{booking.service_name}</div>
                                              <div className="text-sm text-muted-foreground">
                                                {format(new Date(booking.date), 'MMM dd, yyyy')} • {booking.duration}min
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-medium">${booking.price}</div>
                                            <Badge variant={
                                              booking.status === 'completed' ? 'secondary' :
                                              booking.status === 'confirmed' ? 'default' :
                                              booking.status === 'cancelled' ? 'destructive' : 'outline'
                                            }>
                                              {booking.status}
                                            </Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-center text-muted-foreground py-4">
                                      No booking history found
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            </DialogContent>
                          </Dialog>

                          <Select>
                            <SelectTrigger className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </SelectTrigger>
                            <SelectContent align="end">
                              <SelectItem value="book">
                                <Calendar className="mr-2 h-4 w-4" />
                                Book Appointment
                              </SelectItem>
                              {client.phone && (
                                <SelectItem value="call">
                                  <Phone className="mr-2 h-4 w-4" />
                                  Call Client
                                </SelectItem>
                              )}
                              <SelectItem value="email">
                                <Mail className="mr-2 h-4 w-4" />
                                Send Email
                              </SelectItem>
                              <SelectItem value="note">
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Add Note
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {(!filteredClients || filteredClients.length === 0) && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p className="font-medium">No clients found</p>
                        <p className="text-sm">
                          {searchTerm || filterBy !== 'all' 
                            ? 'Try adjusting your filters' 
                            : 'Your clients will appear here as they book appointments'}
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
    </div>
  )
}