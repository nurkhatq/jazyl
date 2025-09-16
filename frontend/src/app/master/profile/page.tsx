'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import { 
  Camera, 
  Star, 
  Users, 
  Save,
  Plus,
  X,
  Eye,
  EyeOff,
  Edit3,
  Check,
  AlertTriangle,
  Clock
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ИСПРАВЛЕНИЕ: Функция для нормализации данных специализации
const normalizeSpecialization = (spec: any): string[] => {
  if (!spec) return [];
  if (Array.isArray(spec)) return spec;
  if (typeof spec === 'string') {
    try {
      const parsed = JSON.parse(spec);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function MasterProfilePage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [newSpecialization, setNewSpecialization] = useState('')
  const [profileData, setProfileData] = useState({
    display_name: '',
    description: '',
    photo_url: '',
    specialization: [] as string[],
    is_active: true,
    is_visible: true,
    experience_years: 0
  })

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

  // ИСПРАВЛЕНИЕ: Нормализованные специализации
  const normalizedSpecializations = useMemo(() => {
    return normalizeSpecialization(masterInfo?.specialization);
  }, [masterInfo?.specialization]);

  // ИСПРАВЛЕНИЕ: Инициализация формы с правильной обработкой specialization
  useEffect(() => {
    if (masterInfo) {
      setProfileData({
        display_name: masterInfo.display_name || '',
        description: masterInfo.description || '',
        photo_url: masterInfo.photo_url || '',
        specialization: normalizeSpecialization(masterInfo.specialization),
        is_active: masterInfo.is_active ?? true,
        is_visible: masterInfo.is_visible ?? true,
        experience_years: masterInfo.experience_years || 0
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
        title: "Профиль обновлен",
        description: "Изменения успешно сохранены"
      })
      queryClient.invalidateQueries({ queryKey: ['master-info'] })
      setIsEditing(false)
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить изменения",
        variant: "destructive"
      })
    }
  })

  // Загрузка фото
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('photo', file)
      const response = await api.post(`/api/masters/${masterInfo?.id}/upload-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return response.data
    },
    onSuccess: (data) => {
      setProfileData(prev => ({ ...prev, photo_url: data.photo_url }))
      queryClient.invalidateQueries({ queryKey: ['master-info'] })
      toast({
        title: "Фото обновлено",
        description: "Фотография успешно загружена"
      })
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить фото",
        variant: "destructive"
      })
    }
  })

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData)
  }

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Файл слишком большой",
          description: "Максимальный размер файла 5MB",
          variant: "destructive"
        })
        return
      }
      uploadPhotoMutation.mutate(file)
    }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Профиль</h1>
          {isEditing ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                {updateProfileMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={!masterInfo?.can_edit_profile}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              {masterInfo?.can_edit_profile ? 'Редактировать' : 'Запросить доступ'}
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-6 text-center">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 bg-gray-200 rounded-full overflow-hidden mx-auto">
                {profileData.photo_url ? (
                  <img
                    src={profileData.photo_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Users className="h-8 w-8" />
                  </div>
                )}
              </div>
              
              {isEditing && masterInfo?.can_upload_photos && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-2 shadow-lg hover:bg-blue-600"
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <h2 className="text-xl font-semibold mb-2">
              {profileData.display_name || 'Не указано'}
            </h2>
            
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${profileData.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm">{profileData.is_active ? 'Работаю' : 'Оффлайн'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-blue-600">{stats?.totalClients || 0}</div>
              <div className="text-xs text-gray-600">Клиентов</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-green-600">{stats?.weekBookings || 0}</div>
              <div className="text-xs text-gray-600">На неделе</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-purple-600">${stats?.monthRevenue || 0}</div>
              <div className="text-xs text-gray-600">За месяц</div>
            </CardContent>
          </Card>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Основная информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="display_name">Отображаемое имя</Label>
              <Input
                id="display_name"
                value={profileData.display_name}
                onChange={(e) => setProfileData(prev => ({ ...prev, display_name: e.target.value }))}
                disabled={!isEditing || !masterInfo?.can_edit_profile}
                placeholder="Как вас будут видеть клиенты"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">О себе</Label>
              <Textarea
                id="description"
                value={profileData.description}
                onChange={(e) => setProfileData(prev => ({ ...prev, description: e.target.value }))}
                disabled={!isEditing || !masterInfo?.can_edit_profile}
                placeholder="Расскажите о своем опыте и подходе к работе..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="experience">Опыт работы (лет)</Label>
              <Input
                id="experience"
                type="number"
                value={profileData.experience_years}
                onChange={(e) => setProfileData(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
                disabled={!isEditing || !masterInfo?.can_edit_profile}
                min="0"
                max="50"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Specializations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Специализации</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {profileData.specialization.map((spec, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                  {spec}
                  {isEditing && masterInfo?.can_edit_profile && (
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
                <p className="text-sm text-gray-500">Специализации не добавлены</p>
              )}
            </div>

            {isEditing && masterInfo?.can_edit_profile && (
              <div className="flex gap-2">
                <Input
                  value={newSpecialization}
                  onChange={(e) => setNewSpecialization(e.target.value)}
                  placeholder="Добавить специализацию"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSpecialization()
                    }
                  }}
                  className="flex-1"
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

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Настройки профиля</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Активен</div>
                <div className="text-sm text-gray-600">Принимать новые записи</div>
              </div>
              <Switch
                checked={profileData.is_active}
                onCheckedChange={(checked) => setProfileData(prev => ({ ...prev, is_active: checked }))}
                disabled={!isEditing}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Видимость профиля</div>
                <div className="text-sm text-gray-600">Показывать клиентам</div>
              </div>
              <div className="flex items-center gap-2">
                {profileData.is_visible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                <Switch
                  checked={profileData.is_visible}
                  onCheckedChange={(checked) => setProfileData(prev => ({ ...prev, is_visible: checked }))}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}