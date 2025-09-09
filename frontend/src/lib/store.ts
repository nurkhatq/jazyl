import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Cookies from 'js-cookie'

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  tenant_id: string
  phone?: string
  is_active?: boolean
  is_verified?: boolean
  created_at?: string
  updated_at?: string
  last_login?: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (accessToken: string, refreshToken: string, user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (accessToken, refreshToken, user) => {
        console.log('🔄 Setting auth for user:', user.email, 'role:', user.role)
        
        // ИСПРАВЛЕНО: Сохраняем в cookies с правильным именем для middleware
        Cookies.set('auth-user', JSON.stringify(user), { 
          expires: 7,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        })
        
        // Также сохраняем токен отдельно для API
        Cookies.set('access-token', accessToken, {
          expires: 7,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        })
        
        console.log('✅ Cookies set:', {
          'auth-user': JSON.stringify(user),
          'access-token': accessToken.substring(0, 20) + '...'
        })
        
        set({ accessToken, refreshToken, user })
      },
      clearAuth: () => {
        console.log('🧹 Clearing auth')
        
        // ИСПРАВЛЕНО: Удаляем все cookies с правильными именами
        Cookies.remove('auth-user')
        Cookies.remove('access-token') 
        Cookies.remove('auth-storage')
        Cookies.remove('auth-data') // Удаляем старый cookie если есть
        
        set({ user: null, accessToken: null, refreshToken: null })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => {
        return {
          getItem: (name) => {
            const value = localStorage.getItem(name)
            // ИСПРАВЛЕНО: Синхронизируем с cookies при чтении
            if (value) {
              try {
                const parsed = JSON.parse(value)
                if (parsed?.state?.user) {
                  // Проверяем, есть ли правильный cookie
                  const existingCookie = Cookies.get('auth-user')
                  if (!existingCookie) {
                    console.log('🔄 Restoring auth-user cookie from localStorage')
                    Cookies.set('auth-user', JSON.stringify(parsed.state.user), {
                      expires: 7,
                      sameSite: 'lax',
                      secure: process.env.NODE_ENV === 'production'
                    })
                  }
                  
                  if (parsed?.state?.accessToken) {
                    const existingToken = Cookies.get('access-token')
                    if (!existingToken) {
                      console.log('🔄 Restoring access-token cookie from localStorage')
                      Cookies.set('access-token', parsed.state.accessToken, {
                        expires: 7,
                        sameSite: 'lax',
                        secure: process.env.NODE_ENV === 'production'
                      })
                    }
                  }
                }
              } catch (e) {
                console.error('Failed to sync auth to cookies:', e)
              }
            }
            return value
          },
          setItem: (name, value) => {
            localStorage.setItem(name, value)
            // ИСПРАВЛЕНО: Синхронизируем с cookies при записи
            try {
              const parsed = JSON.parse(value)
              if (parsed?.state?.user) {
                console.log('🔄 Syncing auth-user cookie from localStorage write')
                Cookies.set('auth-user', JSON.stringify(parsed.state.user), {
                  expires: 7,
                  sameSite: 'lax',
                  secure: process.env.NODE_ENV === 'production'
                })
                
                if (parsed?.state?.accessToken) {
                  console.log('🔄 Syncing access-token cookie from localStorage write')
                  Cookies.set('access-token', parsed.state.accessToken, {
                    expires: 7,
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production'
                  })
                }
              }
            } catch (e) {
              console.error('Failed to sync auth to cookies:', e)
            }
          },
          removeItem: (name) => {
            localStorage.removeItem(name)
            Cookies.remove('auth-user')
            Cookies.remove('access-token')
            Cookies.remove('auth-data') // Remove old cookie
          }
        }
      })
    }
  )
)

interface BookingState {
  selectedMaster: string | null
  selectedService: string | null
  selectedDate: Date | null
  selectedTime: string | null
  setBookingData: (data: Partial<BookingState>) => void
  clearBookingData: () => void
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedMaster: null,
  selectedService: null,
  selectedDate: null,
  selectedTime: null,
  setBookingData: (data) => set((state) => ({ ...state, ...data })),
  clearBookingData: () =>
    set({
      selectedMaster: null,
      selectedService: null,
      selectedDate: null,
      selectedTime: null,
    }),
}))