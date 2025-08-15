import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0];
  const pathname = request.nextUrl.pathname
  const subdomain = hostname.split('.')[0]
  console.log('🟢 hostname:', hostname, 'subdomain:', subdomain, 'pathname:', pathname);
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
    return NextResponse.next()
  }

  // Авторизация
  const authUserCookie = request.cookies.get('auth-user')
  if (!authUserCookie) {
    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/master') ||
      pathname.startsWith('/profile') ||
      pathname.startsWith('/admin')
    ) {
      const url = new URL('/login', request.url)
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  try {
    const authUser = JSON.parse(authUserCookie.value)
    const userRole = authUser.role

    // Проверка доступа
    if (pathname.startsWith('/dashboard')) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        if (userRole === 'master') {
          return NextResponse.redirect(new URL('/master', request.url))
        }
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }

    if (pathname.startsWith('/master')) {
      if (userRole !== 'master') {
        if (userRole === 'owner' || userRole === 'admin') {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }

    if (pathname.startsWith('/admin') && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  } catch (error) {
    console.error('Auth parsing error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
