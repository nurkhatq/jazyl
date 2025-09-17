export interface PermissionRequest {
  id: string;
  permission_type: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  review_note?: string;
  master_id: string;
  tenant_id: string;
}

export interface MasterPermissions {
  can_edit_profile: boolean;
  can_edit_schedule: boolean;
  can_edit_services: boolean;
  can_manage_bookings: boolean;
  can_view_analytics: boolean;
  can_upload_photos: boolean;
}

export interface MasterProfile extends MasterPermissions {
  id: string;
  user_id: string;
  tenant_id: string;
  display_name?: string;
  description?: string;
  photo_url?: string;
  specialization: string[];
  experience_years: number;
  rating: number;
  reviews_count: number;
  is_active: boolean;
  is_visible: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PermissionRequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}
