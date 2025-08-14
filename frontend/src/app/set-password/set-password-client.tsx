'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { Loader2, CheckCircle } from 'lucide-react'

export default function SetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    const emailParam = searchParams.get('email')
    const tokenParam = searchParams.get('token')
    
    if (emailParam) {
      setEmail(emailParam)
    } else if (!tokenParam) {
      // Если нет ни email, ни token, редирект
      router.push('/login')
    }
  }, [searchParams, router])

  const validatePassword = (password: string) => {
    const errors = []
    if (password.length < 8) errors.push('At least 8 characters')
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter')
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter')
    if (!/[0-9]/.test(password)) errors.push('One number')
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      })
      return
    }

    const passwordErrors = validatePassword(formData.password)
    if (passwordErrors.length > 0) {
      toast({
        title: "Weak password",
        description: `Password must have: ${passwordErrors.join(', ')}`,
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      // Если есть token в URL, это сброс пароля
      const token = searchParams.get('token')
      
      if (token) {
        // Reset password flow
        await api.post(`/api/auth/reset-password/${token}`, {
          new_password: formData.password
        })
      } else if (email) {
        // First-time password setup for master
        await api.post('/api/auth/set-initial-password', {
          email: email,
          password: formData.password
        })
      }

      setSuccess(true)
      
      toast({
        title: "Password Set Successfully",
        description: "You can now login with your new password",
      })

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login')
      }, 2000)
      
    } catch (error: any) {
      console.error('Error setting password:', error)
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to set password. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Password Set Successfully!</h2>
              <p className="text-muted-foreground mb-4">
                Redirecting you to login page...
              </p>
              <Link href="/login">
                <Button>Go to Login</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
            <CardTitle>Set Your Password</CardTitle>
            <CardDescription>
              {email ? (
                <>Create a secure password for your account: <strong>{email}</strong></>
              ) : (
                'Create a secure password for your account'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  At least 8 characters with uppercase, lowercase, and number
                </p>
              </div>
              
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
              </div>

              {/* Password strength indicator */}
              {formData.password && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Password requirements:</p>
                  <ul className="text-xs space-y-1">
                    <li className={formData.password.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
                      ✓ At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      ✓ One uppercase letter
                    </li>
                    <li className={/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      ✓ One lowercase letter
                    </li>
                    <li className={/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      ✓ One number
                    </li>
                  </ul>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  'Set Password'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              Already have a password?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}