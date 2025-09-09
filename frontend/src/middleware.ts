import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0];
  const pathname = request.nextUrl.pathname
  const subdomain = hostname.split('.')[0]
  
  console.log('🟢 MIDDLEWARE:', {
    hostname,
    subdomain, 
    pathname,
    cookies: {
      'auth-user': request.cookies.get('auth-user')?.value?.substring(0, 50) + '...' || 'MISSING',
      'auth-data': request.cookies.get('auth-data')?.value?.substring(0, 50) + '...' || 'MISSING',
      'access-token': request.cookies.get('access-token')?.value?.substring(0, 20) + '...' || 'MISSING'
    }
  });

  // === Логика для поддоменов (барбершоп) ===
  if (subdomain !== 'jazyl' && subdomain !== 'www' && hostname.includes('.')) {
    // Это поддомен барбершопа
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-subdomain', subdomain)

    // Если URL не начинается с /barbershop — переписываем
    if (!pathname.startsWith('/barbershop')) {
      return NextResponse.rewrite(
        new URL(`/barbershop${pathname}`, request.url),
        {
          request: { headers: requestHeaders },
        }
      )
    }

    return NextResponse.next()
  }

  // === Логика для основного домена ===

  // Перенаправляем корень на /platform
  if (pathname === '/') {
    return NextResponse.rewrite(new URL('/platform', request.url))
  }

  // Публичные страницы
  const publicPaths = ['/login', '/register', '/forgot-password', '/', '/platform']
  if (publicPaths.some(path => pathname.startsWith(path))) {
    console.log('🟢 PUBLIC PATH, allowing:', pathname)
    return NextResponse.next()
  }

  // Авторизация
  const authUserCookie = request.cookies.get('auth-user')
  console.log('🔍 AUTH CHECK:', {
    path: pathname,
    hasCookie: !!authUserCookie,
    cookieValue: authUserCookie?.value?.substring(0, 100) + '...' || 'NONE'
  })

  if (!authUserCookie) {
    console.log('❌ NO AUTH COOKIE FOUND')
    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/master') ||
      pathname.startsWith('/profile') ||
      pathname.startsWith('/admin')
    ) {
      console.log('🚨 REDIRECTING TO LOGIN from:', pathname)
      const url = new URL('/login', request.url)
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  try {
    const authUser = JSON.parse(authUserCookie.value)
    const userRole = authUser.role
    
    console.log('✅ AUTH PARSED:', {
      email: authUser.email,
      role: userRole,
      path: pathname
    })

    // Проверка доступа
    if (pathname.startsWith('/dashboard')) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        if (userRole === 'master') {
          console.log('🔄 DASHBOARD->MASTER redirect')
          return NextResponse.redirect(new URL('/master', request.url))
        }
        console.log('❌ UNAUTHORIZED for dashboard')
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }

    if (pathname.startsWith('/master')) {
      if (userRole !== 'master') {
        if (userRole === 'owner' || userRole === 'admin') {
          console.log('🔄 MASTER->DASHBOARD redirect')
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        console.log('❌ UNAUTHORIZED for master')
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      } else {
        console.log('✅ MASTER ACCESS GRANTED')
      }
    }

    if (pathname.startsWith('/admin') && userRole !== 'admin') {
      console.log('❌ UNAUTHORIZED for admin')
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  } catch (error) {
    console.error('❌ AUTH PARSING ERROR:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  console.log('✅ MIDDLEWARE PASS')
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}