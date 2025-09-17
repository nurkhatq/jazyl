// frontend/src/app/booking/confirm/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Calendar, User, MapPin, DollarSign, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import api, { getTenantBySubdomain } from '@/lib/api'
import { format, parseISO } from 'date-fns'

interface ConfirmationPageProps {
  params: { id: string }
}

export default function BookingConfirmationPage({ params }: ConfirmationPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [booking, setBooking] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      toast({
        title: 'Invalid Link',
        description: 'Confirmation token is missing',
        variant: 'destructive'
      })
      return
    }

    confirmBooking()
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

  const confirmBooking = async () => {
    try {
      const response = await api.post(`/api/bookings/${params.id}/confirm`, null, {
        params: { token }
      })

      // Load booking details
      const bookingResponse = await api.get(`/api/bookings/${params.id}`)
      setBooking(bookingResponse.data)
      
      setStatus('success')
      toast({
        title: 'Booking Confirmed!',
        description: 'Your appointment has been confirmed successfully'
      })
    } catch (error: any) {
      setStatus('error')
      toast({
        title: 'Confirmation Failed',
        description: error.response?.data?.detail || 'Invalid or expired confirmation link',
        variant: 'destructive'
      })
    }
  }

  const addToCalendar = () => {
    if (!booking) return

    const startDate = parseISO(booking.date)
    const endDate = new Date(startDate.getTime() + booking.service.duration * 60000)
    
    const event = {
      title: `${booking.service.name} at ${tenant?.name}`,
      start: startDate.toISOString().replace(/-|:|\.\d\d\d/g, ''),
      end: endDate.toISOString().replace(/-|:|\.\d\d\d/g, ''),
      description: `Appointment with ${booking.master.display_name} for ${booking.service.name}`,
      location: tenant?.address || ''
    }

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${event.start}/${event.end}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`
    
    window.open(googleCalendarUrl, '_blank')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
        <Card className="p-8 max-w-md w-full">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin text-[var(--primary)] mb-4" />
            <h2 className="text-xl font-semibold mb-2">Confirming Your Booking...</h2>
            <p className="text-gray-600 text-center">Please wait while we confirm your appointment</p>
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
          <Card className="overflow-hidden">
            {/* Status Header */}
            <div className={`p-6 text-center ${
              status === 'success' 
                ? 'bg-gradient-to-r from-green-500 to-green-600' 
                : 'bg-gradient-to-r from-red-500 to-red-600'
            } text-white`}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="inline-flex"
              >
                {status === 'success' ? (
                  <CheckCircle className="h-16 w-16 mb-4" />
                ) : (
                  <XCircle className="h-16 w-16 mb-4" />
                )}
              </motion.div>
              
              <h1 className="text-3xl font-bold mb-2">
                {status === 'success' ? 'Booking Confirmed!' : 'Confirmation Failed'}
              </h1>
              
              {status === 'success' && booking && (
                <p className="text-lg opacity-90">
                  Your appointment is scheduled for {format(parseISO(booking.date), 'EEEE, MMMM dd')}
                </p>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {status === 'success' && booking ? (
                <>
                  {/* Booking Details */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Appointment Details</h3>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="font-medium">Date & Time</p>
                          <p className="text-gray-600">
                            {format(parseISO(booking.date), 'EEEE, MMMM dd, yyyy')}
                          </p>
                          <p className="text-gray-600">
                            {format(parseISO(booking.date), 'h:mm a')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <User className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="font-medium">Master</p>
                          <p className="text-gray-600">{booking.master?.display_name}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <DollarSign className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="font-medium">Service</p>
                          <p className="text-gray-600">{booking.service?.name}</p>
                          <p className="text-[var(--primary)] font-semibold">${booking.price}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="font-medium">Duration</p>
                          <p className="text-gray-600">{booking.service?.duration} minutes</p>
                        </div>
                      </div>

                      {tenant?.address && (
                        <div className="flex items-start space-x-3">
                          <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium">Location</p>
                            <p className="text-gray-600">{tenant.name}</p>
                            <p className="text-gray-600">{tenant.address}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Important Information */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Important Information</h3>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 space-y-2">
                      <p className="text-sm">
                        • Please arrive 5 minutes before your appointment
                      </p>
                      <p className="text-sm">
                        • You can cancel or reschedule up to 2 hours before your appointment
                      </p>
                      <p className="text-sm">
                        • A confirmation email has been sent to your email address
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    <Button 
                      className="w-full"
                      size="lg"
                      onClick={addToCalendar}
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Add to Google Calendar
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="w-full"
                      size="lg"
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
                </>
              ) : (
                <>
                  {/* Error State */}
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-6">
                      {status === 'error' 
                        ? 'The confirmation link is invalid or has expired. Your booking may have already been confirmed.'
                        : 'Something went wrong. Please try again.'}
                    </p>
                    
                    <div className="space-y-3">
                      <Button 
                        className="w-full"
                        size="lg"
                        onClick={() => router.push('/my-bookings')}
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        Check My Bookings
                      </Button>
                      
                      <Button 
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push('/')}
                      >
                        Make New Booking
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}