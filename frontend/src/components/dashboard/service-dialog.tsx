'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createService, updateService } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

interface ServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: any
}

export function ServiceDialog({ open, onOpenChange, service }: ServiceDialogProps) {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    is_popular: false,
  })

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        price: service.price?.toString() || '',
        duration: service.duration?.toString() || '',
        is_popular: service.is_popular || false,
      })
    }
  }, [service])

  const mutation = useMutation({
    mutationFn: (data: any) =>
      service
        ? updateService(service.id, data)
        : createService(user?.tenant_id || '', data),
    onSuccess: () => {
      toast({
        title: service ? 'Service Updated' : 'Service Created',
        description: 'The service has been successfully saved.',
      })
      queryClient.invalidateQueries({ queryKey: ['services'] })
      onOpenChange(false)
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save service. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    mutation.mutate({
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      duration: parseInt(formData.duration),
      is_popular: formData.is_popular,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? 'Edit Service' : 'Add New Service'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Service Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="is_popular">Mark as Popular</Label>
            <Switch
              id="is_popular"
              checked={formData.is_popular}
              onCheckedChange={(checked) => setFormData({ ...formData, is_popular: checked })}
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}