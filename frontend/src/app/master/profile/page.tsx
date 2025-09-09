'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { 
  User, 
  Mail, 
  Phone, 
  Camera, 
  Star, 
  Users, 
  Clock,
  Save,
  Upload,
  Eye,
  EyeOff,
  Plus,
  X,
  Award,
  Calendar
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function MasterProfilePage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // Form states
  const [profileData, setProfileData] = useState({
    display_name: '',
    description: '',
    photo_url: '',
    specialization: [] as string[],
    is_active: true,
    is_visible: true,
    experience_years: 0,
    working_hours: {
      monday: { start: '09:00', end: '18:00', enabled: true },
      tuesday: { start: '09:00', end: '18:00', enabled: true },
      wednesday: { start: '09:00', end: '18:00', enabled: true },
      thursday: { start: '09:00', end: '18:00', enabled: true },
      friday: { start: '09:00', end: '18:00', enabled: true },
      saturday: { start: '10:00', end: '16:00', enabled: true },
      sunday: { start: '10:00', end: '16:00', enabled: false }
    }
  })
  
  const [newSpecialization, setNewSpecialization] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Получаем информацию о мастере
  const { data: masterInfo, isLoading } = useQuery({
    queryKey: ['master-info', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-profile')
      return response.data
    },
    enabled: !!user?.id,
  })

  // Получаем статистику
  const { data: stats } = useQuery({
    queryKey: ['master-stats'],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-stats')
      return response.data
    },
    enabled: !!user?.id,
  })

  // Получаем услуги мастера
  const { data: services } = useQuery({
    queryKey: ['master-services', masterInfo?.id],
    queryFn: async () => {
      if (!masterInfo?.id) return []
      const response = await api.get(`/api/masters/${masterInfo.id}/services`)
      return response.data
    },
    enabled: !!masterInfo?.id,
  })

  // Инициализация формы при загрузке данных
  useEffect(() => {
    if (masterInfo) {
      setProfileData({
        display_name: masterInfo.display_name || '',
        description: masterInfo.description || '',
        photo_url: masterInfo.photo_url || '',
        specialization: masterInfo.specialization || [],
        is_active: masterInfo.is_active ?? true,
        is_visible: masterInfo.is_visible ?? true,
        experience_years: masterInfo.experience_years || 0,
        working_hours: masterInfo.working_hours || profileData.working_hours
      })
    }
  }, [masterInfo])

  // Обновление профиля
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/api/masters/${masterInfo?.id}`, data)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully"
      })
      queryClient.invalidateQueries({ queryKey: ['master-info'] })
      setIsEditing(false)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update profile",
        variant: "destructive"
      })
    }
  })

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData)
  }

  const handleAddSpecialization = () => {
    if (newSpecialization.trim() && !profileData.specialization.includes(newSpecialization.trim())) {
      setProfileData(prev => ({
        ...prev,
        specialization: [...prev.specialization, newSpecialization.trim()]
      }))
      setNewSpecialization('')
    }
  }

  const handleRemoveSpecialization = (spec: string) => {
    setProfileData(prev => ({
      ...prev,
      specialization: prev.specialization.filter(s => s !== spec)
    }))
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
          <h2 className="text-3xl font-bold tracking-tight">My Profile</h2>
          <p className="text-muted-foreground">
            Manage your professional information and settings
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  // Reset form data
                  if (masterInfo) {
                    setProfileData({
                      display_name: masterInfo.display_name || '',
                      description: masterInfo.description || '',
                      photo_url: masterInfo.photo_url || '',
                      specialization: masterInfo.specialization || [],
                      is_active: masterInfo.is_active ?? true,
                      is_visible: masterInfo.is_visible ?? true,
                      experience_years: masterInfo.experience_years || 0,
                      working_hours: masterInfo.working_hours || profileData.working_hours
                    })
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Overview */}
        <Card className="md:col-span-1">
          <CardHeader className="text-center">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              {profileData.photo_url ? (
                <img 
                  src={profileData.photo_url} 
                  alt="Profile" 
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-gray-400" />
              )}
            </div>
            
            {isEditing && (
              <Button variant="outline" size="sm">
                <Camera className="mr-2 h-4 w-4" />
                Upload Photo
              </Button>
            )}
            
            <CardTitle className="text-xl">
              {profileData.display_name || user?.first_name + ' ' + (user?.last_name || '')}
            </CardTitle>
            
            <div className="flex items-center justify-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">{masterInfo?.rating?.toFixed(1) || '0.0'}</span>
              <span className="text-sm text-muted-foreground">
                ({masterInfo?.reviews_count || 0} reviews)
              </span>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Status Indicators */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${profileData.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-sm">{profileData.is_active ? 'Online' : 'Offline'}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Visibility</span>
              <div className="flex items-center gap-2">
                {profileData.is_visible ? (
                  <Badge variant="default">
                    <Eye className="mr-1 h-3 w-3" />
                    Visible
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <EyeOff className="mr-1 h-3 w-3" />
                    Hidden
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats?.totalClients || 0}</div>
                <div className="text-xs text-muted-foreground">Total Clients</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats?.weekBookings || 0}</div>
                <div className="text-xs text-muted-foreground">This Week</div>
              </div>
            </div>

            <Separator />

            {/* Contact Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user?.email}</span>
              </div>
              {user?.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Joined {new Date(user?.created_at || '').toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Your professional details and bio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={profileData.display_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, display_name: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="How you want to appear to clients"
                />
              </div>

              <div>
                <Label htmlFor="description">Bio / Description</Label>
                <Textarea
                  id="description"
                  value={profileData.description}
                  onChange={(e) => setProfileData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="Tell clients about your experience, specialties, and approach..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="experience">Years of Experience</Label>
                <Input
                  id="experience"
                  type="number"
                  value={profileData.experience_years}
                  onChange={(e) => setProfileData(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
                  disabled={!isEditing}
                  min="0"
                  max="50"
                />
              </div>
            </CardContent>
          </Card>

          {/* Specializations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Specializations
              </CardTitle>
              <CardDescription>Your areas of expertise</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {profileData.specialization.map((spec, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {spec}
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveSpecialization(spec)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                
                {profileData.specialization.length === 0 && (
                  <p className="text-sm text-muted-foreground">No specializations added yet</p>
                )}
              </div>

              {isEditing && (
                <div className="flex gap-2">
                  <Input
                    value={newSpecialization}
                    onChange={(e) => setNewSpecialization(e.target.value)}
                    placeholder="Add specialization (e.g., Beard Styling)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddSpecialization()
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddSpecialization}
                    disabled={!newSpecialization.trim()}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardHeader>
              <CardTitle>My Services</CardTitle>
              <CardDescription>Services you offer to clients</CardDescription>
            </CardHeader>
            <CardContent>
              {services && services.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {services.map((service: any) => (
                    <div key={service.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{service.name}</h4>
                        <Badge variant="outline">${service.price}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {service.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {service.duration}min
                        </span>
                        {service.category && (
                          <span>{service.category}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium">No services assigned</p>
                  <p className="text-sm">Contact your manager to assign services to your profile</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Control your availability and visibility</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Active Status</Label>
                  <p className="text-sm text-muted-foreground">
                    When active, you can receive new bookings
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={profileData.is_active}
                  onCheckedChange={(checked) => setProfileData(prev => ({ ...prev, is_active: checked }))}
                  disabled={!isEditing}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_visible">Profile Visibility</Label>
                  <p className="text-sm text-muted-foreground">
                    When visible, clients can see your profile and book with you
                  </p>
                </div>
                <Switch
                  id="is_visible"
                  checked={profileData.is_visible}
                  onCheckedChange={(checked) => setProfileData(prev => ({ ...prev, is_visible: checked }))}
                  disabled={!isEditing}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}