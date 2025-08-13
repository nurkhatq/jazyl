import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Получаем данные авторизации из cookies
  const authCookie = request.cookies.get('auth-storage')
  
  if (!authCookie) {
    // Если нет авторизации, редирект на логин
    if (pathname.startsWith('/dashboard') || 
        pathname.startsWith('/master') || 
        pathname.startsWith('/profile')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  try {
    const authData = JSON.parse(authCookie.value)
    const userRole = authData?.state?.user?.role

    // Проверка доступа по ролям
    if (pathname.startsWith('/dashboard') && userRole !== 'owner') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    
    if (pathname.startsWith('/master') && userRole !== 'master') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    
    if (pathname.startsWith('/admin') && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

  } catch (error) {
    console.error('Auth parsing error:', error)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/master/:path*', '/admin/:path*', '/profile/:path*']
}