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
        
        set({ accessToken, refreshToken, user })
      },
      clearAuth: () => {
        // ИСПРАВЛЕНО: Удаляем все cookies с правильными именами
        Cookies.remove('auth-user')
        Cookies.remove('access-token')
        Cookies.remove('auth-storage')
        
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
                  Cookies.set('auth-user', JSON.stringify(parsed.state.user), {
                    expires: 7,
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production'
                  })
                  
                  if (parsed?.state?.accessToken) {
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
            }
            return value
          },
          setItem: (name, value) => {
            localStorage.setItem(name, value)
            // ИСПРАВЛЕНО: Синхронизируем с cookies при записи
            try {
              const parsed = JSON.parse(value)
              if (parsed?.state?.user) {
                Cookies.set('auth-user', JSON.stringify(parsed.state.user), {
                  expires: 7,
                  sameSite: 'lax',
                  secure: process.env.NODE_ENV === 'production'
                })
                
                if (parsed?.state?.accessToken) {
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