// frontend/src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  
  console.log('🔍 [MIDDLEWARE] Processing:', { hostname, pathname })
  
  // Extract subdomain
  let subdomain = ''
  if (hostname.includes('.')) {
    subdomain = hostname.split('.')[0]
  } else if (hostname.includes('localhost')) {
    subdomain = 'localhost'
  }
  
  console.log('🔍 [MIDDLEWARE] Subdomain:', subdomain)
  
  // Main platform domains
  const isPlatformDomain = subdomain === 'jazyl' || 
                          subdomain === 'www' || 
                          subdomain === 'localhost' ||
                          subdomain === ''
  
  // Platform paths (admin, dashboard, auth, etc.)
  const isPlatformPath = pathname.startsWith('/dashboard') ||
                         pathname.startsWith('/admin') ||
                         pathname.startsWith('/owner') ||
                         pathname.startsWith('/master') ||
                         pathname.startsWith('/login') ||
                         pathname.startsWith('/register') ||
                         pathname.startsWith('/auth') ||
                         pathname.startsWith('/api') ||
                         pathname.startsWith('/set-password') ||
                         pathname.startsWith('/forgot-password') ||
                         pathname.startsWith('/verify-email')
  
  console.log('🔍 [MIDDLEWARE] Is platform?', { isPlatformDomain, isPlatformPath })
  
  // === PLATFORM SITE ===
  if (isPlatformDomain) {
    console.log('✅ [MIDDLEWARE] Platform domain, allowing:', pathname)
    
    // Add headers for API calls
    const response = NextResponse.next()
    response.headers.set('X-Site-Type', 'platform')
    return response
  }
  
  // === CLIENT SITE (barbershop subdomain) ===
  if (!isPlatformDomain) {
    console.log('🏪 [MIDDLEWARE] Client domain:', subdomain)
    
    // Block platform paths on client sites
    if (isPlatformPath && !pathname.startsWith('/api')) {
      console.log('❌ [MIDDLEWARE] Blocking platform path on client site:', pathname)
      return NextResponse.rewrite(new URL('/404', request.url))
    }
    
    // Client site allowed paths
    const isClientPath = pathname === '/' ||
                        pathname === '/my-bookings' ||
                        pathname.startsWith('/booking/confirm') ||
                        pathname.startsWith('/booking/cancel') ||
                        pathname.startsWith('/master/') ||
                        pathname.startsWith('/service') ||
                        pathname.startsWith('/api') ||
                        pathname === '/404' ||
                        // Static assets
                        pathname.startsWith('/_next') ||
                        pathname.startsWith('/static') ||
                        pathname.includes('.') // files with extensions
    
    if (isClientPath) {
      console.log('✅ [MIDDLEWARE] Client path allowed:', pathname)
      
      // Add subdomain header for API calls
      const response = NextResponse.next()
      response.headers.set('X-Tenant-Subdomain', subdomain)
      response.headers.set('X-Site-Type', 'client')
      
      return response
    }
    
    // Path not found for client site
    console.log('❌ [MIDDLEWARE] Path not found for client site:', pathname)
    return NextResponse.rewrite(new URL('/404', request.url))
  }
  
  console.log('✅ [MIDDLEWARE] Default allow:', pathname)
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt (metadata files)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|public/).*)',
  ],
}