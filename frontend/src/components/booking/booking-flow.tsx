'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { getMasters, getServices, getPublicMasters, getPublicServices, getAvailableSlots, createBooking } from '@/lib/api'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Loader2, CheckCircle } from 'lucide-react'

interface BookingFlowProps {
  tenantId?: string // Сделаем опциональным, так как теперь может определяться автоматически
  preselectedMaster?: any
  preselectedService?: any
  isPublic?: boolean // Добавляем флаг для публичного режима
}

export function BookingFlow({ tenantId, preselectedMaster, preselectedService, isPublic = false }: BookingFlowProps) {
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [bookingComplete, setBookingComplete] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedMaster, setSelectedMaster] = useState<string | null>(preselectedMaster?.id || null)
  const [selectedService, setSelectedService] = useState<string | null>(preselectedService?.id || null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [clientData, setClientData] = useState({
    name: '',
    email: '',
    phone: '',
  })

  // Если есть предвыбранные элементы, переходим сразу к выбору времени
  useEffect(() => {
    if (preselectedMaster || preselectedService) {
      setStep(2)
    }
  }, [preselectedMaster, preselectedService])

  // Загружаем мастеров
  const { data: masters, isLoading: mastersLoading } = useQuery({
    queryKey: isPublic ? ['public-masters'] : ['masters', tenantId],
    queryFn: () => isPublic ? getPublicMasters() : getMasters(tenantId),
    staleTime: 5 * 60 * 1000, // 5 минут
  })

  // Загружаем услуги
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: isPublic ? ['public-services'] : ['services', tenantId],
    queryFn: () => isPublic ? getPublicServices() : getServices(tenantId),
    staleTime: 5 * 60 * 1000, // 5 минут
  })

  // Загружаем доступные слоты (ИСПРАВЛЕНО)
  const { data: availableSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ['availableSlots', selectedMaster, selectedDate, selectedService, tenantId],
    queryFn: () => {
      if (!selectedMaster || !selectedDate || !selectedService) {
        return Promise.resolve({ slots: [] })
      }
      // ИСПРАВЛЕНО: используем правильную сигнатуру функции
      return getAvailableSlots(selectedMaster, selectedDate, selectedService, tenantId)
    },
    enabled: !!selectedMaster && !!selectedDate && !!selectedService,
    staleTime: 1 * 60 * 1000, // 1 минута для слотов
  })

  // Мутация для создания брони
  const bookingMutation = useMutation({
    mutationFn: (data: any) => createBooking(data, tenantId),
    onSuccess: (data) => {
      setBookingComplete(true)
      toast({
        title: "Booking Created!",
        description: "Please check your email to confirm your booking.",
      })
    },
    onError: (error: any) => {
      console.error('Booking error:', error)
      toast({
        title: "Booking Failed",
        description: error.response?.data?.detail || "Something went wrong. Please try again.",
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

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(clientData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      })
      return
    }

    // Формируем данные для отправки (исправлено под новую схему API)
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

  // Функция для сброса формы
  const resetForm = () => {
    setBookingComplete(false)
    setStep(1)
    setSelectedMaster(preselectedMaster?.id || null)
    setSelectedService(preselectedService?.id || null)
    setSelectedTime(null)
    setSelectedDate(new Date())
    setClientData({ name: '', email: '', phone: '' })
  }

  // Показываем успешное завершение
  if (bookingComplete) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Booking Successful!</h3>
            <p className="text-gray-600 mb-6">
              We've sent a confirmation email to {clientData.email}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Please check your email and confirm your booking to complete the reservation.
            </p>
            <Button onClick={resetForm}>
              Book Another Appointment
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Показываем загрузку если данные еще загружаются
  if (mastersLoading || servicesLoading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading...</span>
          </div>
        </CardContent>
      </Card>
    )
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
              disabled={(date) => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return date < today || date.getDay() === 0 // Отключаем прошлые даты и воскресенья
              }}
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
            {!preselectedMaster && (
              <div>
                <Label>Select Master</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                  {masters?.filter((m: any) => m.is_active && m.is_visible).map((master: any) => (
                    <div
                      key={master.id}
                      onClick={() => setSelectedMaster(master.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors
                        ${selectedMaster === master.id ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
                    >
                      <div className="flex flex-col items-center text-center">
                        {master.photo_url && (
                          <img 
                            src={master.photo_url} 
                            alt={master.display_name}
                            className="w-16 h-16 rounded-full object-cover mb-2"
                          />
                        )}
                        <div className="font-semibold">{master.display_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {master.specialization?.join(', ')}
                        </div>
                        {master.rating > 0 && (
                          <div className="text-sm mt-1">⭐ {master.rating.toFixed(1)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!masters?.length && (
                  <div className="text-center py-4 text-muted-foreground">
                    No masters available
                  </div>
                )}
              </div>
            )}

            {/* Services */}
            {!preselectedService && (
              <div>
                <Label>Select Service</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {services?.filter((s: any) => s.is_active).map((service: any) => (
                    <div
                      key={service.id}
                      onClick={() => setSelectedService(service.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors
                        ${selectedService === service.id ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold">{service.name}</div>
                          {service.description && (
                            <div className="text-sm text-muted-foreground mb-2">
                              {service.description}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            {service.duration} min
                          </div>
                        </div>
                        <div className="font-semibold">${service.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {!services?.length && (
                  <div className="text-center py-4 text-muted-foreground">
                    No services available
                  </div>
                )}
              </div>
            )}

            {/* Show preselected items */}
            {preselectedMaster && (
              <div className="p-4 bg-primary/10 rounded-lg">
                <Label>Selected Master</Label>
                <p className="font-semibold">{preselectedMaster.display_name}</p>
                {preselectedMaster.specialization?.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {preselectedMaster.specialization.join(', ')}
                  </p>
                )}
              </div>
            )}
            
            {preselectedService && (
              <div className="p-4 bg-primary/10 rounded-lg">
                <Label>Selected Service</Label>
                <p className="font-semibold">
                  {preselectedService.name} - ${preselectedService.price}
                </p>
                <p className="text-sm text-muted-foreground">
                  {preselectedService.duration} minutes
                </p>
              </div>
            )}
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
                <span className="ml-2">Loading available times...</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
                    No available time slots for this date. Please select a different date.
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
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={clientData.name}
                onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
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
              <Label htmlFor="phone">Phone Number *</Label>
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
                <div>Master: {masters?.find((m: any) => m.id === selectedMaster)?.display_name || preselectedMaster?.display_name}</div>
                <div>Service: {services?.find((s: any) => s.id === selectedService)?.name || preselectedService?.name}</div>
                <div className="font-semibold pt-2">
                  Total: ${services?.find((s: any) => s.id === selectedService)?.price || preselectedService?.price}
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
                  Creating Booking...
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