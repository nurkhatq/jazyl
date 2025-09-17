// frontend/src/app/booking/cancel/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, XCircle, Calendar, User, Clock, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import api, { getTenantBySubdomain } from '@/lib/api'
import { format, parseISO, isFuture, addHours } from 'date-fns'

interface CancellationPageProps {
  params: { id: string }
}

const CANCELLATION_REASONS = [
  'Schedule conflict',
  'Personal emergency',
  'Found another time',
  'No longer needed',
  'Other'
]

export default function BookingCancellationPage({ params }: CancellationPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const [status, setStatus] = useState<'loading' | 'confirming' | 'cancelled' | 'error'>('loading')
  const [booking, setBooking] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [canCancel, setCanCancel] = useState(true)
  
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      toast({
        title: 'Invalid Link',
        description: 'Cancellation token is missing',
        variant: 'destructive'
      })
      return
    }

    loadBookingDetails()
    loadTenantInfo()
  }, [params.id, token])

  const loadTenantInfo = async () => {
    try {
      const subdomain = window.location.hostname.split('.')[0]
      const tenantData = await getTenantBySubdomain(subdomain)
      setTenant(tenantData)
      
      // Apply branding
      if (tenantData.primary_color) {
        document.documentElement.style.setProperty('--primary', tenantData.primary_color)
      }
      if (tenantData.secondary_color) {
        document.documentElement.style.setProperty('--secondary', tenantData.secondary_color)
      }
    } catch (error) {
      console.error('Error loading tenant:', error)
    }
  }

  const loadBookingDetails = async () => {
    try {
      // Verify token and get booking details
      const response = await api.get(`/api/bookings/${params.id}`, {
        params: { cancellation_token: token }
      })
      
      const bookingData = response.data
      setBooking(bookingData)
      
      // Check if cancellation is still allowed (2 hours before)
      const bookingDate = parseISO(bookingData.date)
      const minCancellationTime = addHours(new Date(), 2)
      
      if (bookingDate <= minCancellationTime) {
        setCanCancel(false)
        setStatus('error')
        toast({
          title: 'Cannot Cancel',
          description: 'Cancellation must be at least 2 hours before the appointment',
          variant: 'destructive'
        })
      } else if (bookingData.status === 'cancelled') {
        setStatus('error')
        toast({
          title: 'Already Cancelled',
          description: 'This booking has already been cancelled',
          variant: 'destructive'
        })
      } else {
        setStatus('confirming')
      }
    } catch (error: any) {
      setStatus('error')
      toast({
        title: 'Error',
        description: 'Failed to load booking details',
        variant: 'destructive'
      })
    }
  }

  const handleCancellation = async () => {
    if (!selectedReason) {
      toast({
        title: 'Reason Required',
        description: 'Please select a reason for cancellation',
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      const reason = selectedReason === 'Other' ? customReason : selectedReason
      
      await api.post(
        `/api/bookings/${params.id}/cancel`,
        { reason },
        { params: { cancellation_token: token } }
      )
      
      setStatus('cancelled')
      toast({
        title: 'Booking Cancelled',
        description: 'Your appointment has been cancelled successfully'
      })
    } catch (error: any) {
      toast({
        title: 'Cancellation Failed',
        description: error.response?.data?.detail || 'Failed to cancel booking',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
        <Card className="p-8 max-w-md w-full">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin text-[var(--primary)] mb-4" />
            <h2 className="text-xl font-semibold mb-2">Loading Booking Details...</h2>
            <p className="text-gray-600 text-center">Please wait while we load your appointment</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {status === 'confirming' && booking && (
            <Card className="overflow-hidden">
              {/* Warning Header */}
              <div className="p-6 bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-8 w-8" />
                  <div>
                    <h1 className="text-2xl font-bold">Cancel Appointment?</h1>
                    <p className="opacity-90">Please confirm you want to cancel this booking</p>
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-4">Appointment Details</h3>
                  <Card className="p-4 bg-gray-50 dark:bg-gray-800">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium">
                            {format(parseISO(booking.date), 'EEEE, MMMM dd, yyyy')}
                          </p>
                          <p className="text-gray-600">
                            at {format(parseISO(booking.date), 'h:mm a')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <User className="h-5 w-5 text-gray-400" />
                        <p>
                          <span className="font-medium">{booking.master?.display_name}</span>
                          <span className="text-gray-600"> - {booking.service?.name}</span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Clock className="h-5 w-5 text-gray-400" />
                        <p className="text-gray-600">{booking.service?.duration} minutes</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Cancellation Reason */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">Reason for Cancellation</h3>
                  <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
                    <div className="space-y-3">
                      {CANCELLATION_REASONS.map((reason) => (
                        <div key={reason} className="flex items-center space-x-2">
                          <RadioGroupItem value={reason} id={reason} />
                          <Label htmlFor={reason} className="cursor-pointer flex-1">
                            {reason}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>

                  {selectedReason === 'Other' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4"
                    >
                      <Label htmlFor="custom-reason">Please specify</Label>
                      <Textarea
                        id="custom-reason"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Enter your reason..."
                        className="mt-2"
                        rows={3}
                      />
                    </motion.div>
                  )}
                </div>

                {/* Warning Message */}
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-red-800 dark:text-red-400 mb-1">
                        This action cannot be undone
                      </p>
                      <p className="text-red-700 dark:text-red-500">
                        You will need to create a new booking if you change your mind.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push('/')}
                    disabled={isSubmitting}
                  >
                    Keep Appointment
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleCancellation}
                    disabled={isSubmitting || !selectedReason || (selectedReason === 'Other' && !customReason)}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      'Cancel Appointment'
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {status === 'cancelled' && (
            <Card className="overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-green-500 to-green-600 text-white text-center">
                <CheckCircle className="h-16 w-16 mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">Booking Cancelled</h1>
                <p className="opacity-90">Your appointment has been cancelled successfully</p>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-center text-gray-600">
                  A cancellation confirmation has been sent to your email.
                </p>
                
                <div className="space-y-3">
                  <Button 
                    className="w-full"
                    size="lg"
                    onClick={() => router.push('/')}
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    Book New Appointment
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/my-bookings')}
                  >
                    View My Bookings
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {status === 'error' && (
            <Card className="overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-red-500 to-red-600 text-white text-center">
                <XCircle className="h-16 w-16 mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">Cannot Cancel</h1>
              </div>
              
              <div className="p-6 space-y-4">
                {!canCancel ? (
                  <>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                      <p className="text-center">
                        Appointments must be cancelled at least 2 hours in advance.
                      </p>
                      <p className="text-center text-sm text-gray-600 mt-2">
                        Please contact the barbershop directly if you need to cancel.
                      </p>
                    </div>
                    
                    {tenant?.phone && (
                      <Button 
                        className="w-full"
                        size="lg"
                        onClick={() => window.location.href = `tel:${tenant.phone}`}
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        Call {tenant.phone}
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-center text-gray-600">
                    This booking may have already been cancelled or the link is invalid.
                  </p>
                )}
                
                <div className="space-y-3">
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/my-bookings')}
                  >
                    View My Bookings
                  </Button>
                  
                  <Button 
                    variant="ghost"
                    className="w-full"
                    onClick={() => router.push('/')}
                  >
                    Back to Home
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  )
}