'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import {
  LayoutDashboard,
  Calendar,
  Users,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Clock,
  BarChart3
} from 'lucide-react'

interface MasterLayoutProps {
  children: ReactNode
}

export default function MasterLayout({ children }: MasterLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const { user, clearAuth } = useAuthStore()

  const navigation = [
    { name: 'Dashboard', href: '/master', icon: LayoutDashboard },
    { name: 'Schedule', href: '/master/schedule', icon: Calendar },
    { name: 'Bookings', href: '/master/bookings', icon: Calendar },
    { name: 'Clients', href: '/master/clients', icon: Users },
    { name: 'Profile', href: '/master/profile', icon: User },
    { name: 'Settings', href: '/master/settings', icon: Settings },
  ]

  // Ждём инициализации auth store
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Защита роута - проверяем роль пользователя только после инициализации
  useEffect(() => {
    if (!isInitialized) return

    console.log('🔍 Master layout checking auth after init. User:', user)

    if (!user) {
      console.log('❌ No user found after init, redirecting to login')
      router.push('/login')
      return
    }

    if (user.role !== 'master') {
      console.log('❌ User is not a master in layout, role:', user.role)
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

    console.log('✅ Master layout access granted for:', user.email)
  }, [user, router, isInitialized])

  const handleLogout = () => {
    console.log('🔄 Master logging out')
    clearAuth()
    router.push('/login')
  }

  // Показываем загрузку пока не инициализировались или проверяем права доступа
  if (!isInitialized || !user || user.role !== 'master') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
          {/* Debug info в development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 text-xs text-gray-400">
              <p>Initialized: {isInitialized ? '✅' : '❌'}</p>
              <p>User: {user ? `${user.email} (${user.role})` : '❌'}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <Link href="/master" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">J</span>
            </div>
            <span className="text-xl font-bold">Jazyl</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/master' && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className={`mr-3 h-5 w-5 ${
                  isActive ? 'text-blue-500' : 'text-gray-400'
                }`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Quick Actions */}
        <div className="border-t px-3 py-4">
          <div className="space-y-1">
            <Button asChild variant="ghost" className="w-full justify-start" size="sm">
              <Link href="/master/schedule">
                <Clock className="mr-3 h-4 w-4 text-gray-400" />
                <span className="text-sm">Today's Schedule</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start" size="sm">
              <Link href="/master/bookings">
                <BarChart3 className="mr-3 h-4 w-4 text-gray-400" />
                <span className="text-sm">View Stats</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="border-t p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {user?.first_name?.charAt(0) || 'M'}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-400">Master</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-500"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link href="/master" className="hover:text-gray-900">
              Master
            </Link>
            {pathname !== '/master' && (
              <>
                <span>/</span>
                <span className="text-gray-900 capitalize">
                  {pathname.split('/').pop()?.replace('-', ' ')}
                </span>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Status indicator */}
            <div className="hidden md:flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-muted-foreground">Online</span>
            </div>

            {/* Quick access to profile */}
            <Button asChild variant="ghost" size="sm">
              <Link href="/master/profile">
                <User className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}