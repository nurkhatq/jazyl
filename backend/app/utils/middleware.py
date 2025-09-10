from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import time
import uuid
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        # Log request
        logger.info(f"Request {request_id}: {request.method} {request.url.path}")
        
        response = await call_next(request)
        
        # Log response
        process_time = time.time() - start_time
        logger.info(f"Response {request_id}: {response.status_code} in {process_time:.3f}s")
        
        return response

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Получаем хост и извлекаем субдомен
        host = request.headers.get("host", "")
        
        if ".jazyl.tech" in host:
            subdomain = host.split(".jazyl.tech")[0]
            
            # Удаляем admin. префикс если есть
            if subdomain.startswith("admin."):
                subdomain = subdomain[6:]  # убираем "admin."
                # Добавляем заголовок чтобы показать что это admin-доступ
                request.headers.__dict__["_list"].append(
                    (b"x-admin-access", b"true")
                )
            
            # Добавляем subdomain в заголовки для дальнейшего использования
            if subdomain and subdomain not in ["www", "jazyl"]:
                request.headers.__dict__["_list"].append(
                    (b"x-tenant-subdomain", subdomain.encode())
                )
        
        return await call_next(request)

class URLFixMiddleware(BaseHTTPMiddleware):
    """Middleware для исправления проблем с trailing slash"""
    
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        # Если путь заканчивается на / и это не корень, убираем /
        if path.endswith("/") and path != "/" and not path.startswith("/docs") and not path.startswith("/redoc"):
            # Удаляем trailing slash
            new_path = path.rstrip("/")
            
            # Если это API путь, делаем внутренний redirect
            if new_path.startswith("/api/"):
                # Создаем новый Request с исправленным путем
                scope = request.scope.copy()
                scope["path"] = new_path
                scope["raw_path"] = new_path.encode()
                
                new_request = Request(scope, request.receive)
                return await call_next(new_request)
        
        return await call_next(request)