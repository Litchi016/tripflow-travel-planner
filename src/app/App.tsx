import { useEffect, useState, useRef } from "react"
import {
  MapPin, Plus, Settings, ChevronLeft, X, MoreHorizontal,
  Landmark, Utensils, Building2, Plane, Circle,
  LayoutList, CalendarDays, Check, GripVertical,
  ChevronUp, ChevronDown, Search, Trash2, Edit3,
  Navigation2, CheckCircle2, Map as MapIcon,
  RotateCcw, ChevronRight, AlertCircle,
  User, Bell, Globe, Sun, Shield, HelpCircle, Info, MessageSquare
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaceType = "attraction" | "restaurant" | "hotel" | "transport" | "other"
type DateMode = "pending" | "confirmed"
type Screen = "list" | "create" | "workspace" | "add-place" | "settings"
type WsTab = "pool" | "itinerary" | "map"
type ItvView = "normal" | "compact"
type GlobalTab = "trips" | "profile"
type DayPickerMode = "arrange" | "move"

interface Place {
  id: string; name: string; type: PlaceType; note: string
  address: string; dayAssigned: number | null; order: number
  coords: { x: number; y: number }
}
interface Trip {
  id: string; name: string; destination: string
  dateMode: DateMode; days: number; startDate: string; places: Place[]
}
interface TrashedTrip extends Trip { trashedAt: number }
interface UserProfile { displayName: string }
interface DelCfg {
  title: string; desc: string; confirmLabel?: string; onConfirm: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<PlaceType, string> = {
  attraction: "景点", restaurant: "餐厅", hotel: "住宿", transport: "交通", other: "其他",
}
const TYPE_BG: Record<PlaceType, string> = {
  attraction: "#E8F5E0", restaurant: "#FEF3E8", hotel: "#E8F0FE", transport: "#F5E8FE", other: "#F0F0EE",
}
const TYPE_COLOR: Record<PlaceType, string> = {
  attraction: "#4F7E35", restaurant: "#C4760E", hotel: "#2B52C4", transport: "#7C35C4", other: "#666",
}
const SEC = "#6F6A61"
const TERC = "#A9A69F"

// ─── Initial Data ─────────────────────────────────────────────────────────────

const INIT_PLACES: Place[] = [
  { id: "p1",  name: "故宫博物院",      type: "attraction", note: "需要提前预约", address: "北京市东城区景山前街4号",       dayAssigned: 1,    order: 1, coords: { x: 194, y: 162 } },
  { id: "p2",  name: "北海公园",        type: "attraction", note: "",           address: "北京市西城区文津街1号",         dayAssigned: 1,    order: 2, coords: { x: 160, y: 150 } },
  { id: "p3",  name: "什刹海",          type: "attraction", note: "",           address: "北京市西城区什刹海",            dayAssigned: 1,    order: 3, coords: { x: 146, y: 137 } },
  { id: "p4",  name: "天坛公园",        type: "attraction", note: "",           address: "北京市东城区天坛东里甲1号",     dayAssigned: 2,    order: 1, coords: { x: 218, y: 240 } },
  { id: "p5",  name: "南门涮肉",        type: "restaurant", note: "",           address: "北京市西城区西绒线胡同51号",   dayAssigned: 2,    order: 2, coords: { x: 180, y: 207 } },
  { id: "p6",  name: "颐和园",          type: "attraction", note: "",           address: "北京市海淀区新建宫门路19号",   dayAssigned: 3,    order: 1, coords: { x: 76,  y: 138 } },
  { id: "p7",  name: "圆明园",          type: "attraction", note: "",           address: "北京市海淀区清华西路28号",     dayAssigned: 3,    order: 2, coords: { x: 64,  y: 122 } },
  { id: "p8",  name: "天安门广场",      type: "attraction", note: "需要提前预约", address: "北京市东城区天安门广场",       dayAssigned: null, order: 0, coords: { x: 194, y: 186 } },
  { id: "p9",  name: "北京环球影城",    type: "attraction", note: "",           address: "北京市通州区文化旅游区",       dayAssigned: null, order: 0, coords: { x: 318, y: 182 } },
  { id: "p10", name: "后海公园",        type: "attraction", note: "",           address: "北京市西城区后海",             dayAssigned: null, order: 0, coords: { x: 140, y: 131 } },
  { id: "p11", name: "雍和宫",          type: "attraction", note: "需要提前预约", address: "北京市东城区雍和宫大街12号",   dayAssigned: null, order: 0, coords: { x: 232, y: 140 } },
  { id: "p12", name: "四季民福烤鸭",    type: "restaurant", note: "",           address: "北京市东城区景山东街22号",     dayAssigned: null, order: 0, coords: { x: 226, y: 164 } },
  { id: "p13", name: "刘记炙子烤肉",    type: "restaurant", note: "",           address: "北京市朝阳区三里屯路",         dayAssigned: null, order: 0, coords: { x: 270, y: 158 } },
  { id: "p14", name: "北京大兴国际机场", type: "transport",  note: "",           address: "北京市大兴区榆磐路",           dayAssigned: null, order: 0, coords: { x: 198, y: 368 } },
]
const INIT_TRIP: Trip = { id: "t1", name: "北京7日游", destination: "北京", dateMode: "pending", days: 7, startDate: "", places: INIT_PLACES }

const STORAGE_KEY = "tripflow.app-data"
const STORAGE_VERSION = 1

interface PersistedData {
  version: 1
  trips: Trip[]
  trashedTrips: TrashedTrip[]
  curTripId: string
  profile: UserProfile
}

const DEFAULT_PROFILE: UserProfile = { displayName: "旅行者" }

const cloneTrip = (trip: Trip): Trip => ({
  ...trip,
  places: trip.places.map(place => ({ ...place, coords: { ...place.coords } })),
})

const createDefaultData = (): PersistedData => ({
  version: STORAGE_VERSION,
  trips: [cloneTrip(INIT_TRIP)],
  trashedTrips: [],
  curTripId: INIT_TRIP.id,
  profile: { ...DEFAULT_PROFILE },
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

function isPlace(value: unknown): value is Place {
  if (!isRecord(value) || !isRecord(value.coords)) return false
  const validTypes: PlaceType[] = ["attraction", "restaurant", "hotel", "transport", "other"]
  return typeof value.id === "string"
    && typeof value.name === "string"
    && validTypes.includes(value.type as PlaceType)
    && typeof value.note === "string"
    && typeof value.address === "string"
    && (value.dayAssigned === null || (Number.isInteger(value.dayAssigned) && Number(value.dayAssigned) > 0))
    && Number.isInteger(value.order)
    && Number(value.order) >= 0
    && typeof value.coords.x === "number"
    && Number.isFinite(value.coords.x)
    && typeof value.coords.y === "number"
    && Number.isFinite(value.coords.y)
}

function isTrip(value: unknown): value is Trip {
  if (!isRecord(value)) return false
  return typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.destination === "string"
    && (value.dateMode === "pending" || value.dateMode === "confirmed")
    && Number.isInteger(value.days)
    && Number(value.days) > 0
    && Number(value.days) <= 365
    && typeof value.startDate === "string"
    && Array.isArray(value.places)
    && value.places.every(isPlace)
}

function isTrashedTrip(value: unknown): value is TrashedTrip {
  return isTrip(value) && typeof (value as TrashedTrip).trashedAt === "number"
    && Number.isFinite((value as TrashedTrip).trashedAt)
}

function loadPersistedData(): PersistedData {
  if (typeof window === "undefined") return createDefaultData()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultData()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)
      || parsed.version !== STORAGE_VERSION
      || !Array.isArray(parsed.trips)
      || !parsed.trips.every(isTrip)
      || !Array.isArray(parsed.trashedTrips)
      || !parsed.trashedTrips.every(isTrashedTrip)
      || typeof parsed.curTripId !== "string") return createDefaultData()

    const trips = parsed.trips as Trip[]
    const curTripId = parsed.curTripId
    if ((trips.length === 0 && curTripId !== "") || (trips.length > 0 && !trips.some(t => t.id === curTripId))) {
      return createDefaultData()
    }
    const profile = isRecord(parsed.profile) && typeof parsed.profile.displayName === "string" && parsed.profile.displayName.trim()
      ? { displayName: parsed.profile.displayName.trim().slice(0, 20) }
      : { ...DEFAULT_PROFILE }
    return { version: STORAGE_VERSION, trips, trashedTrips: parsed.trashedTrips as TrashedTrip[], curTripId, profile }
  } catch {
    return createDefaultData()
  }
}

function savePersistedData(data: PersistedData) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage can be unavailable in private browsing or when the quota is full.
  }
}

