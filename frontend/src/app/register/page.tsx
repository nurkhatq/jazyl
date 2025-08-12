'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { register, createTenant } from '@/lib/api'
import { Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  
  const [barbershopData, setBarbershopData] = useState({
    name: '',
    subdomain: '',
    address: '',
    phone: '',
  })
  
  const [userData, setUserData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
  })

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate subdomain
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
    if (!subdomainRegex.test(barbershopData.subdomain)) {
      toast({
        title: "Invalid Subdomain",
        description: "Subdomain can only contain lowercase letters, numbers, and hyphens",
        variant: "destructive",
      })
      return
    }
    
    setStep(2)
  }

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (userData.password !== userData.confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      })
      return
    }
    
    setLoading(true)

    try {
      // Create tenant first
      const tenant = await createTenant({
        name: barbershopData.name,
        subdomain: barbershopData.subdomain,
        email: userData.email,
        phone: barbershopData.phone,
        address: barbershopData.address,
      })

      // Then create user
      await register({
        ...userData,
        tenant_id: tenant.id,
        role: 'owner',
      })

      toast({
        title: "Registration Successful!",
        description: "Please check your email to verify your account.",
      })

      router.push('/login')
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.response?.data?.detail || "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold">
            Jazyl
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Your Barbershop</CardTitle>
            <CardDescription>
              {step === 1 ? 'Step 1: Barbershop Information' : 'Step 2: Your Account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Barbershop Name</Label>
                  <Input
                    id="name"
                    value={barbershopData.name}
                    onChange={(e) => setBarbershopData({ ...barbershopData, name: e.target.value })}
                    placeholder="Cool Cuts Barbershop"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="subdomain">Subdomain</Label>
                  <div className="flex items-center">
                    <Input
                      id="subdomain"
                      value={barbershopData.subdomain}
                      onChange={(e) => setBarbershopData({ 
                        ...barbershopData, 
                        subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                      })}
                      placeholder="coolcuts"
                      required
                    />
                    <span className="ml-2 text-sm text-gray-600">.jazyl.tech</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This will be your unique URL
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={barbershopData.phone}
                    onChange={(e) => setBarbershopData({ ...barbershopData, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={barbershopData.address}
                    onChange={(e) => setBarbershopData({ ...barbershopData, address: e.target.value })}
                    placeholder="123 Main St, City, State"
                    required
                  />
                </div>

                <Button type="submit" className="w-full">
                  Continue
                </Button>
              </form>
            ) : (
              <form onSubmit={handleStep2Submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={userData.first_name}
                      onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={userData.last_name}
                      onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userData.email}
                    onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={userData.password}
                    onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    At least 8 characters with uppercase, lowercase, and number
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={userData.confirmPassword}
                    onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                    required
                  />
                </div>

                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-6 text-center text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}