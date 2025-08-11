'use client'

import { useQuery } from '@tanstack/react-query'
import { getMasters } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface MastersListProps {
  tenantId: string
}

export function MastersList({ tenantId }: MastersListProps) {
  const { data: masters, isLoading } = useQuery({
    queryKey: ['masters', tenantId],
    queryFn: () => getMasters(tenantId),
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
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {masters?.map((master: any) => (
        <Card key={master.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>{master.display_name}</CardTitle>
          </CardHeader>
          <CardContent>
            {master.photo_url && (
              <img
                src={master.photo_url}
                alt={master.display_name}
                className="w-full h-48 object-cover rounded-md mb-4"
              />
            )}
            <div className="space-y-2">
              {master.specialization && master.specialization.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {master.specialization.map((spec: string) => (
                    <span
                      key={spec}
                      className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              )}
              {master.rating > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-semibold">{master.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground text-sm">
                    ({master.reviews_count} reviews)
                  </span>
                </div>
              )}
              {master.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {master.description}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}