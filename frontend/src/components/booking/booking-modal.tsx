// frontend/src/components/booking/booking-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Clock, User, Mail, Phone, Check, ChevronLeft, ChevronRight, Star, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { format, addDays, setHours, setMinutes, isBefore, isAfter, startOfDay, parseISO } from 'date-fns'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'date' | 'master' | 'service'
  tenant: any
  masters: any[]
  services: any[]
  preselectedMaster?: any
  preselectedService?: any
}

export default function BookingModal({
  isOpen,
  onClose,
  mode,
  tenant,
  masters,
  services,
  preselectedMaster,
  preselectedService
}: BookingModalProps) {
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  
  // Booking data
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedMaster, setSelectedMaster] = useState<any>(preselectedMaster)
  const [selectedService, setSelectedService] = useState<any>(preselectedService)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [masterAvailability, setMasterAvailability] = useState<any>({})
  
  // Client data
  const [clientData, setClientData] = useState({
    name: '',
    email: '',
    phone: ''
  })

  // Generate next 30 days for date selection
  const dateOptions = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i))

  // Reset on mode change
  useEffect(() => {
    if (mode === 'date') {
      setStep(1) // Select date/time first
    } else if (mode === 'master') {
      setStep(preselectedMaster ? 3 : 2) // Select master or go to services
    } else if (mode === 'service') {
      setStep(preselectedService ? 4 : 5) // Select service or go to masters
    }
  }, [mode, preselectedMaster, preselectedService])

  // Load available slots when date and master are selected
  useEffect(() => {
    if (selectedDate && selectedMaster && selectedService) {
      loadAvailableSlots()
    }
  }, [selectedDate, selectedMaster, selectedService])

  // Load master availability for nearest dates
  useEffect(() => {
    if (mode === 'master' && masters.length > 0) {
      loadMasterAvailability()
    }
  }, [masters, mode])

  const loadAvailableSlots = async () => {
    if (!selectedDate || !selectedMaster || !selectedService) return
    
    try {
      const response = await api.get('/api/bookings/availability/slots', {
        params: {
          master_id: selectedMaster.id,
          date: format(selectedDate, 'yyyy-MM-dd'),
          service_id: selectedService.id
        },
        headers: {
          'X-Tenant-ID': tenant.id
        }
      })
      setAvailableSlots(response.data.slots || [])
    } catch (error) {
      console.error('Failed to load slots:', error)
      setAvailableSlots([])
    }
  }

  const loadMasterAvailability = async () => {
    const availability: any = {}
    
    for (const master of masters) {
      try {
        // Get nearest available date for each master
        const response = await api.get('/api/bookings/availability/check', {
          params: {
            master_id: master.id,
            date: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm:ss'),
            service_id: services[0]?.id // Use first service as default
          },
          headers: {
            'X-Tenant-ID': tenant.id
          }
        })
        
        availability[master.id] = {
          nearestDate: response.data.nearestDate || format(new Date(), 'yyyy-MM-dd'),
          nearestTime: response.data.nearestTime || '09:00'
        }
      } catch (error) {
        availability[master.id] = {
          nearestDate: format(new Date(), 'yyyy-MM-dd'),
          nearestTime: '09:00'
        }
      }
    }
    
    setMasterAvailability(availability)
  }

  const sendVerificationEmail = async () => {
    setLoading(true)
    try {
      const response = await api.post('/api/bookings/verify-email', 
        { email: clientData.email },
        { headers: { 'X-Tenant-ID': tenant.id } }
      )
      
      // In production, the code won't be returned
      // For demo, we'll show it in a toast
      if (response.data.token) {
        toast({
          title: 'Verification Code (Demo)',
          description: `Your code is: ${response.data.token}`,
          duration: 10000
        })
      }
      
      toast({
        title: 'Email Sent',
        description: 'Please check your email for verification code'
      })
      
      setStep(7) // Go to verification step
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send verification email',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const verifyEmail = async () => {
    setLoading(true)
    try {
      // In production, verify the code with backend
      // For demo, we'll accept any non-empty code
      if (verificationCode.length > 0) {
        setEmailVerified(true)
        setStep(8) // Go to confirmation step
        toast({
          title: 'Email Verified',
          description: 'Your email has been verified successfully'
        })
      } else {
        throw new Error('Invalid code')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid verification code',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const createBooking = async () => {
    setLoading(true)
    try {
      const bookingData = {
        master_id: selectedMaster.id,
        service_id: selectedService.id,
        date: `${format(selectedDate!, 'yyyy-MM-dd')} ${selectedTime}:00`,
        client_name: clientData.name,
        client_email: clientData.email,
        client_phone: clientData.phone,
        email_verification_token: verificationCode,
        price: selectedService.price
      }
      
      const response = await api.post('/api/bookings/create', bookingData, {
        headers: { 'X-Tenant-ID': tenant.id }
      })
      
      toast({
        title: 'Booking Confirmed!',
        description: 'Check your email for confirmation details'
      })
      
      setStep(9) // Success step
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create booking',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    // Step 1: Date Selection (for date mode)
    if (step === 1 && mode === 'date') {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <h3 className="text-xl font-semibold mb-4">Choose Date & Time</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {dateOptions.map((date) => (
              <Card
                key={date.toISOString()}
                className={`p-3 cursor-pointer transition-all ${
                  selectedDate?.toDateString() === date.toDateString()
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                    : 'hover:border-gray-400'
                }`}
                onClick={() => setSelectedDate(date)}
              >
                <div className="text-center">
                  <p className="text-xs text-gray-500">{format(date, 'EEE')}</p>
                  <p className="font-semibold">{format(date, 'dd MMM')}</p>
                </div>
              </Card>
            ))}
          </div>

          {selectedDate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6"
            >
              <h4 className="font-medium mb-3">Available Times</h4>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', 
                  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
                  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'].map((time) => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTime(time)}
                    style={selectedTime === time ? { backgroundColor: 'var(--primary)' } : {}}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {selectedDate && selectedTime && (
            <Button 
              className="w-full mt-6"
              onClick={() => setStep(2)}
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Next: Choose Master
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </motion.div>
      )
    }

    // Step 2: Master Selection
    if ((step === 2 && mode === 'date') || (step === 2 && mode === 'master')) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <h3 className="text-xl font-semibold mb-4">Choose Your Master</h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {masters.map((master) => {
              const availability = masterAvailability[master.id]
              return (
                <Card
                  key={master.id}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedMaster?.id === master.id
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                      : 'hover:border-gray-400'
                  }`}
                  onClick={() => setSelectedMaster(master)}
                >
                  <div className="flex items-start space-x-4">
                    {master.photo_url ? (
                      <img
                        src={master.photo_url}
                        alt={master.display_name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                        <User className="h-8 w-8 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold">{master.display_name}</h4>
                      {master.specialization && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{master.specialization.join(', ')}</p>
                      )}
                      <div className="flex items-center mt-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="text-sm ml-1">{master.rating || 5.0}</span>
                        {master.reviews_count > 0 && (
                          <span className="text-sm text-gray-500 ml-1">({master.reviews_count})</span>
                        )}
                      </div>
                      {mode === 'master' && availability && (
                        <p className="text-xs text-green-600 mt-1">
                          Next available: {format(parseISO(availability.nearestDate), 'MMM dd')} at {availability.nearestTime}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {selectedMaster && (
            <Button 
              className="w-full mt-6"
              onClick={() => setStep(mode === 'date' ? 3 : 4)}
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Next: Choose Service
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </motion.div>
      )
    }

    // Step 3: Service Selection (for date mode)
    // Step 4: Service Selection (for master mode)
    // Step 5: Service Selection (for service mode)
    if ((step === 3 && mode === 'date') || (step === 4 && mode === 'master') || (step === 5 && mode === 'service')) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <h3 className="text-xl font-semibold mb-4">Choose Service</h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {services.map((service) => (
              <Card
                key={service.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedService?.id === service.id
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                    : 'hover:border-gray-400'
                }`}
                onClick={() => setSelectedService(service)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{service.name}</h4>
                    {service.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{service.description}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-lg font-bold text-[var(--primary)]">${service.price}</span>
                      <span className="text-sm text-gray-500">{service.duration} min</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {selectedService && (
            <Button 
              className="w-full mt-6"
              onClick={() => {
                if (mode === 'service' && !selectedMaster) {
                  setStep(2) // Go to master selection
                } else {
                  setStep(6) // Go to client details
                }
              }}
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {mode === 'service' && !selectedMaster ? 'Next: Choose Master' : 'Next: Your Details'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </motion.div>
      )
    }

    // Step 6: Client Details
    if (step === 6) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <h3 className="text-xl font-semibold mb-4">Your Details</h3>
          
          <div className="space-y-4">
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
                placeholder="+1 (555) 123-4567"
                required
              />
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">Booking Summary</h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-500">Date:</span> {selectedDate && format(selectedDate, 'EEEE, MMMM dd, yyyy')}</p>
                <p><span className="text-gray-500">Time:</span> {selectedTime}</p>
                <p><span className="text-gray-500">Master:</span> {selectedMaster?.display_name}</p>
                <p><span className="text-gray-500">Service:</span> {selectedService?.name}</p>
                <p className="font-semibold text-[var(--primary)]">Total: ${selectedService?.price}</p>
              </div>
            </div>

            <Button 
              className="w-full"
              onClick={sendVerificationEmail}
              disabled={!clientData.name || !clientData.email || !clientData.phone || loading}
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending verification...
                </>
              ) : (
                <>
                  Verify Email
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )
    }

    // Step 7: Email Verification
    if (step === 7) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <h3 className="text-xl font-semibold mb-4">Verify Your Email</h3>
          
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              We've sent a verification code to <strong>{clientData.email}</strong>
            </p>

            <div>
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter verification code"
                className="text-center text-lg font-mono"
              />
            </div>

            <Button 
              className="w-full"
              onClick={verifyEmail}
              disabled={!verificationCode || loading}
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify & Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <Button 
              variant="ghost"
              className="w-full"
              onClick={sendVerificationEmail}
              disabled={loading}
            >
              Resend Code
            </Button>
          </div>
        </motion.div>
      )
    }

    // Step 8: Final Confirmation
    if (step === 8) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <h3 className="text-xl font-semibold mb-4">Confirm Your Booking</h3>
          
          <div className="space-y-4">
            <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-400">Email Verified</p>
                  <p className="text-sm text-green-700 dark:text-green-500">Your email has been successfully verified</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-semibold mb-3">Appointment Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Date & Time:</span>
                  <span className="font-medium">
                    {selectedDate && format(selectedDate, 'MMM dd, yyyy')} at {selectedTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Master:</span>
                  <span className="font-medium">{selectedMaster?.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Service:</span>
                  <span className="font-medium">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-medium">{selectedService?.duration} minutes</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Price:</span>
                    <span className="font-bold text-[var(--primary)] text-lg">${selectedService?.price}</span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>✓ Confirmation email will be sent to {clientData.email}</p>
              <p>✓ You can cancel up to 2 hours before your appointment</p>
            </div>

            <Button 
              className="w-full"
              onClick={createBooking}
              disabled={loading}
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming booking...
                </>
              ) : (
                <>
                  Confirm Booking
                  <Check className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )
    }

    // Step 9: Success
    if (step === 9) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Check className="h-10 w-10 text-green-600" />
          </motion.div>
          
          <h3 className="text-2xl font-bold mb-3">Booking Confirmed!</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We've sent confirmation details to {clientData.email}
          </p>

          <Card className="p-4 bg-gray-50 dark:bg-gray-800 text-left mb-6">
            <h4 className="font-semibold mb-2">Your appointment:</h4>
            <p className="text-sm">{selectedDate && format(selectedDate, 'EEEE, MMMM dd, yyyy')}</p>
            <p className="text-sm">at {selectedTime} with {selectedMaster?.display_name}</p>
            <p className="text-sm font-semibold text-[var(--primary)] mt-2">{selectedService?.name} - ${selectedService?.price}</p>
          </Card>

          <Button 
            className="w-full"
            onClick={onClose}
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Done
          </Button>
        </motion.div>
      )
    }

    return null
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl z-50 w-full max-w-lg max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-2">
                {step > 1 && step < 9 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(step - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <h2 className="text-xl font-semibold">Book Appointment</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
              <AnimatePresence mode="wait">
                {renderStep()}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}