import axios, { AxiosError } from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.jazyl.tech'

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
})

// Добавляем токен в каждый запрос
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('access-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // ✅ ИСПРАВЛЕНО: Добавляем X-Tenant-ID из user данных
    const authUser = Cookies.get('auth-user')
    if (authUser) {
      try {
        const userData = JSON.parse(authUser)
        if (userData.tenant_id) {
          // ⭐ ВАЖНО: Убеждаемся что отправляем строку, а не объект!
          const tenantId = typeof userData.tenant_id === 'string' 
            ? userData.tenant_id 
            : String(userData.tenant_id)
          config.headers['X-Tenant-ID'] = tenantId
          console.log('🔧 [API] Setting X-Tenant-ID from auth-user:', tenantId)
        }
      } catch (error) {
        console.error('❌ [API] Error parsing auth-user data:', error)
      }
    }
    
    // Автоматически добавляем X-Tenant-Subdomain если мы на поддомене
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      
      if (hostname.includes('.jazyl.tech') && !hostname.startsWith('www.') && !hostname.startsWith('api.')) {
        let subdomain = hostname.split('.jazyl.tech')[0]
        
        // Специальная обработка для admin.jazyl.tech - это публичная страница барбершопа "admin"
        if (subdomain === 'admin') {
          // Оставляем subdomain как 'admin'
        }
        
        if (subdomain && subdomain !== 'jazyl') {
          config.headers['X-Tenant-Subdomain'] = subdomain
          console.log('🔧 [API] Setting X-Tenant-Subdomain:', subdomain)
        }
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Обработка ответов и ошибок
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Проверяем, не является ли это публичным API для получения данных о tenant
      const isPublicTenantAPI = error.config?.url?.includes('/api/tenants/subdomain/')
      
      if (!isPublicTenantAPI) {
        // Токен недействителен или истек (только для защищенных API)
        if (typeof window !== 'undefined') {
          Cookies.remove('access-token')
          Cookies.remove('auth-user')
          localStorage.removeItem('auth-storage')
          
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// ====================== AUTH API ======================
export const login = async (email: string, password: string) => {
  // OAuth2PasswordRequestForm требует именно такой формат
  const params = new URLSearchParams()
  params.append('username', email)  // ВАЖНО: поле называется username, не email
  params.append('password', password)
  
  try {
    const response = await axios.post(
      `${API_URL}/api/auth/login`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Login error:', error)
    throw error
  }
}

export const register = async (userData: any) => {
  const response = await api.post('/api/auth/register', userData)
  return response.data
}

export const logout = async () => {
  const response = await api.post('/api/auth/logout')
  return response.data
}

// ====================== TENANTS API ======================
export const getTenantBySubdomain = async (subdomain: string) => {
  const response = await api.get(`/api/tenants/subdomain/${subdomain}`)
  return response.data
}

export const createTenant = async (tenantData: any) => {
  const response = await api.post('/api/tenants', tenantData)
  return response.data
}

export const updateTenant = async (tenantId: string, tenantData: any) => {
  const response = await api.put(`/api/tenants/${tenantId}`, tenantData)
  return response.data
}

// ====================== MASTERS API (ADMIN FUNCTIONS) ======================
export const getMasters = async (tenantId?: string) => {
  try {
    const config: any = {}
    
    if (tenantId) {
      const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
      config.headers = { 'X-Tenant-ID': tenantIdString }
    }
    
    const response = await api.get('/api/masters', config)
    
    // Нормализуем каждого мастера в ответе
    if (Array.isArray(response.data)) {
      return response.data.map(master => normalizeMasterData(master));
    }
    
    return response.data
  } catch (error) {
    console.error('Error getting masters:', error)
    throw error
  }
}


export const getMaster = async (masterId: string, tenantId?: string) => {
  try {
    const config: any = {}
    
    if (tenantId) {
      const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
      config.headers = { 'X-Tenant-ID': tenantIdString }
    }
    
    const response = await api.get(`/api/masters/${masterId}`, config)
    return response.data
  } catch (error) {
    console.error('Error getting master:', error)
    throw error
  }
}

export const createMaster = async (masterData: any, tenantId?: string) => {
  try {
    const config: any = {}
    
    if (tenantId) {
      const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
      config.headers = { 'X-Tenant-ID': tenantIdString }
    }
    
    const response = await api.post('/api/masters', masterData, config)
    return response.data
  } catch (error) {
    console.error('Error creating master:', error)
    throw error
  }
}

// ✅ ИСПРАВЛЕНО: Добавлена недостающая функция updateMaster
export const updateMaster = async (masterId: string, masterData: any) => {
  try {
    const response = await api.put(`/api/masters/${masterId}`, masterData)
    return response.data
  } catch (error) {
    console.error('Error updating master:', error)
    throw error
  }
}

// ✅ ИСПРАВЛЕНО: Добавлена недостающая функция deleteMaster
export const deleteMaster = async (masterId: string) => {
  try {
    const response = await api.delete(`/api/masters/${masterId}`)
    return response.data
  } catch (error) {
    console.error('Error deleting master:', error)
    throw error
  }
}

// ====================== MASTER PROFILE API (для мастеров) ======================

/**
 * Получить свой профиль мастера
 */
export const getMyProfile = async () => {
  try {
    const response = await api.get('/api/masters/my-profile')
    // Нормализуем данные перед возвратом
    return normalizeMasterData(response.data)
  } catch (error) {
    console.error('Error getting master profile:', error)
    throw error
  }
}

/**
 * Обновить свой профиль мастера
 */
export const updateMyProfile = async (profileData: any) => {
  try {
    const response = await api.put('/api/masters/my-profile', profileData)
    return response.data
  } catch (error) {
    console.error('Error updating master profile:', error)
    throw error
  }
}

/**
 * Получить статистику мастера - ИСПРАВЛЕННЫЙ ЭНДПОИНТ
 */
export const getMyStats = async () => {
  try {
    const response = await api.get('/api/masters/my-stats')
    return response.data
  } catch (error) {
    console.error('Error getting master stats:', error)
    // Возвращаем заглушку в случае ошибки
    return {
      weekBookings: 0,
      totalClients: 0,
      monthRevenue: 0,
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      cancellationRate: 0
    }
  }
}

/**
 * Получить записи мастера на сегодня - НОВЫЙ ЭНДПОИНТ
 */
export const getMyBookingsToday = async () => {
  try {
    const response = await api.get('/api/masters/my-bookings/today')
    return response.data
  } catch (error) {
    console.error('Error getting today bookings:', error)
    // Возвращаем пустой массив в случае ошибки
    return { bookings: [] }
  }
}

/**
 * Получить записи мастера с фильтрами - НОВЫЙ ЭНДПОИНТ
 */
export const getMyBookings = async (filters?: {
  date_from?: string;
  date_to?: string;
  status?: string;
}) => {
  try {
    const params = new URLSearchParams()
    
    if (filters?.date_from) {
      params.append('date_from', filters.date_from)
    }
    if (filters?.date_to) {
      params.append('date_to', filters.date_to)
    }
    if (filters?.status) {
      params.append('status', filters.status)
    }
    
    const response = await api.get(`/api/masters/my-bookings?${params.toString()}`)
    return response.data
  } catch (error) {
    console.error('Error getting master bookings:', error)
    return { bookings: [] }
  }
}

/**
 * Загрузить фото мастера
 */
export const uploadMasterPhoto = async (photo: File) => {
  try {
    const formData = new FormData()
    formData.append('photo', photo)
    
    const response = await api.post('/api/masters/upload-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  } catch (error) {
    console.error('Error uploading master photo:', error)
    throw error
  }
}

/**
 * Получить аналитику мастера
 */
export const getMyAnalytics = async () => {
  try {
    const response = await api.get('/api/masters/my-analytics')
    return response.data
  } catch (error) {
    console.error('Error getting master analytics:', error)
    return {}
  }
}

/**
 * Запросить разрешение у менеджера
 */
export const requestPermission = async (permissionType: string, reason: string, additionalInfo?: string) => {
  try {
    const response = await api.post('/api/masters/request-permission', {
      permission_type: permissionType,
      reason: reason,
      additional_info: additionalInfo || ''
    })
    return response.data
  } catch (error) {
    console.error('Error requesting permission:', error)
    throw error
  }
}

/**
 * Получить свои запросы разрешений
 */
export const getMyPermissionRequests = async () => {
  try {
    const response = await api.get('/api/masters/my-permission-requests')
    return response.data
  } catch (error) {
    console.error('Error getting my permission requests:', error)
    return { requests: [] }
  }
}

/**
 * Получить свое расписание
 */
export const getMySchedule = async () => {
  try {
    const response = await api.get('/api/masters/my-schedule')
    return response.data
  } catch (error) {
    console.error('Error getting master schedule:', error)
    return { schedule: [] }
  }
}

export const updateMySchedule = async (scheduleData: any) => {
  try {
    const response = await api.put('/api/masters/my-schedule', scheduleData)
    return response.data
  } catch (error) {
    console.error('Error updating master schedule:', error)
    throw error
  }
}


export const getMastersWithPermissions = async (tenantId?: string) => {
  try {
    const config: any = {}
    
    if (tenantId) {
      const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
      config.headers = { 'X-Tenant-ID': tenantIdString }
    }
    
    const response = await api.get('/api/masters', config)
    return response.data
  } catch (error) {
    console.error('Error getting masters with permissions:', error)
    throw error
  }
}

export const toggleMasterStatus = async (masterId: string, isActive: boolean) => {
  try {
    const response = await api.put(`/api/masters/${masterId}`, {
      is_active: isActive
    })
    return response.data
  } catch (error) {
    console.error('Error toggling master status:', error)
    throw error
  }
}

export const getPermissionRequestsStats = async () => {
  try {
    const response = await api.get('/api/masters/permission-requests/stats')
    return response.data
  } catch (error) {
    console.error('Error getting permission requests stats:', error)
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    }
  }
}

/**
 * Массовое обновление прав мастеров
 */
export const bulkUpdateMasterPermissions = async (updates: Array<{
  masterId: string;
  permissions: any;
}>) => {
  try {
    const response = await api.put('/api/masters/bulk-permissions', {
      updates: updates
    })
    return response.data
  } catch (error) {
    console.error('Error bulk updating master permissions:', error)
    throw error
  }
}

/**
 * Заблокировать время в расписании
 */
export const blockMyTime = async (blockData: {
  date: string;
  start_time: string;
  end_time: string;
  reason?: string;
}) => {
  try {
    const response = await api.post('/api/masters/block-time', blockData)
    return response.data
  } catch (error) {
    console.error('Error blocking time:', error)
    throw error
  }
}

// ====================== ADMIN API для управления мастерами ======================

/**
 * Обновить права мастера (только для владельцев)
 */
export const updateMasterPermissions = async (masterId: string, permissions: {
  can_edit_profile?: boolean;
  can_edit_schedule?: boolean;
  can_edit_services?: boolean;
  can_manage_bookings?: boolean;
  can_view_analytics?: boolean;
  can_upload_photos?: boolean;
}) => {
  try {
    const response = await api.put(`/api/masters/${masterId}/permissions`, permissions)
    return response.data
  } catch (error) {
    console.error('Error updating master permissions:', error)
    throw error
  }
}

/**
 * Получить запросы разрешений (для администраторов)
 */
export const getPermissionRequests = async () => {
  try {
    const response = await api.get('/api/masters/permission-requests')
    return response.data
  } catch (error) {
    console.error('Error getting permission requests:', error)
    return []
  }
}

/**
 * Одобрить запрос разрешения
 */
export const approvePermissionRequest = async (requestId: string, reviewNote?: string) => {
  try {
    const response = await api.put(`/api/masters/permission-requests/${requestId}/approve`, {
      review_note: reviewNote || ''
    })
    return response.data
  } catch (error) {
    console.error('Error approving permission request:', error)
    throw error
  }
}

/**
 * Отклонить запрос разрешения
 */
export const rejectPermissionRequest = async (requestId: string, reviewNote?: string) => {
  try {
    const response = await api.put(`/api/masters/permission-requests/${requestId}/reject`, {
      review_note: reviewNote || ''
    })
    return response.data
  } catch (error) {
    console.error('Error rejecting permission request:', error)
    throw error
  }
}

// ====================== SERVICES API ======================
export const getServices = async (tenantId?: string) => {
  try {
    const config: any = {}
    
    // ✅ ИСПРАВЛЕНО: Правильная отправка X-Tenant-ID как строки
    if (tenantId) {
      const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
      config.headers = { 'X-Tenant-ID': tenantIdString }
      console.log('🔧 [getServices] Setting X-Tenant-ID:', tenantIdString)
    }
    
    const response = await api.get('/api/services', config)
    return response.data
  } catch (error) {
    console.error('Error getting services:', error)
    throw error
  }
}

export const createService = async (serviceData: any, tenantId?: string) => {
  try {
    const config: any = {}
    
    if (tenantId) {
      const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
      // ✅ ИСПРАВЛЕНО: Правильное добавление заголовка
      config.headers = {
        ...config.headers,  // сохраняем существующие заголовки
        'X-Tenant-ID': tenantIdString
      }
      console.log('🔧 [createService] Setting X-Tenant-ID:', tenantIdString)
    }
    
    console.log('🔧 [createService] Request data:', serviceData)
    console.log('🔧 [createService] Config:', config)
    
    const response = await api.post('/api/services', serviceData, config)
    return response.data
  } catch (error) {
    console.error('❌ [createService] Error:', error)
    throw error
  }
}

export const normalizeMasterData = (masterData: any) => {
  if (!masterData) return null;
  
  return {
    ...masterData,
    // ИСПРАВЛЕНИЕ: Обрабатываем specialization правильно
    specialization: Array.isArray(masterData.specialization) 
      ? masterData.specialization 
      : typeof masterData.specialization === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(masterData.specialization);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [],
    // Обрабатываем другие поля
    experience_years: masterData.experience_years || 0,
    rating: masterData.rating || 0.0,
    reviews_count: masterData.reviews_count || 0,
    is_active: masterData.is_active ?? true,
    is_visible: masterData.is_visible ?? true
  };
};


export const updateService = async (serviceId: string, serviceData: any) => {
  const response = await api.put(`/api/services/${serviceId}`, serviceData)
  return response.data
}

export const deleteService = async (serviceId: string) => {
  const response = await api.delete(`/api/services/${serviceId}`)
  return response.data
}

// ====================== CLIENTS API ======================
export const getClients = async (search?: string, tenantId?: string) => {
  const config: any = {
    params: { search },
  }
  
  if (tenantId) {
    const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
    config.headers = { 'X-Tenant-ID': tenantIdString }
  }
  
  const response = await api.get('/api/clients', config)
  return response.data
}

export const getClient = async (clientId: string) => {
  const response = await api.get(`/api/clients/${clientId}`)
  return response.data
}

export const createClient = async (clientData: any, tenantId?: string) => {
  const config: any = {}
  
  if (tenantId) {
    const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
    config.headers = { 'X-Tenant-ID': tenantIdString }
  }
  
  const response = await api.post('/api/clients', clientData, config)
  return response.data
}

export const updateClient = async (clientId: string, clientData: any) => {
  const response = await api.put(`/api/clients/${clientId}`, clientData)
  return response.data
}

// ====================== BOOKINGS API ======================
export const getAvailableSlots = async (
  masterId: string,
  date: Date,
  serviceId: string,
  tenantId?: string
) => {
  const config: any = {
    params: {
      master_id: masterId,
      date: date.toISOString().split('T')[0],
      service_id: serviceId,
    }
  }
  
  if (tenantId) {
    const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
    config.headers = { 'X-Tenant-ID': tenantIdString }
  }
  
  const response = await api.get('/api/bookings/availability/slots', config)
  return response.data
}

export const createBooking = async (bookingData: any, tenantId?: string) => {
  const config: any = {}
  
  if (tenantId) {
    const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
    config.headers = { 'X-Tenant-ID': tenantIdString }
  }
  
  const response = await api.post('/api/bookings', bookingData, config)
  return response.data
}

export const getBookings = async (filters?: any) => {
  const response = await api.get('/api/bookings', { params: filters })
  return response.data
}

export const confirmBooking = async (bookingId: string, token: string) => {
  const response = await api.post(`/api/bookings/${bookingId}/confirm`, null, {
    params: { token }
  })
  return response.data
}

export const cancelBooking = async (bookingId: string, token: string) => {
  const response = await api.post(`/api/bookings/${bookingId}/cancel`, null, {
    params: { token }
  })
  return response.data
}

// ====================== DASHBOARD API ======================
export const getDashboardStats = async (dateFrom?: string, dateTo?: string, tenantId?: string) => {
  const config: any = {
    params: { date_from: dateFrom, date_to: dateTo }
  }
  
  if (tenantId) {
    const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
    config.headers = { 'X-Tenant-ID': tenantIdString }
  }
  
  const response = await api.get('/api/dashboard/stats', config)
  return response.data
}

export const getTodayOverview = async (tenantId?: string) => {
  const config: any = {}
  
  if (tenantId) {
    const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
    config.headers = { 'X-Tenant-ID': tenantIdString }
  }
  
  const response = await api.get('/api/dashboard/today', config)
  return response.data
}

export const getRevenueReport = async (period: string, tenantId?: string) => {
  const config: any = {
    params: { period }
  }
  
  if (tenantId) {
    const tenantIdString = typeof tenantId === 'string' ? tenantId : String(tenantId)
    config.headers = { 'X-Tenant-ID': tenantIdString }
  }
  
  const response = await api.get('/api/dashboard/revenue', config)
  return response.data
}

// ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================

/**
 * Получить полный URL для изображения
 */
export const getImageUrl = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath
  }
  
  // Если относительный путь, добавляем API URL
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`
  return `${API_URL}${cleanPath}`
}

/**
 * Типы разрешений для запросов
 */
export const PERMISSION_TYPES = {
  EDIT_SCHEDULE: 'edit_schedule',
  EDIT_SERVICES: 'edit_services',
  VIEW_ANALYTICS: 'view_analytics',
  UPLOAD_PHOTOS: 'upload_photos'
} as const

/**
 * Статусы записей
 */
export const BOOKING_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
} as const

/**
 * Проверить, есть ли у мастера конкретное разрешение
 */
export const hasPermission = (masterProfile: any, permission: keyof typeof PERMISSION_TYPES): boolean => {
  const permissionMap = {
    EDIT_SCHEDULE: 'can_edit_schedule',
    EDIT_SERVICES: 'can_edit_services',
    VIEW_ANALYTICS: 'can_view_analytics',
    UPLOAD_PHOTOS: 'can_upload_photos'
  }
  
  const fieldName = permissionMap[permission]
  return masterProfile?.[fieldName] === true
}

/**
 * Форматировать статистику для отображения
 */
export const formatMasterStats = (stats: any) => {
  return {
    weekBookings: stats?.weekBookings || 0,
    totalClients: stats?.totalClients || 0,
    monthRevenue: stats?.monthRevenue ? `${stats.monthRevenue.toFixed(2)} ₽` : '0.00 ₽',
    totalBookings: stats?.totalBookings || 0,
    completedBookings: stats?.completedBookings || 0,
    cancelledBookings: stats?.cancelledBookings || 0,
    cancellationRate: stats?.cancellationRate ? `${stats.cancellationRate}%` : '0%'
  }
}

/**
 * Проверить, нужно ли показать уведомление о недостающих правах
 */
export const checkMissingPermissions = (masterProfile: any): string[] => {
  const missing = []
  
  if (!masterProfile?.can_edit_schedule) {
    missing.push('Редактирование расписания')
  }
  if (!masterProfile?.can_edit_services) {
    missing.push('Редактирование услуг')
  }
  if (!masterProfile?.can_view_analytics) {
    missing.push('Просмотр аналитики')
  }
  if (!masterProfile?.can_upload_photos) {
    missing.push('Загрузка фотографий')
  }
  
  return missing
}

export default api