'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTenantBySubdomain, getPublicMasters, getPublicServices, getImageUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookingFlow } from '@/components/booking/booking-flow'
import { Clock, MapPin, Phone, Star, Calendar } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export default function BarbershopPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [masters, setMasters] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBooking, setShowBooking] = useState(false)
  const [selectedMaster, setSelectedMaster] = useState<any>(null)
  const [selectedService, setSelectedService] = useState<any>(null)

  useEffect(() => {
    const loadBarbershopData = async () => {
      try {
        // Получаем поддомен из URL
        const hostname = window.location.hostname
        const subdomain = hostname.split('.')[0]
        
        if (subdomain === 'jazyl' || subdomain === 'www') {
          router.push('/platform')
          return
        }

        // Загружаем данные барбершопа
        const tenantData = await getTenantBySubdomain(subdomain)
        setTenant(tenantData)
        
        // Применяем брендинг
        if (tenantData.primary_color) {
          document.documentElement.style.setProperty('--primary', tenantData.primary_color)
        }
        if (tenantData.secondary_color) {
          document.documentElement.style.setProperty('--secondary', tenantData.secondary_color)
        }
        
        // Загружаем мастеров и услуги
        const [mastersData, servicesData] = await Promise.all([
          getPublicMasters(),
          getPublicServices()
        ])
        
        setMasters(mastersData.filter((m: any) => m.is_active && m.is_visible))
        setServices(servicesData.filter((s: any) => s.is_active))
      } catch (error) {
        console.error('Failed to load barbershop:', error)
        router.push('/404')
      } finally {
        setLoading(false)
      }
    }

    loadBarbershopData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200"></div>
          <div className="container mx-auto px-4 py-8">
            <Skeleton className="h-12 w-64 mb-4" />
            <Skeleton className="h-6 w-96" />
          </div>
        </div>
      </div>
    )
  }

  if (!tenant) return null

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="relative h-64 bg-gradient-to-r from-gray-900 to-gray-700 text-white">
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div>
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt={tenant.name} className="h-20 mb-4" />
            )}
            <h1 className="text-4xl font-bold mb-2">{tenant.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {tenant.address}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <a href={`tel:${tenant.phone}`}>{tenant.phone}</a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Booking CTA */}
      <section className="bg-gray-50 py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Ready to Book?</h2>
              <p className="text-gray-600">Choose your preferred time and service</p>
            </div>
            <Button 
              size="lg" 
              className="px-8"
              onClick={() => {
                setShowBooking(!showBooking)
                if (!showBooking) {
                  // Scroll to booking section when opening
                  setTimeout(() => {
                    const bookingSection = document.querySelector('[data-booking-section]')
                    if (bookingSection) {
                      bookingSection.scrollIntoView({ behavior: 'smooth' })
                    }
                  }, 100)
                }
              }}
            >
              <Calendar className="mr-2 h-5 w-5" />
              Book Appointment
            </Button>
          </div>
        </div>
      </section>

      {/* Booking Section */}
      {showBooking && (
        <section className="py-12 bg-white border-b min-h-screen" data-booking-section>
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBooking(false)}
                  className="mb-4"
                >
                  ← Back to Barbershop
                </Button>
              </div>
              <BookingFlow 
                tenantId={tenant.id}
                preselectedMaster={selectedMaster}
                preselectedService={selectedService}
                isPublic={true}
              />
            </div>
          </div>
        </section>
      )}

      {/* Our Masters */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Masters</h2>
          
          {masters.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {masters.map((master) => (
                <Card key={master.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {master.photo_url && (
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={getImageUrl(master.photo_url) || master.photo_url} 
                        alt={master.display_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide image and show placeholder if it fails to load
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>{master.display_name}</CardTitle>
                    {master.specialization && master.specialization.length > 0 && (
                      <CardDescription>
                        {master.specialization.join(', ')}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {master.rating > 0 && (
                      <div className="flex items-center gap-2 mb-4">
                        <Star className="h-5 w-5 text-yellow-500 fill-current" />
                        <span className="font-semibold">{master.rating.toFixed(1)}</span>
                        <span className="text-gray-500">({master.reviews_count} reviews)</span>
                      </div>
                    )}
                    {master.description && (
                      <p className="text-gray-600 mb-4">{master.description}</p>
                    )}
                    <div className="space-y-2">
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedMaster(master)
                          setShowBooking(true)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        Book with {master.display_name.split(' ')[0]}
                      </Button>
                      <Button 
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const subdomain = window.location.hostname.split('.')[0]
                          window.open(`/master/${master.id}?subdomain=${subdomain}`, '_blank')
                        }}
                      >
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">No masters available at the moment</p>
          )}
        </div>
      </section>

      {/* Our Services */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Services</h2>
          
          {services.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <Card key={service.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      {service.is_popular && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          Popular
                        </span>
                      )}
                    </div>
                    {service.description && (
                      <CardDescription>{service.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>{service.duration} min</span>
                      </div>
                      <div className="text-2xl font-bold">
                        ${service.price}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setSelectedService(service)
                        setShowBooking(true)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      Book This Service
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">No services available at the moment</p>
          )}
        </div>
      </section>

      {/* Working Hours */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Working Hours</h2>
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6">
              <div className="space-y-3">
                {Object.entries(tenant.working_hours || {}).map(([day, hours]: [string, any]) => (
                  <div key={day} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="font-medium capitalize">{day}</span>
                    <span className="text-gray-600">
                      {hours.open} - {hours.close}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-bold text-lg">{tenant.name}</h3>
              <p className="text-gray-400">{tenant.address}</p>
              <p className="text-gray-400">{tenant.phone}</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-gray-400">
                Powered by{' '}
                <a href="https://jazyl.tech" className="text-white hover:underline">
                  Jazyl
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}