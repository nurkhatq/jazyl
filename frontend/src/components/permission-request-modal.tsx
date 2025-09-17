'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { requestPermission } from '@/lib/api'
import { 
  Calendar, 
  Settings, 
  Camera, 
  BarChart3,
  Lock,
  Send,
  AlertCircle 
} from 'lucide-react'

interface PermissionOption {
  key: string;
  title: string;
  description: string;
  icon: any;
  color: string;
}

const PERMISSIONS: PermissionOption[] = [
  {
    key: 'edit_schedule',
    title: 'Редактирование графика',
    description: 'Возможность изменять рабочее расписание',
    icon: Calendar,
    color: 'bg-blue-100 text-blue-700'
  },
  {
    key: 'edit_services',
    title: 'Управление услугами',
    description: 'Добавление и редактирование услуг',
    icon: Settings,
    color: 'bg-purple-100 text-purple-700'
  },
  {
    key: 'upload_photos',
    title: 'Загрузка фотографий',
    description: 'Добавление фото работ в галерею',
    icon: Camera,
    color: 'bg-green-100 text-green-700'
  },
  {
    key: 'view_analytics',
    title: 'Просмотр аналитики',
    description: 'Доступ к расширенной статистике',
    icon: BarChart3,
    color: 'bg-orange-100 text-orange-700'
  }
]

interface PermissionRequestModalProps {
  currentPermissions: any
  children: React.ReactNode
}

export default function PermissionRequestModal({ 
  currentPermissions, 
  children 
}: PermissionRequestModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<string>('')
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const requestMutation = useMutation({
    mutationFn: ({ permission, reason }: { permission: string, reason: string }) =>
      requestPermission(permission, reason),
    onSuccess: () => {
      console.log('Запрос отправлен!')
      setIsOpen(false)
      setSelectedPermission('')
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['master-profile'] })
      queryClient.invalidateQueries({ queryKey: ['my-permission-requests'] })
    },
    onError: (error: any) => {
      console.error('Ошибка при отправке запроса:', error)
    }
  })

  const handleSubmit = () => {
    if (!selectedPermission || !reason.trim()) {
      return
    }

    requestMutation.mutate({
      permission: selectedPermission,
      reason: reason.trim()
    })
  }

  // Определяем доступные для запроса разрешения
  const availablePermissions = PERMISSIONS.filter(permission => {
    const permissionKey = `can_${permission.key}`
    return !currentPermissions?.[permissionKey]
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Запрос дополнительных разрешений
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Информация */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">
                  Как работают запросы разрешений
                </p>
                <p className="text-blue-700">
                  Выберите нужное разрешение и опишите, зачем оно вам необходимо. 
                  Владелец салона рассмотрит ваш запрос и примет решение.
                </p>
              </div>
            </div>
          </div>

          {/* Выбор разрешения */}
          <div className="space-y-3">
            <h3 className="font-medium">Доступные для запроса разрешения:</h3>
            
            {availablePermissions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-6">
                  <Lock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">
                    У вас есть все доступные разрешения
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {availablePermissions.map((permission) => {
                  const Icon = permission.icon
                  const isSelected = selectedPermission === permission.key
                  
                  return (
                    <Card 
                      key={permission.key}
                      className={`cursor-pointer transition-all ${
                        isSelected 
                          ? 'ring-2 ring-blue-500 bg-blue-50' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedPermission(
                        isSelected ? '' : permission.key
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${permission.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{permission.title}</h4>
                              {isSelected && (
                                <Badge variant="default" className="text-xs">
                                  Выбрано
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Обоснование */}
          {selectedPermission && (
            <div className="space-y-2">
              <label className="font-medium">
                Обоснование запроса <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Объясните, зачем вам нужно это разрешение..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">
                Чем подробнее вы опишете причину, тем больше шансов на одобрение
              </p>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={requestMutation.isPending}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedPermission || !reason.trim() || requestMutation.isPending}
            >
              {requestMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Отправляем...
                </div>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Отправить запрос
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}