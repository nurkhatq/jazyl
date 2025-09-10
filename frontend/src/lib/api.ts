import axios from 'axios'
import Cookies from 'js-cookie'

// Определяем базовый URL API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.jazyl.tech'

// Создаем экземпляр axios с базовой конфигурацией
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Утилита для получения tenant info из URL
const getTenantInfo = () => {
  if (typeof window === 'undefined') return { subdomain: null, isAdmin: false }
  
  const hostname = window.location.hostname
  
  if (hostname.includes('.jazyl.tech')) {
    const parts = hostname.split('.jazyl.tech')[0]
    const isAdmin = parts.startsWith('admin.')
    let subdomain = isAdmin ? parts.substring(6) : parts // убираем 'admin.' если есть
    
    // Убираем www если есть
    if (subdomain === 'www') subdomain = ''
    
    return { subdomain, isAdmin }
  }
  
  return { subdomain: null, isAdmin: false }
}

// ИСПРАВЛЕННЫЙ interceptor для requests - объединяем ваш подход с cookie и мой с admin detection
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const { subdomain, isAdmin } = getTenantInfo()
    
    // Добавляем subdomain если он есть и не системный
    if (subdomain && subdomain !== 'jazyl') {
      config.headers['X-Tenant-Subdomain'] = subdomain
    }
    
    // Добавляем токен из cookie (ваш хороший подход!)
    const token = Cookies.get('access-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Также проверяем localStorage как fallback
    const authData = localStorage.getItem('auth-storage')
    if (authData && !token) {
      try {
        const { state } = JSON.parse(authData)
        if (state.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  }
  
  return config
})

// ИСПРАВЛЕННЫЙ interceptor для responses - объединяем оба подхода
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      
      // Не перенаправляем если уже на странице логина
      if (currentPath !== '/login') {
        // Очищаем все данные аутентификации (ваш подход лучше!)
        Cookies.remove('access-token')
        Cookies.remove('auth-user')
        localStorage.removeItem('auth-storage')
        
        window.location.href = '/login'
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

// ====================== MASTERS API ======================
export const getMasters = async (tenantId?: string) => {
  const config: any = {}
  
  // Если tenantId передан явно, используем его
  if (tenantId) {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  // Иначе interceptor автоматически добавит X-Tenant-Subdomain
  
  const response = await api.get('/api/masters', config)
  return response.data
}

export const getMaster = async (masterId: string, tenantId?: string) => {
  const config: any = {}
  
  if (tenantId) {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get(`/api/masters/${masterId}`, config)
  return response.data
}

export const createMaster = async (masterData: any, tenantId?: string) => {
  const config: any = {}
  
  if (tenantId) {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.post('/api/masters', masterData, config)
  return response.data
}

export const updateMaster = async (masterId: string, masterData: any) => {
  const response = await api.put(`/api/masters/${masterId}`, masterData)
  return response.data
}

export const deleteMaster = async (masterId: string) => {
  const response = await api.delete(`/api/masters/${masterId}`)
  return response.data
}

// ====================== MASTER PROFILE API (для мастеров) ======================
export const getMyProfile = async () => {
  const response = await api.get('/api/masters/my-profile')
  return response.data
}

export const updateMyProfile = async (profileData: any) => {
  const response = await api.put('/api/masters/my-profile', profileData)
  return response.data
}

export const uploadMasterPhoto = async (photo: File) => {
  const formData = new FormData()
  formData.append('photo', photo)
  
  const response = await api.post('/api/masters/upload-photo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const getMyAnalytics = async () => {
  const response = await api.get('/api/masters/my-analytics')
  return response.data
}

export const requestPermission = async (permissionData: any) => {
  const response = await api.post('/api/masters/request-permission', permissionData)
  return response.data
}

export const getMyPermissionRequests = async () => {
  const response = await api.get('/api/masters/my-permission-requests')
  return response.data
}

// ====================== SERVICES API ======================
export const getServices = async (tenantId?: string) => {
  const config: any = {}
  
  if (tenantId) {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get('/api/services', config)
  return response.data
}

export const createService = async (serviceData: any, tenantId?: string) => {
  const config: any = {}
  
  if (tenantId) {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.post('/api/services', serviceData, config)
  return response.data
}

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
    config.headers = { 'X-Tenant-ID': tenantId }
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
    config.headers = { 'X-Tenant-ID': tenantId }
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
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get('/api/bookings/availability/slots', config)
  return response.data
}

export const createBooking = async (bookingData: any, tenantId?: string) => {
  const config: any = {}
  
  if (tenantId) {
    config.headers = { 'X-Tenant-ID': tenantId }
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
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get('/api/dashboard/stats', config)
  return response.data
}

export const getTodayOverview = async (tenantId?: string) => {
  const config: any = {}
  
  if (tenantId) {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get('/api/dashboard/today', config)
  return response.data
}

export const getRevenueReport = async (period: string, tenantId?: string) => {
  const config: any = {
    params: { period }
  }
  
  if (tenantId) {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get('/api/dashboard/revenue', config)
  return response.data
}

export default api