'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import { getPermissionRequestsStats } from '@/lib/api'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  UserCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  AlertTriangle
} from 'lucide-react'
import { useState } from 'react'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, clearAuth } = useAuthStore()

  // Получаем статистику запросов разрешений для владельца
  const { data: requestsStats } = useQuery({
    queryKey: ['permission-requests-stats'],
    queryFn: getPermissionRequestsStats,
    enabled: !!user && user.role === 'owner',
    refetchInterval: 30000 // Обновляем каждые 30 секунд
  })

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Bookings', href: '/dashboard/bookings', icon: Calendar },
    { name: 'Masters', href: '/dashboard/masters', icon: Users },
    { name: 'Services', href: '/dashboard/services', icon: Scissors },
    { name: 'Clients', href: '/dashboard/clients', icon: UserCircle },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  // Добавляем специальные пункты для владельца
  if (user?.role === 'owner') {
    navigation.splice(-1, 0, {
      name: 'Управление мастерами',
      href: '/dashboard/masters-management',
      icon: Users
    })
    navigation.splice(-1, 0, {
      name: 'Запросы разрешений',
      href: '/dashboard/permission-requests',
      icon: Shield
    })
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
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
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <Link href="/dashboard" className="text-xl font-bold">
            Jazyl
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

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const isPendingRequests = item.href === '/dashboard/permission-requests'
            const hasPendingRequests = requestsStats?.pending > 0
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors relative ${
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
                {isPendingRequests && hasPendingRequests && (
                  <Badge variant="destructive" className="ml-auto px-1 py-0 text-xs">
                    {requestsStats.pending}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="ml-3">
                <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
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
          
          {/* Показываем уведомления о новых запросах */}
          {user?.role === 'owner' && requestsStats?.pending > 0 && (
            <div className="ml-auto">
              <Link href="/dashboard/permission-requests">
                <Button variant="outline" size="sm" className="relative">
                  <AlertTriangle className="h-4 w-4 mr-1 text-yellow-600" />
                  {requestsStats.pending} новых запросов
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}