const MOCK_LOCS = [
  { name: "故宫博物院",   address: "北京市东城区景山前街4号" },
  { name: "天安门广场",   address: "北京市东城区天安门广场" },
  { name: "颐和园",       address: "北京市海淀区新建宫门路19号" },
  { name: "天坛公园",     address: "北京市东城区天坛东里甲1号" },
  { name: "北海公园",     address: "北京市西城区文津街1号" },
  { name: "雍和宫",       address: "北京市东城区雍和宫大街12号" },
  { name: "后海公园",     address: "北京市西城区后海" },
  { name: "北京南站",     address: "北京市丰台区马家堡西路" },
  { name: "首都国际机场", address: "北京市顺义区天竺" },
  { name: "鸟巢",         address: "北京市朝阳区国家体育场南路" },
  { name: "西湖风景名胜区", address: "浙江省杭州市西湖区龙井路1号" },
  { name: "灵隐寺",       address: "浙江省杭州市西湖区法云弄1号" },
  { name: "雷峰塔景区",   address: "浙江省杭州市西湖区南山路15号" },
  { name: "杭州东站",     address: "浙江省杭州市上城区全福桥路2号" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const genId = () => `p_${Math.random().toString(36).slice(2, 8)}`
const getDayPlaces = (places: Place[], day: number) =>
  places.filter(p => p.dayAssigned === day).sort((a, b) => a.order - b.order)
const getPool = (places: Place[]) => places.filter(p => p.dayAssigned === null)

function tripDateLabel(t: Trip): string {
  if (t.dateMode === "pending") return `日期暂定 · 共${t.days}天`
  if (!t.startDate) return `共${t.days}天`
  const s = new Date(t.startDate), e = new Date(t.startDate)
  e.setDate(e.getDate() + t.days - 1)
  const f = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`
  return `${f(s)}—${f(e)}`
}
function tripDatePill(t: Trip): string {
  if (t.dateMode === "pending") return "日期暂定"
  if (!t.startDate) return `${t.days}天`
  const s = new Date(t.startDate), e = new Date(t.startDate)
  e.setDate(e.getDate() + t.days - 1)
  return `${s.getMonth()+1}/${s.getDate()}—${e.getMonth()+1}/${e.getDate()}`
}
function dayDateSuffix(t: Trip, day: number): string {
  if (t.dateMode !== "confirmed" || !t.startDate) return ""
  const d = new Date(t.startDate); d.setDate(d.getDate() + day - 1)
  return ` · ${d.getMonth()+1}月${d.getDate()}日`
}
function searchLocs(q: string) {
  if (!q.trim()) return []
  return MOCK_LOCS.filter(r => r.name.includes(q) || r.address.includes(q)).slice(0, 4)
}
function daysUntilPerm(trashedAt: number): number {
  return Math.max(0, 30 - Math.floor((Date.now() - trashedAt) / 86400000))
}

// ─── Utility Components ───────────────────────────────────────────────────────

function TIcon({ type, size = 16 }: { type: PlaceType; size?: number }) {
  const p = { size, strokeWidth: 1.5 }
  if (type === "attraction") return <Landmark {...p} />
  if (type === "restaurant") return <Utensils {...p} />
  if (type === "hotel")      return <Building2 {...p} />
  if (type === "transport")  return <Plane {...p} />
  return <Circle {...p} />
}

function TBadge({ type }: { type: PlaceType }) {
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: TYPE_BG[type], color: TYPE_COLOR[type] }}>
      {TYPE_LABEL[type]}
    </span>
  )
}

function Btn({ children, onClick, disabled, variant = "primary", className = "" }:
  { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary"|"secondary"|"danger"|"ghost"; className?: string }) {
  const base = "flex items-center justify-center gap-2 rounded-2xl font-medium text-[15px] transition-all active:scale-[0.97] h-12 px-6"
  const v = {
    primary:   disabled ? "bg-[#EEE9DC] text-[#A9A69F] cursor-not-allowed" : "bg-[#F8DF72] text-[#2B2924] active:bg-[#F0D455]",
    secondary: "bg-white border border-[#EEE9DC] text-[#2B2924]",
    danger:    "bg-[#C96B58] text-white",
    ghost:     "text-[#6F6A61]",
  }
  return <button onClick={onClick} disabled={disabled} className={`${base} ${v[variant]} ${className}`}>{children}</button>
}

function Sheet({ open, onClose, title, children }:
  { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 max-w-[390px] mx-auto bg-white rounded-t-3xl z-40 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 bg-[#EEE9DC] rounded-full" /></div>
        {title && <div className="px-5 pb-3 shrink-0"><p className="text-[17px] font-semibold text-[#2B2924]">{title}</p></div>}
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>{children}</div>
      </div>
    </>
  )
}

function Dlg({ cfg, onClose }: { cfg: DelCfg | null; onClose: () => void }) {
  if (!cfg) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-x-6 top-1/2 -translate-y-1/2 bg-white rounded-3xl z-50 p-6 max-w-[358px] mx-auto shadow-2xl">
        <h3 className="text-[17px] font-semibold text-[#2B2924] mb-2">{cfg.title}</h3>
        <p className="text-[14px] leading-relaxed mb-6" style={{ color: SEC }}>{cfg.desc}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-2xl border border-[#EEE9DC] text-[#2B2924] text-[15px] font-medium">取消</button>
          <button onClick={() => { cfg.onConfirm(); onClose() }} className="flex-1 h-11 rounded-2xl bg-[#C96B58] text-white text-[15px] font-medium">{cfg.confirmLabel || "删除"}</button>
        </div>
      </div>
    </>
  )
}

function Toast({ msg, onUndo, bottom = 24 }: { msg: string; onUndo?: () => void; bottom?: number }) {
  return (
    <div className="fixed inset-x-4 max-w-[358px] mx-auto bg-[#2B2924] text-white rounded-2xl px-4 py-3 flex items-center gap-3 z-50 shadow-xl"
      style={{ bottom: `${bottom}px` }}>
      <CheckCircle2 size={16} className="shrink-0 text-[#76966F]" />
      <span className="text-[13px] flex-1">{msg}</span>
      {onUndo && <button onClick={onUndo} className="text-[#F8DF72] text-[13px] font-semibold shrink-0">撤销</button>}
    </div>
  )
}

function Empty({ icon: Icon, title, desc, action }:
  { icon: React.ElementType; title: string; desc: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
      <div className="w-16 h-16 rounded-2xl bg-[#EEE9DC] flex items-center justify-center">
        <Icon size={28} strokeWidth={1.5} className="text-[#A9A69F]" />
      </div>
      <div className="text-center">
        <p className="text-[16px] font-semibold text-[#2B2924] mb-1">{title}</p>
        <p className="text-[13px] leading-relaxed" style={{ color: SEC }}>{desc}</p>
      </div>
      {action && <Btn variant="primary" onClick={action.onClick}>{action.label}</Btn>}
    </div>
  )
}

function SubPageShell({ title, onBack, children }:
  { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full bg-[#FFFCF3]">
      <div className="flex items-center gap-2 px-4 pt-12 pb-4 shrink-0">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
          <ChevronLeft size={22} strokeWidth={1.5} style={{ color: SEC }} />
        </button>
        <h1 className="text-[18px] font-semibold text-[#2B2924]">{title}</h1>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>{children}</div>
    </div>
  )
}

function SettingsRow({ icon: Icon, label, value, onClick, danger = false }:
  { icon: React.ElementType; label: string; value?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-5 py-4 active:bg-[#EEE9DC]/30 transition-colors">
      <div className="w-8 h-8 rounded-xl bg-[#EEE9DC] flex items-center justify-center shrink-0">
        <Icon size={15} strokeWidth={1.5} style={{ color: danger ? "#C96B58" : SEC }} />
      </div>
      <span className={`flex-1 text-left text-[15px] ${danger ? "text-[#C96B58]" : "text-[#2B2924]"}`}>{label}</span>
      {value && <span className="text-[13px] shrink-0" style={{ color: TERC }}>{value}</span>}
      <ChevronRight size={14} strokeWidth={1.5} style={{ color: "#C8C4BC" }} className="shrink-0" />
    </button>
  )
}

// ─── Trip List Screen ─────────────────────────────────────────────────────────

function TripListScreen({ trips, onSelect, onCreate, setDlg, onSoftDelete }:
  { trips: Trip[]; onSelect: (id: string) => void; onCreate: () => void; setDlg: (c: DelCfg) => void; onSoftDelete: (id: string) => void }) {
  const [menuId, setMenuId] = useState<string | null>(null)
  return (
    <div className="flex flex-col h-full bg-[#FFFCF3]" onClick={() => setMenuId(null)}>
      <div className="px-5 pt-14 pb-4 flex items-center justify-between shrink-0">
        <h1 className="text-[26px] font-bold text-[#2B2924]">旅行</h1>
        <button onClick={onCreate} className="w-11 h-11 rounded-full bg-[#F8DF72] flex items-center justify-center active:scale-95 transition-transform shadow-sm">
          <Plus size={22} strokeWidth={2.5} className="text-[#2B2924]" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ scrollbarWidth: "none" }}>
        {trips.length === 0 ? (
          <Empty icon={MapPin} title="还没有旅行计划" desc="创建一趟旅行，开始收集想去的地点" action={{ label: "创建第一趟旅行", onClick: onCreate }} />
        ) : (
          <div className="flex flex-col gap-3">
            {trips.map(trip => {
              const assigned  = trip.places.filter(p => p.dayAssigned !== null).length
              const pending   = trip.places.filter(p => p.dayAssigned === null).length
              return (
                <div key={trip.id} className="bg-white rounded-2xl p-4 border border-[#EEE9DC] relative"
                  style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.06)" }}>
                  {/* Header */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(trip.id)}>
                      <h2 className="text-[17px] font-bold text-[#2B2924] truncate">{trip.name}</h2>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[12px]" style={{ color: SEC }}>
                          <MapPin size={11} strokeWidth={1.5} className="shrink-0" />{trip.destination}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F7E8AA] text-[#2B2924]">
                          {tripDatePill(trip)}
                        </span>
                        <span className="text-[11px]" style={{ color: SEC }}>{trip.days}天</span>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuId(menuId === trip.id ? null : trip.id) }}
                      className="w-11 h-11 flex items-center justify-center shrink-0 -mr-2 -mt-1">
                      <MoreHorizontal size={18} style={{ color: TERC }} />
                    </button>
                  </div>
                  {/* Stats + footer */}
                  <div className="mt-3 pt-3 border-t border-[#EEE9DC] flex items-center justify-between cursor-pointer"
                    onClick={() => onSelect(trip.id)}>
                    <p className="text-[12px]" style={{ color: SEC }}>
                      待安排<span className="font-semibold text-[#2B2924] mx-0.5">{pending}</span>处
                      <span className="mx-1.5" style={{ color: "#C8C4BC" }}>|</span>
                      已安排<span className="font-semibold text-[#2B2924] mx-0.5">{assigned}</span>处
                    </p>
                    <span className="text-[12px] font-semibold text-[#C8A200] flex items-center gap-0.5">
                      继续规划<ChevronRight size={12} strokeWidth={2} />
                    </span>
                  </div>
                  {/* Context menu */}
                  {menuId === trip.id && (
                    <div className="absolute right-3 top-12 bg-white rounded-2xl shadow-xl border border-[#EEE9DC] overflow-hidden z-10 w-44"
                      onClick={e => e.stopPropagation()}>
                      <button className="flex items-center gap-3 px-4 py-3.5 text-[14px] text-[#2B2924] w-full active:bg-[#FFFCF3]"
                        onClick={() => { setMenuId(null); onSelect(trip.id) }}>
                        <Settings size={14} /> 旅行设置
                      </button>
                      <button className="flex items-center gap-3 px-4 py-3.5 text-[14px] text-[#C96B58] w-full active:bg-[#FFFCF3]"
                        onClick={() => {
                          setMenuId(null)
                          setDlg({
                            title: `移入回收站？`,
                            desc: `「${trip.name}」将移入回收站，30天后自动永久删除。你可以在"我的→计划回收站"中恢复。`,
                            confirmLabel: "移入回收站",
                            onConfirm: () => onSoftDelete(trip.id),
                          })
                        }}>
                        <Trash2 size={14} /> 移入回收站
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

function RecycleBinScreen({ trashedTrips, onRestore, onPermDelete, setDlg, onBack }:
  { trashedTrips: TrashedTrip[]; onRestore: (id: string) => void; onPermDelete: (id: string) => void; setDlg: (c: DelCfg) => void; onBack: () => void }) {
  return (
    <SubPageShell title="计划回收站" onBack={onBack}>
      {trashedTrips.length === 0 ? (
        <Empty icon={Trash2} title="回收站是空的" desc="移入回收站的旅行将在这里保留30天" />
      ) : (
        <div className="px-4 pb-8 flex flex-col gap-3">
          <p className="text-[12px] px-1 mt-1 mb-1" style={{ color: SEC }}>回收站中的旅行将在30天后自动永久删除</p>
          {trashedTrips.map(trip => {
            const days = daysUntilPerm(trip.trashedAt)
            const assigned = trip.places.filter(p => p.dayAssigned !== null).length
            const pending  = trip.places.filter(p => p.dayAssigned === null).length
            return (
              <div key={trip.id} className="bg-white rounded-2xl p-4 border border-[#EEE9DC]"
                style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.06)" }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-[#2B2924] truncate">{trip.name}</h3>
                    <p className="text-[12px] mt-0.5" style={{ color: SEC }}>
                      {trip.destination} · {trip.days}天 · {pending}个待安排
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-[#C96B58] bg-[#FEF6F4] px-2 py-0.5 rounded-full shrink-0 ml-2">
                    {days}天后删除
                  </span>
                </div>
                <p className="text-[12px] mb-3" style={{ color: SEC }}>
                  已安排{assigned}处 · 待安排{pending}处
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onRestore(trip.id)}
                    className="flex-1 h-9 rounded-xl bg-[#F8DF72] text-[#2B2924] text-[13px] font-semibold active:bg-[#F0D455]">
                    恢复旅行
                  </button>
                  <button
                    onClick={() => setDlg({
                      title: "永久删除？",
                      desc: `「${trip.name}」将被永久删除，无法恢复。`,
                      confirmLabel: "永久删除",
                      onConfirm: () => onPermDelete(trip.id),
                    })}
                    className="flex-1 h-9 rounded-xl border border-[#F0C4BC] text-[#C96B58] text-[13px] font-medium active:bg-[#FEF6F4]">
                    永久删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SubPageShell>
  )
}

function ProfileScreen({ profile, onUpdateProfile, trashedTrips, onRestore, onPermDelete, onResetData, setDlg }:
  { profile: UserProfile; onUpdateProfile: (profile: UserProfile) => void; trashedTrips: TrashedTrip[]; onRestore: (id: string) => void; onPermDelete: (id: string) => void; onResetData: () => void; setDlg: (c: DelCfg) => void }) {
  const [sub, setSub] = useState<string | null>(null)
  const [draftName, setDraftName] = useState(profile.displayName)
  const [notifTrip,  setNotifTrip]  = useState(true)
  const [notifPush,  setNotifPush]  = useState(false)
  const [darkMode,   setDarkMode]   = useState(false)

  if (sub === "recycle-bin")  return <RecycleBinScreen trashedTrips={trashedTrips} onRestore={onRestore} onPermDelete={onPermDelete} setDlg={setDlg} onBack={() => setSub(null)} />

  if (sub === "account") return (
    <SubPageShell title="账号与安全" onBack={() => setSub(null)}>
      <div className="px-4 pb-8">
        <div className="bg-white rounded-2xl p-5 border border-[#EEE9DC] mb-4" style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.06)" }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#F8DF72] flex items-center justify-center">
              <User size={26} strokeWidth={1.5} className="text-[#2B2924]" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-[#2B2924]">本地账号</p>
              <p className="text-[13px] mt-0.5" style={{ color: SEC }}>途序使用本地存储，无需登录或注册</p>
            </div>
          </div>
        </div>
        <div className="bg-[#F7E8AA]/40 rounded-2xl p-4 border border-[#F7E8AA]">
          <p className="text-[13px] text-[#2B2924] font-medium mb-1">关于本地账号</p>
          <p className="text-[12px] leading-relaxed" style={{ color: SEC }}>
            你的所有旅行数据保存在本设备上，不会上传到任何服务器。更换设备时数据不会自动同步，请注意备份。
          </p>
        </div>
      </div>
    </SubPageShell>
  )

  if (sub === "edit-profile") return (
    <SubPageShell title="编辑资料" onBack={() => setSub(null)}>
      <div className="px-4 pb-8 flex flex-col gap-4">
        <div className="flex flex-col items-center py-6">
          <div className="w-20 h-20 rounded-full bg-[#F8DF72] flex items-center justify-center mb-3">
            <User size={34} strokeWidth={1.5} className="text-[#2B2924]" />
          </div>
          <button className="text-[13px] font-medium text-[#C8A200]">更换头像</button>
        </div>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>显示名称</label>
          <input value={draftName} maxLength={20} onChange={e => setDraftName(e.target.value)} placeholder="请输入显示名称"
            className="w-full h-12 px-4 rounded-2xl bg-white border border-[#EEE9DC] text-[#2B2924] text-[15px] outline-none focus:border-[#F8DF72]" />
          <p className="text-[11px] mt-1.5 text-right" style={{ color: TERC }}>{draftName.length}/20</p>
        </div>
        <Btn variant="primary" className="w-full" disabled={!draftName.trim()} onClick={() => {
          const displayName = draftName.trim()
          if (!displayName) return
          onUpdateProfile({ displayName })
          setDraftName(displayName)
          setSub(null)
        }}>保存</Btn>
      </div>
    </SubPageShell>
  )

  if (sub === "privacy") return (
    <SubPageShell title="数据与隐私" onBack={() => setSub(null)}>
      <div className="px-4 pb-8 flex flex-col gap-3">
        {[
          { title: "数据存储", desc: "所有旅行数据存储在你的本地设备上，途序不会访问或上传你的任何个人数据。" },
          { title: "位置信息", desc: "途序不会请求你的实时位置，地点搜索使用本地模拟数据。" },
          { title: "第三方服务", desc: "途序目前不接入任何第三方追踪或分析服务。" },
          { title: "数据删除", desc: "清除应用数据或卸载应用将永久删除所有旅行计划，请提前导出备份。" },
        ].map(item => (
          <div key={item.title} className="bg-white rounded-2xl p-4 border border-[#EEE9DC]">
            <p className="text-[14px] font-semibold text-[#2B2924] mb-1">{item.title}</p>
            <p className="text-[12px] leading-relaxed" style={{ color: SEC }}>{item.desc}</p>
          </div>
        ))}
      </div>
    </SubPageShell>
  )

  if (sub === "language") return (
    <SubPageShell title="语言" onBack={() => setSub(null)}>
      <div className="px-4 pb-8">
        <p className="text-[12px] px-1 mt-1 mb-3" style={{ color: SEC }}>当前版本仅支持简体中文</p>
        {[{ label: "简体中文", selected: true }, { label: "繁體中文", selected: false }, { label: "English", selected: false }].map(lang => (
          <div key={lang.label} className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 border border-[#EEE9DC] mb-2">
            <span className={`text-[15px] ${lang.selected ? "font-semibold text-[#2B2924]" : ""}`} style={{ color: lang.selected ? "#2B2924" : SEC }}>{lang.label}</span>
            {lang.selected && <Check size={16} strokeWidth={2.5} className="text-[#C8A200]" />}
          </div>
        ))}
      </div>
    </SubPageShell>
  )

  if (sub === "notifications") return (
    <SubPageShell title="通知" onBack={() => setSub(null)}>
      <div className="px-4 pb-8 flex flex-col gap-3">
        {[
          { label: "旅行提醒", desc: "出发前一天提醒", val: notifTrip, set: setNotifTrip },
          { label: "推送通知", desc: "允许应用发送推送", val: notifPush, set: setNotifPush },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-2xl px-5 py-4 border border-[#EEE9DC] flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium text-[#2B2924]">{item.label}</p>
              <p className="text-[12px] mt-0.5" style={{ color: SEC }}>{item.desc}</p>
            </div>
            <button onClick={() => item.set(!item.val)}
              className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${item.val ? "bg-[#F8DF72]" : "bg-[#EEE9DC]"}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${item.val ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>
    </SubPageShell>
  )

  if (sub === "appearance") return (
    <SubPageShell title="外观" onBack={() => setSub(null)}>
      <div className="px-4 pb-8 flex flex-col gap-3">
        <div className="bg-white rounded-2xl px-5 py-4 border border-[#EEE9DC] flex items-center justify-between">
          <div>
            <p className="text-[15px] font-medium text-[#2B2924]">深色模式</p>
            <p className="text-[12px] mt-0.5" style={{ color: SEC }}>当前版本暂不支持深色模式</p>
          </div>
          <button onClick={() => setDarkMode(!darkMode)}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${darkMode ? "bg-[#F8DF72]" : "bg-[#EEE9DC]"}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${darkMode ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
        {[
          { label: "浅色", icon: Sun, active: !darkMode },
          { label: "深色", icon: Sun, active: darkMode },
        ].map(theme => (
          <div key={theme.label} className={`rounded-2xl px-5 py-4 border flex items-center gap-3 ${theme.active ? "border-[#F8DF72] bg-[#FFFBE8]" : "border-[#EEE9DC] bg-white"}`}>
            <theme.icon size={18} strokeWidth={1.5} style={{ color: theme.active ? "#2B2924" : SEC }} />
            <span className={`text-[15px] font-medium ${theme.active ? "text-[#2B2924]" : ""}`} style={{ color: theme.active ? "#2B2924" : SEC }}>{theme.label}</span>
            {theme.active && <Check size={15} strokeWidth={2.5} className="text-[#C8A200] ml-auto" />}
          </div>
        ))}
      </div>
    </SubPageShell>
  )

  if (sub === "contact") return (
    <SubPageShell title="联系我们" onBack={() => setSub(null)}>
      <div className="px-4 pb-8 flex flex-col gap-3">
        <div className="bg-white rounded-2xl p-5 border border-[#EEE9DC]">
          <p className="text-[14px] font-semibold text-[#2B2924] mb-3">途序团队</p>
          {[
            { label: "邮件联系", value: "hello@tripflow.app" },
            { label: "工作时间", value: "周一至周五 10:00–18:00" },
            { label: "响应时间", value: "通常在1-2个工作日内回复" },
          ].map(r => (
            <div key={r.label} className="flex justify-between py-2.5 border-b border-[#EEE9DC] last:border-0">
              <span className="text-[13px]" style={{ color: SEC }}>{r.label}</span>
              <span className="text-[13px] font-medium text-[#2B2924]">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </SubPageShell>
  )

  if (sub === "feedback") return (
    <SubPageShell title="帮助反馈" onBack={() => setSub(null)}>
      <div className="px-4 pb-8 flex flex-col gap-4">
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>反馈类型</label>
          <div className="flex gap-2">
            {["功能建议", "问题报告", "其他"].map(t => (
              <button key={t} className="flex-1 h-9 rounded-xl bg-white border border-[#EEE9DC] text-[13px] text-[#2B2924] first:bg-[#F8DF72] first:border-[#F8DF72]">{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>描述你的问题或建议</label>
          <textarea rows={5} placeholder="请详细描述…"
            className="w-full px-4 py-3 rounded-2xl bg-white border border-[#EEE9DC] text-[14px] placeholder:text-[#A9A69F] outline-none focus:border-[#F8DF72] resize-none" />
        </div>
        <Btn variant="primary" className="w-full">提交反馈</Btn>
      </div>
    </SubPageShell>
  )

  if (sub === "version") return (
    <SubPageShell title="版本信息" onBack={() => setSub(null)}>
      <div className="px-4 pb-8 flex flex-col items-center pt-8 gap-4">
        <div className="w-20 h-20 rounded-3xl bg-[#F8DF72] flex items-center justify-center shadow-lg">
          <MapPin size={36} strokeWidth={1.5} className="text-[#2B2924]" />
        </div>
        <div className="text-center">
          <p className="text-[20px] font-bold text-[#2B2924]">途序 TripFlow</p>
          <p className="text-[14px] mt-1" style={{ color: SEC }}>版本 1.0.0 (2026)</p>
        </div>
        <div className="w-full bg-white rounded-2xl border border-[#EEE9DC] overflow-hidden">
          {[
            { label: "版本号", value: "1.0.0" },
            { label: "构建号", value: "20260716" },
            { label: "平台",   value: "Web" },
            { label: "存储",   value: "本地存储" },
          ].map(r => (
            <div key={r.label} className="flex justify-between px-5 py-3.5 border-b border-[#EEE9DC] last:border-0">
              <span className="text-[14px]" style={{ color: SEC }}>{r.label}</span>
              <span className="text-[14px] font-medium text-[#2B2924]">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </SubPageShell>
  )

  if (sub === "about") return (
    <SubPageShell title="关于途序" onBack={() => setSub(null)}>
      <div className="px-4 pb-8 flex flex-col gap-4 pt-2">
        <div className="flex flex-col items-center py-6">
          <div className="w-20 h-20 rounded-3xl bg-[#F8DF72] flex items-center justify-center shadow-lg mb-4">
            <MapPin size={36} strokeWidth={1.5} className="text-[#2B2924]" />
          </div>
          <h2 className="text-[22px] font-bold text-[#2B2924]">途序 TripFlow</h2>
          <p className="text-[13px] mt-1" style={{ color: SEC }}>让旅行规划变得优雅而轻松</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#EEE9DC]">
          <p className="text-[14px] leading-relaxed" style={{ color: SEC }}>
            途序是一款专注于旅行路线规划的工具。通过地点收集、日程安排和地图可视化，帮助你在出发前把旅行打理得井井有条。
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#EEE9DC]">
          <p className="text-[13px] font-semibold text-[#2B2924] mb-2">设计理念</p>
          <p className="text-[13px] leading-relaxed" style={{ color: SEC }}>
            简洁、直觉、本地优先。我们相信好的旅行工具应该让人专注于旅行本身，而不是被复杂的功能所困扰。
          </p>
        </div>
        <p className="text-[12px] text-center" style={{ color: TERC }}>
          以用心与热情，为旅行者而作 ✦
        </p>
      </div>
    </SubPageShell>
  )

  // Main profile page
  return (
    <div className="flex flex-col h-full bg-[#FFFCF3]">
      <div className="px-5 pt-14 pb-4 shrink-0">
        <h1 className="text-[26px] font-bold text-[#2B2924]">我的</h1>
      </div>
      <div className="flex-1 overflow-y-auto pb-6" style={{ scrollbarWidth: "none" }}>
        {/* Profile card */}
        <div className="mx-4 mb-5 bg-white rounded-2xl p-5 border border-[#EEE9DC] flex items-center gap-4"
          style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.06)" }}>
          <div className="w-16 h-16 rounded-full bg-[#F8DF72] flex items-center justify-center shrink-0">
            <User size={28} strokeWidth={1.5} className="text-[#2B2924]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold text-[#2B2924] truncate">{profile.displayName}</p>
            <p className="text-[12px] mt-0.5" style={{ color: SEC }}>本地账号 · 数据仅保存在本设备</p>
          </div>
          <button onClick={() => setSub("edit-profile")}
            className="w-9 h-9 rounded-xl bg-[#EEE9DC] flex items-center justify-center">
            <Edit3 size={15} strokeWidth={1.5} style={{ color: SEC }} />
          </button>
        </div>

        {/* Account & data section */}
        <div className="mx-4 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider px-1 mb-2" style={{ color: TERC }}>账号与数据</p>
          <div className="bg-white rounded-2xl border border-[#EEE9DC] overflow-hidden">
            <SettingsRow icon={Shield}  label="账号与安全" onClick={() => setSub("account")} />
            <div className="h-px mx-5 bg-[#EEE9DC]" />
            <SettingsRow icon={User}    label="编辑资料"   onClick={() => setSub("edit-profile")} />
            <div className="h-px mx-5 bg-[#EEE9DC]" />
            <SettingsRow icon={Trash2}  label="计划回收站" value={trashedTrips.length > 0 ? `${trashedTrips.length}个` : undefined} onClick={() => setSub("recycle-bin")} />
            <div className="h-px mx-5 bg-[#EEE9DC]" />
            <SettingsRow icon={Info}    label="数据与隐私" onClick={() => setSub("privacy")} />
            <div className="h-px mx-5 bg-[#EEE9DC]" />
            <SettingsRow icon={RotateCcw} label="重置示例数据" danger onClick={() => setDlg({
              title: "重置示例数据？",
              desc: "这会删除当前设备上的全部旅行计划和回收站内容，并恢复初始的北京7日游示例。此操作无法撤销。",
              confirmLabel: "确认重置",
              onConfirm: onResetData,
            })} />
          </div>
        </div>

        {/* Preferences section */}
        <div className="mx-4 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider px-1 mb-2" style={{ color: TERC }}>偏好设置</p>
          <div className="bg-white rounded-2xl border border-[#EEE9DC] overflow-hidden">
            <SettingsRow icon={Globe}   label="语言"       value="简体中文" onClick={() => setSub("language")} />
            <div className="h-px mx-5 bg-[#EEE9DC]" />
            <SettingsRow icon={Bell}    label="通知"       onClick={() => setSub("notifications")} />
            <div className="h-px mx-5 bg-[#EEE9DC]" />
            <SettingsRow icon={Sun}     label="外观"       value="浅色" onClick={() => setSub("appearance")} />
          </div>
        </div>

        {/* Support section */}
        <div className="mx-4 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider px-1 mb-2" style={{ color: TERC }}>支持与反馈</p>
          <div className="bg-white rounded-2xl border border-[#EEE9DC] overflow-hidden">
            <SettingsRow icon={MessageSquare} label="联系我们"   onClick={() => setSub("contact")} />
            <div className="h-px mx-5 bg-[#EEE9DC]" />
            <SettingsRow icon={HelpCircle}    label="帮助反馈"   onClick={() => setSub("feedback")} />
            <div className="h-px mx-5 bg-[#EEE9DC]" />
            <SettingsRow icon={Info}          label="版本信息"   value="1.0.0" onClick={() => setSub("version")} />
            <div className="h-px mx-5 bg-[#EEE9DC]" />
            <SettingsRow icon={MapPin}        label="关于途序"   onClick={() => setSub("about")} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create Trip Screen ───────────────────────────────────────────────────────

function CreateTripScreen({ form, setForm, onBack, onSave }:
  { form: { name: string; dest: string; dateMode: DateMode; days: number; startDate: string }; setForm: React.Dispatch<React.SetStateAction<{ name: string; dest: string; dateMode: DateMode; days: number; startDate: string }>>; onBack: () => void; onSave: () => void }) {
  const [nameErr, setNameErr] = useState("")
  const canSave = form.name.trim() && form.dest.trim()
  return (
    <div className="flex flex-col h-full bg-[#FFFCF3]">
      <div className="flex items-center gap-2 px-4 pt-12 pb-4 shrink-0">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center">
          <ChevronLeft size={22} strokeWidth={1.5} style={{ color: SEC }} />
        </button>
        <h1 className="text-[18px] font-semibold text-[#2B2924]">创建旅行</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>旅行名称 *</label>
          <input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setNameErr("") }}
            placeholder="例：北京7日游"
            className={`w-full h-12 px-4 rounded-2xl bg-white border text-[#2B2924] text-[15px] placeholder:text-[#A9A69F] outline-none transition-colors ${nameErr ? "border-[#C96B58]" : "border-[#EEE9DC] focus:border-[#F8DF72]"}`} />
          {nameErr && <p className="text-[12px] text-[#C96B58] mt-1">{nameErr}</p>}
        </div>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>目的地</label>
          <input value={form.dest} onChange={e => setForm(f => ({ ...f, dest: e.target.value }))} placeholder="例：北京"
            className="w-full h-12 px-4 rounded-2xl bg-white border border-[#EEE9DC] text-[#2B2924] text-[15px] placeholder:text-[#A9A69F] outline-none focus:border-[#F8DF72] transition-colors" />
        </div>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>日期状态</label>
          <div className="flex bg-[#EEE9DC] rounded-2xl p-1">
            {(["pending", "confirmed"] as DateMode[]).map(m => (
              <button key={m} onClick={() => setForm(f => ({ ...f, dateMode: m }))}
                className={`flex-1 h-9 rounded-xl text-[14px] font-medium transition-all ${form.dateMode === m ? "bg-white text-[#2B2924] shadow-sm" : ""}`}
                style={{ color: form.dateMode === m ? "#2B2924" : SEC }}>
                {m === "pending" ? "日期暂定" : "日期确定"}
              </button>
            ))}
          </div>
        </div>
        {form.dateMode === "pending" ? (
          <div>
            <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>旅行天数</label>
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-[#EEE9DC] px-4 py-3">
              <button type="button" aria-label="减少一天" disabled={form.days <= 1}
                onClick={() => setForm(f => ({ ...f, days: Math.max(1, f.days - 1) }))}
                className="w-11 h-11 rounded-xl bg-[#EEE9DC] flex items-center justify-center text-[#2B2924] text-xl font-bold disabled:opacity-35 disabled:cursor-not-allowed active:scale-95">−</button>
              <span className="flex-1 text-center text-[20px] font-bold text-[#2B2924]">{form.days}天</span>
              <button type="button" aria-label="增加一天" disabled={form.days >= 30}
                onClick={() => setForm(f => ({ ...f, days: Math.min(30, f.days + 1) }))}
                className="w-11 h-11 rounded-xl bg-[#EEE9DC] flex items-center justify-center text-[#2B2924] text-xl font-bold disabled:opacity-35 disabled:cursor-not-allowed active:scale-95">＋</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>开始日期</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full h-12 px-3 rounded-2xl bg-white border border-[#EEE9DC] text-[#2B2924] text-[14px] outline-none focus:border-[#F8DF72]" />
            </div>
            <div className="flex-1">
              <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>旅行天数</label>
              <div className="flex items-center gap-2 bg-white border border-[#EEE9DC] rounded-2xl px-3 h-12">
                <button type="button" aria-label="减少一天" disabled={form.days <= 1}
                  onClick={() => setForm(f => ({ ...f, days: Math.max(1, f.days - 1) }))}
                  className="text-[18px] font-bold w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-35 active:bg-[#EEE9DC]" style={{ color: SEC }}>−</button>
                <span className="flex-1 text-center text-[15px] font-semibold text-[#2B2924]">{form.days}天</span>
                <button type="button" aria-label="增加一天" disabled={form.days >= 30}
                  onClick={() => setForm(f => ({ ...f, days: Math.min(30, f.days + 1) }))}
                  className="text-[18px] font-bold w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-35 active:bg-[#EEE9DC]" style={{ color: SEC }}>＋</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="px-4 pb-10 pt-3 shrink-0">
        <Btn variant="primary" className="w-full" disabled={!canSave}
          onClick={() => { if (!form.name.trim()) { setNameErr("请输入旅行名称"); return } onSave() }}>
          创建旅行
        </Btn>
      </div>
    </div>
  )
}

// ─── Add / Edit Place Screen ──────────────────────────────────────────────────

function AddPlaceScreen({ form, setForm, editingId, onBack, onSave }:
  { form: { name: string; type: PlaceType; note: string; address: string }; setForm: React.Dispatch<React.SetStateAction<{ name: string; type: PlaceType; note: string; address: string }>>; editingId: string | null; onBack: () => void; onSave: (f: { name: string; type: PlaceType; note: string; address: string }) => void }) {
  const [results, setResults] = useState<typeof MOCK_LOCS>([])
  const [showResults, setShowResults] = useState(false)
  const [nameErr, setNameErr] = useState("")

  const TYPES: PlaceType[] = ["attraction", "restaurant", "hotel", "transport", "other"]
  const TIconMap: Record<PlaceType, React.ElementType> = { attraction: Landmark, restaurant: Utensils, hotel: Building2, transport: Plane, other: Circle }

  const handleNameChange = (q: string) => {
    setForm(f => ({ ...f, name: q, address: "" }))
    setNameErr("")
    setResults(searchLocs(q))
    setShowResults(!!q.trim())
  }
  const handleSelect = (r: typeof MOCK_LOCS[0]) => {
    setForm(f => ({ ...f, name: r.name, address: r.address }))
    setResults([])
    setShowResults(false)
  }

  return (
    <div className="flex flex-col h-full bg-[#FFFCF3]">
      <div className="flex items-center gap-2 px-4 pt-12 pb-4 shrink-0">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center"><X size={20} strokeWidth={1.5} style={{ color: SEC }} /></button>
        <h1 className="text-[18px] font-semibold text-[#2B2924]">{editingId ? "编辑地点" : "添加地点"}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>地点名称 *</label>
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TERC }} />
            <input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="输入名称，自动搜索地点"
              className={`w-full h-12 pl-10 pr-4 rounded-2xl bg-white border text-[#2B2924] text-[15px] placeholder:text-[#A9A69F] outline-none transition-colors ${nameErr ? "border-[#C96B58]" : "border-[#EEE9DC] focus:border-[#F8DF72]"}`} />
          </div>
          {nameErr && <p className="text-[12px] text-[#C96B58] mt-1">{nameErr}</p>}
          {showResults && results.length > 0 && (
            <div className="mt-1 bg-white rounded-2xl border border-[#EEE9DC] overflow-hidden shadow-sm">
              {results.map((r, i) => (
                <button key={`${r.name}-${i}`} onClick={() => handleSelect(r)} className="w-full px-4 py-3 text-left border-b border-[#EEE9DC] last:border-0 active:bg-[#FFFCF3]">
                  <p className="text-[14px] font-medium text-[#2B2924]">{r.name}</p>
                  <p className="text-[12px]" style={{ color: TERC }}>{r.address}</p>
                </button>
              ))}
            </div>
          )}
          {showResults && results.length === 0 && (
            <p className="text-[12px] mt-2 px-1" style={{ color: TERC }}>未找到匹配地点，将只保存名称并暂不设置位置</p>
          )}
          {!showResults && form.address && (
            <div className="mt-2 flex items-start gap-2 px-1">
              <MapPin size={14} className="shrink-0 mt-0.5 text-[#76966F]" />
              <p className="text-[12px] leading-relaxed" style={{ color: SEC }}>{form.address}</p>
            </div>
          )}
        </div>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>地点类型</label>
          <div className="flex gap-2">
            {TYPES.map(t => {
              const Icon = TIconMap[t]
              const active = form.type === t
              return (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all ${active ? "border-[#F8DF72] bg-[#FFFBE8]" : "border-[#EEE9DC] bg-white"}`}>
                  <Icon size={18} strokeWidth={1.5} style={{ color: active ? "#2B2924" : TERC }} />
                  <span translate="no" lang="zh-CN" className="text-[10px] font-medium" style={{ color: active ? "#2B2924" : TERC }}>{TYPE_LABEL[t]}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>备注（选填）</label>
          <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="添加备注，如开放时间、预约提醒等" rows={2}
            className="w-full px-4 py-3 rounded-2xl bg-white border border-[#EEE9DC] text-[#2B2924] text-[14px] placeholder:text-[#A9A69F] outline-none focus:border-[#F8DF72] resize-none transition-colors" />
        </div>
      </div>
      <div className="px-4 pb-10 pt-3 shrink-0">
        <Btn variant="primary" className="w-full" disabled={!form.name.trim()}
          onClick={() => { if (!form.name.trim()) { setNameErr("请输入地点名称"); return } onSave(form) }}>
          {editingId ? "保存修改" : "保存到待安排池"}
        </Btn>
      </div>
    </div>
  )
}

// ─── Trip Settings Screen ─────────────────────────────────────────────────────

function TripSettingsScreen({ trip, onBack, onUpdate, setDlg, onDeleteDay, onSoftDeleteTrip }:
  { trip: Trip; onBack: () => void; onUpdate: (t: Trip) => void; setDlg: (c: DelCfg) => void; onDeleteDay: (day: number) => void; onSoftDeleteTrip: () => void }) {
  const [name,      setName]      = useState(trip.name)
  const [dest,      setDest]      = useState(trip.destination)
  const [dateMode,  setDateMode]  = useState<DateMode>(trip.dateMode)
  const [days,      setDays]      = useState(trip.days)
  const [startDate, setStartDate] = useState(trip.startDate)

  const save = () => onUpdate({ ...trip, name, destination: dest, dateMode, days, startDate })

  return (
    <div className="flex flex-col h-full bg-[#FFFCF3]">
      <div className="flex items-center gap-2 px-4 pt-12 pb-4 shrink-0">
        <button onClick={() => { save(); onBack() }} className="w-10 h-10 flex items-center justify-center">
          <ChevronLeft size={22} strokeWidth={1.5} style={{ color: SEC }} />
        </button>
        <h1 className="text-[18px] font-semibold text-[#2B2924]">旅行设置</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-8 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
        {/* Name & destination at top */}
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>旅行名称</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl bg-white border border-[#EEE9DC] text-[#2B2924] text-[15px] outline-none focus:border-[#F8DF72]" />
        </div>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>目的地</label>
          <input value={dest} onChange={e => setDest(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl bg-white border border-[#EEE9DC] text-[#2B2924] text-[15px] outline-none focus:border-[#F8DF72]" />
        </div>
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>日期状态</label>
          <div className="flex bg-[#EEE9DC] rounded-2xl p-1">
            {(["pending", "confirmed"] as DateMode[]).map(m => (
              <button key={m} onClick={() => setDateMode(m)}
                className={`flex-1 h-9 rounded-xl text-[14px] font-medium transition-all ${dateMode === m ? "bg-white text-[#2B2924] shadow-sm" : ""}`}
                style={{ color: dateMode === m ? "#2B2924" : SEC }}>
                {m === "pending" ? "日期暂定" : "日期确定"}
              </button>
            ))}
          </div>
        </div>
        {dateMode === "confirmed" && (
          <div className="bg-white rounded-2xl border border-[#EEE9DC] p-4 flex flex-col gap-3">
            <div>
              <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>开始日期</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-[#FFFCF3] border border-[#EEE9DC] text-[#2B2924] text-[14px] outline-none" />
            </div>
            {startDate && (
              <>
                <div>
                  <p className="text-[12px] mb-2" style={{ color: SEC }}>日期预览</p>
                  <div className="flex flex-col gap-1">
                    {Array.from({ length: Math.min(days, 5) }, (_, i) => {
                      const d = new Date(startDate); d.setDate(d.getDate() + i)
                      return (
                        <div key={i} className="flex items-center justify-between text-[13px]">
                          <span style={{ color: SEC }}>第{i+1}天</span>
                          <span className="text-[#2B2924] font-medium">{d.getMonth()+1}月{d.getDate()}日</span>
                        </div>
                      )
                    })}
                    {days > 5 && <p className="text-[12px]" style={{ color: TERC }}>…共{days}天</p>}
                  </div>
                </div>
                <button onClick={() => { onUpdate({ ...trip, name, destination: dest, dateMode: "confirmed", days, startDate }); setDateMode("confirmed") }}
                  className="w-full h-10 rounded-xl bg-[#F8DF72] text-[#2B2924] text-[14px] font-semibold">
                  确认日期
                </button>
              </>
            )}
          </div>
        )}
        {dateMode === "pending" && (
          <div>
            <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>旅行天数管理</label>
            <div className="bg-white rounded-2xl border border-[#EEE9DC] overflow-hidden">
              {Array.from({ length: days }, (_, i) => {
                const day = i + 1
                const cnt = getDayPlaces(trip.places, day).length
                return (
                  <div key={day} className="flex items-center px-4 py-3 border-b border-[#EEE9DC] last:border-0">
                    <span className="text-[14px] text-[#2B2924] flex-1">第{day}天</span>
                    {cnt > 0 && <span className="text-[12px] mr-3" style={{ color: TERC }}>{cnt}个地点</span>}
                    <button type="button" disabled={days <= 1} onClick={() => {
                      if (cnt > 0) {
                        setDlg({
                          title: `删除第${day}天？`,
                          desc: `这一天有${cnt}个地点。删除日期后，这些地点会返回待安排地点池，不会被彻底删除。`,
                          confirmLabel: "删除日期",
                          onConfirm: () => { onDeleteDay(day); setDays(d => Math.max(1, d - 1)) }
                        })
                      } else {
                        onDeleteDay(day); setDays(d => Math.max(1, d - 1))
                      }
                    }} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#C96B58] disabled:opacity-25 disabled:cursor-not-allowed active:bg-[#FEF6F4] active:scale-95">
                      <X size={16} strokeWidth={2} />
                    </button>
                  </div>
                )
              })}
              <button type="button" disabled={days >= 30}
                onClick={() => { const nextDays = Math.min(30, days + 1); setDays(nextDays); onUpdate({ ...trip, name, destination: dest, dateMode, days: nextDays, startDate }) }}
                className="w-full py-3 text-[13px] border-t border-dashed border-[#EEE9DC] flex items-center justify-center gap-2 disabled:opacity-35 disabled:cursor-not-allowed active:bg-[#FFFCF3]"
                style={{ color: SEC }}>
                <Plus size={15} /> 增加一天
              </button>
            </div>
          </div>
        )}
        {/* Soft delete — 移入回收站 */}
        <div className="mt-2">
          <button onClick={onSoftDeleteTrip}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-[#F0C4BC] text-[#C96B58] text-[15px] font-medium bg-white active:bg-[#FEF6F4]">
            <Trash2 size={16} strokeWidth={1.5} /> 移入计划回收站
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Place Pool Tab ───────────────────────────────────────────────────────────

function PlacePoolTab({ trip, filter, setFilter, onAdd, onArrange, onActions, onEdit, onViewItinerary }:
  { trip: Trip; filter: PlaceType | "all"; setFilter: (f: PlaceType | "all") => void; onAdd: () => void; onArrange: (id: string) => void; onActions: (id: string) => void; onEdit: (id: string) => void; onViewItinerary: () => void }) {
  const pool     = getPool(trip.places)
  const filtered = filter === "all" ? pool : pool.filter(p => p.type === filter)
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between px-4 pt-3 pb-2 shrink-0">
        <div>
          <h2 className="text-[19px] font-bold text-[#2B2924]">待安排地点</h2>
          <p className="text-[12px] mt-0.5" style={{ color: SEC }}>
            {pool.length === 0 ? "还没有分配到具体日期的地点" : `共${pool.length}个待安排地点`}
          </p>
        </div>
        <button onClick={onAdd} className="w-10 h-10 rounded-full bg-[#F8DF72] flex items-center justify-center mt-0.5 active:scale-95 transition-transform shadow-sm">
          <Plus size={20} strokeWidth={2.5} className="text-[#2B2924]" />
        </button>
      </div>
      <div className="overflow-x-auto shrink-0 px-4 pb-3" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2">
          {(["all", "attraction", "restaurant", "hotel", "transport", "other"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-3.5 h-8 rounded-full text-[12px] font-medium transition-colors ${filter === f ? "bg-[#F8DF72] text-[#2B2924]" : "bg-white border border-[#EEE9DC]"}`}
              style={{ color: filter === f ? "#2B2924" : SEC }}>
              {f === "all" ? "全部" : TYPE_LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "none" }}>
        {pool.length === 0 ? (
          <Empty icon={CheckCircle2} title="所有地点都已安排" desc="待安排地点池已空，所有地点已分配到日程中" action={{ label: "查看每日行程", onClick: onViewItinerary }} />
        ) : filtered.length === 0 ? (
          <Empty icon={MapPin} title={`没有${filter !== "all" ? TYPE_LABEL[filter] : ""}类型地点`} desc="切换筛选条件或添加新地点" />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(place => (
              <div key={place.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.06)" }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: TYPE_BG[place.type] }}>
                  <TIcon type={place.type} size={18} />
                </div>
                <button className="flex-1 text-left min-w-0" onClick={() => onEdit(place.id)}>
                  <p className="text-[15px] font-medium text-[#2B2924] truncate">{place.name}</p>
                  <p className="text-[12px]" style={{ color: SEC }}>{TYPE_LABEL[place.type]}{place.note ? ` · ${place.note}` : ""}</p>
                </button>
                <button onClick={() => onArrange(place.id)}
                  className="shrink-0 h-8 px-3 rounded-xl border border-[#F8DF72] text-[#2B2924] text-[12px] font-semibold bg-[#FFFBE6] active:bg-[#F7E8AA] transition-colors">
                  安排
                </button>
                <button onClick={() => onActions(place.id)}
                  className="w-11 h-11 flex items-center justify-center shrink-0 -mr-2">
                  <MoreHorizontal size={16} style={{ color: TERC }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Itinerary Tab ────────────────────────────────────────────────────────────

function ItineraryTab({ trip, selectedDay, setSelectedDay, view, setView, isReorder, onEnterReorder, onCancelReorder, onDoneReorder, expandedId, setExpandedId, onAddOptions, onActions, onMove, showToast }:
  { trip: Trip; selectedDay: number; setSelectedDay: (d: number) => void; view: ItvView; setView: (v: ItvView) => void; isReorder: boolean; onEnterReorder: () => void; onCancelReorder: () => void; onDoneReorder: () => void; expandedId: string | null; setExpandedId: (id: string | null) => void; onAddOptions: () => void; onActions: (id: string) => void; onMove: (id: string, dir: "up" | "down") => void; showToast: (msg: string, undo?: () => void) => void }) {
  const dayPlaces  = getDayPlaces(trip.places, selectedDay)
  const hasAnyPlace = trip.places.length > 0

  if (!hasAnyPlace) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-[#EEE9DC] flex items-center justify-center mb-4">
          <MapPin size={28} strokeWidth={1.5} style={{ color: TERC }} />
        </div>
        <h2 className="text-[17px] font-semibold text-[#2B2924] mb-1 text-center">先添加几个想去的地方</h2>
        <p className="text-[13px] text-center leading-relaxed mb-6" style={{ color: SEC }}>添加后，可以在地图上查看分布并安排到不同日期</p>
        <Btn variant="primary" onClick={onAddOptions}>添加地点</Btn>
      </div>
    )
  }

  if (isReorder) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#EEE9DC] shrink-0">
          <button onClick={onCancelReorder} className="text-[15px] px-1" style={{ color: SEC }}>取消</button>
          <span className="text-[15px] font-semibold text-[#2B2924]">调整顺序</span>
          <button onClick={onDoneReorder} className="text-[15px] font-semibold text-[#C8A200] px-1">完成</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          {dayPlaces.map((place, idx) => (
            <div key={place.id} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 mb-2" style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.06)" }}>
              <GripVertical size={20} style={{ color: "#C8C4BC" }} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-[#2B2924] truncate">{place.name}</p>
                <p className="text-[12px]" style={{ color: SEC }}>{TYPE_LABEL[place.type]}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => onMove(place.id, "up")} disabled={idx === 0}
                  className="w-8 h-7 rounded-lg bg-[#EEE9DC] flex items-center justify-center disabled:opacity-30 active:bg-[#DDD8CC]">
                  <ChevronUp size={14} className="text-[#2B2924]" />
                </button>
                <button onClick={() => onMove(place.id, "down")} disabled={idx === dayPlaces.length - 1}
                  className="w-8 h-7 rounded-lg bg-[#EEE9DC] flex items-center justify-center disabled:opacity-30 active:bg-[#DDD8CC]">
                  <ChevronDown size={14} className="text-[#2B2924]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-x-auto shrink-0 px-4 pt-2 pb-2" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2">
          {Array.from({ length: trip.days }, (_, i) => i + 1).map(day => (
            <button key={day} onClick={() => setSelectedDay(day)}
              className={`shrink-0 px-4 h-9 rounded-full text-[13px] font-medium transition-colors ${selectedDay === day ? "bg-[#F8DF72] text-[#2B2924]" : "bg-white border border-[#EEE9DC]"}`}
              style={{ color: selectedDay === day ? "#2B2924" : SEC }}>
              第{day}天{dayDateSuffix(trip, day).replace(" · ", "")}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between px-4 pb-2 shrink-0">
        <div>
          <span className="text-[15px] font-semibold text-[#2B2924]">第{selectedDay}天</span>
          <span className="text-[13px] ml-2" style={{ color: SEC }}>已安排{dayPlaces.length}个地点</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView(view === "normal" ? "compact" : "normal")}
            className="text-[12px] px-2.5 h-7 rounded-lg border border-[#EEE9DC] bg-white"
            style={{ color: SEC }}>
            {view === "normal" ? "紧凑" : "展开"}
          </button>
          {dayPlaces.length > 1 && (
            <button onClick={onEnterReorder}
              className="text-[12px] px-2.5 h-7 rounded-lg border border-[#EEE9DC] bg-white"
              style={{ color: SEC }}>
              调整顺序
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-2" style={{ scrollbarWidth: "none" }}>
        {dayPlaces.length === 0 ? (
          <Empty icon={CalendarDays} title="这一天还没有安排" desc="从待安排地点选择，或新建一个地点" action={{ label: "从待安排地点选择", onClick: onAddOptions }} />
        ) : view === "normal" ? (
          <div>
            {dayPlaces.map((place, idx) => (
              <div key={place.id}>
                <div className="bg-white rounded-2xl px-4 py-3.5 flex items-start gap-3" style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.06)" }}>
                  <div className="w-8 h-8 rounded-full bg-[#F8DF72] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[13px] font-bold text-[#2B2924]">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#2B2924]">{place.name}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: SEC }}>{TYPE_LABEL[place.type]}{place.note ? ` · ${place.note}` : ""}</p>
                    {place.address && <p className="text-[11px] mt-0.5 truncate" style={{ color: "#C8C4BC" }}>{place.address}</p>}
                  </div>
                  <button onClick={() => onActions(place.id)}
                    className="w-11 h-11 flex items-center justify-center shrink-0 -mr-2 -mt-1">
                    <MoreHorizontal size={17} style={{ color: TERC }} />
                  </button>
                </div>
                {idx < dayPlaces.length - 1 && (
                  <div className="ml-8 h-4 border-l-2 border-dashed border-[#EEE9DC]" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {dayPlaces.map((place, idx) => (
              <div key={place.id}>
                <button className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 active:bg-[#FFFCF3]"
                  style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.05)" }}
                  onClick={() => setExpandedId(expandedId === place.id ? null : place.id)}>
                  <div className="w-6 h-6 rounded-full bg-[#F8DF72] flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-[#2B2924]">{idx + 1}</span>
                  </div>
                  <span className="flex-1 text-left text-[14px] font-medium text-[#2B2924] truncate">{place.name}</span>
                  <button onClick={e => { e.stopPropagation(); onActions(place.id) }}
                    className="w-11 h-11 flex items-center justify-center -mr-2">
                    <MoreHorizontal size={14} style={{ color: TERC }} />
                  </button>
                </button>
                {expandedId === place.id && (
                  <div className="mx-3 px-4 pt-3 pb-3 bg-[#FFFCF3] rounded-b-xl border-x border-b border-[#EEE9DC] -mt-2">
                    <p className="text-[12px]" style={{ color: SEC }}>{TYPE_LABEL[place.type]}{place.note ? ` · ${place.note}` : ""}</p>
                    {place.address && <p className="text-[11px] mt-0.5" style={{ color: "#C8C4BC" }}>{place.address}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 px-4 pb-4 pt-2">
        <button onClick={onAddOptions}
          className="w-full h-11 rounded-2xl border border-dashed border-[#C8C4BC] text-[14px] font-medium flex items-center justify-center gap-2 active:bg-[#EEE9DC]/30 transition-colors"
          style={{ color: SEC }}>
          <Plus size={16} /> 添加地点
        </button>
      </div>
    </div>
  )
}

// ─── Map Tab ──────────────────────────────────────────────────────────────────

function MapTab({ trip, filter, setFilter, listOpen, setListOpen, onMarker, selectedId, setSelectedId }:
  { trip: Trip; filter: "all" | "pool" | number; setFilter: (f: "all" | "pool" | number) => void; listOpen: boolean; setListOpen: (v: boolean) => void; onMarker: (id: string) => void; selectedId: string | null; setSelectedId: (id: string | null) => void }) {
  const daysWithPlaces = [...new Set(trip.places.filter(p => p.dayAssigned !== null).map(p => p.dayAssigned as number))].sort()
  const filterOpts = [
    { key: "all"  as const, label: "全部" },
    { key: "pool" as const, label: "待安排" },
    ...daysWithPlaces.map(d => ({ key: d as number, label: `第${d}天` }))
  ]
  const visible = (p: Place) => filter === "all" || (filter === "pool" && p.dayAssigned === null) || (typeof filter === "number" && p.dayAssigned === filter)

  const visiblePlaces = trip.places.filter(visible)
  let barLabel = ""
  if (filter === "all")        barLabel = `全部 ${trip.places.length} 个地点`
  else if (filter === "pool")  barLabel = `${getPool(trip.places).length} 个待安排地点`
  else                         barLabel = `第${filter}天 · ${getDayPlaces(trip.places, filter as number).length} 个地点`

  return (
    <div className="relative flex-1 h-full overflow-hidden" style={{ background: "#EEEAE2" }}>
      <svg viewBox="0 0 390 520" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice"
        onClick={() => setSelectedId(null)}>
        <defs>
          <style>{`
            @keyframes mapPing {
              0%   { transform: scale(1);   opacity: 0.55; }
              100% { transform: scale(2.2); opacity: 0;    }
            }
            @keyframes mapBreath {
              0%, 100% { transform: scale(1);    opacity: 0.35; }
              50%       { transform: scale(1.25); opacity: 0.08; }
            }
            .map-ping {
              transform-box: fill-box;
              transform-origin: center;
              animation: mapPing 1.6s ease-out infinite;
            }
            .map-breath {
              transform-box: fill-box;
              transform-origin: center;
              animation: mapBreath 1.6s ease-in-out infinite;
            }
          `}</style>
        </defs>
        <rect width="390" height="520" fill="#EEEAE2" />
        {/* Forbidden City block */}
        <rect x="177" y="148" width="36" height="30" fill="#E0DAD0" rx="3" />
        {/* Water */}
        <ellipse cx="146" cy="133" rx="13" ry="7" fill="#B0C8DE" opacity="0.8" />
        <ellipse cx="154" cy="148" rx="8"  ry="6" fill="#B0C8DE" opacity="0.8" />
        {/* Ring roads */}
        <polygon points="194,15 325,42 372,115 372,228 328,318 194,352 60,318 18,228 18,115 63,42"
          fill="none" stroke="#D4D0C8" strokeWidth="1.8" opacity="0.5" />
        <polygon points="194,68 272,84 312,130 312,192 278,252 194,272 110,252 76,192 76,130 116,84"
          fill="none" stroke="#CCCAC2" strokeWidth="2.5" />
        <polygon points="194,101 240,110 264,142 264,184 240,224 194,234 148,224 124,184 124,142 148,110"
          fill="none" stroke="#C4C0B8" strokeWidth="3" />
        {/* Roads */}
        <line x1="0"   y1="186" x2="390" y2="186" stroke="#C8C4BC" strokeWidth="4" />
        <line x1="194" y1="0"   x2="194" y2="520" stroke="#C8C4BC" strokeWidth="2.5" />
        <line x1="0"   y1="240" x2="390" y2="240" stroke="#D4D0C8" strokeWidth="2"   opacity="0.6" />
        <line x1="0"   y1="130" x2="390" y2="130" stroke="#D4D0C8" strokeWidth="1.8" opacity="0.5" />
        <line x1="124" y1="0"   x2="124" y2="520" stroke="#D4D0C8" strokeWidth="1.8" opacity="0.5" />
        <line x1="264" y1="0"   x2="264" y2="520" stroke="#D4D0C8" strokeWidth="1.8" opacity="0.5" />
        {/* Markers */}
        {trip.places.map(place => {
          const dim   = !visible(place)
          const isSel = selectedId === place.id
          const isPool = place.dayAssigned === null
          return (
            <g key={place.id} onClick={e => { e.stopPropagation(); setSelectedId(place.id); onMarker(place.id) }}
              style={{ cursor: "pointer", opacity: dim ? 0.18 : 1, transition: "opacity 0.2s" }}>
              {isSel && <>
                <circle cx={place.coords.x} cy={place.coords.y} r={14} fill="#F8DF72" className="map-ping" />
                <circle cx={place.coords.x} cy={place.coords.y} r={14} fill="#F8DF72" className="map-breath" />
              </>}
              {isPool ? (
                <>
                  <circle cx={place.coords.x} cy={place.coords.y} r={12} fill="white" stroke="#A9A69F" strokeWidth={2} />
                  <circle cx={place.coords.x} cy={place.coords.y} r={4}  fill="#A9A69F" />
                </>
              ) : (
                <>
                  <circle cx={place.coords.x} cy={place.coords.y} r={13} fill="#F8DF72" stroke="#D4B800" strokeWidth={1.5} />
                  <text x={place.coords.x} y={place.coords.y} textAnchor="middle" dominantBaseline="central"
                    fontSize="10" fontWeight="700" fill="#2B2924"
                    style={{ userSelect: "none", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                    {place.dayAssigned}
                  </text>
                </>
              )}
              <circle cx={place.coords.x} cy={place.coords.y} r={20} fill="transparent" />
            </g>
          )
        })}
      </svg>

      {/* Filter pills */}
      <div className="absolute top-3 left-0 right-0 px-4 z-10">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {filterOpts.map(f => (
            <button key={String(f.key)} onClick={() => setFilter(f.key)}
              className={`shrink-0 px-4 h-8 rounded-full text-[12px] font-semibold shadow-md transition-colors ${filter === f.key ? "bg-[#F8DF72] text-[#2B2924]" : "bg-white"}`}
              style={{ color: filter === f.key ? "#2B2924" : SEC }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-14 right-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md border border-[#EEE9DC]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full bg-[#F8DF72] border border-[#D4B800] flex items-center justify-center shrink-0">
            <span style={{ fontSize: "8px", fontWeight: 700, color: "#2B2924" }}>1</span>
          </div>
          <span className="text-[10px]" style={{ color: SEC }}>旅行日</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-white border-2 border-[#A9A69F] flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#A9A69F]" />
          </div>
          <span className="text-[10px]" style={{ color: SEC }}>待安排</span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-4 inset-x-4 z-10">
        {listOpen && (
          <div className="absolute bottom-14 inset-x-0 bg-white rounded-2xl shadow-xl overflow-hidden max-h-56">
            <div className="overflow-y-auto max-h-56" style={{ scrollbarWidth: "none" }}>
              {visiblePlaces.map(p => (
                <button key={p.id} onClick={() => { setSelectedId(p.id); setListOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-[#FFFCF3] border-b border-[#EEE9DC] last:border-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${p.dayAssigned ? "bg-[#F8DF72]" : "bg-[#EEE9DC]"}`}>
                    {p.dayAssigned
                      ? <span className="text-[10px] font-bold text-[#2B2924]">{p.dayAssigned}</span>
                      : <div className="w-2 h-2 rounded-full bg-[#A9A69F]" />}
                  </div>
                  <span className="flex-1 text-left text-[13px] text-[#2B2924] truncate">{p.name}</span>
                  <span className="text-[11px] shrink-0" style={{ color: TERC }}>{TYPE_LABEL[p.type]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => setListOpen(!listOpen)}
          className="w-full bg-white rounded-2xl px-4 h-12 flex items-center justify-between shadow-lg active:bg-[#FFFCF3]">
          <span className="text-[13px] font-semibold text-[#2B2924]">{barLabel}</span>
          <ChevronUp size={18} style={{ color: SEC }} className={`transition-transform ${listOpen ? "" : "rotate-180"}`} />
        </button>
      </div>
    </div>
  )
}

// ─── Global Bottom Nav ────────────────────────────────────────────────────────

function GlobalNav({ tab, setTab }: { tab: GlobalTab; setTab: (t: GlobalTab) => void }) {
  return (
    <div className="shrink-0 border-t border-[#EEE9DC] bg-white flex items-center px-3 pt-2 pb-6 gap-1">
      {([
        { tab: "trips"   as GlobalTab, icon: MapPin, label: "旅行" },
        { tab: "profile" as GlobalTab, icon: User,   label: "我的" },
      ] as const).map(({ tab: t, icon: Icon, label }) => (
        <button key={t} onClick={() => setTab(t)}
          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl transition-all ${tab === t ? "bg-[#F8DF72]" : ""}`}>
          <Icon size={20} strokeWidth={1.5} style={{ color: tab === t ? "#2B2924" : SEC }} />
          <span className="text-[10px] font-semibold" style={{ color: tab === t ? "#2B2924" : SEC }}>{label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [initialData] = useState<PersistedData>(() => loadPersistedData())
  const [screen,       setScreen]       = useState<Screen>("list")
  const [globalTab,    setGlobalTab]    = useState<GlobalTab>("trips")
  const [wsTab,        setWsTab]        = useState<WsTab>("itinerary")
  const [trips,        setTrips]        = useState<Trip[]>(initialData.trips)
  const [trashedTrips, setTrashedTrips] = useState<TrashedTrip[]>(initialData.trashedTrips)
  const [curTripId,    setCurTripId]    = useState(initialData.curTripId)
  const [profile,      setProfile]      = useState<UserProfile>(initialData.profile)
  const trip = trips.find(t => t.id === curTripId) || trips[0]

  useEffect(() => {
    savePersistedData({ version: STORAGE_VERSION, trips, trashedTrips, curTripId, profile })
  }, [trips, trashedTrips, curTripId, profile])

  const [selectedDay,  setSelectedDay]  = useState(1)
  const [itvView,      setItvView]      = useState<ItvView>("normal")
  const [isReorder,    setIsReorder]    = useState(false)
  const [reorderSnap,  setReorderSnap]  = useState<Place[] | null>(null)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [poolFilter,   setPoolFilter]   = useState<PlaceType | "all">("all")
  const [mapFilter,    setMapFilter]    = useState<"all" | "pool" | number>("all")
  const [mapListOpen,  setMapListOpen]  = useState(false)
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null)

  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [addForm,      setAddForm]      = useState({ name: "", type: "attraction" as PlaceType, note: "", address: "" })
  const [createForm,   setCreateForm]   = useState({ name: "", dest: "", dateMode: "pending" as DateMode, days: 7, startDate: "" })

  const [dayPicker,    setDayPicker]    = useState({ open: false, placeId: "", selectedDay: null as number | null, mode: "arrange" as DayPickerMode })
  const [placeAct,     setPlaceAct]     = useState({ open: false, id: "", source: "itinerary" as "itinerary" | "pool" })
  const [mapSum,       setMapSum]       = useState({ open: false, id: "" })
  const [extMapPlaceId, setExtMapPlaceId] = useState<string | null>(null)
  const [addOpts,      setAddOpts]      = useState(false)
  const [fromPool,     setFromPool]     = useState(false)
  const [dlg,          setDlg]          = useState<DelCfg | null>(null)
  const [toast,        setToast]        = useState<{ msg: string; undo?: () => void } | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout>>()

  const showToast = (msg: string, undo?: () => void) => {
    clearTimeout(toastRef.current)
    setToast({ msg, undo })
    toastRef.current = setTimeout(() => setToast(null), 3500)
  }

  const extMapPlace = trip?.places.find(p => p.id === extMapPlaceId)

  const openExternalMap = (provider: "amap" | "baidu") => {
    if (!extMapPlace) return
    const keyword = [extMapPlace.name, extMapPlace.address.trim()].filter(Boolean).join(" ")
    const city = trip?.destination.trim() || "全国"
    const url = provider === "amap"
      ? `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}&city=${encodeURIComponent(city)}&view=map&src=tripflow&callnative=0`
      : `https://api.map.baidu.com/place/search?query=${encodeURIComponent(keyword)}&region=${encodeURIComponent(city)}&output=html&src=webapp.tripflow.travelplanner`
    window.open(url, "_blank", "noopener,noreferrer")
    setExtMapPlaceId(null)
  }

  const updateTrip = (fn: (t: Trip) => Trip) => {
    setTrips(ts => ts.map(t => t.id === curTripId ? fn(t) : t))
  }

  const assignPlace = (placeId: string, day: number) => {
    const place = trip?.places.find(p => p.id === placeId)
    if (!place) return
    const prevDay = place.dayAssigned; const prevOrder = place.order
    const cnt = getDayPlaces(trip!.places, day).length
    const isMove = prevDay !== null
    updateTrip(t => ({ ...t, places: t.places.map(p => p.id === placeId ? { ...p, dayAssigned: day, order: cnt + 1 } : p) }))
    const msg = isMove ? `已将${place.name}移动到第${day}天` : `已将${place.name}安排到第${day}天`
    showToast(msg, () => {
      updateTrip(t => ({ ...t, places: t.places.map(p => p.id === placeId ? { ...p, dayAssigned: prevDay, order: prevOrder } : p) }))
    })
  }

  const returnToPool = (placeId: string) => {
    const place = trip?.places.find(p => p.id === placeId)
    if (!place) return
    const prevDay = place.dayAssigned; const prevOrder = place.order
    updateTrip(t => ({ ...t, places: t.places.map(p => p.id === placeId ? { ...p, dayAssigned: null, order: 0 } : p) }))
    showToast(`已将${place.name}移回待安排地点`, () => {
      updateTrip(t => ({ ...t, places: t.places.map(p => p.id === placeId ? { ...p, dayAssigned: prevDay, order: prevOrder } : p) }))
    })
  }

  const deletePlace = (placeId: string) => {
    updateTrip(t => ({ ...t, places: t.places.filter(p => p.id !== placeId) }))
    showToast("地点已删除")
  }

  const movePlaceInDay = (placeId: string, dir: "up" | "down") => {
    updateTrip(t => {
      const dayPs  = getDayPlaces(t.places, t.places.find(p => p.id === placeId)?.dayAssigned || 1)
      const idx    = dayPs.findIndex(p => p.id === placeId)
      const newIdx = dir === "up" ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= dayPs.length) return t
      const swap = dayPs[newIdx]
      return { ...t, places: t.places.map(p => p.id === placeId ? { ...p, order: swap.order } : p.id === swap.id ? { ...p, order: dayPs[idx].order } : p) }
    })
  }

  const enterReorder = () => {
    if (trip) setReorderSnap(trip.places.map(p => ({ ...p })))
    setIsReorder(true)
  }
  const cancelReorder = () => {
    if (reorderSnap) {
      updateTrip(t => ({ ...t, places: reorderSnap }))
      setReorderSnap(null)
    }
    setIsReorder(false)
  }
  const doneReorder = () => {
    setReorderSnap(null)
    setIsReorder(false)
    showToast("顺序已更新")
  }

  const savePlace = (form: typeof addForm) => {
    if (editingId) {
      updateTrip(t => ({ ...t, places: t.places.map(p => p.id === editingId ? { ...p, ...form } : p) }))
      showToast("地点已更新")
    } else {
      const np: Place = { id: genId(), ...form, dayAssigned: null, order: 0, coords: { x: 170 + Math.random() * 50, y: 150 + Math.random() * 50 } }
      updateTrip(t => ({ ...t, places: [np, ...t.places] }))
      showToast(`${form.name}已添加到待安排地点`)
    }
    setScreen("workspace"); setWsTab("pool"); setEditingId(null)
    setAddForm({ name: "", type: "attraction", note: "", address: "" })
  }

  const createTrip = () => {
    const nt: Trip = { id: genId(), name: createForm.name, destination: createForm.dest, dateMode: createForm.dateMode, days: createForm.days, startDate: createForm.startDate, places: [] }
    setTrips(ts => [...ts, nt]); setCurTripId(nt.id)
    setScreen("workspace"); setWsTab("itinerary"); setSelectedDay(1)
    setCreateForm({ name: "", dest: "", dateMode: "pending", days: 7, startDate: "" })
  }

  const softDeleteTrip = (id: string) => {
    const t = trips.find(x => x.id === id)
    if (!t) return
    setTrashedTrips(arr => [...arr, { ...t, trashedAt: Date.now() }])
    const remaining = trips.filter(x => x.id !== id)
    setTrips(remaining)
    if (curTripId === id) setCurTripId(remaining[0]?.id || "")
    showToast(`「${t.name}」已移入回收站`)
    setScreen("list")
  }

  const restoreTrip = (id: string) => {
    const t = trashedTrips.find(x => x.id === id)
    if (!t) return
    const { trashedAt: _, ...restored } = t
    setTrips(arr => [...arr, restored])
    setTrashedTrips(arr => arr.filter(x => x.id !== id))
    showToast(`「${t.name}」已恢复`)
  }

  const permDeleteTrip = (id: string) => {
    setTrashedTrips(arr => arr.filter(x => x.id !== id))
    showToast("旅行已永久删除")
  }

  const resetExampleData = () => {
    const defaults = createDefaultData()
    setTrips(defaults.trips)
    setTrashedTrips(defaults.trashedTrips)
    setCurTripId(defaults.curTripId)
    setScreen("list")
    setGlobalTab("trips")
    setWsTab("itinerary")
    setSelectedDay(1)
    showToast("已恢复示例数据")
  }

  const deleteDay = (day: number) => {
    if (!trip || trip.days <= 1) return
    updateTrip(t => ({
      ...t, days: t.days - 1,
      places: t.places.map(p => {
        if (p.dayAssigned === day)                               return { ...p, dayAssigned: null, order: 0 }
        if (p.dayAssigned !== null && p.dayAssigned > day)      return { ...p, dayAssigned: p.dayAssigned - 1 }
        return p
      })
    }))
    if (selectedDay > (trip?.days || 1) - 1) setSelectedDay(Math.max(1, (trip?.days || 1) - 1))
  }

  const openAddPlace  = () => { setEditingId(null); setAddForm({ name: "", type: "attraction", note: "", address: "" }); setScreen("add-place") }
  const openEditPlace = (id: string) => {
    const p = trip?.places.find(pl => pl.id === id)
    if (!p) return
    setEditingId(id); setAddForm({ name: p.name, type: p.type, note: p.note, address: p.address }); setScreen("add-place")
  }

  const actPlace  = placeAct.id  ? trip?.places.find(p => p.id === placeAct.id)  : null
  const mapPlace  = mapSum.id    ? trip?.places.find(p => p.id === mapSum.id)     : null
  const pool      = trip ? getPool(trip.places) : []

  const toastBottom = screen === "workspace" ? (isReorder ? 100 : 100) : 96

  return (
    <div className="flex items-start justify-center min-h-[100dvh] bg-stone-300 sm:py-8 py-0"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="relative w-full sm:w-[390px] bg-[#FFFCF3] overflow-hidden flex flex-col sm:rounded-[44px] sm:shadow-2xl"
        style={{ height: "100dvh", maxHeight: "844px" }}>

        {/* ── List (trips + profile) ─────────────────────────────── */}
        {screen === "list" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-hidden">
              {globalTab === "trips" ? (
                <TripListScreen
                  trips={trips}
                  onSelect={id => { setCurTripId(id); setScreen("workspace"); setWsTab("itinerary"); setSelectedDay(1) }}
                  onCreate={() => setScreen("create")}
                  setDlg={setDlg}
                  onSoftDelete={softDeleteTrip} />
              ) : (
                <ProfileScreen
                  profile={profile}
                  onUpdateProfile={nextProfile => { setProfile(nextProfile); showToast("资料已保存") }}
                  trashedTrips={trashedTrips}
                  onRestore={restoreTrip}
                  onPermDelete={permDeleteTrip}
                  onResetData={resetExampleData}
                  setDlg={setDlg} />
              )}
            </div>
            <GlobalNav tab={globalTab} setTab={setGlobalTab} />
          </div>
        )}

        {/* ── Create Trip ───────────────────────────────────────── */}
        {screen === "create" && (
          <CreateTripScreen form={createForm} setForm={setCreateForm} onBack={() => setScreen("list")} onSave={createTrip} />
        )}

        {/* ── Add / Edit Place ──────────────────────────────────── */}
        {screen === "add-place" && (
          <AddPlaceScreen form={addForm} setForm={setAddForm} editingId={editingId}
            onBack={() => { setScreen("workspace"); setEditingId(null); setAddForm({ name: "", type: "attraction", note: "", address: "" }) }}
            onSave={savePlace} />
        )}

        {/* ── Trip Settings ─────────────────────────────────────── */}
        {screen === "settings" && trip && (
          <TripSettingsScreen trip={trip} onBack={() => setScreen("workspace")}
            onUpdate={t => setTrips(ts => ts.map(x => x.id === t.id ? t : x))}
            setDlg={setDlg} onDeleteDay={deleteDay}
            onSoftDeleteTrip={() => setDlg({
              title: "移入计划回收站？",
              desc: `「${trip.name}」将移入回收站，30天后自动永久删除。可在"我的 → 计划回收站"中恢复。`,
              confirmLabel: "移入回收站",
              onConfirm: () => softDeleteTrip(trip.id),
            })} />
        )}

        {/* ── Workspace ─────────────────────────────────────────── */}
        {screen === "workspace" && trip && (
          <div className="flex flex-col h-full">
            {/* Top bar */}
            <div className="shrink-0 px-4 pt-12 pb-3 flex items-center gap-2">
              <button onClick={() => setScreen("list")}
                className="w-9 h-9 flex items-center justify-center rounded-xl active:bg-[#EEE9DC] transition-colors shrink-0"
                style={{ color: SEC }}>
                <ChevronLeft size={22} strokeWidth={1.5} />
              </button>
              <button onClick={() => setScreen("settings")}
                className="flex-1 flex items-center gap-2 active:bg-[#F7E8AA]/30 rounded-2xl px-2 py-1 transition-colors">
                <div className="flex-1 text-left">
                  <h1 className="text-[18px] font-bold text-[#2B2924] leading-tight">{trip.name}</h1>
                  <p className="text-[12px] mt-0.5" style={{ color: SEC }}>{tripDateLabel(trip)} · {trip.days}天</p>
                </div>
                <div className="w-9 h-9 flex items-center justify-center" style={{ color: SEC }}>
                  <Settings size={19} strokeWidth={1.5} />
                </div>
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {wsTab === "pool" && (
                <PlacePoolTab trip={trip} filter={poolFilter} setFilter={setPoolFilter}
                  onAdd={openAddPlace}
                  onArrange={id => setDayPicker({ open: true, placeId: id, selectedDay: null, mode: "arrange" })}
                  onActions={id => setPlaceAct({ open: true, id, source: "pool" })}
                  onEdit={openEditPlace}
                  onViewItinerary={() => setWsTab("itinerary")} />
              )}
              {wsTab === "itinerary" && (
                <ItineraryTab trip={trip} selectedDay={selectedDay} setSelectedDay={setSelectedDay}
                  view={itvView} setView={setItvView}
                  isReorder={isReorder} onEnterReorder={enterReorder} onCancelReorder={cancelReorder} onDoneReorder={doneReorder}
                  expandedId={expandedId} setExpandedId={setExpandedId}
                  onAddOptions={() => setAddOpts(true)}
                  onActions={id => setPlaceAct({ open: true, id, source: "itinerary" })}
                  onMove={movePlaceInDay} showToast={showToast} />
              )}
              {wsTab === "map" && (
                <MapTab trip={trip} filter={mapFilter} setFilter={setMapFilter}
                  listOpen={mapListOpen} setListOpen={setMapListOpen}
                  selectedId={mapSelectedId} setSelectedId={setMapSelectedId}
                  onMarker={id => setMapSum({ open: true, id })} />
              )}
            </div>

            {/* Bottom nav — hidden in reorder mode */}
            {!isReorder && (
              <div className="shrink-0 border-t border-[#EEE9DC] bg-white flex items-center px-3 pt-2 pb-6 gap-1">
                {([
                  { tab: "pool"      as WsTab, icon: LayoutList,  label: "地点池" },
                  { tab: "itinerary" as WsTab, icon: CalendarDays, label: "每日行程" },
                  { tab: "map"       as WsTab, icon: MapIcon,      label: "地图" },
                ] as const).map(({ tab, icon: Icon, label }) => (
                  <button key={tab} onClick={() => { setWsTab(tab); setIsReorder(false); setMapListOpen(false) }}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl transition-all ${wsTab === tab ? "bg-[#F8DF72]" : ""}`}>
                    <Icon size={20} strokeWidth={1.5} style={{ color: wsTab === tab ? "#2B2924" : SEC }} />
                    <span className="text-[10px] font-semibold" style={{ color: wsTab === tab ? "#2B2924" : SEC }}>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Day Picker Sheet ────────────────────────────────────── */}
        <Sheet open={dayPicker.open} onClose={() => setDayPicker(d => ({ ...d, open: false }))}
          title={dayPicker.mode === "arrange" ? "安排到哪一天？" : "移动到哪一天？"}>
          <div className="px-4 pb-6">
            {Array.from({ length: trip?.days || 0 }, (_, i) => i + 1).map(day => {
              const cnt     = getDayPlaces(trip?.places || [], day).length
              const sel     = dayPicker.selectedDay === day
              const isCurr  = dayPicker.mode === "move" && trip?.places.find(p => p.id === dayPicker.placeId)?.dayAssigned === day
              return (
                <button key={day}
                  onClick={() => !isCurr && setDayPicker(d => ({ ...d, selectedDay: day }))}
                  disabled={isCurr}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl mb-2 transition-colors
                    ${sel ? "bg-[#F7E8AA]" : isCurr ? "bg-[#F5F5F0]" : "bg-[#FFFCF3] active:bg-[#EEE9DC]/40"}`}>
                  <span className={`text-[15px] font-medium ${isCurr ? "" : "text-[#2B2924]"}`}
                    style={{ color: isCurr ? TERC : "#2B2924" }}>
                    第{day}天{dayDateSuffix(trip!, day)}
                    {isCurr && <span className="text-[11px] ml-1.5" style={{ color: TERC }}>当前所在日</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px]" style={{ color: SEC }}>{cnt > 0 ? `已安排${cnt}个` : "暂无安排"}</span>
                    {sel && <Check size={15} className="text-[#76966F]" />}
                  </div>
                </button>
              )
            })}
            <Btn variant="primary" className="w-full mt-2" disabled={dayPicker.selectedDay === null}
              onClick={() => {
                if (dayPicker.selectedDay && dayPicker.placeId) {
                  assignPlace(dayPicker.placeId, dayPicker.selectedDay)
                  setDayPicker(d => ({ ...d, open: false }))
                }
              }}>
              {dayPicker.mode === "arrange" ? "确认安排" : "确认移动"}
            </Btn>
          </div>
        </Sheet>

        {/* ── Itinerary Place Actions Sheet ───────────────────────── */}
        {placeAct.source === "itinerary" && (
          <Sheet open={placeAct.open} onClose={() => setPlaceAct(a => ({ ...a, open: false }))}>
            {actPlace && (
              <div className="pb-6">
                <div className="px-5 pb-3 border-b border-[#EEE9DC]">
                  <p className="text-[16px] font-semibold text-[#2B2924]">{actPlace.name}</p>
                  <p className="text-[12px]" style={{ color: SEC }}>当前安排：第{actPlace.dayAssigned}天</p>
                </div>
                {[
                  { label: "移动到其他日期", icon: ChevronRight, fn: () => { setPlaceAct(a => ({ ...a, open: false })); setDayPicker({ open: true, placeId: actPlace.id, selectedDay: actPlace.dayAssigned, mode: "move" }) } },
                  { label: "移回待安排地点", icon: RotateCcw,    fn: () => { setPlaceAct(a => ({ ...a, open: false })); returnToPool(actPlace.id) } },
                  { label: "编辑地点",       icon: Edit3,        fn: () => { setPlaceAct(a => ({ ...a, open: false })); openEditPlace(actPlace.id) } },
                  { label: "在高德/百度地图中查看", icon: Navigation2, fn: () => { setPlaceAct(a => ({ ...a, open: false })); setExtMapPlaceId(actPlace.id) } },
                ].map(({ label, icon: Icon, fn }) => (
                  <button key={label} onClick={fn} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#FFFCF3] text-[#2B2924]">
                    <Icon size={17} strokeWidth={1.5} style={{ color: SEC }} />
                    <span className="text-[15px]">{label}</span>
                  </button>
                ))}
                <div className="mx-5 h-px bg-[#EEE9DC] my-1" />
                <button onClick={() => { setPlaceAct(a => ({ ...a, open: false })); setDlg({ title: `确定删除${actPlace.name}吗？`, desc: "删除后，它会从行程和地图中同时移除。", onConfirm: () => deletePlace(actPlace.id) }) }}
                  className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#FFFCF3]">
                  <Trash2 size={17} strokeWidth={1.5} className="text-[#C96B58]" />
                  <span className="text-[15px] text-[#C96B58]">删除地点</span>
                </button>
              </div>
            )}
          </Sheet>
        )}

        {/* ── Pool Place Actions Sheet ────────────────────────────── */}
        {placeAct.source === "pool" && (
          <Sheet open={placeAct.open} onClose={() => setPlaceAct(a => ({ ...a, open: false }))}>
            {actPlace && (
              <div className="pb-6">
                <div className="px-5 pb-3 border-b border-[#EEE9DC]">
                  <p className="text-[16px] font-semibold text-[#2B2924]">{actPlace.name}</p>
                  <p className="text-[12px]" style={{ color: SEC }}>待安排地点</p>
                </div>
                {[
                  { label: "编辑地点",     icon: Edit3,       fn: () => { setPlaceAct(a => ({ ...a, open: false })); openEditPlace(actPlace.id) } },
                  { label: "在高德/百度地图中查看", icon: Navigation2, fn: () => { setPlaceAct(a => ({ ...a, open: false })); setExtMapPlaceId(actPlace.id) } },
                ].map(({ label, icon: Icon, fn }) => (
                  <button key={label} onClick={fn} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#FFFCF3] text-[#2B2924]">
                    <Icon size={17} strokeWidth={1.5} style={{ color: SEC }} />
                    <span className="text-[15px]">{label}</span>
                  </button>
                ))}
                <div className="mx-5 h-px bg-[#EEE9DC] my-1" />
                <button onClick={() => { setPlaceAct(a => ({ ...a, open: false })); setDlg({ title: `确定删除${actPlace.name}吗？`, desc: "删除后，它会从行程和地图中同时移除。", onConfirm: () => deletePlace(actPlace.id) }) }}
                  className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#FFFCF3]">
                  <Trash2 size={17} strokeWidth={1.5} className="text-[#C96B58]" />
                  <span className="text-[15px] text-[#C96B58]">删除地点</span>
                </button>
              </div>
            )}
          </Sheet>
        )}

        {/* ── Map Place Summary Sheet ─────────────────────────────── */}
        <Sheet open={mapSum.open} onClose={() => setMapSum(m => ({ ...m, open: false }))}>
          {mapPlace && (
            <div className="px-5 pb-8">
              <TBadge type={mapPlace.type} />
              <h2 className="text-[20px] font-bold text-[#2B2924] mt-2 mb-1">{mapPlace.name}</h2>
              {mapPlace.address && <p className="text-[13px] mb-1" style={{ color: SEC }}>{mapPlace.address}</p>}
              {mapPlace.note    && <p className="text-[13px] mb-1" style={{ color: SEC }}>备注：{mapPlace.note}</p>}
              <p className="text-[13px] mb-5" style={{ color: TERC }}>
                当前状态：{mapPlace.dayAssigned ? `第${mapPlace.dayAssigned}天` : "待安排地点"}
              </p>
              <div className="flex gap-2.5">
                <Btn variant="primary" className="flex-1 text-[14px]"
                  onClick={() => {
                    setMapSum(m => ({ ...m, open: false }))
                    setDayPicker({ open: true, placeId: mapPlace.id, selectedDay: mapPlace.dayAssigned, mode: mapPlace.dayAssigned ? "move" : "arrange" })
                  }}>
                  {mapPlace.dayAssigned ? "移动到其他日期" : "安排到某一天"}
                </Btn>
                <Btn variant="secondary" className="text-[14px] px-4"
                  onClick={() => { setMapSum(m => ({ ...m, open: false })); setExtMapPlaceId(mapPlace.id) }}>
                  <Navigation2 size={15} /> 外部地图
                </Btn>
              </div>
            </div>
          )}
        </Sheet>

        {/* ── External Map Dialog ─────────────────────────────────── */}
        {extMapPlace && (
          <>
            <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setExtMapPlaceId(null)} />
            <div className="fixed inset-x-5 top-1/2 -translate-y-1/2 bg-white rounded-3xl z-50 p-6 max-w-[370px] mx-auto shadow-2xl">
              <h3 className="text-[17px] font-semibold text-[#2B2924] mb-2">即将离开 TripFlow</h3>
              <p className="text-[13px] leading-relaxed mb-1" style={{ color: SEC }}>将在新标签页中搜索「{extMapPlace.name}」。</p>
              <p className="text-[12px] leading-relaxed mb-5" style={{ color: TERC }}>地点结果、路线和导航由外部地图提供，返回后你的 TripFlow 行程不会改变。</p>
              <div className="flex gap-3 mb-4">
                <button onClick={() => openExternalMap("baidu")} className="flex-1 h-12 rounded-2xl bg-[#3478F6] text-white font-semibold text-[15px] active:opacity-90">百度地图</button>
                <button onClick={() => openExternalMap("amap")} className="flex-1 h-12 rounded-2xl bg-[#1BA784] text-white font-semibold text-[15px] active:opacity-90">高德地图</button>
              </div>
              <button onClick={() => setExtMapPlaceId(null)} className="w-full text-center text-[14px] py-2" style={{ color: SEC }}>取消</button>
            </div>
          </>
        )}

        {/* ── Add Options Sheet ───────────────────────────────────── */}
        <Sheet open={addOpts} onClose={() => setAddOpts(false)}>
          <div className="px-4 pb-6 flex flex-col gap-2">
            <button onClick={() => { setAddOpts(false); setFromPool(true) }}
              className="w-full flex items-center gap-4 px-4 py-4 bg-[#FFFCF3] rounded-2xl active:bg-[#EEE9DC]/30 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-[#EEE9DC] flex items-center justify-center">
                <LayoutList size={18} style={{ color: SEC }} />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-semibold text-[#2B2924]">从待安排地点选择</p>
                <p className="text-[12px]" style={{ color: SEC }}>共{pool.length}个待安排地点</p>
              </div>
            </button>
            <button onClick={() => { setAddOpts(false); openAddPlace() }}
              className="w-full flex items-center gap-4 px-4 py-4 bg-[#FFFCF3] rounded-2xl active:bg-[#EEE9DC]/30 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-[#EEE9DC] flex items-center justify-center">
                <Plus size={18} style={{ color: SEC }} />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-semibold text-[#2B2924]">新建地点</p>
                <p className="text-[12px]" style={{ color: SEC }}>手动输入地点信息</p>
              </div>
            </button>
          </div>
        </Sheet>

        {/* ── From Pool Select Sheet ──────────────────────────────── */}
        <Sheet open={fromPool} onClose={() => setFromPool(false)} title="从待安排地点选择">
          <div className="pb-6">
            {pool.length === 0 ? (
              <div className="py-10 text-center text-[14px]" style={{ color: SEC }}>待安排地点池为空，所有地点已安排</div>
            ) : (
              pool.map(p => (
                <button key={p.id} onClick={() => { setFromPool(false); assignPlace(p.id, selectedDay) }}
                  className="w-full flex items-center gap-3 px-5 py-3 active:bg-[#FFFCF3] border-b border-[#EEE9DC] last:border-0">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: TYPE_BG[p.type] }}>
                    <TIcon type={p.type} size={15} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[15px] font-medium text-[#2B2924]">{p.name}</p>
                    <p className="text-[11px]" style={{ color: TERC }}>{TYPE_LABEL[p.type]}</p>
                  </div>
                  <ChevronRight size={15} style={{ color: "#C8C4BC" }} />
                </button>
              ))
            )}
          </div>
        </Sheet>

        {/* ── Delete Dialog ───────────────────────────────────────── */}
        <Dlg cfg={dlg} onClose={() => setDlg(null)} />

        {/* ── Toast ───────────────────────────────────────────────── */}
        {toast && <Toast msg={toast.msg} bottom={toastBottom} onUndo={toast.undo ? () => { toast.undo!(); setToast(null) } : undefined} />}
      </div>
    </div>
  )
}
