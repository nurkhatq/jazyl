'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/lib/store'
import { getPermissionRequests, approvePermissionRequest, rejectPermissionRequest } from '@/lib/api'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar,
  MessageSquare,
  AlertCircle 
} from 'lucide-react'

// Типизация для запроса разрешения
interface PermissionRequest {
  id: string;
  permission_type: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  review_note?: string;
}

// Маппинг типов разрешений на человекочитаемые названия
const PERMISSION_LABELS: Record<string, string> = {
  edit_schedule: '📅 Редактирование графика',
  edit_services: '💼 Управление услугами',
  edit_profile: '👤 Редактирование профиля',
  upload_photos: '📸 Загрузка фотографий',
  manage_bookings: '📝 Управление записями',
  view_analytics: '📊 Просмотр аналитики'
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  approved: 'Одобрено',
  rejected: 'Отклонено'
}

// Вспомогательная функция для форматирования даты
const formatDate = (dateString: string, includeTime = false) => {
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  return date.toLocaleDateString('ru-RU', options)
}

export default function PermissionRequestsPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  // Защита роута
  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.push('/unauthorized')
    }
  }, [user, router])

  // Получаем список запросов
  const { data: requests, isLoading } = useQuery({
    queryKey: ['permission-requests'],
    queryFn: getPermissionRequests,
    enabled: !!user && user.role === 'owner'
  })

  // Мутация для одобрения
  const approveMutation = useMutation({
    mutationFn: ({ requestId, note }: { requestId: string, note?: string }) => 
      approvePermissionRequest(requestId, note),
    onSuccess: () => {
      console.log('Запрос одобрен!')
      queryClient.invalidateQueries({ queryKey: ['permission-requests'] })
    },
    onError: () => {
      console.error('Ошибка при одобрении запроса')
    }
  })

  // Мутация для отклонения
  const rejectMutation = useMutation({
    mutationFn: ({ requestId, note }: { requestId: string, note?: string }) => 
      rejectPermissionRequest(requestId, note),
    onSuccess: () => {
      console.log('Запрос отклонен')
      queryClient.invalidateQueries({ queryKey: ['permission-requests'] })
    },
    onError: () => {
      console.error('Ошибка при отклонении запроса')
    }
  })

  const handleApprove = (requestId: string) => {
    approveMutation.mutate({ 
      requestId, 
      note: reviewNotes[requestId] || ''
    })
  }

  const handleReject = (requestId: string) => {
    rejectMutation.mutate({ 
      requestId, 
      note: reviewNotes[requestId] || ''
    })
  }

  if (!user || user.role !== 'owner') {
    return null
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pendingRequests = requests?.filter((req: PermissionRequest) => req.status === 'pending') || []
  const reviewedRequests = requests?.filter((req: PermissionRequest) => req.status !== 'pending') || []

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Запросы разрешений</h1>
          <p className="text-muted-foreground">
            Управляйте запросами мастеров на дополнительные права
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          ← Назад к дашборду
        </Button>
      </div>

      {/* Новые запросы */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Новые запросы ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingRequests.map((request: PermissionRequest) => (
              <Card key={request.id} className="border-l-4 border-l-yellow-400">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Мастер запрашивает:</span>
                        <Badge variant="outline">
                          {PERMISSION_LABELS[request.permission_type] || request.permission_type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        {formatDate(request.created_at, true)}
                      </div>

                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm font-medium mb-1">Обоснование:</p>
                        <p className="text-sm text-gray-700">{request.reason}</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Комментарий к решению:</label>
                        <Textarea
                          placeholder="Опциональный комментарий..."
                          value={reviewNotes[request.id] || ''}
                          onChange={(e) => setReviewNotes(prev => ({
                            ...prev,
                            [request.id]: e.target.value
                          }))}
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button 
                      onClick={() => handleApprove(request.id)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Одобрить
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => handleReject(request.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Отклонить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* История запросов */}
      {reviewedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              История запросов
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviewedRequests.map((request: PermissionRequest) => (
              <Card key={request.id} className="border-l-4 border-l-gray-300">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {PERMISSION_LABELS[request.permission_type] || request.permission_type}
                        </Badge>
                        <Badge className={STATUS_COLORS[request.status]}>
                          {STATUS_LABELS[request.status]}
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-600">
                        {formatDate(request.created_at)}
                        {request.reviewed_at && (
                          <span> → Рассмотрено {formatDate(request.reviewed_at)}</span>
                        )}
                      </div>

                      {request.review_note && (
                        <div className="bg-gray-50 p-2 rounded text-sm">
                          <MessageSquare className="h-3 w-3 inline mr-1" />
                          {request.review_note}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Если нет запросов */}
      {(!requests || requests.length === 0) && (
        <Card>
          <CardContent className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Нет запросов разрешений
            </h3>
            <p className="text-gray-600">
              Когда мастера будут запрашивать дополнительные права, они появятся здесь
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
