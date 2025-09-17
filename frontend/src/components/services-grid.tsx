// frontend/src/components/services-grid.tsx
'use client'

import { motion } from 'framer-motion'
import { Clock, DollarSign, Scissors, ChevronRight, Sparkles, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ServicesGridProps {
  services: any[]
  onSelectService: (service: any) => void
}

export default function ServicesGrid({ services, onSelectService }: ServicesGridProps) {
  if (!services || services.length === 0) {
    return (
      <div className="text-center py-12">
        <Scissors className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No services available</p>
      </div>
    )
  }

  // Group services by category if available, fallback to 'General'
  const categories = Array.from(
    new Set(services.map(s => s?.category || 'General'))
  );

  return (
    <div className="space-y-8">
      {categories.map((category) => {
        const categoryServices = services.filter(s => (s.category || 'General') === category)
        
        return (
          <div key={category}>
            {categories.length > 1 && (
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-[var(--primary)]" />
                {category}
              </h3>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryServices.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-300 group h-full">
                    {/* Popular Badge */}
                    {service.is_popular && (
                      <Badge className="absolute top-3 right-3 z-10" style={{ backgroundColor: 'var(--primary)' }}>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Popular
                      </Badge>
                    )}

                    <div className="p-6">
                      {/* Service Name & Description */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-lg mb-2 group-hover:text-[var(--primary)] transition">
                          {service.name}
                        </h4>
                        {service.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {service.description}
                          </p>
                        )}
                      </div>

                      {/* Service Details */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <Clock className="h-4 w-4 mr-2" />
                            <span className="text-sm">{service.duration} min</span>
                          </div>
                          <div className="flex items-center font-bold text-lg">
                            <DollarSign className="h-5 w-5 text-[var(--primary)]" />
                            <span style={{ color: 'var(--primary)' }}>{service.price}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <Button 
                        className="w-full group-hover:scale-[1.02] transition-transform"
                        variant="outline"
                        onClick={() => onSelectService(service)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)'
                          e.currentTarget.style.color = 'var(--primary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = ''
                          e.currentTarget.style.color = ''
                        }}
                      >
                        Select & Book
                        <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition" />
                      </Button>
                    </div>

                    {/* Decorative gradient */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ 
                        backgroundImage: `linear-gradient(to right, var(--primary), var(--secondary))` 
                      }}
                    />
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}