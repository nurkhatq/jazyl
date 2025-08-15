'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { Search, User, Calendar, DollarSign } from 'lucide-react'

export default function MasterClientsPage() {
  const user = useAuthStore((state) => state.user)
  const [searchTerm, setSearchTerm] = useState('')

  // Получаем информацию о мастере
  const { data: masterInfo } = useQuery({
    queryKey: ['master-info', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-profile')
      return response.data
    },
    enabled: !!user?.id,
  })

  // Получаем клиентов мастера (через историю записей)
  const { data: clients, isLoading } = useQuery({
    queryKey: ['master-clients', masterInfo?.id],
    queryFn: async () => {
      if (!masterInfo?.id) return []
      
      // Получаем все записи мастера
      const response = await api.get('/api/bookings', {
        params: {
          master_id: masterInfo.id,
          status: 'completed'
        }
      })
      
      // Группируем по клиентам
      const clientsMap = new Map()
      response.data.forEach((booking: any) => {
        const clientId = booking.client_id
        if (!clientsMap.has(clientId)) {
          clientsMap.set(clientId, {
            id: clientId,
            name: booking.client_name || 'Unknown Client',
            email: booking.client_email,
            phone: booking.client_phone,
            totalVisits: 0,
            totalSpent: 0,
            lastVisit: booking.date,
            bookings: []
          })
        }
        
        const client = clientsMap.get(clientId)
        client.totalVisits++
        client.totalSpent += booking.price
        if (new Date(booking.date) > new Date(client.lastVisit)) {
          client.lastVisit = booking.date
        }
        client.bookings.push(booking)
      })
      
      return Array.from(clientsMap.values())
    },
    enabled: !!masterInfo?.id
  })

  const filteredClients = clients?.filter((client: any) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      client.name?.toLowerCase().includes(search) ||
      client.email?.toLowerCase().includes(search) ||
      client.phone?.toLowerCase().includes(search)
    )
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Clients</h2>
        <p className="text-muted-foreground">
          View your client base and history
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-8">Loading clients...</div>
        ) : filteredClients && filteredClients.length > 0 ? (
          filteredClients.map((client: any) => (
            <Card key={client.id}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>
                      {client.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                    <CardDescription>{client.email || 'No email'}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Total Visits</span>
                    </div>
                    <span className="font-medium">{client.totalVisits}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span>Total Spent</span>
                    </div>
                    <span className="font-medium">${client.totalSpent.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Last Visit</span>
                    </div>
                    <span className="font-medium">
                      {new Date(client.lastVisit).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {client.totalVisits >= 5 && (
                    <Badge variant="secondary" className="w-full justify-center">
                      Regular Client
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No clients found
          </div>
        )}
      </div>
    </div>
  )
}