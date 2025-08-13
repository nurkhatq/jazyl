'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export default function UnauthorizedPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  const handleRedirect = () => {
    if (user) {
      switch (user.role) {
        case 'owner':
          router.push('/dashboard')
          break
        case 'master':
          router.push('/master')
          break
        case 'client':
          router.push('/profile')
          break
        default:
          router.push('/')
      }
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">403 - Unauthorized</h1>
        <p className="text-gray-600 mb-8">
          You don't have permission to access this page.
        </p>
        <Button onClick={handleRedirect}>
          Go to Your Dashboard
        </Button>
      </div>
    </div>
  )
}