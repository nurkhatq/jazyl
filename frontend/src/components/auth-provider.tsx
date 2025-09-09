'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import Cookies from 'js-cookie'

/**
 * AuthProvider - инициализирует аутентификацию при загрузке приложения
 * Синхронизирует localStorage с cookies для корректной работы middleware
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setAuth, clearAuth } = useAuthStore()

  useEffect(() => {
    // Инициализация аутентификации при загрузке приложения
    const initAuth = () => {
      try {
        // Проверяем localStorage
        const authStorage = localStorage.getItem('auth-storage')
        if (authStorage) {
          const parsed = JSON.parse(authStorage)
          const { user: storedUser, accessToken, refreshToken } = parsed.state || {}
          
          if (storedUser && accessToken) {
            // Проверяем cookie middleware
            const cookieUser = Cookies.get('auth-user')
            
            if (!cookieUser) {
              // Восстанавливаем cookie для middleware
              console.log('🔄 Restoring auth cookies from localStorage')
              setAuth(accessToken, refreshToken || '', storedUser)
            } else {
              // Проверяем, что данные совпадают
              try {
                const parsedCookieUser = JSON.parse(cookieUser)
                if (parsedCookieUser.id !== storedUser.id) {
                  console.log('🔄 Syncing auth data - user mismatch')
                  setAuth(accessToken, refreshToken || '', storedUser)
                }
              } catch (e) {
                console.log('🔄 Fixing corrupted auth cookie')
                setAuth(accessToken, refreshToken || '', storedUser)
              }
            }
            
            console.log('✅ Auth initialized for user:', storedUser.email, 'role:', storedUser.role)
          }
        } else {
          // localStorage пустой, но может быть cookie
          const cookieUser = Cookies.get('auth-user')
          const cookieToken = Cookies.get('access-token')
          
          if (cookieUser && !user) {
            // Очищаем устаревший cookie без localStorage
            console.log('🧹 Cleaning orphaned cookies')
            clearAuth()
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        // Очищаем поврежденные данные
        clearAuth()
      }
    }

    // Запускаем инициализацию
    initAuth()

    // Слушаем изменения в других вкладках
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-storage') {
        if (!e.newValue) {
          // Данные удалены в другой вкладке
          console.log('🔄 Auth cleared in another tab')
          clearAuth()
        } else {
          // Данные обновлены в другой вкладке
          console.log('🔄 Auth updated in another tab')
          initAuth()
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [setAuth, clearAuth, user])

  return <>{children}</>
}