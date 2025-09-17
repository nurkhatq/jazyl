// frontend/src/components/masters-showcase.tsx
'use client'

import { motion } from 'framer-motion'
import { Star, Award, Clock, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getImageUrl } from '@/lib/api'

interface MastersShowcaseProps {
  masters: any[]
  onSelectMaster: (master: any) => void
}

export default function MastersShowcase({ masters, onSelectMaster }: MastersShowcaseProps) {
  if (!masters || masters.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No masters available</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {masters.map((master, index) => (
        <motion.div
          key={master.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ y: -5 }}
        >
          <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 h-full">
            {/* Image */}
            <div className="relative h-64 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
              {master.photo_url ? (
                <img
                  src={getImageUrl(master.photo_url) || master.photo_url}
                  alt={master.display_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center ${master.photo_url ? 'hidden' : ''}`}>
                <User className="h-20 w-20 text-gray-400" />
              </div>
              
              {/* Rating Badge */}
              {master.rating > 0 && (
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-full flex items-center space-x-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{master.rating.toFixed(1)}</span>
                </div>
              )}

              {/* Experience Badge */}
              {master.experience_years > 0 && (
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-full flex items-center space-x-1">
                  <Award className="h-3 w-3" />
                  <span className="text-sm">{master.experience_years}y exp</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-2">{master.display_name}</h3>
              
              {/* Specializations */}
              {master.specialization && master.specialization.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {master.specialization.slice(0, 3).map((spec: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {spec}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Description */}
              {master.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {master.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3 text-sm text-gray-500">
                  {master.reviews_count > 0 && (
                    <span>{master.reviews_count} reviews</span>
                  )}
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Available
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button 
                  className="w-full"
                  onClick={() => onSelectMaster(master)}
                  style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  Book Now
                </Button>
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.open(`/master/${master.id}`, '_blank')
                  }}
                >
                  View Profile
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}