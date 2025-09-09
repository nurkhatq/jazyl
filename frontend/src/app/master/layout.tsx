'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import {
  Home,
  Calendar,
  Clock,
  User,
  Menu,
  X,
  LogOut,
  Settings
} from 'lucide-react'

interface MasterLayoutProps {
  children: ReactNode
}

export default function MasterLayout({ children }: MasterLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isInitialized, setIsInitialized] = useState(false)
  const { user, clearAuth } = useAuthStore()

  const navigation = [
    { name: 'Главная', href: '/master', icon: Home },
    { name: 'Расписание', href: '/master/schedule', icon: Calendar },
    { name: 'Записи', href: '/master/bookings', icon: Clock },
    { name: 'Профиль', href: '/master/profile', icon: User },
  ]

  // Ждём инициализации auth store
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Защита роута
  useEffect(() => {
    if (!isInitialized) return

    if (!user) {
      router.push('/login')
      return
    }

    if (user.role !== 'master') {
      switch (user.role) {
        case 'owner':
        case 'admin':
          router.push('/dashboard')
          break
        case 'client':
          router.push('/profile')
          break
        default:
          router.push('/login')
      }
      return
    }
  }, [user, router, isInitialized])

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  // Показываем загрузку
  if (!isInitialized || !user || user.role !== 'master') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main content */}
      <main className="pb-20">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="grid grid-cols-4 h-16">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/master' && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Settings Menu - можно вызвать свайпом или долгим нажатием */}
      <div className="fixed top-4 right-4 z-40">
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm border shadow-sm"
            onClick={() => {
              // Можно добавить выпадающее меню или перейти в настройки
              router.push('/master/profile')
            }}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}