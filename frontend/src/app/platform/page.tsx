'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Users, Calendar, BarChart3, Shield, Zap } from 'lucide-react'
import Link from 'next/link'

export default function PlatformPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Jazyl</h1>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-5xl font-bold mb-6">
              Modern Booking Platform for Barbershops
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Streamline your barbershop operations with our all-in-one SaaS solution.
              Manage bookings, masters, and clients effortlessly.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/register">
                <Button size="lg">Start Free Trial</Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline">Request Demo</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Everything You Need</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Calendar className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Smart Booking System</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Let clients book appointments 24/7 through your branded subdomain.
                  Automatic confirmations and reminders included.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Master Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Manage your team's schedules, services, and performance.
                  Each master gets their own dashboard.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Track revenue, popular services, and client retention.
                  Make data-driven decisions for your business.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Secure & Reliable</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  SSL encryption, automated backups, and 99.9% uptime.
                  Your data is safe with us.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Mobile Optimized</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Perfect experience on any device. Your clients can book
                  appointments from anywhere.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CheckCircle2 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>White Label</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Your brand, your colors, your subdomain.
                  Completely customizable to match your style.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to Transform Your Barbershop?</h3>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of barbershops already using Jazyl
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; 2025 Jazyl. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
