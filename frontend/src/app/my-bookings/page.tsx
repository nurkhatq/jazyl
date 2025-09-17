// frontend/src/app/my-bookings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, User, X, AlertTriangle, Check, ChevronLeft, Mail, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { format, parseISO, isFuture, addHours } from 'date-fns'
import { getTenantBySubdomain } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function MyBookingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [tenant, setTenant] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [cancelModal, setCancelModal] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    const loadTenant = async () => {
      try {
        const subdomain = window.location.hostname.split('.')[0]
        if (subdomain === 'jazyl' || subdomain === 'www' || subdomain === 'localhost') {
          router.push('/platform')
          return
        }
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
        router.push('/404')
      }
    }
    loadTenant()
  }, [router])

  const searchBookings = async () => {
    if (!email) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const response = await api.get('/api/bookings/my-bookings', {
        params: { email },
        headers: { 'X-Tenant-ID': tenant.id }
      })
      setBookings(response.data.bookings || [])
      setSearched(true)
      
      if (response.data.bookings.length === 0) {
        toast({
          title: 'No Bookings Found',
          description: 'No bookings found for this email address'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load bookings',
        variant: 'destructive'
      })
      setBookings([])
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const cancelBooking = async () => {
    if (!cancelModal) return

    setLoading(true)
    try {
      await api.post(
        `/api/bookings/${cancelModal.id}/cancel`,
        { reason: cancelReason },
        {
          params: { cancellation_token: cancelModal.cancellation_token },
          headers: { 'X-Tenant-ID': tenant.id }
        }
      )

      toast({
        title: 'Booking Cancelled',
        description: 'Your booking has been cancelled successfully'
      })

      // Refresh bookings
      await searchBookings()
      setCancelModal(null)
      setCancelReason('')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to cancel booking',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-xl font-semibold">My Bookings</h1>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {tenant.name}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {!searched ? (
          /* Search Form */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">View Your Bookings</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Enter your email to view and manage your appointments
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchBookings()}
                    />
                    <Button
                      onClick={searchBookings}
                      disabled={loading || !email}
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          /* Bookings List */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Search Header */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Showing bookings for</p>
                  <p className="font-medium">{email}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearched(false)
                    setBookings([])
                    setEmail('')
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Search Different Email
                </Button>
              </div>
            </Card>

            {/* Bookings */}
            {bookings.length > 0 ? (
              <div className="space-y-4">
                {bookings.map((booking, index) => {
                  const bookingDate = parseISO(booking.date)
                  const canCancel = booking.can_cancel && 
                    booking.status === 'confirmed' && 
                    isFuture(addHours(bookingDate, -2))

                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="p-6 hover:shadow-lg transition-shadow">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                          <div className="flex-1 space-y-3">
                            {/* Service & Master */}
                            <div>
                              <h3 className="font-semibold text-lg">{booking.service}</h3>
                              <p className="text-gray-600 dark:text-gray-400 flex items-center mt-1">
                                <User className="h-4 w-4 mr-2" />
                                with {booking.master}
                              </p>
                            </div>

                            {/* Date & Time */}
                            <div className="flex items-center space-x-4 text-sm">
                              <div className="flex items-center text-gray-600 dark:text-gray-400">
                                <Calendar className="h-4 w-4 mr-2" />
                                {format(bookingDate, 'EEEE, MMMM dd, yyyy')}
                              </div>
                              <div className="flex items-center text-gray-600 dark:text-gray-400">
                                <Clock className="h-4 w-4 mr-2" />
                                {format(bookingDate, 'h:mm a')}
                              </div>
                            </div>

                            {/* Price & Status */}
                            <div className="flex items-center space-x-4">
                              <span className="font-semibold text-[var(--primary)]">
                                ${booking.price}
                              </span>
                              <Badge className={getStatusColor(booking.status)}>
                                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </Badge>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-2">
                            {canCancel && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setCancelModal(booking)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                            {booking.status === 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/')}
                              >
                                Book Again
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Warning for upcoming bookings */}
                        {booking.status === 'confirmed' && isFuture(bookingDate) && !canCancel && (
                          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start space-x-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                            <p className="text-sm text-yellow-800 dark:text-yellow-400">
                              Cancellation not available (less than 2 hours before appointment)
                            </p>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Calendar className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Bookings Found</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  You don't have any bookings with this email address
                </p>
                <Button onClick={() => router.push('/')} style={{ backgroundColor: 'var(--primary)' }}>
                  Make Your First Booking
                </Button>
              </Card>
            )}
          </motion.div>
        )}
      </div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {cancelModal && (
          <Dialog open={!!cancelModal} onOpenChange={() => setCancelModal(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel Booking</DialogTitle>
                <DialogDescription>
                  Are you sure you want to cancel this appointment?
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <Card className="p-3 bg-gray-50 dark:bg-gray-800">
                  <p className="font-medium">{cancelModal.service}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {format(parseISO(cancelModal.date), 'EEEE, MMMM dd at h:mm a')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    with {cancelModal.master}
                  </p>
                </Card>

                <div>
                  <Label htmlFor="reason">Cancellation Reason (Optional)</Label>
                  <Input
                    id="reason"
                    placeholder="Please provide a reason..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCancelModal(null)
                    setCancelReason('')
                  }}
                >
                  Keep Booking
                </Button>
                <Button
                  variant="destructive"
                  onClick={cancelBooking}
                  disabled={loading}
                >
                  {loading ? 'Cancelling...' : 'Confirm Cancellation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  )
}