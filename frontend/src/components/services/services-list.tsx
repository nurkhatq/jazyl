'use client'

import { useQuery } from '@tanstack/react-query'
import { getServices } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, DollarSign } from 'lucide-react'

interface ServicesListProps {
  tenantId: string
}

export function ServicesList({ tenantId }: ServicesListProps) {
  const { data: services, isLoading } = useQuery({
    queryKey: ['services', tenantId],
    queryFn: () => getServices(tenantId),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Group services by category
  const groupedServices = services?.reduce((acc: any, service: any) => {
    const category = service.category?.name || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(service)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      {Object.entries(groupedServices || {}).map(([category, categoryServices]: [string, any]) => (
        <div key={category}>
          <h4 className="text-xl font-semibold mb-4">{category}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryServices.map((service: any) => (
              <Card key={service.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>{service.duration} min</span>
                    </div>
                    <div className="flex items-center gap-1 font-semibold">
                      <DollarSign className="h-4 w-4" />
                      <span>{service.price}</span>
                    </div>
                  </div>
                  {service.is_popular && (
                    <div className="mt-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs">
                        Popular
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}