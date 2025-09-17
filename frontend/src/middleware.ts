import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  
  console.log('🔍 MIDDLEWARE:', { hostname, pathname })
  
  // Получаем subdomain
  let subdomain = ''
  
  if (hostname.includes('.jazyl.tech')) {
    const hostParts = hostname.split('.jazyl.tech')[0]
    subdomain = hostParts
  }
  
  console.log('🔍 SUBDOMAIN:', subdomain)
  
  // Если это основной домен jazyl.tech
  if (!subdomain || subdomain === 'www' || subdomain === 'jazyl') {
    console.log('🌐 MAIN DOMAIN')
    
    // Если пользователь заходит на jazyl.tech/dashboard - это админка основной платформы
    if (pathname.startsWith('/dashboard')) {
      console.log('🔐 PLATFORM ADMIN ACCESS')
      
      // Проверяем аутентификацию для admin путей
      const isAuthPath = pathname.startsWith('/login') || pathname.startsWith('/register')
      const isPublicPath = pathname.startsWith('/_next') || 
                          pathname.startsWith('/api') || 
                          pathname === '/favicon.ico' ||
                          pathname === '/robots.txt' ||
                          pathname === '/404'
      
      if (!isAuthPath && !isPublicPath) {
        // Проверяем есть ли токен
        const accessToken = request.cookies.get('access-token')
        
        if (!accessToken) {
          console.log('🚫 No auth token, redirecting to login')
          return NextResponse.redirect(new URL('/login', request.url))
        }
      }
      
      console.log('🟢 PLATFORM ADMIN PATH, allowing:', pathname)
      return NextResponse.next()
    }
    
    // Для остальных путей на jazyl.tech показываем платформу
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/platform', request.url))
    }
    
    return NextResponse.next()
  }
  
  // Если это поддомен (клиентская страница <barber-name>.jazyl.tech)
  if (subdomain) {
    console.log('🌐 CLIENT ACCESS for subdomain:', subdomain)
    
    // Разрешенные публичные пути для клиентов
    const isPublicClientPath = pathname === '/' ||
                              pathname.startsWith('/_next') ||
                              pathname.startsWith('/api') ||
                              pathname === '/favicon.ico' ||
                              pathname === '/robots.txt' ||
                              pathname.startsWith('/booking') ||
                              pathname.startsWith('/confirm') ||
                              pathname.startsWith('/cancel') ||
                              pathname === '/404'
    
    if (isPublicClientPath) {
      console.log('🟢 PUBLIC PATH, allowing:', pathname)
      return NextResponse.next()
    }
    
    // Если путь не найден для клиентского сайта, показываем 404
    console.log('❌ Path not found for client site:', pathname)
    return NextResponse.rewrite(new URL('/404', request.url))
  }
  
  console.log('🟢 FALLBACK, allowing:', pathname)
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
}