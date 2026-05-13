// VillaOS v7 — types/report.ts

export type ReportType = 'revenue' | 'expense';
export type CostScope  = 'shared' | 'per_villa';

export interface ReportCategory {
  id:          string;
  ownerId:     string;
  villaId:     string | null;
  name:        string;
  type:        ReportType;
  scope:       CostScope;       // NEW: 'shared' | 'per_villa'
  groupName:   string | null;
  icon:        string;
  color:       string;
  isAuto:      boolean;
  autoSource:  string | null;
  fixedAmount: number;
  sortOrder:   number;
  isActive:    boolean;
  createdAt:   string;
}

export interface ReportEntry {
  id:         string;
  categoryId: string;
  villaId:    string | null;
  ownerId:    string;
  year:       number;
  month:      number;
  amount:     number;
  note:       string | null;
  createdAt:  string;
  updatedAt:  string;
}

export interface ReportCategoryWithEntry extends ReportCategory {
  amount:      number;
  note:        string | null;
  allocAmount?: number;  // for shared: amount after allocation
}

// ── Hướng 1: Villa summary for multi-villa view ──────────────

export interface VillaSummary {
  villaId:         string;
  villaName:       string;
  emoji:           string;
  revenue:         number;
  perVillaExpense: number;   // only per_villa scope expenses
  sharedAlloc:     number;   // allocated share of shared costs
  totalExpense:    number;   // perVillaExpense + sharedAlloc
  netProfit:       number;
  occupancyRate:   number;
  allocPct:        number;   // % of shared cost allocated to this villa (0–100)
}

// ── Priority 4: Dashboard types ──────────────────────────────

export interface CostAlert {
  categoryId: string;
  name:       string;
  icon:       string;
  color:      string;
  amount:     number;
  prevAmount: number;
  pctChange:  number;
  reason:     string;
}

export interface Payout {
  source:       string;
  amount:       number;
  expectedDate: string;
  bookingRef?:  string;
}

export interface ChannelStat {
  source:    string;
  revenue:   number;
  pct:       number;
  adr:       number;
  occupancy: number;
  color:     string;
}

export interface ServiceStat {
  name:   string;
  icon:   string;
  amount: number;
}

export type HealthLevel = 'Xuất sắc' | 'Tốt' | 'Trung bình' | 'Kém';

export interface HealthMetric {
  icon:  string;
  label: string;
  value: HealthLevel;
}

export interface MonthlyReport {
  year:    number;
  month:   number;
  villaId: string | null;

  // Core P&L
  revenue:          ReportCategoryWithEntry[];
  expenses:         ReportCategoryWithEntry[];   // per_villa only (for current villa)
  totalRevenue:     number;
  totalExpense:     number;                      // per_villa + allocated shared
  netProfit:        number;
  prevMonthRevenue: number;
  prevMonthExpense: number;
  prevMonthProfit:  number;

  // Hướng 1: Shared costs
  sharedExpenses:     ReportCategoryWithEntry[];  // full shared amounts (before alloc)
  totalSharedExpense: number;                     // full shared total
  sharedAllocPct:     number;                     // allocation % for this villa (0–100)

  // Hướng 2: All-villas summary (populated when villaId = null)
  allVillasSummary: VillaSummary[];

  // 6-month trend
  monthly6: { label: string; revenue: number; expense: number; profit: number }[];

  // Priority 4
  cashflowReceived:  number;
  cashflowPending:   number;
  occupancyRate:     number;
  healthScore:       number;
  healthLabel:       HealthLevel;
  healthMetrics:     HealthMetric[];
  healthTip:         string;
  costAlerts:        CostAlert[];
  upcomingPayouts:   Payout[];
  channelStats:      ChannelStat[];
  topServices:       ServiceStat[];
  revenueBySource:   { source: string; amount: number; pct: number; color: string }[];
}

// ── Default template categories ──────────────────────────────
// scope: Nhân sự + Cố định → shared (chung nhiều villa)
//        Vận hành          → per_villa (riêng từng villa)

export const DEFAULT_CATEGORIES: Omit<ReportCategory, 'id'|'ownerId'|'villaId'|'createdAt'>[] = [
  // ── Doanh thu ──
  { name:'VillaOS',         type:'revenue', scope:'per_villa', groupName:'Doanh thu', icon:'🏡', color:'#178a5e', isAuto:true,  autoSource:'villaos_confirmed', fixedAmount:0, sortOrder:1,  isActive:true },
  { name:'Agoda',           type:'revenue', scope:'per_villa', groupName:'Doanh thu', icon:'🅰️', color:'#3266ad', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:2,  isActive:true },
  { name:'Booking.com',     type:'revenue', scope:'per_villa', groupName:'Doanh thu', icon:'🔵', color:'#d65a1e', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:3,  isActive:true },
  { name:'Dịch vụ thêm',    type:'revenue', scope:'per_villa', groupName:'Doanh thu', icon:'✨', color:'#7f77dd', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:4,  isActive:true },
  // ── Chi phí vận hành (per_villa) ──
  { name:'Điện',            type:'expense', scope:'per_villa', groupName:'Vận hành',  icon:'⚡', color:'#854F0B', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:5,  isActive:true },
  { name:'Nước',            type:'expense', scope:'per_villa', groupName:'Vận hành',  icon:'💧', color:'#185FA5', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:6,  isActive:true },
  { name:'Vệ sinh',         type:'expense', scope:'per_villa', groupName:'Vận hành',  icon:'🧹', color:'#5A6978', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:7,  isActive:true },
  { name:'Internet',        type:'expense', scope:'per_villa', groupName:'Vận hành',  icon:'📶', color:'#5A6978', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:8,  isActive:true },
  // ── Chi phí nhân sự (shared) ──
  { name:'Hoa hồng sale',   type:'expense', scope:'shared',    groupName:'Nhân sự',   icon:'🏷️', color:'#6B7280', isAuto:true,  autoSource:'commission',        fixedAmount:0, sortOrder:9,  isActive:true },
  { name:'Lương nhân viên', type:'expense', scope:'shared',    groupName:'Nhân sự',   icon:'👤', color:'#6B7280', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:10, isActive:true },
  // ── Chi phí cố định (shared) ──
  { name:'Thuê mặt bằng',   type:'expense', scope:'shared',    groupName:'Cố định',   icon:'🏢', color:'#374151', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:11, isActive:true },
  { name:'Trả ngân hàng',   type:'expense', scope:'shared',    groupName:'Cố định',   icon:'🏦', color:'#374151', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:12, isActive:true },
];
