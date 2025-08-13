'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { login } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  // В handleSubmit после успешного логина добавьте лог для отладки:

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await login(formData.email, formData.password)
      
      console.log('Login response:', response)
      console.log('User role:', response.user.role)
      
      // Store auth data
      setAuth(response.access_token, response.refresh_token, response.user)
      
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      })

      // Small delay to ensure cookies are set
      await new Promise(resolve => setTimeout(resolve, 100))

      // Redirect based on user role
      switch (response.user.role) {
        case 'owner':
          console.log('Redirecting to /dashboard')
          router.push('/dashboard')
          break
        case 'master':
          console.log('Redirecting to /master')
          router.push('/master')
          break
        case 'admin':
          console.log('Redirecting to /admin')
          router.push('/admin')
          break
        case 'client':
          console.log('Redirecting to /profile')
          router.push('/profile')
          break
        default:
          console.log('Redirecting to /')
          router.push('/')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      toast({
        title: "Login Failed",
        description: error.response?.data?.detail || "Invalid email or password",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold">
            Jazyl
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Login to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </form>

            {/* Подсказка для тестирования */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-6 p-4 bg-gray-100 rounded-lg text-sm">
                <p className="font-semibold mb-2">Test Accounts:</p>
                <p>Owner: admin@jazyl.tech</p>
                <p>Master: (create via dashboard)</p>
                <p>Password: Admin123!</p>
              </div>
            )}

            <div className="mt-6 text-center text-sm">
              Don't have an account?{' '}
              <Link href="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}