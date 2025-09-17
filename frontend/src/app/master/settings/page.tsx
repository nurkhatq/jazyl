'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store'
import { getMyProfile, updateMyProfile, getMyPermissionRequests } from '@/lib/api'
import PermissionRequestModal from '@/components/permission-request-modal'
import { 
  Settings, 
  User, 
  Camera, 
  Calendar,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  AlertCircle,
  Shield,
  Save,
  ArrowLeft
} from 'lucide-react'

// Типизация
interface MasterProfile {
  display_name?: string;
  description?: string;
  experience_years?: number;
  specialization?: string[];
  can_edit_profile?: boolean;
  can_edit_schedule?: boolean;
  can_edit_services?: boolean;
  can_upload_photos?: boolean;
  can_view_analytics?: boolean;
  can_manage_bookings?: boolean;
  [key: string]: any;
}

interface PermissionRequest {
  id: string;
  permission_type: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  review_note?: string;
}

const PERMISSION_ICONS: Record<string, any> = {
  can_edit_profile: User,
  can_edit_schedule: Calendar,
  can_edit_services: Settings,
  can_upload_photos: Camera,
  can_view_analytics: BarChart3,
  can_manage_bookings: CheckCircle
}

const PERMISSION_LABELS: Record<string, string> = {
  can_edit_profile: 'Редактирование профиля',
  can_edit_schedule: 'Редактирование графика',
  can_edit_services: 'Управление услугами',
  can_upload_photos: 'Загрузка фотографий',
  can_view_analytics: 'Просмотр аналитики',
  can_manage_bookings: 'Управление записями'
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает рассмотрения',
  approved: 'Одобрено',
  rejected: 'Отклонено'
}

export default function MasterSettingsPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [profileData, setProfileData] = useState({
    display_name: '',
    description: '',
    experience_years: 0,
    specialization: []
  })

  // Защита роута
  useEffect(() => {
    if (!user || user.role !== 'master') {
      router.push('/unauthorized')
    }
  }, [user, router])

  // Получаем профиль мастера
  const { data: masterProfile, isLoading } = useQuery({
    queryKey: ['master-profile'],
    queryFn: getMyProfile,
    enabled: !!user && user.role === 'master'
  })

  // Получаем запросы разрешений
  const { data: permissionRequests } = useQuery({
    queryKey: ['my-permission-requests'],
    queryFn: getMyPermissionRequests,
    enabled: !!user && user.role === 'master'
  })

  // Мутация для обновления профиля
  const updateProfileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      console.log('Профиль обновлен!')
      queryClient.invalidateQueries({ queryKey: ['master-profile'] })
    },
    onError: (error: any) => {
      console.error('Ошибка при обновлении профиля:', error)
    }
  })

  // Обновляем локальное состояние при загрузке профиля
  useEffect(() => {
    if (masterProfile) {
      setProfileData({
        display_name: masterProfile.display_name || '',
        description: masterProfile.description || '',
        experience_years: masterProfile.experience_years || 0,
        specialization: masterProfile.specialization || []
      })
    }
  }, [masterProfile])

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData)
  }

  if (!user || user.role !== 'master') {
    return null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const permissions = masterProfile ? Object.keys(PERMISSION_LABELS).filter(key => 
    key.startsWith('can_')
  ) : []

  const grantedPermissions = permissions.filter(permission => 
    masterProfile?.[permission] === true
  )

  const deniedPermissions = permissions.filter(permission => 
    masterProfile?.[permission] === false
  )

  const canEditProfile = masterProfile?.can_edit_profile

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Мобильный заголовок с навигацией */}
      <div className="lg:hidden bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/master')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Настройки</h1>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto p-6 space-y-6 pb-20 lg:pb-6">
        {/* Десктопный заголовок */}
        <div className="hidden lg:flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Настройки мастера</h1>
            <p className="text-muted-foreground">
              Управляйте своим профилем и разрешениями
            </p>
          </div>
        </div>

        {/* Профиль */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Профиль мастера
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canEditProfile && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-800">
                    У вас нет прав на редактирование профиля. Обратитесь к администратору.
                  </span>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Отображаемое имя</Label>
                <Input
                  id="display_name"
                  value={profileData.display_name}
                  onChange={(e) => setProfileData(prev => ({
                    ...prev,
                    display_name: e.target.value
                  }))}
                  disabled={!canEditProfile}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience_years">Опыт работы (лет)</Label>
                <Input
                  id="experience_years"
                  type="number"
                  value={profileData.experience_years}
                  onChange={(e) => setProfileData(prev => ({
                    ...prev,
                    experience_years: parseInt(e.target.value) || 0
                  }))}
                  disabled={!canEditProfile}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={profileData.description}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                rows={3}
                disabled={!canEditProfile}
              />
            </div>

            {canEditProfile && (
              <Button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Сохраняем...
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Сохранить профиль
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Разрешения */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Права доступа
              </div>
              <PermissionRequestModal currentPermissions={masterProfile}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Запросить разрешение
                </Button>
              </PermissionRequestModal>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Предоставленные права */}
            {grantedPermissions.length > 0 && (
              <div>
                <h3 className="font-medium text-green-700 mb-2">✅ Предоставленные права</h3>
                <div className="grid md:grid-cols-2 gap-2">
                  {grantedPermissions.map((permission) => {
                    const Icon = PERMISSION_ICONS[permission] || CheckCircle
                    return (
                      <div key={permission} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                        <Icon className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-800">
                          {PERMISSION_LABELS[permission]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Ограниченные права */}
            {deniedPermissions.length > 0 && (
              <div>
                <h3 className="font-medium text-red-700 mb-2">❌ Ограниченные права</h3>
                <div className="grid md:grid-cols-2 gap-2">
                  {deniedPermissions.map((permission) => {
                    const Icon = PERMISSION_ICONS[permission] || XCircle
                    return (
                      <div key={permission} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                        <Icon className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-800">
                          {PERMISSION_LABELS[permission]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* История запросов */}
        {permissionRequests?.requests?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                История запросов разрешений
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {permissionRequests.requests.map((request: PermissionRequest) => (
                <Card key={request.id} className="border-l-4 border-l-gray-300">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {PERMISSION_LABELS[`can_${request.permission_type}`] || request.permission_type}
                          </Badge>
                          <Badge className={STATUS_COLORS[request.status]}>
                            {STATUS_LABELS[request.status]}
                          </Badge>
                        </div>

                        <p className="text-sm text-gray-600">{request.reason}</p>

                        {request.review_note && (
                          <div className="bg-gray-50 p-2 rounded text-sm">
                            <strong>Комментарий администратора:</strong> {request.review_note}
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          Запрос от {new Date(request.created_at).toLocaleDateString('ru-RU')}
                          {request.reviewed_at && (
                            <span> • Рассмотрено {new Date(request.reviewed_at).toLocaleDateString('ru-RU')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}