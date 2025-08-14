'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import Link from 'next/link'

interface VerifyEmailClientProps {
  token: string
}

export default function VerifyEmailClient({ token }: VerifyEmailClientProps) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        await api.post(`/api/auth/verify-email/${token}`)
        setStatus('success')
        setMessage('Your email has been verified successfully!')
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } catch (error: any) {
        setStatus('error')
        setMessage(error.response?.data?.detail || 'Invalid or expired verification link')
      }
    }

    verifyEmail()
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Verifying your email...</h2>
              </>
            )}
            
            {status === 'success' && (
              <>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Email Verified!</h2>
                <p className="text-muted-foreground mb-4">{message}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Redirecting to login page...
                </p>
                <Link href="/login">
                  <Button>Go to Login</Button>
                </Link>
              </>
            )}
            
            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Verification Failed</h2>
                <p className="text-muted-foreground mb-4">{message}</p>
                <Link href="/login">
                  <Button>Go to Login</Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}