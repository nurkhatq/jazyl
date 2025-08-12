'use client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import api, { updateTenant } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export function BookingSettings() {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  
  const [settings, setSettings] = useState({
    min_advance_hours: 2,
    max_advance_days: 30,
    slot_duration: 30,
    allow_cancellation: true,
    cancellation_hours: 2,
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
    if (tenant?.booking_settings) {
      setSettings(tenant.booking_settings)
    }
  }, [tenant])

  const mutation = useMutation({
    mutationFn: (data: any) => updateTenant(user?.tenant_id || '', {
      booking_settings: data
    }),
    onSuccess: () => {
      toast({
        title: 'Settings Updated',
        description: 'Booking settings have been updated.',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update settings.',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(settings)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Rules</CardTitle>
        <CardDescription>
          Configure how clients can book appointments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="min_advance_hours">
              Minimum advance booking (hours)
            </Label>
            <Input
              id="min_advance_hours"
              type="number"
              value={settings.min_advance_hours}
              onChange={(e) => setSettings({
                ...settings,
                min_advance_hours: parseInt(e.target.value)
              })}
              min="0"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              How many hours in advance clients must book
            </p>
          </div>
          
          <div>
            <Label htmlFor="max_advance_days">
              Maximum advance booking (days)
            </Label>
            <Input
              id="max_advance_days"
              type="number"
              value={settings.max_advance_days}
              onChange={(e) => setSettings({
                ...settings,
                max_advance_days: parseInt(e.target.value)
              })}
              min="1"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              How far in advance clients can book
            </p>
          </div>
          
          <div>
            <Label htmlFor="slot_duration">
              Time slot duration (minutes)
            </Label>
            <Select
              value={settings.slot_duration.toString()}
              onValueChange={(value) => setSettings({
                ...settings,
                slot_duration: parseInt(value)
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="allow_cancellation">
                Allow cancellations
              </Label>
              <p className="text-xs text-muted-foreground">
                Let clients cancel their bookings
              </p>
            </div>
            <Switch
              id="allow_cancellation"
              checked={settings.allow_cancellation}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                allow_cancellation: checked
              })}
            />
          </div>
          
          {settings.allow_cancellation && (
            <div>
              <Label htmlFor="cancellation_hours">
                Cancellation deadline (hours before)
              </Label>
              <Input
                id="cancellation_hours"
                type="number"
                value={settings.cancellation_hours}
                onChange={(e) => setSettings({
                  ...settings,
                  cancellation_hours: parseInt(e.target.value)
                })}
                min="0"
                required
              />
            </div>
          )}
          
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}