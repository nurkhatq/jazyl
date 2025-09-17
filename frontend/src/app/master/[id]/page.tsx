// frontend/src/app/master/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  Star, Award, Clock, Calendar, ChevronLeft, ChevronRight,
  MapPin, Phone, Mail, Instagram, Facebook, Twitter,
  CheckCircle, TrendingUp, Users, Scissors
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import api, { getTenantBySubdomain, getMasterReviews } from '@/lib/api'
import { format, parseISO, addDays } from 'date-fns'
import BookingModal from '@/components/booking/booking-modal'

interface MasterProfileProps {
  params: { id: string }
}

export default function MasterProfilePage({ params }: MasterProfileProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [tenant, setTenant] = useState<any>(null)
  const [master, setMaster] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewStats, setReviewStats] = useState<any>({})
  const [schedule, setSchedule] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [currentReviewPage, setCurrentReviewPage] = useState(1)

  useEffect(() => {
    loadData()
  }, [params.id])

  const loadData = async () => {
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

      // Load master data
      const [masterRes, servicesRes] = await Promise.all([
        api.get(`/api/masters/public/${params.id}`, {
          headers: { 'X-Tenant-Subdomain': subdomain }
        }),
        api.get('/api/services/public', {
          headers: { 'X-Tenant-Subdomain': subdomain }
        })
      ])

      setMaster(masterRes.data)
      setServices(servicesRes.data || [])

      // Load reviews
      await loadReviews(tenantData.id)

      // Load schedule for next 7 days
      await loadSchedule(tenantData.id)
    } catch (error) {
      console.error('Error loading master profile:', error)
      toast({
        title: 'Error',
        description: 'Failed to load master profile',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadReviews = async (tenantId: string) => {
    try {
      const reviewsData = await getMasterReviews(tenantId, params.id, currentReviewPage, 10)
      setReviews(reviewsData.reviews || [])
      
      // Calculate review statistics
      const stats = {
        total: reviewsData.total || 0,
        average: reviewsData.average || 0,
        distribution: reviewsData.distribution || {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        }
      }
      setReviewStats(stats)
    } catch (error) {
      console.error('Error loading reviews:', error)
    }
  }

  const loadSchedule = async (tenantId: string) => {
    try {
      const startDate = format(new Date(), 'yyyy-MM-dd')
      const endDate = format(addDays(new Date(), 7), 'yyyy-MM-dd')
      
      const response = await api.get(`/api/masters/${params.id}/schedule`, {
        params: { start_date: startDate, end_date: endDate },
        headers: { 'X-Tenant-ID': tenantId }
      })
      
      setSchedule(response.data.schedule || [])
    } catch (error) {
      console.error('Error loading schedule:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    )
  }

  if (!master) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-4">Master Not Found</h2>
        <Button onClick={() => router.push('/')}>Go Back</Button>
      </div>
    )
  }

  const ratingDistribution = reviewStats.distribution || {}
  const maxCount = Math.max(...Object.values(ratingDistribution).map(v => v as number), 1)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {tenant?.name}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/10 to-[var(--secondary)]/10" />
        <div className="container mx-auto px-4 py-12 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Master Photo & Basic Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Card className="overflow-hidden">
                {master.photo_url ? (
                  <img
                    src={master.photo_url}
                    alt={master.display_name}
                    className="w-full h-80 object-cover"
                  />
                ) : (
                  <div className="w-full h-80 bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                    <Avatar className="h-32 w-32">
                      <AvatarFallback className="text-4xl">
                        {master.display_name?.charAt(0) || 'M'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                
                <div className="p-6 space-y-4">
                  <div>
                    <h1 className="text-2xl font-bold mb-2">{master.display_name}</h1>
                    {master.specialization && master.specialization.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {master.specialization.map((spec: string, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Experience</span>
                      <span className="font-semibold">{master.experience_years || 0} years</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Rating</span>
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-500 fill-current mr-1" />
                        <span className="font-semibold">{master.rating?.toFixed(1) || '5.0'}</span>
                        <span className="text-sm text-gray-500 ml-1">({master.reviews_count || 0})</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
                      <span className="font-semibold">{master.completed_bookings || 0} cuts</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full"
                    size="lg"
                    onClick={() => setBookingModalOpen(true)}
                    style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                  >
                    Book Appointment
                  </Button>
                </div>
              </Card>
            </motion.div>

            {/* Main Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:col-span-2"
            >
              <Tabs defaultValue="about" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="about">About</TabsTrigger>
                  <TabsTrigger value="services">Services</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="reviews">Reviews</TabsTrigger>
                </TabsList>

                {/* About Tab */}
                <TabsContent value="about" className="space-y-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">About {master.display_name}</h3>
                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line">
                      {master.description || 'Professional barber with years of experience in modern and classic haircuts.'}
                    </p>
                  </Card>

                  {/* Achievements */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Achievements</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start space-x-3">
                        <Award className="h-5 w-5 text-[var(--primary)] mt-1" />
                        <div>
                          <p className="font-medium">Top Rated</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Consistently rated 5 stars
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <TrendingUp className="h-5 w-5 text-[var(--primary)] mt-1" />
                        <div>
                          <p className="font-medium">Most Booked</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Popular choice among clients
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Users className="h-5 w-5 text-[var(--primary)] mt-1" />
                        <div>
                          <p className="font-medium">Loyal Clients</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            High return customer rate
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-[var(--primary)] mt-1" />
                        <div>
                          <p className="font-medium">Certified Professional</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Licensed and insured
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* Services Tab */}
                <TabsContent value="services">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Available Services</h3>
                    <div className="space-y-3">
                      {services.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:border-[var(--primary)] transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedService(service)
                            setBookingModalOpen(true)
                          }}
                        >
                          <div className="flex-1">
                            <h4 className="font-medium">{service.name}</h4>
                            {service.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {service.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-4 mt-2 text-sm">
                              <span className="flex items-center text-gray-500">
                                <Clock className="h-3 w-3 mr-1" />
                                {service.duration} min
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-[var(--primary)]">
                              ${service.price}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="schedule">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Weekly Schedule</h3>
                    <div className="grid grid-cols-7 gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                        const daySchedule = schedule.find(s => s.day_of_week === idx)
                        const isWorking = daySchedule?.is_working

                        return (
                          <div key={day} className="text-center">
                            <p className="text-sm font-medium mb-2">{day}</p>
                            {isWorking ? (
                              <div className="text-xs space-y-1">
                                <p className="text-green-600 dark:text-green-400">Open</p>
                                <p>{daySchedule.start_time}</p>
                                <p>to</p>
                                <p>{daySchedule.end_time}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Closed</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                </TabsContent>

                {/* Reviews Tab */}
                <TabsContent value="reviews" className="space-y-6">
                  {/* Review Statistics */}
                  <Card className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Overall Rating</h3>
                        <div className="flex items-center space-x-4">
                          <div>
                            <p className="text-5xl font-bold">{reviewStats.average?.toFixed(1) || '5.0'}</p>
                            <div className="flex items-center mt-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-5 w-5 ${
                                    star <= Math.round(reviewStats.average || 5)
                                      ? 'text-yellow-500 fill-current'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Based on {reviewStats.total || 0} reviews
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-4">Rating Distribution</h3>
                        <div className="space-y-2">
                          {[5, 4, 3, 2, 1].map((rating) => {
                            const count = ratingDistribution[rating] || 0
                            const percentage = reviewStats.total > 0 
                              ? (count / reviewStats.total) * 100 
                              : 0

                            return (
                              <div key={rating} className="flex items-center space-x-3">
                                <span className="text-sm w-3">{rating}</span>
                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                <Progress 
                                  value={percentage} 
                                  className="flex-1 h-2"
                                />
                                <span className="text-sm text-gray-600 dark:text-gray-400 w-10 text-right">
                                  {count}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Reviews List */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Client Reviews</h3>
                    {reviews.length > 0 ? (
                      <div className="space-y-4">
                        {reviews.map((review) => (
                          <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3">
                                <Avatar>
                                  <AvatarFallback>
                                    {review.client_name?.charAt(0) || 'C'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <p className="font-medium">{review.client_name}</p>
                                    <div className="flex items-center">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          className={`h-3 w-3 ${
                                            star <= review.rating
                                              ? 'text-yellow-500 fill-current'
                                              : 'text-gray-300'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {format(parseISO(review.created_at), 'MMM dd, yyyy')}
                                  </p>
                                  {review.comment && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                      {review.comment}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Pagination */}
                        {reviewStats.total > 10 && (
                          <div className="flex justify-center space-x-2 pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentReviewPage(p => Math.max(1, p - 1))}
                              disabled={currentReviewPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="flex items-center px-3 text-sm">
                              Page {currentReviewPage} of {Math.ceil(reviewStats.total / 10)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentReviewPage(p => p + 1)}
                              disabled={currentReviewPage >= Math.ceil(reviewStats.total / 10)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Star className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No reviews yet</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Be the first to review {master.display_name}
                        </p>
                      </div>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Booking Modal */}
      {tenant && (
        <BookingModal
          isOpen={bookingModalOpen}
          onClose={() => {
            setBookingModalOpen(false)
            setSelectedService(null)
          }}
          mode="master"
          tenant={tenant}
          masters={[master]}
          services={services}
          preselectedMaster={master}
          preselectedService={selectedService}
        />
      )}
    </div>
  )
}