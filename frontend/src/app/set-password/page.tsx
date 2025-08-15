import dynamic from 'next/dynamic'

const SetPasswordClient = dynamic(
  () => import('./set-password-client'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }
)

export default function SetPasswordPage() {
  return <SetPasswordClient />
}