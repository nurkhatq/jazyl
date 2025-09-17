'use client'

import { useQuery } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { format } from 'date-fns'
import { MoreHorizontal, Eye, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface BookingsTableProps {
  date?: Date
}

export function BookingsTable({ date }: BookingsTableProps) {
  const user = useAuthStore((state) => state.user)
  
  const { data: bookings, isLoading, refetch } = useQuery({
    queryKey: ['bookings', date],
    queryFn: async () => {
      const response = await api.get('/api/bookings/', {
        params: {
          date_from: date ? format(date, 'yyyy-MM-dd') : undefined,
          date_to: date ? format(date, 'yyyy-MM-dd') : undefined,
        }
      })
      return response.data
    },
    enabled: !!user?.tenant_id,
  })

  const handleCancel = async (bookingId: string) => {
    try {
      await api.post(`/api/bookings/${bookingId}/cancel`, {
        reason: 'Cancelled by owner'
      })
      refetch()
    } catch (error) {
      console.error('Failed to cancel booking:', error)
    }
  }

  if (isLoading) {
    return <div>Loading bookings...</div>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Master</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Price</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings?.map((booking: any) => (
            <TableRow key={booking.id}>
              <TableCell>{format(new Date(booking.date), 'HH:mm')}</TableCell>
              <TableCell>{booking.client_name || `Client #${booking.client_id.slice(0, 8)}`}</TableCell>
              <TableCell>{booking.service_name || `Service #${booking.service_id.slice(0, 8)}`}</TableCell>
              <TableCell>Master #{booking.master_id.slice(0, 8)}</TableCell>
              <TableCell>
                <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                  {booking.status}
                </Badge>
              </TableCell>
              <TableCell>${booking.price}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCancel(booking.id)}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel Booking
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {(!bookings || bookings.length === 0) && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No bookings found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}