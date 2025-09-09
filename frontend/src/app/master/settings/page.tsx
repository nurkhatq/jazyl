'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { 
  Settings, 
  Bell, 
  Clock, 
  Shield, 
  Moon, 
  Sun,
  Globe,
  Smartphone,
  Mail,
  MessageSquare,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Calendar,
  DollarSign,
  User,
  Save
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function MasterSettingsPage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // Settings states
  const [settings, setSettings] = useState({
    // Notification preferences
    notifications: {
      email_bookings: true,
      sms_bookings: false,
      push_bookings: true,
      email_cancellations: true,
      sms_cancellations: true,
      push_cancellations: true,
      email_reminders: false,
      sms_reminders: false,
      push_reminders: true,
      email_marketing: false,
      sound_enabled: true
    },
    
    // Booking preferences
    booking: {
      auto_accept: false,
      advance_booking_limit: 30, // days
      buffer_time: 15, // minutes
      allow_same_day: true,
      require_phone: false,
      require_notes: false,
      cancellation_window: 24 // hours
    },
    
    // Privacy settings
    privacy: {
      show_phone: false,
      show_last_name: true,
      show_rating: true,
      show_reviews: true,
      allow_photos: true
    },
    
    // Working hours
    working_hours: {
      monday: { enabled: true, start: '09:00', end: '18:00' },
      tuesday: { enabled: true, start: '09:00', end: '18:00' },
      wednesday: { enabled: true, start: '09:00', end: '18:00' },
      thursday: { enabled: true, start: '09:00', end: '18:00' },
      friday: { enabled: true, start: '09:00', end: '18:00' },
      saturday: { enabled: true, start: '10:00', end: '16:00' },
      sunday: { enabled: false, start: '10:00', end: '16:00' }
    },
    
    // Interface preferences
    interface: {
      theme: 'light', // light, dark, system
      language: 'en',
      timezone: 'UTC',
      date_format: 'MM/DD/YYYY',
      time_format: '12' // 12 or 24
    }
  })

  // Получаем текущие настройки мастера
  const { data: masterSettings, isLoading } = useQuery({
    queryKey: ['master-settings', user?.id],
    queryFn: async () => {
      try {
        const response = await api.get('/api/masters/my-settings')
        return response.data
      } catch (error) {
        // Если настроек нет, используем дефолтные
        return settings
      }
    },
    enabled: !!user?.id,
  })

  // Обновление настроек
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const response = await api.put('/api/masters/my-settings', newSettings)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Settings updated successfully"
      })
      queryClient.invalidateQueries({ queryKey: ['master-settings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update settings",
        variant: "destructive"
      })
    }
  })

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(settings)
  }

  const updateSetting = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }))
  }

  const weekdays = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ]
