// VillaOS v7 — types/report.ts

export type ReportType = 'revenue' | 'expense';

export interface ReportCategory {
  id:          string;
  ownerId:     string;
  villaId:     string | null;
  name:        string;
  type:        ReportType;
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
  amount: number;
  note:   string | null;
}

// ── Priority 4: New types for full dashboard ─────────────────

export interface CostAlert {
  categoryId: string;
  name:       string;
  icon:       string;
  color:      string;
  amount:     number;
  prevAmount: number;
  pctChange:  number;   // e.g. 48 = tăng 48%
  reason:     string;   // "Tăng 48% so với tháng trước"
}

export interface Payout {
  source:       string;  // 'Agoda', 'Booking.com', 'Trực tiếp'
  amount:       number;
  expectedDate: string;  // ISO date string
  bookingRef?:  string;
}

export interface ChannelStat {
  source:    string;
  revenue:   number;
  pct:       number;     // % of total revenue
  adr:       number;     // Average Daily Rate (revenue / nights)
  occupancy: number;     // % occupancy from this channel
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
  year:     number;
  month:    number;
  villaId:  string | null;

  // Core P&L
  revenue:  ReportCategoryWithEntry[];
  expenses: ReportCategoryWithEntry[];
  totalRevenue:     number;
  totalExpense:     number;
  netProfit:        number;
  prevMonthRevenue: number;
  prevMonthExpense: number;
  prevMonthProfit:  number;

  // 6-month trend
  monthly6: { label: string; revenue: number; expense: number; profit: number }[];

  // ── Priority 4: Dashboard metrics ───────────────────────────
  cashflowReceived:  number;
  cashflowPending:   number;
  occupancyRate:     number;    // 0–100
  healthScore:       number;    // 0–100
  healthLabel:       HealthLevel;
  healthMetrics:     HealthMetric[];
  healthTip:         string;
  costAlerts:        CostAlert[];
  upcomingPayouts:   Payout[];
  channelStats:      ChannelStat[];
  topServices:       ServiceStat[];
  revenueBySource:   { source: string; amount: number; pct: number; color: string }[];
}

// ── Default template categories ─────────────────────────────
export const DEFAULT_CATEGORIES: Omit<ReportCategory, 'id'|'ownerId'|'villaId'|'createdAt'>[] = [
  // ── Doanh thu ──
  { name:'VillaOS',        type:'revenue', groupName:'Doanh thu', icon:'🏡', color:'#178a5e', isAuto:true,  autoSource:'villaos_confirmed', fixedAmount:0, sortOrder:1,  isActive:true },
  { name:'Agoda',          type:'revenue', groupName:'Doanh thu', icon:'🅰️', color:'#3266ad', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:2,  isActive:true },
  { name:'Booking.com',    type:'revenue', groupName:'Doanh thu', icon:'🔵', color:'#d65a1e', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:3,  isActive:true },
  { name:'Dịch vụ thêm',   type:'revenue', groupName:'Doanh thu', icon:'✨', color:'#7f77dd', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:4,  isActive:true },
  // ── Chi phí vận hành ──
  { name:'Điện',           type:'expense', groupName:'Vận hành',  icon:'⚡', color:'#854F0B', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:5,  isActive:true },
  { name:'Nước',           type:'expense', groupName:'Vận hành',  icon:'💧', color:'#185FA5', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:6,  isActive:true },
  { name:'Vệ sinh',        type:'expense', groupName:'Vận hành',  icon:'🧹', color:'#5A6978', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:7,  isActive:true },
  { name:'Internet',       type:'expense', groupName:'Vận hành',  icon:'📶', color:'#5A6978', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:8,  isActive:true },
  // ── Chi phí nhân sự ──
  { name:'Hoa hồng sale',  type:'expense', groupName:'Nhân sự',   icon:'🏷️', color:'#6B7280', isAuto:true,  autoSource:'commission',        fixedAmount:0, sortOrder:9,  isActive:true },
  { name:'Lương nhân viên',type:'expense', groupName:'Nhân sự',   icon:'👤', color:'#6B7280', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:10, isActive:true },
  // ── Chi phí cố định ──
  { name:'Thuê mặt bằng',  type:'expense', groupName:'Cố định',   icon:'🏢', color:'#374151', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:11, isActive:true },
  { name:'Trả ngân hàng',  type:'expense', groupName:'Cố định',   icon:'🏦', color:'#374151', isAuto:false, autoSource:null,                fixedAmount:0, sortOrder:12, isActive:true },
];
