export interface Tenant {
  id: string
  subdomain: string
  name: string
  email: string
  phone?: string
  address?: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  working_hours: Record<string, { open: string; close: string }>
  booking_settings: {
    min_advance_hours: number
    max_advance_days: number
    slot_duration: number
    allow_cancellation: boolean
    cancellation_hours: number
  }
  is_active: boolean
  is_verified: boolean
}

export interface User {
  id: string
  email: string
  first_name: string
  last_name?: string
  phone?: string
  role: 'owner' | 'master' | 'admin' | 'client'
  tenant_id: string
  is_active: boolean
  is_verified: boolean
  created_at?: string
}

export interface Master {
  id: string
  tenant_id: string
  user_id: string
  display_name: string
  description?: string
  photo_url?: string
  specialization: string[]
  rating: number
  reviews_count: number
  is_active: boolean
  is_visible: boolean
  schedules?: MasterSchedule[]
}

export interface MasterSchedule {
  day_of_week: number
  start_time: string
  end_time: string
  is_working: boolean
}

export interface Service {
  id: string
  tenant_id: string
  category_id?: string
  category?: ServiceCategory
  name: string
  description?: string
  price: number
  duration: number
  is_active: boolean
  is_popular: boolean
}

export interface ServiceCategory {
  id: string
  name: string
  description?: string
  sort_order: number
}

export interface Booking {
  id: string
  tenant_id: string
  master_id: string
  service_id: string
  client_id: string
  date: string
  end_time: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  price: number
  notes?: string
  confirmation_token: string
  cancellation_token: string
  confirmed_at?: string
  cancelled_at?: string
  cancellation_reason?: string
}

export interface Client {
  id: string
  tenant_id: string
  email: string
  phone: string
  first_name: string
  last_name?: string
  total_visits: number
  total_spent: number
  last_visit?: string
  is_vip: boolean
  is_blacklisted: boolean
}