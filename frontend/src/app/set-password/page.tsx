import { Suspense } from 'react'
import SetPasswordClient from './set-password-client'

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <SetPasswordClient />
    </Suspense>
  )
}