'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { getMasters, getServices, getAvailableSlots, createBooking } from '@/lib/api'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

interface BookingFlowProps {
  tenantId: string
}

export function BookingFlow({ tenantId }: BookingFlowProps) {
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedMaster, setSelectedMaster] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [clientData, setClientData] = useState({
    name: '',
    email: '',
    phone: '',
  })

  const { data: masters } = useQuery({
    queryKey: ['masters', tenantId],
    queryFn: () => getMasters(tenantId),
  })

  const { data: services } = useQuery({
    queryKey: ['services', tenantId],
    queryFn: () => getServices(tenantId),
  })

  const { data: availableSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ['availableSlots', selectedMaster, selectedDate, selectedService],
    queryFn: () => 
      selectedMaster && selectedDate && selectedService
        ? getAvailableSlots(tenantId, selectedMaster, selectedDate, selectedService)
        : Promise.resolve([]),
    enabled: !!selectedMaster && !!selectedDate && !!selectedService,
  })

  const bookingMutation = useMutation({
    mutationFn: (data: any) => createBooking(tenantId, data),
    onSuccess: () => {
      toast({
        title: "Booking Created!",
        description: "Please check your email to confirm your booking.",
      })
      // Reset form
      setStep(1)
      setSelectedMaster(null)
      setSelectedService(null)
      setSelectedTime(null)
      setClientData({ name: '', email: '', phone: '' })
    },
    onError: () => {
      toast({
        title: "Booking Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    },
  })

  const handleSubmit = () => {
    if (!selectedMaster || !selectedService || !selectedTime || !selectedDate) {
      toast({
        title: "Missing Information",
        description: "Please complete all steps before submitting.",
        variant: "destructive",
      })
      return
    }

    const bookingData = {
      master_id: selectedMaster,
      service_id: selectedService,
      date: `${format(selectedDate, 'yyyy-MM-dd')} ${selectedTime}:00`,
      client_name: clientData.name,
      client_email: clientData.email,
      client_phone: clientData.phone,
    }

    bookingMutation.mutate(bookingData)
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`flex items-center ${s < 4 ? 'flex-1' : ''}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold
                ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              {s}
            </div>
            {s < 4 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  step > s ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Date */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
            <CardDescription>Choose your preferred appointment date</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date() || date.getDay() === 0}
              className="rounded-md border"
            />
          </CardContent>
          <div className="p-6 pt-0 flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!selectedDate}
            >
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Select Master & Service */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Master & Service</CardTitle>
            <CardDescription>Choose your preferred master and service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Masters */}
            <div>
              <Label>Select Master</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                {masters?.map((master: any) => (
                  <div
                    key={master.id}
                    onClick={() => setSelectedMaster(master.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors
                      ${selectedMaster === master.id ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
                  >
                    <div className="font-semibold">{master.display_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {master.specialization?.join(', ')}
                    </div>
                    {master.rating > 0 && (
                      <div className="text-sm mt-1">⭐ {master.rating}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Services */}
            <div>
              <Label>Select Service</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {services?.map((service: any) => (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors
                      ${selectedService === service.id ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{service.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {service.duration} min
                        </div>
                      </div>
                      <div className="font-semibold">${service.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <div className="p-6 pt-0 flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!selectedMaster || !selectedService}
            >
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Select Time */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Time</CardTitle>
            <CardDescription>
              Available time slots for {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {slotsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {availableSlots?.slots?.map((slot: string) => (
                  <Button
                    key={slot}
                    variant={selectedTime === slot ? 'default' : 'outline'}
                    onClick={() => setSelectedTime(slot)}
                    className="w-full"
                  >
                    {slot}
                  </Button>
                ))}
                {(!availableSlots?.slots || availableSlots.slots.length === 0) && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No available time slots for this date
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <div className="p-6 pt-0 flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={!selectedTime}
            >
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Contact Information */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Please provide your contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={clientData.name}
                onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={clientData.email}
                onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                placeholder="john@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={clientData.phone}
                onChange={(e) => setClientData({ ...clientData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                required
              />
            </div>

            {/* Booking Summary */}
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Booking Summary</h4>
              <div className="space-y-1 text-sm">
                <div>Date: {selectedDate && format(selectedDate, 'MMMM d, yyyy')}</div>
                <div>Time: {selectedTime}</div>
                <div>Master: {masters?.find((m: any) => m.id === selectedMaster)?.display_name}</div>
                <div>Service: {services?.find((s: any) => s.id === selectedService)?.name}</div>
                <div className="font-semibold pt-2">
                  Total: ${services?.find((s: any) => s.id === selectedService)?.price}
                </div>
              </div>
            </div>
          </CardContent>
          <div className="p-6 pt-0 flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!clientData.name || !clientData.email || !clientData.phone || bookingMutation.isPending}
            >
              {bookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Booking...
                </>
              ) : (
                'Complete Booking'
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}