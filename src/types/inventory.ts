export type ShelfLifeZone = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'BLACK';

export type StorageType = 'ambient' | 'refrigerated' | 'frozen' | 'hazardous';

export type BatchStatus = 'active' | 'quarantine' | 'expired' | 'depleted';

export type TransactionType = 'IN' | 'OUT' | 'ADJUST' | 'DAMAGE' | 'EXPIRE' | 'QUARANTINE' | 'RELOCATE';

export type UserRole = 'staff' | 'supervisor' | 'manager' | 'auditor';

export interface Product {
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  default_shelf_life_days: number;
  unit_of_measure: string;
  reorder_level: number;
  storage_requirements: StorageType;
  unit_cost: number;
  selling_price: number;
  created_at: string;
}

export interface InventoryBatch {
  batch_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  batch_number: string;
  barcode: string;
  quantity_received: number;
  quantity_current: number;
  unit_of_measure: string;
  manufacturing_date: string;
  expiry_date: string;
  received_date: string;
  supplier_id: string;
  supplier_name: string;
  location_code: string; // e.g. "A-12-3-05"
  status: BatchStatus;
  unit_cost: number;
  storage_type: StorageType;
  notes?: string;
  qc_passed: boolean;
  qc_notes?: string;
}

export interface Location {
  location_id: string;
  location_code: string;
  section: string; // "A", "B", "C", "Cold-1", "DOCK-IN", "DOCK-OUT"
  aisle: string;
  rack: number; // 1-8 (Tier/Level)
  position: number; // 1-20
  storage_type: StorageType;
  capacity_units: number;
  current_occupancy: number;
  zone_name?: string;
  area_type?: 'rack' | 'dock_in' | 'dock_out' | 'packing' | 'quarantine' | 'bulk_floor' | 'chiller' | 'custom';
  max_weight_kg?: number;
  status?: 'active' | 'maintenance' | 'reserved';
  description?: string;
}

export interface Transaction {
  transaction_id: string;
  batch_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  batch_number: string;
  transaction_type: TransactionType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  transaction_date: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  reference_document?: string;
  location_code: string;
  notes?: string;
  fifo_compliant?: boolean;
  override_reason?: string;
  override_by?: string;
  customer_destination?: string;
}

export interface Supplier {
  supplier_id: string;
  supplier_name: string;
  contact_info: string;
  supplier_code: string;
  lead_time_days: number;
}

export interface Company {
  company_id: string;
  name: string;
  code: string;
  gstin?: string;
  fssai_license?: string;
  warehouse_name: string;
  address: string;
  contact_email?: string;
  contact_phone?: string;
  logo_text?: string;
  is_active: boolean;
}

export interface User {
  user_id: string;
  username: string;
  role: UserRole;
  full_name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  department: string;
  assigned_zone?: string;
  pin_code?: string;
  can_override_fifo?: boolean;
  can_delete_records?: boolean;
  can_adjust_stock?: boolean;
  can_manage_settings?: boolean;
}

export interface ShelfLifeStatus {
  zone: ShelfLifeZone;
  statusLabel: string;
  actionRequired: string;
  daysRemaining: number;
  percentageRemaining: number;
  totalShelfLifeDays: number;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
  dotColor: string;
}

export interface AlertItem {
  alert_id: string;
  batch_id: string;
  product_id: string;
  product_name: string;
  batch_number: string;
  location_code: string;
  alert_type: 'expiry_warning' | 'expired' | 'low_stock' | 'quarantine_needed';
  alert_level: ShelfLifeZone;
  days_remaining: number;
  quantity: number;
  created_at: string;
  acknowledged: boolean;
  acknowledged_by?: string;
}

export interface LabelTemplateSettings {
  label_width_inch: number; // 4
  label_height_inch: number; // 2
  show_company_name: boolean;
  show_logo: boolean;
  show_qr: boolean;
  show_dates: boolean;
  show_location: boolean;
  show_shelf_life_badge: boolean;
  show_price_inr?: boolean;
  font_size: 'small' | 'medium' | 'large';
  copies_per_item: number;
  label_title_mode?: 'product_name' | 'company_name' | 'lot_tag' | 'custom';
  custom_title_text?: string;
}

export interface WarehouseTask {
  id: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  dueTime: string;
  completed: boolean;
  category: string;
}

export interface ScheduleEvent {
  id: string;
  time: string;
  title: string;
  status: 'current' | 'done' | 'in_progress' | 'pending';
}

export interface UpcomingDelivery {
  id: string;
  supplier: string;
  eta: string;
  pallets: number;
  cargoType: string;
  status: 'scheduled' | 'delayed' | 'arrived';
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  location: string;
  status: 'active' | 'break' | 'offline';
}

export interface WarehouseHealthMetric {
  score: number;
  statusText: string;
  fifoCompliance: number;
  expiryRate: number;
  stockAccuracy: number;
  spaceUtilization: number;
}

export interface SystemSettings {
  company: {
    name: string;
    warehouse_name: string;
    address: string;
    logo_text: string;
    gstin?: string;
    fssai_license?: string;
    contact_phone?: string;
    contact_email?: string;
  };
  companies?: Company[];
  activeCompanyId?: string;
  currency: {
    code: string; // 'INR'
    symbol: string; // '₹'
    name: string; // 'Indian Rupee'
  };
  fifo_rules?: {
    strict_enforcement: boolean;
    allow_supervisor_override: boolean;
    auto_quarantine_expired: boolean;
    highlight_urgent_days: number;
  };
  shelf_life_thresholds: {
    green_percentage: number; // 30
    yellow_percentage: number; // 15
    orange_percentage: number; // 5
    red_percentage: number; // 0
  };
  barcode: {
    format: 'CODE128' | 'EAN13' | 'QR';
    prefix: string;
    include_expiry: boolean;
  };
  label_template: LabelTemplateSettings;
  challan_settings?: {
    challan_prefix: string;
    terms_conditions: string;
    authorized_signatory_title: string;
    show_gst_breakdown: boolean;
  };
  inbound_qc_rules?: {
    min_shelf_life_inward_pct: number;
    require_coa_certificate: boolean;
    require_temp_verification: boolean;
  };
  notification_preferences?: {
    low_stock_multiplier: number;
    expiry_horizon_days: number;
    audio_alerts_enabled: boolean;
  };
  backup: {
    auto_backup: boolean;
    frequency_hours: number;
    last_backup_date: string;
  };
  sound_effects: boolean;
}

