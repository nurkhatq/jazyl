'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import Cookies from 'js-cookie'

// Временный компонент для дебага аутентификации
function AuthDebug() {
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    console.log('🔍 Current auth state:', {
      user,
      'auth-user cookie': Cookies.get('auth-user'),
      'access-token cookie': Cookies.get('access-token'),
      'localStorage auth': localStorage.getItem('auth-storage'),
      'current pathname': window.location.pathname
    })
  }, [user])

  return (
    <div className="bg-gray-100 p-4 rounded mb-4 text-sm">
      <h3 className="font-bold mb-2">🔍 Debug Info:</h3>
      <div className="space-y-1">
        <p><strong>User:</strong> {user ? `${user.email} (${user.role})` : 'None'}</p>
        <p><strong>auth-user cookie:</strong> {Cookies.get('auth-user') ? '✅ Set' : '❌ Missing'}</p>
        <p><strong>access-token cookie:</strong> {Cookies.get('access-token') ? '✅ Set' : '❌ Missing'}</p>
        <p><strong>localStorage:</strong> {localStorage.getItem('auth-storage') ? '✅ Set' : '❌ Missing'}</p>
      </div>
    </div>
  )
}

export default function MasterDashboard() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  // Защита роута
  useEffect(() => {
    console.log('🚨 Master page useEffect triggered. User:', user)

    if (!user) {
      console.log('❌ No user found, redirecting to login')
      router.push('/login')
      return
    }

    if (user.role !== 'master') {
      console.log('❌ User is not a master, role:', user.role)
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

    console.log('✅ Master access granted for:', user.email)
  }, [user, router])

  // Показываем загрузку пока проверяем права доступа
  if (!user || user.role !== 'master') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Master Dashboard</h1>
        
        {/* Debug info - remove in production */}
        <AuthDebug />

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Welcome back, {user.first_name}!
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-blue-50 p-4 rounded">
              <h3 className="font-medium text-blue-900">Today's Schedule</h3>
              <p className="text-blue-700">No appointments today</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded">
              <h3 className="font-medium text-green-900">This Week</h3>
              <p className="text-green-700">0 appointments completed</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded">
            <h3 className="font-medium text-yellow-800 mb-2">🧪 Test Instructions:</h3>
            <ol className="text-yellow-700 text-sm space-y-1 list-decimal list-inside">
              <li>Check that you can see this page</li>
              <li>Press F5 to refresh the page</li>
              <li>Verify you're NOT redirected to login</li>
              <li>Check the browser console for auth logs</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}