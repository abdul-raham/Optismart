// ============================================================
// OPTISMART PORTAL — CORE TYPE SYSTEM
// ============================================================

// --- ROLES ---
export type UserRole = 'super_admin' | 'admin' | 'dsa' | 'installer' | 'reseller'

// --- USER ---
export interface User {
  id: string
  auth_id: string | null
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  status: 'active' | 'inactive' | 'suspended'
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// --- INSTALLER PROFILE ---
export interface InstallerProfile {
  id: string
  user_id: string
  user?: User
  location: string
  is_available: boolean
  rating: number
  total_jobs: number
  created_at: string
}

// --- PRODUCTS ---
export interface Product {
  id: string
  name: string
  description: string
  retail_price: number
  wholesale_price: number
  stock_quantity: number
  min_stock_level: number
  image_url: string | null
  source_url?: string | null
  specs?: string[]
  is_active: boolean
  created_at: string
  updated_at?: string
}

// --- LEADS ---
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost'
export type LeadTemperature = 'hot' | 'warm' | 'cold'

export interface Lead {
  id: string
  dsa_id: string
  dsa?: User
  customer_name: string
  phone: string
  email: string | null
  location: string | null
  status: LeadStatus
  temperature: LeadTemperature
  notes: string | null
  follow_up_date: string | null
  follow_up_interval_days: number | null
  follow_up_stopped: boolean
  converted_order_id: string | null
  created_at: string
  updated_at: string
}

// --- ORDERS ---
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'approved'
  | 'confirmed'
  | 'processing'
  | 'dispatched'
  | 'delivered'
  | 'completed'
  | 'rescheduled'
  | 'cancelled'

export interface Order {
  id: string
  order_number: string
  dsa_id: string | null
  unregistered_dsa_name?: string | null
  reseller_id?: string | null
  dsa?: User
  customer_name: string
  customer_email?: string | null
  customer_phone: string
  customer_address: string
  product_id: string
  product?: Product
  quantity: number
  unit_price: number
  total_amount: number
  status: OrderStatus
  installation_needed: boolean
  installation_price: number
  expected_delivery_date: string | null
  notes: string | null
  payment_confirmed_at: string | null
  delivered_at?: string | null
  created_at: string
  updated_at: string
  installer_job?: InstallerJob
}

// --- INSTALLER JOBS ---
export type JobStatus = 'assigned' | 'accepted' | 'en_route' | 'installed' | 'completed' | 'rejected'

export interface InstallerJob {
  id: string
  installer_id: string
  installer?: User
  installer_profile?: InstallerProfile
  order_id: string
  order?: Order
  scheduled_date: string
  status: JobStatus
  notes: string | null
  commission_amount: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// --- PAYMENTS ---
export interface Payment {
  id: string
  order_id: string
  order?: Order
  amount: number
  payment_method: string
  reference_code: string | null
  receipt_number: string | null
  status: 'pending' | 'confirmed'
  confirmed_by: string | null
  confirmer?: User
  confirmed_at: string | null
  created_at: string
}

// --- COMMISSIONS ---
export interface Commission {
  id: string
  dsa_id: string
  dsa?: User
  order_id: string
  order?: Order
  amount: number
  status: 'pending' | 'paid'
  triggered_at: string
}

// --- EXPENSES ---
export type ExpenseCategory = 'logistics' | 'marketing' | 'salaries' | 'utilities' | 'equipment' | 'other'

export interface Expense {
  id: string
  posted_by: string
  poster?: User
  category: ExpenseCategory
  description: string
  amount: number
  expense_date: string
  receipt_url: string | null
  created_at: string
}

// --- NOTIFICATIONS ---
export type NotificationType = 'order' | 'job' | 'payment' | 'system' | 'training' | 'commission'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  related_id: string | null
  created_at: string
}

// --- PRONET TRAINING ---
export interface TrainingModule {
  id: string
  title: string
  description: string
  duration_minutes: number
  order_index: number
  lessons?: Lesson[]
  created_at: string
}

export interface Lesson {
  id: string
  module_id: string
  module?: TrainingModule
  title: string
  video_url: string | null
  content: string | null
  duration_minutes: number
  order_index: number
  is_quiz: boolean
  created_at: string
}

export interface LessonProgress {
  id: string
  user_id: string
  lesson_id: string
  status: 'started' | 'completed'
  completed_at: string | null
  created_at?: string
  updated_at?: string
}

export interface QuizQuestion {
  id: string
  quiz_id?: string
  text: string
  options: { id: string; text: string }[]
  correct_answer_id: string
  order_index?: number
}

export interface Quiz {
  id: string
  module_id: string
  title: string
  pass_percentage: number
  questions?: QuizQuestion[]
  created_at: string
}

export interface QuizAttempt {
  id: string
  user_id: string
  quiz_id: string
  answers: Record<string, string>
  score_percentage: number
  passed: boolean
  attempted_at: string
}

export interface Certificate {
  id: string
  user_id: string
  module_id?: string | null
  user?: User
  certificate_number: string
  issued_at: string
  pdf_url: string | null
}

export interface TrainingResource {
  id: string
  title: string
  category: string
  file_url: string
  file_size_mb: number
  pages: number
  created_at: string
}

export interface CommissionRule {
  id: string
  name: string
  monthly_camera_threshold: number
  per_camera_amount: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  actor_user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}

// --- REMINDERS ---
export interface Reminder {
  id: string
  user_id: string
  title: string
  notes: string | null
  due_at: string
  frequency: 'once' | 'daily' | 'weekly'
  is_completed: boolean
  created_at: string
}

// --- ANALYTICS ---
export interface DSAStats {
  total_orders: number
  delivered_orders: number
  pending_orders: number
  cancelled_orders: number
  total_commission: number
  monthly_target_progress: number
}

export interface AdminStats {
  total_revenue: number
  total_orders: number
  pending_payments: number
  total_users: number
  active_installers: number
  monthly_revenue: number
}

// --- DATABASE GENERATED TYPE PLACEHOLDER ---
// This is populated by supabase gen types
export type Database = {
  public: {
    Tables: Record<string, unknown>
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}
