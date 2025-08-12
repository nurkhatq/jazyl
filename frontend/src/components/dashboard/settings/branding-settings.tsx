'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import api, { updateTenant } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export function BrandingSettings() {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  
  const [formData, setFormData] = useState({
    logo_url: '',
    primary_color: '#000000',
    secondary_color: '#FFFFFF',
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
        logo_url: tenant.logo_url || '',
        primary_color: tenant.primary_color || '#000000',
        secondary_color: tenant.secondary_color || '#FFFFFF',
      })
    }
  }, [tenant])

  const mutation = useMutation({
    mutationFn: (data: any) => updateTenant(user?.tenant_id || '', data),
    onSuccess: () => {
      toast({
        title: 'Branding Updated',
        description: 'Your branding settings have been updated.',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update branding. Please try again.',
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
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Customize your barbershop's appearance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input
              id="logo_url"
              type="url"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter the URL of your logo image
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="secondary_color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary_color"
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          
          <div className="p-4 border rounded-lg">
            <p className="text-sm font-medium mb-2">Preview</p>
            <div className="flex items-center gap-4">
              <div
                className="w-24 h-24 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: formData.primary_color }}
              >
                Primary
              </div>
              <div
                className="w-24 h-24 rounded-lg flex items-center justify-center border font-bold"
                style={{ backgroundColor: formData.secondary_color }}
              >
                Secondary
              </div>
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