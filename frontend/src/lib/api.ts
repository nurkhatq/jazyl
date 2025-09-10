import axios from 'axios'

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
    const subdomain = isAdmin ? parts.substring(6) : parts // убираем 'admin.' если есть
    
    return { subdomain, isAdmin }
  }
  
  return { subdomain: null, isAdmin: false }
}

// Auth API
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

// Tenants API
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

// Masters API
export const getMasters = async (tenantId?: string) => {
  const config: any = {}
  
  // Если tenantId не передан, пытаемся получить из URL
  if (!tenantId) {
    const { subdomain } = getTenantInfo()
    if (subdomain) {
      config.headers = { 'X-Tenant-Subdomain': subdomain }
    }
  } else {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get('/api/masters', config)
  return response.data
}

export const getMaster = async (masterId: string, tenantId?: string) => {
  const config: any = {}
  
  if (!tenantId) {
    const { subdomain } = getTenantInfo()
    if (subdomain) {
      config.headers = { 'X-Tenant-Subdomain': subdomain }
    }
  } else {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get(`/api/masters/${masterId}`, config)
  return response.data
}

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

// Services API
export const getServices = async (tenantId?: string) => {
  const config: any = {}
  
  if (!tenantId) {
    const { subdomain } = getTenantInfo()
    if (subdomain) {
      config.headers = { 'X-Tenant-Subdomain': subdomain }
    }
  } else {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get('/api/services', config)
  return response.data
}

export const createService = async (serviceData: any) => {
  const response = await api.post('/api/services', serviceData)
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

// Clients API
export const getClients = async (search?: string, tenantId?: string) => {
  const config: any = {
    params: { search },
  }
  
  if (!tenantId) {
    const { subdomain } = getTenantInfo()
    if (subdomain) {
      config.headers = { 'X-Tenant-Subdomain': subdomain }
    }
  } else {
    config.headers = { 'X-Tenant-ID': tenantId }
  }
  
  const response = await api.get('/api/clients', config)
  return response.data
}

export const getClient = async (clientId: string) => {
  const response = await api.get(`/api/clients/${clientId}`)
  return response.data
}

export const updateClient = async (clientId: string, clientData: any) => {
  const response = await api.put(`/api/clients/${clientId}`, clientData)
  return response.data
}

export const createClient = async (clientData: any) => {
  const { subdomain } = getTenantInfo()
  const config = subdomain ? { headers: { 'X-Tenant-Subdomain': subdomain } } : {}
  
  const response = await api.post('/api/clients', clientData, config)
  return response.data
}

// Bookings API
export const createBooking = async (bookingData: any, tenantId?: string) => {
  const config: any = {}
  
  if (!tenantId) {
    const { subdomain } = getTenantInfo()
    if (subdomain) {
      config.headers = { 'X-Tenant-Subdomain': subdomain }
    }
  } else {
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

// Dashboard API
export const getDashboardStats = async () => {
  const response = await api.get('/api/dashboard/stats')
  return response.data
}

export const getTodayOverview = async () => {
  const response = await api.get('/api/dashboard/today')
  return response.data
}

// Add auth interceptor for protected routes
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const authData = localStorage.getItem('auth-storage')
    if (authData) {
      const { state } = JSON.parse(authData)
      if (state.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`
      }
    }
    
    // Добавляем tenant info если не установлен
    const { subdomain } = getTenantInfo()
    if (subdomain && !config.headers['X-Tenant-ID'] && !config.headers['X-Tenant-Subdomain']) {
      config.headers['X-Tenant-Subdomain'] = subdomain
    }
  }
  return config
})

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api