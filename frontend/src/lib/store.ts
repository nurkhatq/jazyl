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
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (accessToken: string, refreshToken: string, user: User) => void
  clearAuth: () => void
}

// Custom storage для синхронизации с cookies
const cookieStorage = {
  getItem: (name: string) => {
    // Читаем из localStorage для клиента
    if (typeof window !== 'undefined') {
      return localStorage.getItem(name)
    }
    return null
  },
  setItem: (name: string, value: string) => {
    // Сохраняем в localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(name, value)
      
      // Также сохраняем критичные данные в cookies для middleware
      try {
        const data = JSON.parse(value)
        if (data.state?.user) {
          // Сохраняем минимальную информацию в cookie для проверки на сервере
          Cookies.set('auth-user', JSON.stringify({
            role: data.state.user.role,
            id: data.state.user.id,
            email: data.state.user.email
          }), { 
            expires: 7,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
          })
        }
      } catch (e) {
        console.error('Error setting auth cookie:', e)
      }
    }
  },
  removeItem: (name: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(name)
      // Удаляем cookie при logout
      Cookies.remove('auth-user')
    }
  },
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (accessToken, refreshToken, user) => {
        // Сохраняем токен в cookie для API запросов
        Cookies.set('access-token', accessToken, { 
          expires: 1/48, // 30 минут
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        })
        
        set({ accessToken, refreshToken, user })
      },
      clearAuth: () => {
        // Удаляем все cookies
        Cookies.remove('access-token')
        Cookies.remove('auth-user')
        
        set({ user: null, accessToken: null, refreshToken: null })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => cookieStorage),
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