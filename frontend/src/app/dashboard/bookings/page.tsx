'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { BookingsTable } from '@/components/dashboard/bookings-table'
import { BookingDialog } from '@/components/dashboard/booking-dialog'
import { Plus } from 'lucide-react'

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Bookings</h2>
            <p className="text-muted-foreground">
              Manage all your appointments
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Booking
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <div className="md:col-span-1">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </div>
          <div className="md:col-span-3">
            <BookingsTable date={selectedDate} />
          </div>
        </div>

        <BookingDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
        />
      </div>
    </DashboardLayout>
  )
}