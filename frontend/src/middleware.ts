import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  
  // Получаем subdomain
  let subdomain = ''
  let isAdmin = false
  
  if (hostname.includes('.jazyl.tech')) {
    const hostParts = hostname.split('.jazyl.tech')[0]
    
    if (hostParts.startsWith('admin.')) {
      isAdmin = true
      subdomain = hostParts.substring(6) // убираем 'admin.'
    } else {
      subdomain = hostParts
    }
  }
  
  console.log('🟢 MIDDLEWARE:', {
    hostname,
    subdomain,
    pathname,
    cookies: {
      'auth-user': request.cookies.get('auth-user')?.value.substring(0, 50) + '...' || 'undefined...',
      'auth-data': request.cookies.get('auth-data')?.value.substring(0, 50) + '...' || 'undefined...',
      'access-token': request.cookies.get('access-token')?.value.substring(0, 50) + '...' || 'undefined...'
    }
  })
  
  // Если это основной домен (jazyl.tech или www.jazyl.tech)
  if (!subdomain || subdomain === 'www' || subdomain === 'jazyl') {
    // Перенаправляем на главную платформу
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/platform', request.url))
    }
    return NextResponse.next()
  }
  
  // Если это admin поддомен
  if (isAdmin) {
    console.log('🔐 ADMIN ACCESS for subdomain:', subdomain)
    
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
    
    // Разрешаем доступ к admin интерфейсу
    console.log('🟢 ADMIN PATH, allowing:', pathname)
    return NextResponse.next()
  }
  
  // Если это обычный поддомен (клиентская страница)
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