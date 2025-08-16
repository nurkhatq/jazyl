import axios from 'axios'
import Cookies from 'js-cookie'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.jazyl.tech'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add subdomain to requests
api.interceptors.request.use((config) => {
  // Add subdomain
  if (typeof window !== 'undefined') {
    const subdomain = window.location.hostname.split('.')[0]
    if (subdomain && subdomain !== 'www' && subdomain !== 'jazyl') {
      config.headers['X-Tenant-Subdomain'] = subdomain
    }
    
    // Add auth token from cookie
    const token = Cookies.get('access-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  
  return config
})

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      // Clear auth and redirect to login
      if (typeof window !== 'undefined') {
        // Clear all auth data
        Cookies.remove('access-token')
        Cookies.remove('auth-user')
        localStorage.removeItem('auth-storage')
        
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Tenant API
export const getTenantBySubdomain = async (subdomain: string) => {
  const response = await api.get(`/api/tenants/subdomain/${subdomain}`)
  return response.data
}

// Masters API
export const getMasters = async (tenantId: string) => {
  const response = await api.get('/api/masters', {
    headers: { 'X-Tenant-ID': tenantId }
  })
  return response.data
}

// Services API
export const getServices = async (tenantId: string) => {
  const response = await api.get('/api/services', {
    headers: { 'X-Tenant-ID': tenantId }
  })
  return response.data
}

// Booking API
export const getAvailableSlots = async (
  tenantId: string,
  masterId: string,
  date: Date,
  serviceId: string
) => {
  const response = await api.get('/api/bookings/availability/slots', {
    params: {
      master_id: masterId,
      date: date.toISOString().split('T')[0],
      service_id: serviceId,
    },
    headers: { 'X-Tenant-ID': tenantId }
  })
  return response.data
}
// Add these functions to the existing api.ts file

// Tenant Management
export const createTenant = async (tenantData: any) => {
  const response = await api.post('/api/tenants', tenantData)
  return response.data
}

export const updateTenant = async (tenantId: string, tenantData: any) => {
  const response = await api.put(`/api/tenants/${tenantId}`, tenantData)
  return response.data
}

// Dashboard Stats
export const getDashboardStats = async (tenantId: string, dateFrom?: string, dateTo?: string) => {
  const response = await api.get('/api/dashboard/stats', {
    params: { date_from: dateFrom, date_to: dateTo },
    headers: { 'X-Tenant-ID': tenantId }
  })
  return response.data
}

export const getTodayOverview = async (tenantId: string) => {
  const response = await api.get('/api/dashboard/today', {
    headers: { 'X-Tenant-ID': tenantId }
  })
  return response.data
}

export const getRevenueReport = async (tenantId: string, period: string) => {
  const response = await api.get('/api/dashboard/revenue', {
    params: { period },
    headers: { 'X-Tenant-ID': tenantId }
  })
  return response.data
}

// Masters Management
export const createMaster = async (tenantId: string, masterData: any) => {
  const response = await api.post('/api/masters', masterData, {
    headers: { 'X-Tenant-ID': tenantId }
  })
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

// Services Management
export const createService = async (tenantId: string, serviceData: any) => {
  const response = await api.post('/api/services', serviceData, {
    headers: { 'X-Tenant-ID': tenantId }
  })
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

// Clients Management
export const getClients = async (tenantId: string, search?: string) => {
  const response = await api.get('/api/clients', {
    params: { search },
    headers: { 'X-Tenant-ID': tenantId }
  })
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
export const createBooking = async (tenantId: string, bookingData: any) => {
  const response = await api.post('/api/bookings', bookingData, {
    headers: { 'X-Tenant-ID': tenantId }
  })
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

// Auth API
// Замените существующую функцию login на эту:
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

export default api