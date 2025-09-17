from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.schemas.master import (
    MasterCreate, MasterUpdate, MasterResponse,
    MasterStatsResponse, TodayBookingsResponse,  # ✅ ДОБАВЛЕНЫ новые схемы
    MasterPermissionsUpdate, MasterScheduleSchema
)
from app.schemas.service import ServiceCreate, ServiceUpdate, ServiceResponse
from app.schemas.booking import BookingCreate, BookingUpdate, BookingResponse
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.schemas.permission_request import PermissionRequestCreate, PermissionRequestResponse, PermissionRequestReview 
__all__ = [
    "TenantCreate", "TenantUpdate", "TenantResponse",
    "UserCreate", "UserLogin", "UserResponse", "TokenResponse",
    "MasterCreate", "MasterUpdate", "MasterResponse",
    "MasterStatsResponse", "TodayBookingsResponse",  # ✅ ДОБАВЛЕНЫ новые схемы
    "MasterPermissionsUpdate", "MasterScheduleSchema",
    "ServiceCreate", "ServiceUpdate", "ServiceResponse",
    "BookingCreate", "BookingUpdate", "BookingResponse",
    "ClientCreate", "ClientUpdate", "ClientResponse",
    "PermissionRequestCreate", "PermissionRequestResponse", "PermissionRequestReview"
]