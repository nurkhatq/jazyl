from fastapi import HTTPException

class CustomException(HTTPException):
    """Custom exception class for API errors"""
    pass

class TenantNotFoundException(CustomException):
    def __init__(self):
        super().__init__(status_code=404, detail="Tenant not found")

class UnauthorizedException(CustomException):
    def __init__(self):
        super().__init__(status_code=401, detail="Unauthorized")

class ForbiddenException(CustomException):
    def __init__(self):
        super().__init__(status_code=403, detail="Forbidden")

class BadRequestException(CustomException):
    def __init__(self, detail: str = "Bad request"):
        super().__init__(status_code=400, detail=detail)

class ConflictException(CustomException):
    def __init__(self, detail: str = "Conflict"):
        super().__init__(status_code=409, detail=detail)