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
        // Сохраняем в cookies для middleware
        Cookies.set('auth-data', JSON.stringify(user), { 
          expires: 7,
          sameSite: 'lax'
        })
        
        set({ accessToken, refreshToken, user })
      },
      clearAuth: () => {
        // Удаляем cookies
        Cookies.remove('auth-data')
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
            // Дублируем в cookies для middleware
            if (value) {
              try {
                const parsed = JSON.parse(value)
                if (parsed?.state?.user) {
                  Cookies.set('auth-data', JSON.stringify(parsed.state.user), {
                    expires: 7,
                    sameSite: 'lax'
                  })
                }
              } catch (e) {
                console.error('Failed to sync auth to cookies:', e)
              }
            }
            return value
          },
          setItem: (name, value) => {
            localStorage.setItem(name, value)
            // Дублируем в cookies для middleware
            try {
              const parsed = JSON.parse(value)
              if (parsed?.state?.user) {
                Cookies.set('auth-data', JSON.stringify(parsed.state.user), {
                  expires: 7,
                  sameSite: 'lax'
                })
              }
            } catch (e) {
              console.error('Failed to sync auth to cookies:', e)
            }
          },
          removeItem: (name) => {
            localStorage.removeItem(name)
            Cookies.remove('auth-data')
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