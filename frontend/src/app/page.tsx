// frontend/src/app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTenantBySubdomain, getPublicMasters, getPublicServices } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Calendar, Clock, User, Star, ChevronRight, MapPin, Phone, Mail, Award, Scissors } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import BookingModal from '@/components/booking/booking-modal'
import MastersShowcase from '@/components/masters-showcase'
import ServicesGrid from '@/components/services-grid'

export default function Home() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [masters, setMasters] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [bookingMode, setBookingMode] = useState<'date' | 'master' | 'service' | null>(null)
  const [selectedMaster, setSelectedMaster] = useState<any>(null)
  const [selectedService, setSelectedService] = useState<any>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const subdomain = window.location.hostname.split('.')[0]
        
        if (subdomain === 'jazyl' || subdomain === 'www' || subdomain === 'localhost') {
          router.push('/platform')
          return
        }

        const tenantData = await getTenantBySubdomain(subdomain)
        setTenant(tenantData)
        
        // Apply branding colors
        if (tenantData.primary_color) {
          document.documentElement.style.setProperty('--primary', tenantData.primary_color)
        }
        if (tenantData.secondary_color) {
          document.documentElement.style.setProperty('--secondary', tenantData.secondary_color)
        }

        // Load masters and services using public API
        const [mastersData, servicesData] = await Promise.all([
          getPublicMasters(),
          getPublicServices()
        ])
        setMasters(mastersData || [])
        setServices(servicesData || [])
      } catch (error) {
        console.error('Failed to load:', error)
        router.push('/404')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (!tenant) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Modern Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.name} className="h-10 md:h-12 w-auto" />
              ) : (
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center">
                  <Scissors className="h-6 w-6 md:h-7 md:w-7 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]">
                  {tenant.name}
                </h1>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Premium Barbershop</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <a href={`tel:${tenant.phone}`} className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-[var(--primary)] transition">
                <Phone className="h-4 w-4" />
                <span>{tenant.phone}</span>
              </a>
              {tenant.address && (
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                  <MapPin className="h-4 w-4" />
                  <span className="max-w-[200px] truncate">{tenant.address}</span>
                </div>
              )}
            </div>
            <Button 
              className="md:hidden"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
              onClick={() => setBookingMode('date')}
            >
              Book Now
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/10 via-transparent to-[var(--secondary)]/10" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="container mx-auto px-4 relative z-10"
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300"
            >
              Your Style, Our Craft
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-12"
            >
              Book your perfect appointment in seconds. Choose your preferred way to book.
            </motion.p>
            
            {/* Booking Options Cards */}
            <div className="grid md:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card 
                  className="p-6 cursor-pointer hover:shadow-xl transition-all border-2 hover:border-[var(--primary)] group"
                  onClick={() => setBookingMode('date')}
                >
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-[var(--primary)] group-hover:scale-110 transition" />
                  <h3 className="font-semibold text-lg mb-2">By Date & Time</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose your preferred date and see available masters
                  </p>
                  <ChevronRight className="h-5 w-5 mx-auto mt-4 text-gray-400 group-hover:text-[var(--primary)] group-hover:translate-x-1 transition" />
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card 
                  className="p-6 cursor-pointer hover:shadow-xl transition-all border-2 hover:border-[var(--primary)] group"
                  onClick={() => setBookingMode('master')}
                >
                  <User className="h-12 w-12 mx-auto mb-4 text-[var(--primary)] group-hover:scale-110 transition" />
                  <h3 className="font-semibold text-lg mb-2">By Master</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select your favorite master and their availability
                  </p>
                  <ChevronRight className="h-5 w-5 mx-auto mt-4 text-gray-400 group-hover:text-[var(--primary)] group-hover:translate-x-1 transition" />
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card 
                  className="p-6 cursor-pointer hover:shadow-xl transition-all border-2 hover:border-[var(--primary)] group"
                  onClick={() => setBookingMode('service')}
                >
                  <Scissors className="h-12 w-12 mx-auto mb-4 text-[var(--primary)] group-hover:scale-110 transition" />
                  <h3 className="font-semibold text-lg mb-2">By Service</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Pick a service and find available masters
                  </p>
                  <ChevronRight className="h-5 w-5 mx-auto mt-4 text-gray-400 group-hover:text-[var(--primary)] group-hover:translate-x-1 transition" />
                </Card>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Our Masters Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Expert Masters</h2>
            <p className="text-gray-600 dark:text-gray-400">Skilled professionals dedicated to your perfect look</p>
          </motion.div>
          <MastersShowcase 
            masters={masters} 
            onSelectMaster={(master) => {
              setSelectedMaster(master)
              setBookingMode('master')
            }}
          />
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Services</h2>
            <p className="text-gray-600 dark:text-gray-400">Premium grooming services tailored to your needs</p>
          </motion.div>
          <ServicesGrid 
            services={services}
            onSelectService={(service) => {
              setSelectedService(service)
              setBookingMode('service')
            }}
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gradient-to-r from-[var(--primary)]/10 to-[var(--secondary)]/10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <Award className="h-12 w-12 mx-auto mb-4 text-[var(--primary)]" />
              <h3 className="font-semibold text-lg mb-2">Premium Quality</h3>
              <p className="text-gray-600 dark:text-gray-400">Top-notch service with attention to detail</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <Clock className="h-12 w-12 mx-auto mb-4 text-[var(--primary)]" />
              <h3 className="font-semibold text-lg mb-2">Easy Booking</h3>
              <p className="text-gray-600 dark:text-gray-400">Book your appointment in just a few clicks</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <Star className="h-12 w-12 mx-auto mb-4 text-[var(--primary)]" />
              <h3 className="font-semibold text-lg mb-2">5-Star Service</h3>
              <p className="text-gray-600 dark:text-gray-400">Consistently rated excellent by our clients</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p>&copy; 2024 {tenant.name}. All rights reserved.</p>
            </div>
            <div className="flex space-x-6">
              {tenant.phone && (
                <a href={`tel:${tenant.phone}`} className="hover:text-[var(--primary)] transition">
                  <Phone className="h-5 w-5" />
                </a>
              )}
              {tenant.email && (
                <a href={`mailto:${tenant.email}`} className="hover:text-[var(--primary)] transition">
                  <Mail className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      <AnimatePresence>
        {bookingMode && (
          <BookingModal
            isOpen={!!bookingMode}
            onClose={() => {
              setBookingMode(null)
              setSelectedMaster(null)
              setSelectedService(null)
            }}
            mode={bookingMode}
            tenant={tenant}
            masters={masters}
            services={services}
            preselectedMaster={selectedMaster}
            preselectedService={selectedService}
          />
        )}
      </AnimatePresence>
    </div>
  )
}