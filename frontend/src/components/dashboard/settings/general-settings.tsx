'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import api, { updateTenant } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export function GeneralSettings() {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  })

  const { data: tenant } = useQuery({
    queryKey: ['tenant', user?.tenant_id],
    queryFn: async () => {
      const response = await api.get(`/api/tenants/${user?.tenant_id}`)
      return response.data
    },
    enabled: !!user?.tenant_id,
  })

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        address: tenant.address || '',
      })
    }
  }, [tenant])

  const mutation = useMutation({
    mutationFn: (data: any) => updateTenant(user?.tenant_id || '', data),
    onSuccess: () => {
      toast({
        title: 'Settings Updated',
        description: 'Your barbershop settings have been updated.',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update settings. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Information</CardTitle>
        <CardDescription>
          Update your barbershop's basic information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Barbershop Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="email">Contact Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              required
            />
          </div>
          
          <div>
            <Label>Subdomain</Label>
            <div className="mt-1 text-sm text-muted-foreground">
              {tenant?.subdomain}.jazyl.tech
            </div>
          </div>
          
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}