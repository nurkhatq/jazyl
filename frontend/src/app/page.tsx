'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTenantBySubdomain } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BookingFlow } from '@/components/booking/booking-flow'
import { MastersList } from '@/components/masters/masters-list'
import { ServicesList } from '@/components/services/services-list'

export default function Home() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTenant = async () => {
      try {
        const subdomain = window.location.hostname.split('.')[0]
        
        if (subdomain === 'jazyl' || subdomain === 'www') {
          // Main platform page
          router.push('/platform')
          return
        }

        const tenantData = await getTenantBySubdomain(subdomain)
        setTenant(tenantData)
        
        // Apply tenant branding
        if (tenantData.primary_color) {
          document.documentElement.style.setProperty('--primary', tenantData.primary_color)
        }
        if (tenantData.secondary_color) {
          document.documentElement.style.setProperty('--secondary', tenantData.secondary_color)
        }
      } catch (error) {
        console.error('Failed to load tenant:', error)
        router.push('/404')
      } finally {
        setLoading(false)
      }
    }

    loadTenant()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!tenant) {
    return null
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {tenant.logo_url && (
                <img src={tenant.logo_url} alt={tenant.name} className="h-12 w-auto" />
              )}
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a href={`tel:${tenant.phone}`} className="text-muted-foreground">
                {tenant.phone}
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Book Your Appointment</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Choose your preferred master and service, pick a convenient time
            </p>
            
            {/* Booking Options */}
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <Button
                size="lg"
                className="h-24 text-lg"
                onClick={() => document.getElementById('booking-by-master')?.scrollIntoView()}
              >
                <div>
                  <div className="font-semibold">Choose Master First</div>
                  <div className="text-sm opacity-80">See available masters and their schedules</div>
                </div>
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                className="h-24 text-lg"
                onClick={() => document.getElementById('booking-by-date')?.scrollIntoView()}
              >
                <div>
                  <div className="font-semibold">Choose Date First</div>
                  <div className="text-sm opacity-80">Pick a date and see available slots</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Flow */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <BookingFlow tenantId={tenant.id} />
        </div>
      </section>

      {/* Masters Section */}
      <section id="booking-by-master" className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl font-bold mb-8 text-center">Our Masters</h3>
          <MastersList tenantId={tenant.id} />
        </div>
      </section>

      {/* Services Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl font-bold mb-8 text-center">Our Services</h3>
          <ServicesList tenantId={tenant.id} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-muted-foreground">
            <p>{tenant.name}</p>
            <p>{tenant.address}</p>
            <p className="mt-4 text-sm">Powered by Jazyl</p>
          </div>
        </div>
      </footer>
    </div>
  )
}