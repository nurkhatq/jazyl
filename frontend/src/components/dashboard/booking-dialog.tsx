'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBooking, getMasters, getServices } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { format } from 'date-fns'

interface BookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BookingDialog({ open, onOpenChange }: BookingDialogProps) {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    master_id: '',
    service_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '',
    client_name: '',
    client_email: '',
    client_phone: '',
  })

  const { data: masters } = useQuery({
    queryKey: ['masters'],
    queryFn: () => getMasters(user?.tenant_id || ''),
    enabled: !!user?.tenant_id,
  })

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: () => getServices(user?.tenant_id || ''),
    enabled: !!user?.tenant_id,
  })

  const mutation = useMutation({
    mutationFn: (data: any) => createBooking(user?.tenant_id || '', data),
    onSuccess: () => {
      toast({
        title: 'Booking Created',
        description: 'The booking has been successfully created.',
      })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['today-overview'] })
      onOpenChange(false)
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create booking. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    mutation.mutate({
      master_id: formData.master_id,
      service_id: formData.service_id,
      date: `${formData.date} ${formData.time}:00`,
      client_name: formData.client_name,
      client_email: formData.client_email,
      client_phone: formData.client_phone,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Booking</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="master">Master</Label>
            <Select
              value={formData.master_id}
              onValueChange={(value) => setFormData({ ...formData, master_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a master" />
              </SelectTrigger>
              <SelectContent>
                {masters?.map((master: any) => (
                  <SelectItem key={master.id} value={master.id}>
                    {master.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="service">Service</Label>
            <Select
              value={formData.service_id}
              onValueChange={(value) => setFormData({ ...formData, service_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {services?.map((service: any) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - ${service.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="client_name">Client Name</Label>
            <Input
              id="client_name"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="client_email">Client Email</Label>
            <Input
              id="client_email"
              type="email"
              value={formData.client_email}
              onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="client_phone">Client Phone</Label>
            <Input
              id="client_phone"
              type="tel"
              value={formData.client_phone}
              onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
              required
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create Booking'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}