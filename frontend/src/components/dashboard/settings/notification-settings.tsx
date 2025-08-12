'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import api, { updateTenant } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export function NotificationSettings() {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  
  const [settings, setSettings] = useState({
    email_enabled: true,
    sms_enabled: false,
    reminder_hours: [24, 2],
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
    if (tenant?.notification_settings) {
      setSettings(tenant.notification_settings)
    }
  }, [tenant])

  const mutation = useMutation({
    mutationFn: (data: any) => updateTenant(user?.tenant_id || '', {
      notification_settings: data
    }),
    onSuccess: () => {
      toast({
        title: 'Settings Updated',
        description: 'Notification settings have been updated.',
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
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Configure how clients receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email_enabled">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send booking confirmations and reminders via email
                </p>
              </div>
              <Switch
                id="email_enabled"
                checked={settings.email_enabled}
                onCheckedChange={(checked) => setSettings({
                  ...settings,
                  email_enabled: checked
                })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sms_enabled">SMS Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send booking reminders via SMS (requires setup)
                </p>
              </div>
              <Switch
                id="sms_enabled"
                checked={settings.sms_enabled}
                onCheckedChange={(checked) => setSettings({
                  ...settings,
                  sms_enabled: checked
                })}
                disabled
              />
            </div>
          </div>
          
          <div>
            <Label>Reminder Schedule</Label>
            <p className="text-xs text-muted-foreground mb-3">
              When to send booking reminders
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.reminder_hours.includes(24)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSettings({
                        ...settings,
                        reminder_hours: [...settings.reminder_hours, 24]
                      })
                    } else {
                      setSettings({
                        ...settings,
                        reminder_hours: settings.reminder_hours.filter(h => h !== 24)
                      })
                    }
                  }}
                />
                <Label>24 hours before appointment</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.reminder_hours.includes(2)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSettings({
                        ...settings,
                        reminder_hours: [...settings.reminder_hours, 2]
                      })
                    } else {
                      setSettings({
                        ...settings,
                        reminder_hours: settings.reminder_hours.filter(h => h !== 2)
                      })
                    }
                  }}
                />
                <Label>2 hours before appointment</Label>
              </div>
            </div>
          </div>
          
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}