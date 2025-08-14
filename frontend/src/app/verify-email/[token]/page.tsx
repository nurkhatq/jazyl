import { Suspense } from 'react'
import VerifyEmailClient from './verify-email-client'

export default function VerifyEmailPage({ params }: { params: { token: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <VerifyEmailClient token={params.token} />
    </Suspense>
  )
}