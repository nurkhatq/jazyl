'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/store'
import { 
  getMastersWithPermissions, 
  updateMasterPermissions, 
  toggleMasterStatus,
  getPermissionRequestsStats 
} from '@/lib/api'
import { 
  Users, 
  Settings, 
  Calendar, 
  Camera, 
  BarChart3,
  CheckCircle,
  UserCheck,
  UserX,
  AlertTriangle,
  Search
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'

// Типизация
interface Master {
  id: string;
  display_name?: string;
  is_active: boolean;
  experience_years?: number;
  can_edit_profile: boolean;
  can_edit_schedule: boolean;
  can_edit_services: boolean;
  can_upload_photos: boolean;
  can_view_analytics: boolean;
  can_manage_bookings: boolean;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface PermissionConfig {
  key: string;
  label: string;
  icon: any;
  description: string;
}

const PERMISSION_CONFIG: PermissionConfig[] = [
  {
    key: 'can_edit_profile',
    label: 'Профиль',
    icon: UserCheck,
    description: 'Редактирование профиля'
  },
  {
    key: 'can_edit_schedule',
    label: 'График',
    icon: Calendar,
    description: 'Редактирование расписания'
  },
  {
    key: 'can_edit_services',
    label: 'Услуги',
    icon: Settings,
    description: 'Управление услугами'
  },
  {
    key: 'can_upload_photos',
    label: 'Фото',
    icon: Camera,
    description: 'Загрузка фотографий'
  },
  {
    key: 'can_view_analytics',
    label: 'Аналитика',
    icon: BarChart3,
    description: 'Просмотр статистики'
  },
  {
    key: 'can_manage_bookings',
    label: 'Записи',
    icon: CheckCircle,
    description: 'Управление записями'
  }
]

export default function MastersManagementPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Защита роута
  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.push('/unauthorized')
    }
  }, [user, router])

  // Получаем список мастеров
  const { data: masters, isLoading } = useQuery({
    queryKey: ['masters-with-permissions', user?.tenant_id],
    queryFn: () => getMastersWithPermissions(user?.tenant_id),
    enabled: !!user && user.role === 'owner'
  })

  // Получаем статистику запросов
  const { data: requestsStats } = useQuery({
    queryKey: ['permission-requests-stats'],
    queryFn: getPermissionRequestsStats,
    enabled: !!user && user.role === 'owner'
  })

  // Мутация для обновления прав
  const updatePermissionsMutation = useMutation({
    mutationFn: ({ masterId, permissions }: { masterId: string, permissions: any }) =>
      updateMasterPermissions(masterId, permissions),
    onSuccess: () => {
      console.log('Права обновлены!')
      queryClient.invalidateQueries({ queryKey: ['masters-with-permissions'] })
    },
    onError: (error: any) => {
      console.error('Ошибка при обновлении прав:', error)
    }
  })

  // Мутация для изменения статуса
  const toggleStatusMutation = useMutation({
    mutationFn: ({ masterId, isActive }: { masterId: string, isActive: boolean }) =>
      toggleMasterStatus(masterId, isActive),
    onSuccess: () => {
      console.log('Статус изменен!')
      queryClient.invalidateQueries({ queryKey: ['masters-with-permissions'] })
    },
    onError: (error: any) => {
      console.error('Ошибка при изменении статуса:', error)
    }
  })

  const handlePermissionToggle = (masterId: string, permission: string, value: boolean) => {
    updatePermissionsMutation.mutate({
      masterId,
      permissions: { [permission]: value }
    })
  }

  const handleStatusToggle = (masterId: string, currentStatus: boolean) => {
    toggleStatusMutation.mutate({
      masterId,
      isActive: !currentStatus
    })
  }

  if (!user || user.role !== 'owner') {
    return null
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  // Фильтрация мастеров
  const filteredMasters = (masters || []).filter((master: Master) => {
    const matchesSearch = master.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         master.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && master.is_active) ||
                         (statusFilter === 'inactive' && !master.is_active)
    
    return matchesSearch && matchesStatus
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Управление мастерами</h1>
            <p className="text-muted-foreground">
              Настройка прав доступа и управление мастерами
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/permission-requests">
              <Button variant="outline" className="relative">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Запросы разрешений
                {requestsStats?.pending > 0 && (
                  <Badge variant="destructive" className="ml-2 px-1 py-0 text-xs">
                    {requestsStats.pending}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Статистика */}
        {requestsStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Всего мастеров</p>
                    <p className="font-bold">{masters?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">Ожидают</p>
                    <p className="font-bold">{requestsStats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Одобрено</p>
                    <p className="font-bold">{requestsStats.approved}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Отклонено</p>
                    <p className="font-bold">{requestsStats.rejected}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Фильтры */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Поиск по имени или email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  Все
                </Button>
                <Button
                  variant={statusFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                >
                  Активные
                </Button>
                <Button
                  variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('inactive')}
                >
                  Неактивные
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Список мастеров */}
        <div className="space-y-4">
          {filteredMasters.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Мастеров не найдено
                </h3>
                <p className="text-gray-600">
                  Попробуйте изменить параметры поиска
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredMasters.map((master: Master) => (
              <Card key={master.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {master.display_name || 'Не указано'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {master.user?.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={master.is_active ? 'default' : 'secondary'}>
                            {master.is_active ? 'Активен' : 'Неактивен'}
                            </Badge>
                          {master.experience_years && master.experience_years > 0 && (
                            <Badge variant="outline">
                              {master.experience_years} лет опыта
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Активен:</span>
                      <Switch
                        checked={master.is_active}
                        onCheckedChange={() => handleStatusToggle(master.id, master.is_active)}
                        disabled={toggleStatusMutation.isPending}
                      />
                    </div>
                  </div>

                  {/* Права доступа */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-700">Права доступа:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {PERMISSION_CONFIG.map((permission) => {
                        const Icon = permission.icon
                        const isGranted = master[permission.key as keyof Master] as boolean
                        
                        return (
                          <div
                            key={permission.key}
                            className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                              isGranted 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <Switch
                              checked={isGranted}
                              onCheckedChange={(value) => 
                                handlePermissionToggle(master.id, permission.key, value)
                              }
                              disabled={updatePermissionsMutation.isPending}
                            />
                            <Icon className={`h-4 w-4 ${
                              isGranted ? 'text-green-600' : 'text-gray-400'
                            }`} />
                            <div>
                              <p className="text-sm font-medium">{permission.label}</p>
                              <p className="text-xs text-gray-500">{permission.description}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}