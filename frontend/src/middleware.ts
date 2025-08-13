import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Пропускаем публичные страницы
  const publicPaths = ['/login', '/register', '/forgot-password', '/', '/platform']
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }
  
  // Получаем данные авторизации из cookies
  const authUserCookie = request.cookies.get('auth-user')
  
  // Если нет авторизации, редирект на логин
  if (!authUserCookie) {
    if (pathname.startsWith('/dashboard') || 
        pathname.startsWith('/master') || 
        pathname.startsWith('/profile') ||
        pathname.startsWith('/admin')) {
      const url = new URL('/login', request.url)
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  try {
    const authUser = JSON.parse(authUserCookie.value)
    const userRole = authUser.role

    // Проверка доступа по ролям
    if (pathname.startsWith('/dashboard')) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        // Редирект на правильный дашборд
        if (userRole === 'master') {
          return NextResponse.redirect(new URL('/master', request.url))
        }
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }
    
    if (pathname.startsWith('/master')) {
      if (userRole !== 'master') {
        // Редирект на правильный дашборд
        if (userRole === 'owner' || userRole === 'admin') {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }
    
    if (pathname.startsWith('/admin')) {
      if (userRole !== 'admin') {
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }

  } catch (error) {
    console.error('Auth parsing error:', error)
    // При ошибке парсинга - редирект на логин
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
}