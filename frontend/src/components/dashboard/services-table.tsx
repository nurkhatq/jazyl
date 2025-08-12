'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { getServices, updateService, deleteService } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Edit, Trash, Clock, DollarSign } from 'lucide-react'
import { useState } from 'react'
import { ServiceDialog } from './service-dialog'

export function ServicesTable() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [editingService, setEditingService] = useState<any>(null)
  
  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => getServices(user?.tenant_id || ''),
    enabled: !!user?.tenant_id,
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ serviceId, isActive }: { serviceId: string, isActive: boolean }) =>
      updateService(serviceId, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })

  if (isLoading) {
    return <div>Loading services...</div>
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Popular</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services?.map((service: any) => (
              <TableRow key={service.id}>
                <TableCell className="font-medium">{service.name}</TableCell>
                <TableCell>{service.category?.name || 'Uncategorized'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {service.duration} min
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {service.price}
                  </div>
                </TableCell>
                <TableCell>
                  {service.is_popular && (
                    <Badge variant="default">Popular</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={service.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ serviceId: service.id, isActive: checked })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingService(service)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(service.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!services || services.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No services found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {editingService && (
        <ServiceDialog
          open={!!editingService}
          onOpenChange={(open) => !open && setEditingService(null)}
          service={editingService}
        />
      )}
    </>
  )
}