const generateTimeSlots = (): string[] => {
    const slots: string[] = []
    for (let hour = 9; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(time)
    }
    }
    return slots
}

  const timeSlots: string[] = generateTimeSlots()
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      timeSlots.push(time)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your preferences and account settings
          </p>
        </div>
        <Button
          onClick={handleSaveSettings}
          disabled={updateSettingsMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="booking">Booking</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="interface">Interface</TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose how you want to be notified about bookings and updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Booking Notifications */}
              <div>
                <h4 className="text-sm font-medium mb-4">New Bookings</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label>Email notifications</Label>
                        <p className="text-sm text-muted-foreground">Get emails for new bookings</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.email_bookings}
                      onCheckedChange={(checked) => updateSetting('notifications', 'email_bookings', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label>SMS notifications</Label>
                        <p className="text-sm text-muted-foreground">Get text messages for new bookings</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.sms_bookings}
                      onCheckedChange={(checked) => updateSetting('notifications', 'sms_bookings', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label>Push notifications</Label>
                        <p className="text-sm text-muted-foreground">Get push notifications in the app</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.push_bookings}
                      onCheckedChange={(checked) => updateSetting('notifications', 'push_bookings', checked)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Cancellation Notifications */}
              <div>
                <h4 className="text-sm font-medium mb-4">Cancellations</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Label>Email for cancellations</Label>
                    </div>
                    <Switch
                      checked={settings.notifications.email_cancellations}
                      onCheckedChange={(checked) => updateSetting('notifications', 'email_cancellations', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <Label>SMS for cancellations</Label>
                    </div>
                    <Switch
                      checked={settings.notifications.sms_cancellations}
                      onCheckedChange={(checked) => updateSetting('notifications', 'sms_cancellations', checked)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Sound Settings */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings.notifications.sound_enabled ? (
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <Label>Sound notifications</Label>
                    <p className="text-sm text-muted-foreground">Play sounds for notifications</p>
                  </div>
                </div>
                <Switch
                  checked={settings.notifications.sound_enabled}
                  onCheckedChange={(checked) => updateSetting('notifications', 'sound_enabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Settings Tab */}
        <TabsContent value="booking">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Booking Preferences
              </CardTitle>
              <CardDescription>
                Control how clients can book appointments with you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-accept bookings</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically confirm new bookings without manual approval
                  </p>
                </div>
                <Switch
                  checked={settings.booking.auto_accept}
                  onCheckedChange={(checked) => updateSetting('booking', 'auto_accept', checked)}
                />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="advance_limit">Advance booking limit (days)</Label>
                  <Input
                    id="advance_limit"
                    type="number"
                    value={settings.booking.advance_booking_limit}
                    onChange={(e) => updateSetting('booking', 'advance_booking_limit', parseInt(e.target.value))}
                    min="1"
                    max="365"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How far in advance clients can book
                  </p>
                </div>

                <div>
                  <Label htmlFor="buffer_time">Buffer time (minutes)</Label>
                  <Select
                    value={settings.booking.buffer_time.toString()}
                    onValueChange={(value) => updateSetting('booking', 'buffer_time', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No buffer</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Time between appointments
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="cancellation_window">Cancellation window (hours)</Label>
                <Input
                  id="cancellation_window"
                  type="number"
                  value={settings.booking.cancellation_window}
                  onChange={(e) => updateSetting('booking', 'cancellation_window', parseInt(e.target.value))}
                  min="0"
                  max="168"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum time before appointment that clients can cancel
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Allow same-day bookings</Label>
                  <Switch
                    checked={settings.booking.allow_same_day}
                    onCheckedChange={(checked) => updateSetting('booking', 'allow_same_day', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Require phone number</Label>
                  <Switch
                    checked={settings.booking.require_phone}
                    onCheckedChange={(checked) => updateSetting('booking', 'require_phone', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Require booking notes</Label>
                  <Switch
                    checked={settings.booking.require_notes}
                    onCheckedChange={(checked) => updateSetting('booking', 'require_notes', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Working Hours
              </CardTitle>
              <CardDescription>
                Set your default working schedule
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weekdays.map(day => (
                  <div key={day.key} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="w-20">
                      <Switch
                        checked={settings.working_hours[day.key as keyof typeof settings.working_hours].enabled}
                        onCheckedChange={(checked) => {
                          setSettings(prev => ({
                            ...prev,
                            working_hours: {
                              ...prev.working_hours,
                              [day.key]: {
                                ...prev.working_hours[day.key as keyof typeof prev.working_hours],
                                enabled: checked
                              }
                            }
                          }))
                        }}
                      />
                    </div>
                    
                    <div className="w-24 font-medium">
                      {day.label}
                    </div>

                    {settings.working_hours[day.key as keyof typeof settings.working_hours].enabled ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Select
                          value={settings.working_hours[day.key as keyof typeof settings.working_hours].start}
                          onValueChange={(value) => {
                            setSettings(prev => ({
                              ...prev,
                              working_hours: {
                                ...prev.working_hours,
                                [day.key]: {
                                  ...prev.working_hours[day.key as keyof typeof prev.working_hours],
                                  start: value
                                }
                              }
                            }))
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.slice(0, 48).map(time => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <span className="text-muted-foreground">to</span>

                        <Select
                          value={settings.working_hours[day.key as keyof typeof settings.working_hours].end}
                          onValueChange={(value) => {
                            setSettings(prev => ({
                              ...prev,
                              working_hours: {
                                ...prev.working_hours,
                                [day.key]: {
                                  ...prev.working_hours[day.key as keyof typeof prev.working_hours],
                                  end: value
                                }
                              }
                            }))
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.slice(0, 48).map((time: string) => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex-1 text-muted-foreground">
                        Closed
                      </div>
                    )}
                    </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy Settings
              </CardTitle>
              <CardDescription>
                Control what information is visible to clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings.privacy.show_phone ? (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <Label>Show phone number</Label>
                    <p className="text-sm text-muted-foreground">
                      Display your phone number on your public profile
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.privacy.show_phone}
                  onCheckedChange={(checked) => updateSetting('privacy', 'show_phone', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Show full name</Label>
                    <p className="text-sm text-muted-foreground">
                      Display your last name to clients
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.privacy.show_last_name}
                  onCheckedChange={(checked) => updateSetting('privacy', 'show_last_name', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Show rating and reviews</Label>
                  <p className="text-sm text-muted-foreground">
                    Display your rating and client reviews
                  </p>
                </div>
                <Switch
                  checked={settings.privacy.show_rating}
                  onCheckedChange={(checked) => updateSetting('privacy', 'show_rating', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Show individual reviews</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow clients to see detailed reviews from others
                  </p>
                </div>
                <Switch
                  checked={settings.privacy.show_reviews}
                  onCheckedChange={(checked) => updateSetting('privacy', 'show_reviews', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow profile photos</Label>
                  <p className="text-sm text-muted-foreground">
                    Let clients upload photos with their reviews
                  </p>
                </div>
                <Switch
                  checked={settings.privacy.allow_photos}
                  onCheckedChange={(checked) => updateSetting('privacy', 'allow_photos', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interface Tab */}
        <TabsContent value="interface">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Interface Preferences
              </CardTitle>
              <CardDescription>
                Customize your app experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Settings */}
              <div>
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={settings.interface.theme}
                  onValueChange={(value) => updateSetting('interface', 'theme', value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose your preferred color scheme
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={settings.interface.language}
                    onValueChange={(value) => updateSetting('interface', 'language', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="kz">Қазақша</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.interface.timezone}
                    onValueChange={(value) => updateSetting('interface', 'timezone', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Asia/Almaty">Asia/Almaty</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="date_format">Date Format</Label>
                  <Select
                    value={settings.interface.date_format}
                    onValueChange={(value) => updateSetting('interface', 'date_format', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="DD MMM YYYY">DD MMM YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="time_format">Time Format</Label>
                  <Select
                    value={settings.interface.time_format}
                    onValueChange={(value) => updateSetting('interface', 'time_format', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12-hour (AM/PM)</SelectItem>
                      <SelectItem value="24">24-hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Security */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account Security
              </CardTitle>
              <CardDescription>
                Manage your account security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Change Password</h4>
                  <p className="text-sm text-muted-foreground">
                    Update your account password
                  </p>
                </div>
                <Button variant="outline">
                  Change Password
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Two-Factor Authentication</h4>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Button variant="outline">
                  Enable 2FA
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Login History</h4>
                  <p className="text-sm text-muted-foreground">
                    View your recent login activity
                  </p>
                </div>
                <Button variant="outline">
                  View History
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            These actions cannot be undone. Please proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
            <div>
              <h4 className="font-medium text-red-600">Deactivate Account</h4>
              <p className="text-sm text-muted-foreground">
                Temporarily disable your account and stop receiving bookings
              </p>
            </div>
            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
              Deactivate
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
            <div>
              <h4 className="font-medium text-red-600">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="destructive">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Footer */}
      <div className="flex items-center justify-between p-6 bg-gray-50 rounded-lg">
        <div>
          <h4 className="font-medium">Need Help?</h4>
          <p className="text-sm text-muted-foreground">
            Contact support if you have questions about these settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            Contact Support
          </Button>
          <Button variant="outline">
            View Documentation
          </Button>
        </div>
      </div>
    </div>
  )
}