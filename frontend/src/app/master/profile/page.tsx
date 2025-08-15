'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { User, Mail, Phone, Star, Calendar } from 'lucide-react'

// Диалог изменения пароля
import { ChangePasswordDialog } from '@/components/masters/change-password-dialog'

export default function MasterProfilePage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    display_name: '',
    description: '',
    specialization: '',
    phone: ''
  })

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

  // Получаем информацию о мастере
  const { data: masterInfo } = useQuery({
    queryKey: ['master-info', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/masters/my-profile')
      return response.data
    },
    enabled: !!user?.id,
  })

  // Заполняем форму данными
  useEffect(() => {
    if (masterInfo) {
      setFormData({
        display_name: masterInfo.display_name || '',
        description: masterInfo.description || '',
        specialization: masterInfo.specialization?.join(', ') || '',
        phone: masterInfo?.phone || ''
      })
    }
  }, [masterInfo, user])

  // Мутация для обновления профиля
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/api/masters/${masterInfo?.id}`, data)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ['master-info'] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    updateMutation.mutate({
      display_name: formData.display_name,
      description: formData.description,
      specialization: formData.specialization.split(',').map(s => s.trim()).filter(s => s)
    })
  }

  // Функция для обработки успешного изменения пароля
  const handlePasswordChangeSuccess = () => {
    toast({
      title: "Password Changed",
      description: "Your password has been updated successfully",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Profile</h2>
        <p className="text-muted-foreground">
          Manage your professional information
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your professional details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="How clients will see your name"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="Haircut, Beard Trim, Coloring (comma-separated)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your skills separated by commas
                </p>
              </div>
              
              <div>
                <Label htmlFor="description">About Me</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Tell clients about your experience and expertise..."
                />
              </div>
              
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{masterInfo?.phone || 'Not set'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">
                    {masterInfo?.created_at ? new Date(masterInfo.created_at).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>
              Your work statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Rating</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">
                    {masterInfo?.rating > 0 ? masterInfo.rating.toFixed(1) : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {masterInfo?.reviews_count || 0} reviews
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Bookings</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cancellation Rate</span>
                  <span className="font-medium">0%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader>
            <CardTitle>My Services</CardTitle>
            <CardDescription>
              Services you can provide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {masterInfo?.specialization && masterInfo.specialization.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {masterInfo.specialization.map((spec: string) => (
                    <Badge key={spec} variant="secondary">
                      {spec}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No specializations added yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Change Password Section */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Manage your password and security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setPasswordDialogOpen(true)}>
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Диалог изменения пароля */}
      <ChangePasswordDialog 
        open={passwordDialogOpen} 
        onOpenChange={setPasswordDialogOpen} 
        onSuccess={handlePasswordChangeSuccess} // уведомление при успешной смене пароля
      />
    </div>
  )
}
