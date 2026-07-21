import { useEffect, useState, useRef } from "react"
import {
  MapPin, Plus, Settings, ChevronLeft, X, MoreHorizontal,
  Landmark, Utensils, Building2, Plane, Circle,
  LayoutList, CalendarDays, Check, GripVertical,
  ChevronUp, ChevronDown, Search, Trash2, Edit3,
  Navigation2, CheckCircle2, Map as MapIcon,
  RotateCcw, ChevronRight, AlertCircle, Clock3,
  User, Bell, Globe, Sun, Shield, HelpCircle, Info, MessageSquare,
  NotebookPen, ListChecks, FileText, Luggage, ClipboardCheck,
  Footprints, Car, Bus
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaceType = "attraction" | "restaurant" | "hotel" | "transport" | "other"
type DateMode = "pending" | "confirmed"
type Screen = "list" | "create" | "workspace" | "add-place" | "settings"
type WsTab = "pool" | "itinerary" | "map" | "memo"
type ItvView = "normal" | "compact"
type GlobalTab = "trips" | "profile"
type DayPickerMode = "arrange" | "repeat" | "move"
type MemoType = "text" | "checklist"
type MemoCategory = string
type LongDistanceMode = "driving" | "transit"

interface ChecklistItem { id: string; text: string; completed: boolean }
interface TripMemo {
  id: string; category: MemoCategory; type: MemoType; title: string
  content: string; items: ChecklistItem[]; updatedAt: number
}
interface MemoFolder { id: string; title: string; desc: string; builtIn?: boolean }
interface TrashedMemoFolder { folder: MemoFolder; memos: TripMemo[]; trashedAt: number }

interface Visit {
  id: string
  day: number
  order: number
  arrivalTime: string
  durationMinutes: number | null
}

interface Place {
  id: string; name: string; type: PlaceType; note: string
  address: string; dayAssigned: number | null; order: number
  coords: { x: number; y: number }
  amapPoiId?: string
  lng?: number
  lat?: number
  hotelStay?: { checkInDay: number; checkOutDay: number }
  visits: Visit[]
}
interface PlaceForm {
  name: string; type: PlaceType; note: string; address: string
  amapPoiId?: string; lng?: number; lat?: number
  hotelCheckInDay?: number; hotelCheckOutDay?: number
}
interface AMapSuggestion {
  id: string; name: string; address: string; district: string
  lng?: number; lat?: number
}
interface Trip {
  id: string; name: string; destination: string
  dateMode: DateMode; days: number; startDate: string; places: Place[]; memos: TripMemo[]
  memoFolders?: MemoFolder[]; trashedMemoFolders?: TrashedMemoFolder[]
  travelPreferences?: { shortDistanceKm: number; longDistanceMode: LongDistanceMode }
  segmentTravelModes?: Record<string, SegmentEstimate["mode"]>
}
interface SegmentEstimate { mode: "walking" | "driving" | "transit"; distanceMeters: number; durationSeconds: number; status: "ready" | "unavailable" }
type DayPlace = Place & Visit & { placeId: string; visitId: string }
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
const DAY_COLORS = ["#F8DF72", "#9FD8F0", "#B9DFA6", "#F4B7A8", "#CDB9ED", "#F6C98B", "#9FD9D0"]
const DAY_ROUTE_COLORS = ["#F2C500", "#00A9E0", "#45A834", "#F0446C", "#7543C5", "#E97800", "#009D8C"]
const dayColor = (day: number) => DAY_COLORS[(Math.max(1, day) - 1) % DAY_COLORS.length]
const dayRouteColor = (day: number) => DAY_ROUTE_COLORS[(Math.max(1, day) - 1) % DAY_ROUTE_COLORS.length]
const SEC = "#6F6A61"
const TERC = "#A9A69F"
const DEFAULT_TRAVEL_PREFERENCES = { shortDistanceKm: 1, longDistanceMode: "transit" as LongDistanceMode }
const MEMO_CATEGORIES: { key: MemoCategory; label: string; desc: string; icon: typeof NotebookPen }[] = [
  { key: "preparation", label: "行前准备", desc: "预约、证件与出发前事项", icon: ClipboardCheck },
  { key: "packing", label: "行李清单", desc: "随身物品与打包检查", icon: Luggage },
  { key: "food", label: "美食备忘", desc: "想吃的店和点单提示", icon: Utensils },
  { key: "other", label: "其他笔记", desc: "其余旅行信息", icon: NotebookPen },
]
const DEFAULT_MEMO_FOLDERS: MemoFolder[] = MEMO_CATEGORIES.map(item => ({ id: item.key, title: item.label, desc: item.desc, builtIn: true }))

// ─── Initial Data ─────────────────────────────────────────────────────────────

const LEGACY_INIT_PLACES: Omit<Place, "visits">[] = [
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
const INIT_PLACES: Place[] = LEGACY_INIT_PLACES.map(place => ({
  ...place,
  visits: place.dayAssigned === null ? [] : [{
    id: `v_${place.id}`,
    day: place.dayAssigned,
    order: place.order,
    arrivalTime: "",
    durationMinutes: null,
  }],
}))
const INIT_TRIP: Trip = { id: "t1", name: "北京7日游", destination: "北京", dateMode: "pending", days: 7, startDate: "", places: INIT_PLACES, memos: [] }

const STORAGE_KEY = "tripflow.app-data"
const STORAGE_VERSION = 3

interface PersistedData {
  version: 3
  trips: Trip[]
  trashedTrips: TrashedTrip[]
  curTripId: string
  profile: UserProfile
}

const DEFAULT_PROFILE: UserProfile = { displayName: "旅行者" }

const cloneTrip = (trip: Trip): Trip => ({
  ...trip,
  places: trip.places.map(place => ({ ...place, coords: { ...place.coords }, visits: place.visits.map(visit => ({ ...visit })) })),
  memos: trip.memos.map(memo => ({ ...memo, items: memo.items.map(item => ({ ...item })) })),
  memoFolders: trip.memoFolders?.map(folder => ({ ...folder })),
  trashedMemoFolders: trip.trashedMemoFolders?.map(entry => ({ ...entry, folder: { ...entry.folder }, memos: entry.memos.map(memo => ({ ...memo, items: memo.items.map(item => ({ ...item })) })) })),
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

function isPlaceBase(value: unknown): value is Omit<Place, "visits"> {
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
    && (value.amapPoiId === undefined || typeof value.amapPoiId === "string")
    && (value.lng === undefined || (typeof value.lng === "number" && Number.isFinite(value.lng)))
    && (value.lat === undefined || (typeof value.lat === "number" && Number.isFinite(value.lat)))
}

function isVisit(value: unknown): value is Visit {
  return isRecord(value)
    && typeof value.id === "string"
    && Number.isInteger(value.day) && Number(value.day) > 0
    && Number.isInteger(value.order) && Number(value.order) >= 0
    && typeof value.arrivalTime === "string"
    && (value.durationMinutes === null || (Number.isInteger(value.durationMinutes) && Number(value.durationMinutes) > 0))
}

function isPlace(value: unknown): value is Place {
  return isPlaceBase(value) && Array.isArray((value as Record<string, unknown>).visits)
    && ((value as Record<string, unknown>).visits as unknown[]).every(isVisit)
}

function isTripMemo(value: unknown): value is TripMemo {
  if (!isRecord(value) || !Array.isArray(value.items)) return false
  const validCategory = typeof value.category === "string" && value.category.trim().length > 0
  const validType = value.type === "text" || value.type === "checklist"
  return typeof value.id === "string" && validCategory && validType
    && typeof value.title === "string" && typeof value.content === "string"
    && typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
    && value.items.every(item => isRecord(item) && typeof item.id === "string"
      && typeof item.text === "string" && typeof item.completed === "boolean")
}

function isMemoFolder(value: unknown): value is MemoFolder {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string"
    && typeof value.desc === "string" && (value.builtIn === undefined || typeof value.builtIn === "boolean")
}

function isTrashedMemoFolder(value: unknown): value is TrashedMemoFolder {
  return isRecord(value) && isMemoFolder(value.folder) && Array.isArray(value.memos)
    && value.memos.every(isTripMemo) && typeof value.trashedAt === "number" && Number.isFinite(value.trashedAt)
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
    && Array.isArray(value.memos)
    && value.memos.every(isTripMemo)
    && (value.memoFolders === undefined || (Array.isArray(value.memoFolders) && value.memoFolders.every(isMemoFolder)))
    && (value.trashedMemoFolders === undefined || (Array.isArray(value.trashedMemoFolders) && value.trashedMemoFolders.every(isTrashedMemoFolder)))
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
    if (!isRecord(parsed)) return createDefaultData()

    if (parsed.version === 1 && Array.isArray(parsed.trips) && Array.isArray(parsed.trashedTrips)) {
      const migrateTrip = (value: unknown): Trip | null => {
        if (!isRecord(value) || !Array.isArray(value.places) || !value.places.every(isPlaceBase)) return null
        const migrated = {
          ...value,
          memos: [],
          places: value.places.map((rawPlace, index) => {
            const place = rawPlace as Omit<Place, "visits">
            return {
              ...place,
              visits: place.dayAssigned === null ? [] : [{
                id: `v_migrated_${place.id}_${index}`,
                day: place.dayAssigned,
                order: place.order,
                arrivalTime: "",
                durationMinutes: null,
              }],
            }
          }),
        }
        return isTrip(migrated) ? migrated : null
      }
      const trips = parsed.trips.map(migrateTrip)
      const trashedTrips = parsed.trashedTrips.map(value => {
        const trip = migrateTrip(value)
        return trip && isRecord(value) && typeof value.trashedAt === "number" ? { ...trip, trashedAt: value.trashedAt } : null
      })
      if (trips.every(Boolean) && trashedTrips.every(Boolean) && typeof parsed.curTripId === "string") {
        const profile = isRecord(parsed.profile) && typeof parsed.profile.displayName === "string" && parsed.profile.displayName.trim()
          ? { displayName: parsed.profile.displayName.trim().slice(0, 20) }
          : { ...DEFAULT_PROFILE }
        return { version: STORAGE_VERSION, trips: trips as Trip[], trashedTrips: trashedTrips as TrashedTrip[], curTripId: parsed.curTripId, profile }
      }
      return createDefaultData()
    }

    if (parsed.version === 2 && Array.isArray(parsed.trips) && Array.isArray(parsed.trashedTrips)) {
      const addMemos = (value: unknown): Trip | null => {
        if (!isRecord(value)) return null
        const migrated = { ...value, memos: [] }
        return isTrip(migrated) ? migrated : null
      }
      const trips = parsed.trips.map(addMemos)
      const trashedTrips = parsed.trashedTrips.map(value => {
        const trip = addMemos(value)
        return trip && isRecord(value) && typeof value.trashedAt === "number" ? { ...trip, trashedAt: value.trashedAt } : null
      })
      if (trips.every(Boolean) && trashedTrips.every(Boolean) && typeof parsed.curTripId === "string") {
        const profile = isRecord(parsed.profile) && typeof parsed.profile.displayName === "string" && parsed.profile.displayName.trim()
          ? { displayName: parsed.profile.displayName.trim().slice(0, 20) }
          : { ...DEFAULT_PROFILE }
        return { version: STORAGE_VERSION, trips: trips as Trip[], trashedTrips: trashedTrips as TrashedTrip[], curTripId: parsed.curTripId, profile }
      }
      return createDefaultData()
    }

    if (parsed.version !== STORAGE_VERSION
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
const genVisitId = () => `v_${Math.random().toString(36).slice(2, 9)}`
const genMemoId = (prefix = "m") => `${prefix}_${Math.random().toString(36).slice(2, 10)}`
const hotelVisitPosition = (place: Place, visit: Visit): -1 | 0 | 1 => {
  if (place.type !== "hotel" || !place.hotelStay) return 0
  const sameDayVisits = place.visits.filter(item => item.day === visit.day).sort((a, b) => a.order - b.order)
  const firstVisitId = sameDayVisits[0]?.id
  const lastVisitId = sameDayVisits[sameDayVisits.length - 1]?.id
  const isStart = visit.day > place.hotelStay.checkInDay && visit.id === firstVisitId
  const isEnd = visit.day < place.hotelStay.checkOutDay && visit.id === lastVisitId
  if (isStart) return -1
  if (isEnd) return 1
  return 0
}
const getDayPlaces = (places: Place[], day: number) =>
  places.flatMap(place => place.visits
    .filter(visit => visit.day === day)
    .map(visit => ({ ...place, ...visit, placeId: place.id, visitId: visit.id } as DayPlace)))
    .sort((a, b) => {
      const aPlace = places.find(place => place.id === a.placeId)
      const bPlace = places.find(place => place.id === b.placeId)
      const aPosition = aPlace ? hotelVisitPosition(aPlace, a) : 0
      const bPosition = bPlace ? hotelVisitPosition(bPlace, b) : 0
      return aPosition - bPosition || a.order - b.order
    })
const getPool = (places: Place[]) => places.filter(p => p.visits.length === 0)
const getVisit = (places: Place[], visitId: string) => {
  for (const place of places) {
    const visit = place.visits.find(item => item.id === visitId)
    if (visit) return { place, visit }
  }
  return null
}
const visitTimeLabel = (visit: Pick<Visit, "arrivalTime" | "durationMinutes">) => {
  if (!visit.arrivalTime) return ""
  if (!visit.durationMinutes) return visit.arrivalTime
  const [hours, minutes] = visit.arrivalTime.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return visit.arrivalTime
  const end = hours * 60 + minutes + visit.durationMinutes
  return `${visit.arrivalTime}—${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`
}
const formatTravelDistance = (meters: number) => meters < 1000 ? `${Math.max(1, Math.round(meters))}米` : `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)}公里`
const formatTravelDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60))
  return minutes < 60 ? `${minutes}分钟` : `${Math.floor(minutes / 60)}小时${minutes % 60 ? `${minutes % 60}分钟` : ""}`
}
const geographicDistanceMeters = (a: DayPlace, b: DayPlace) => {
  if (![a.lng, a.lat, b.lng, b.lat].every(Number.isFinite)) return Number.NaN
  const rad = (value: number) => value * Math.PI / 180
  const dLat = rad(Number(b.lat) - Number(a.lat)); const dLng = rad(Number(b.lng) - Number(a.lng))
  const lat1 = rad(Number(a.lat)); const lat2 = rad(Number(b.lat))
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

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

const AMAP_KEY = String(import.meta.env.VITE_AMAP_KEY || "").trim()
const AMAP_SECURITY_CODE = String(import.meta.env.VITE_AMAP_SECURITY_CODE || "").trim()
let amapPromise: Promise<any> | null = null
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;",
}[char] || char))

function loadAMap(): Promise<any> {
  if (!AMAP_KEY || !AMAP_SECURITY_CODE) return Promise.reject(new Error("AMAP_NOT_CONFIGURED"))
  if (amapPromise) return amapPromise
  amapPromise = new Promise((resolve, reject) => {
    const win = window as any
    win._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE }
    const start = () => win.AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.AutoComplete", "AMap.PlaceSearch", "AMap.ToolBar", "AMap.Scale", "AMap.Driving", "AMap.Walking", "AMap.Transfer"],
    }).then(resolve).catch(reject)
    if (win.AMapLoader) { start(); return }
    const script = document.createElement("script")
    script.src = "https://webapi.amap.com/loader.js"
    script.async = true
    script.onload = start
    script.onerror = () => reject(new Error("AMAP_LOADER_FAILED"))
    document.head.appendChild(script)
  })
  return amapPromise
}

async function searchAMapPlaces(keyword: string, city: string): Promise<AMapSuggestion[]> {
  if (!keyword.trim()) return []
  const AMap = await loadAMap()
  return new Promise((resolve, reject) => {
    const auto = new AMap.AutoComplete({ city: city || "全国", citylimit: false })
    auto.search(keyword, (status: string, result: any) => {
      if (status !== "complete") {
        const rawInfo = typeof result === "string" ? result : (result?.info || result?.message || "")
        const info = `${String(status || "UNKNOWN").toUpperCase()}_${String(rawInfo || "NO_INFO").toUpperCase()}`
        reject(new Error(`AMAP_SEARCH_FAILED_${info}`))
        return
      }
      const tips = Array.isArray(result?.tips) ? result.tips : []
      resolve(tips.filter((tip: any) => tip?.name).slice(0, 8).map((tip: any) => ({
        id: String(tip.id || ""),
        name: String(tip.name || ""),
        address: typeof tip.address === "string" ? tip.address : "",
        district: String(tip.district || ""),
        lng: typeof tip.location?.lng === "number" ? tip.location.lng : undefined,
        lat: typeof tip.location?.lat === "number" ? tip.location.lat : undefined,
      })))
    })
  })
}

const travelEstimateCache = new Map<string, SegmentEstimate>()
async function estimateTravelSegment(from: DayPlace, to: DayPlace, destination: string, preferences: Trip["travelPreferences"], forcedMode?: SegmentEstimate["mode"]): Promise<SegmentEstimate> {
  const straightMeters = geographicDistanceMeters(from, to)
  if (!Number.isFinite(straightMeters) || !Number.isFinite(from.lng) || !Number.isFinite(from.lat) || !Number.isFinite(to.lng) || !Number.isFinite(to.lat)) {
    return { mode: "walking", distanceMeters: 0, durationSeconds: 0, status: "unavailable" }
  }
  const prefs = preferences || DEFAULT_TRAVEL_PREFERENCES
  const mode: SegmentEstimate["mode"] = forcedMode || (straightMeters <= prefs.shortDistanceKm * 1000 ? "walking" : prefs.longDistanceMode)
  const cacheKey = `${mode}:${from.lng},${from.lat}:${to.lng},${to.lat}:${destination}`
  const cached = travelEstimateCache.get(cacheKey)
  if (cached) return cached
  try {
    const AMap = await loadAMap()
    const result = await new Promise<any>((resolve, reject) => {
      const options = { hideMarkers: true, autoFitView: false, city: destination || undefined }
      const service = mode === "walking"
        ? new AMap.Walking(options)
        : mode === "driving"
          ? new AMap.Driving({ ...options, policy: AMap.DrivingPolicy?.LEAST_TIME, showTraffic: false })
          : new AMap.Transfer({ ...options, policy: AMap.TransferPolicy?.LEAST_TIME, extensions: "base" })
      service.search([Number(from.lng), Number(from.lat)], [Number(to.lng), Number(to.lat)], (status: string, data: any) => status === "complete" ? resolve(data) : reject(new Error("AMAP_ESTIMATE_FAILED")))
    })
    const route = mode === "transit" ? result?.plans?.[0] : result?.routes?.[0]
    const estimate: SegmentEstimate = route && Number.isFinite(Number(route.time))
      ? { mode, distanceMeters: Number(route.distance || straightMeters), durationSeconds: Number(route.time), status: "ready" }
      : { mode, distanceMeters: straightMeters, durationSeconds: 0, status: "unavailable" }
    travelEstimateCache.set(cacheKey, estimate)
    return estimate
  } catch {
    return { mode, distanceMeters: straightMeters, durationSeconds: 0, status: "unavailable" }
  }
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
      <div className="fixed inset-0 bg-black/30" style={{ zIndex: 900 }} onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 max-w-[390px] mx-auto bg-white rounded-t-3xl overflow-hidden max-h-[90vh] flex flex-col" style={{ zIndex: 1000 }}>
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
      <div className="fixed inset-0 bg-black/40" style={{ zIndex: 1100 }} onClick={onClose} />
      <div className="fixed inset-x-6 top-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 max-w-[358px] mx-auto shadow-2xl" style={{ zIndex: 1200 }}>
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
    <div className="fixed inset-x-4 max-w-[358px] mx-auto bg-[#2B2924] text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl"
      style={{ bottom: `${bottom}px`, zIndex: 1300 }}>
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
              const assigned  = trip.places.reduce((sum, p) => sum + p.visits.length, 0)
              const pending   = trip.places.filter(p => p.visits.length === 0).length
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
            const assigned = trip.places.reduce((sum, p) => sum + p.visits.length, 0)
            const pending  = trip.places.filter(p => p.visits.length === 0).length
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

function AddPlaceScreen({ form, setForm, editingId, destination, tripDays, tripStartDate, tripDateMode, onBack, onSave }:
  { form: PlaceForm; setForm: React.Dispatch<React.SetStateAction<PlaceForm>>; editingId: string | null; destination: string; tripDays: number; tripStartDate: string; tripDateMode: DateMode; onBack: () => void; onSave: (f: PlaceForm, target: "pool" | "itinerary", day?: number) => void }) {
  const [results, setResults] = useState<AMapSuggestion[]>([])
  const [showResults, setShowResults] = useState(false)
  const [nameErr, setNameErr] = useState("")
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "empty" | "error" | "unconfigured">("idle")
  const [searchErrorCode, setSearchErrorCode] = useState("")
  const [daySelectOpen, setDaySelectOpen] = useState(false)

  const TYPES: PlaceType[] = ["attraction", "restaurant", "hotel", "transport", "other"]
  const TIconMap: Record<PlaceType, React.ElementType> = { attraction: Landmark, restaurant: Utensils, hotel: Building2, transport: Plane, other: Circle }
  const hotelDayLabel = (day: number) => {
    if (tripDateMode !== "confirmed" || !tripStartDate) return `第${day}天`
    const date = new Date(tripStartDate); date.setDate(date.getDate() + day - 1)
    return `第${day}天 · ${date.getMonth() + 1}月${date.getDate()}日`
  }

  const handleNameChange = (q: string) => {
    setForm(f => ({ ...f, name: q, address: "", amapPoiId: undefined, lng: undefined, lat: undefined }))
    setNameErr("")
    setSearchErrorCode("")
    setShowResults(!!q.trim())
    if (!q.trim()) { setResults([]); setSearchState("idle") }
  }
  const handleSelect = (r: AMapSuggestion) => {
    setForm(f => ({ ...f, name: r.name, address: [r.district, r.address].filter(Boolean).join(" "), amapPoiId: r.id || undefined, lng: r.lng, lat: r.lat }))
    setResults([])
    setShowResults(false)
    setSearchState("ready")
  }

  useEffect(() => {
    const query = form.name.trim()
    if (!showResults || !query) return
    if (!AMAP_KEY || !AMAP_SECURITY_CODE) { setSearchState("unconfigured"); return }
    let cancelled = false
    setSearchState("loading")
    const timer = window.setTimeout(() => {
      searchAMapPlaces(query, destination).then(items => {
        if (cancelled) return
        setResults(items)
        setSearchState(items.length ? "ready" : "empty")
      }).catch(error => {
        if (!cancelled) {
          const safeCode = String(error?.message || error || "").match(/[A-Z][A-Z0-9_]{3,}/g)?.join(" · ") || "UNKNOWN_ERROR"
          setResults([]); setSearchErrorCode(safeCode); setSearchState("error")
        }
      })
    }, 350)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [form.name, destination, showResults])

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
          {showResults && searchState === "loading" && <p className="text-[12px] mt-2 px-1" style={{ color: TERC }}>正在搜索高德地点…</p>}
          {showResults && searchState === "unconfigured" && <p className="text-[12px] mt-2 px-1 text-[#C96B58]">地图服务尚未配置，请检查本机环境变量。</p>}
          {showResults && searchState === "error" && <p className="text-[12px] mt-2 px-1 text-[#C96B58]">高德搜索暂时不可用（{searchErrorCode}），仍可仅保存地点名称。</p>}
          {showResults && searchState === "empty" && <p className="text-[12px] mt-2 px-1" style={{ color: TERC }}>未找到匹配地点，将只保存名称并暂不设置位置</p>}
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
                <button key={t} onClick={() => setForm(f => ({
                  ...f, type: t,
                  hotelCheckInDay: t === "hotel" ? (f.hotelCheckInDay || 1) : undefined,
                  hotelCheckOutDay: t === "hotel" ? (f.hotelCheckOutDay || Math.min(2, tripDays)) : undefined,
                }))}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all ${active ? "border-[#F8DF72] bg-[#FFFBE8]" : "border-[#EEE9DC] bg-white"}`}>
                  <Icon size={18} strokeWidth={1.5} style={{ color: active ? "#2B2924" : TERC }} />
                  <span translate="no" lang="zh-CN" className="text-[10px] font-medium" style={{ color: active ? "#2B2924" : TERC }}>{TYPE_LABEL[t]}</span>
                </button>
              )
            })}
          </div>
        </div>
        {form.type === "hotel" && (
          <div className="rounded-2xl border border-[#EEE9DC] bg-white p-4">
            <div className="flex items-center gap-2 mb-3"><CalendarDays size={17} className="text-[#8A7200]" /><p className="text-[14px] font-semibold text-[#2B2924]">住宿日期</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] mb-1.5 block" style={{ color: SEC }}>入住</label>
                <select value={form.hotelCheckInDay || 1} onChange={event => {
                  const checkIn = Number(event.target.value)
                  setForm(current => ({ ...current, hotelCheckInDay: checkIn, hotelCheckOutDay: Math.max(checkIn, current.hotelCheckOutDay || checkIn) }))
                }} className="w-full h-11 rounded-xl border border-[#EEE9DC] bg-[#FFFCF3] px-3 text-[14px] outline-none">
                  {Array.from({ length: tripDays }, (_, index) => index + 1).map(day => <option key={day} value={day}>{hotelDayLabel(day)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] mb-1.5 block" style={{ color: SEC }}>离店</label>
                <select value={form.hotelCheckOutDay || Math.min(2, tripDays)} onChange={event => setForm(current => ({ ...current, hotelCheckOutDay: Number(event.target.value) }))}
                  className="w-full h-11 rounded-xl border border-[#EEE9DC] bg-[#FFFCF3] px-3 text-[14px] outline-none">
                  {Array.from({ length: tripDays }, (_, index) => index + 1).filter(day => day >= (form.hotelCheckInDay || 1)).map(day => <option key={day} value={day}>{hotelDayLabel(day)}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed mt-3" style={{ color: TERC }}>入住日放在行程末尾，住宿期间作为每日起终点，离店日放在行程开头。</p>
          </div>
        )}
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>备注（选填）</label>
          <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="添加备注，如开放时间、预约提醒等" rows={2}
            className="w-full px-4 py-3 rounded-2xl bg-white border border-[#EEE9DC] text-[#2B2924] text-[14px] placeholder:text-[#A9A69F] outline-none focus:border-[#F8DF72] resize-none transition-colors" />
        </div>
      </div>
      <div className="px-4 pb-10 pt-3 shrink-0">
        {editingId ? (
          <Btn variant="primary" className="w-full" disabled={!form.name.trim()}
            onClick={() => { if (!form.name.trim()) { setNameErr("请输入地点名称"); return } onSave(form, "pool") }}>
            保存修改
          </Btn>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Btn variant="secondary" className="w-full" disabled={!form.name.trim()}
              onClick={() => { if (!form.name.trim()) { setNameErr("请输入地点名称"); return } onSave(form, "pool") }}>
              保存到待安排池
            </Btn>
            <Btn variant="primary" className="w-full" disabled={!form.name.trim()}
              onClick={() => {
                if (!form.name.trim()) { setNameErr("请输入地点名称"); return }
                if (form.type === "hotel") onSave(form, "itinerary", form.hotelCheckInDay || 1)
                else setDaySelectOpen(true)
              }}>
              {form.type === "hotel" ? "保存并加入行程" : "添加到行程"}
            </Btn>
          </div>
        )}
      </div>
      <Sheet open={daySelectOpen} onClose={() => setDaySelectOpen(false)} title="添加到哪一天？">
        <div className="px-4 pb-7 grid grid-cols-3 gap-3">
          {Array.from({ length: tripDays }, (_, index) => index + 1).map(day => (
            <button key={day} onClick={() => { setDaySelectOpen(false); onSave(form, "itinerary", day) }}
              className="h-12 rounded-2xl border border-[#EEE9DC] bg-[#FFFCF3] text-[14px] font-semibold active:scale-[0.97] transition-transform"
              style={{ color: "#2B2924" }}>
              第{day}天
            </button>
          ))}
        </div>
      </Sheet>
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
  const [shortDistanceKm, setShortDistanceKm] = useState(trip.travelPreferences?.shortDistanceKm || DEFAULT_TRAVEL_PREFERENCES.shortDistanceKm)
  const [longDistanceMode, setLongDistanceMode] = useState<LongDistanceMode>(trip.travelPreferences?.longDistanceMode || DEFAULT_TRAVEL_PREFERENCES.longDistanceMode)

  const save = () => onUpdate({ ...trip, name, destination: dest, dateMode, days, startDate, travelPreferences: { shortDistanceKm, longDistanceMode } })

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
        <div>
          <label className="text-[13px] mb-1.5 block" style={{ color: SEC }}>行程交通偏好</label>
          <div className="bg-white rounded-2xl border border-[#EEE9DC] p-4 flex flex-col gap-4">
            <div>
              <p className="text-[13px] font-medium text-[#2B2924]">短距离优先步行</p>
              <p className="text-[11px] mt-1 mb-2" style={{ color: TERC }}>地点间直线距离不超过该范围时查询步行路线</p>
              <select value={shortDistanceKm} onChange={event => setShortDistanceKm(Number(event.target.value))}
                className="w-full h-11 rounded-xl bg-[#FFFCF3] border border-[#EEE9DC] px-3 text-[14px] outline-none">
                {[0.5, 1, 1.5, 2, 3].map(value => <option key={value} value={value}>{value}公里以内步行</option>)}
              </select>
            </div>
            <div>
              <p className="text-[13px] font-medium text-[#2B2924] mb-2">超过步行范围后</p>
              <div className="grid grid-cols-2 gap-2">
                {(["transit", "driving"] as LongDistanceMode[]).map(mode => (
                  <button key={mode} onClick={() => setLongDistanceMode(mode)}
                    className={`h-11 rounded-xl border text-[13px] font-semibold flex items-center justify-center gap-2 ${longDistanceMode === mode ? "border-[#E4C641] bg-[#FFF6CC]" : "border-[#EEE9DC] bg-[#FFFCF3]"}`}>
                    {mode === "transit" ? <Bus size={16} /> : <Car size={16} />}{mode === "transit" ? "公共交通" : "驾车"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
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

function TravelEstimateRow({ estimate, loading, onOpen }: { estimate?: SegmentEstimate; loading: boolean; onOpen: () => void }) {
  const mode = estimate?.mode || "walking"
  const Icon = mode === "walking" ? Footprints : mode === "driving" ? Car : Bus
  const label = mode === "walking" ? "步行" : mode === "driving" ? "驾车" : "公共交通"
  return <button type="button" onClick={onOpen} className="ml-8 my-1 min-h-8 flex items-center gap-2 text-[11px] text-left active:opacity-60" style={{ color: TERC }}>
    <div className="h-8 w-px bg-[#DDD7CA]" />
    <Icon size={14} className="shrink-0" />
    {loading ? <span>正在估算…</span> : estimate?.status === "ready"
      ? <span>{label} · {formatTravelDistance(estimate.distanceMeters)} · 约{formatTravelDuration(estimate.durationSeconds)}</span>
      : <span>{label} · 暂无法估算</span>}
    <ChevronRight size={13} className="shrink-0" />
  </button>
}

function ItineraryTab({ trip, selectedDay, setSelectedDay, view, setView, isReorder, onEnterReorder, onCancelReorder, onDoneReorder, expandedId, setExpandedId, onAddOptions, onActions, onReorder, onTravelModeChange, showToast }:
  { trip: Trip; selectedDay: number; setSelectedDay: (d: number) => void; view: ItvView; setView: (v: ItvView) => void; isReorder: boolean; onEnterReorder: () => void; onCancelReorder: () => void; onDoneReorder: () => void; expandedId: string | null; setExpandedId: (id: string | null) => void; onAddOptions: () => void; onActions: (visitId: string) => void; onReorder: (orderedVisitIds: string[]) => void; onTravelModeChange: (key: string, mode: SegmentEstimate["mode"]) => void; showToast: (msg: string, undo?: () => void) => void }) {
  const dayPlaces  = getDayPlaces(trip.places, selectedDay)
  const hasAnyPlace = trip.places.length > 0
  const [dragVisitId, setDragVisitId] = useState<string | null>(null)
  const dragVisitIdRef = useRef<string | null>(null)
  const [dragOverlay, setDragOverlay] = useState<{ top: number; left: number; width: number; height: number; offsetX: number; offsetY: number } | null>(null)
  const dragOverlayRef = useRef<typeof dragOverlay>(null)
  const draftVisitOrderRef = useRef<string[]>([])
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left")
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const reorderScrollRef = useRef<HTMLDivElement | null>(null)
  const dragCardRef = useRef<HTMLDivElement | null>(null)
  const lastDropTargetRef = useRef<string | null>(null)
  const finalDropTargetRef = useRef<string | null>(null)
  const [travelEstimates, setTravelEstimates] = useState<Record<string, SegmentEstimate>>({})
  const [estimatingTravel, setEstimatingTravel] = useState(false)
  const [travelPicker, setTravelPicker] = useState<{ open: boolean; fromIndex: number }>({ open: false, fromIndex: 0 })
  const [travelAlternatives, setTravelAlternatives] = useState<Partial<Record<SegmentEstimate["mode"], SegmentEstimate>>>({})
  const [loadingAlternatives, setLoadingAlternatives] = useState(false)
  const travelSignature = dayPlaces.map(place => `${place.visitId}:${place.lng || ""},${place.lat || ""}`).join("|")
  const segmentKey = (from: DayPlace, to: DayPlace) => `${from.visitId}->${to.visitId}`
  useEffect(() => {
    let cancelled = false
    if (dayPlaces.length < 2) { setTravelEstimates({}); setEstimatingTravel(false); return }
    setEstimatingTravel(true)
    Promise.all(dayPlaces.slice(0, -1).map((place, index) =>
      estimateTravelSegment(place, dayPlaces[index + 1], trip.destination, trip.travelPreferences, trip.segmentTravelModes?.[segmentKey(place, dayPlaces[index + 1])])
        .then(estimate => [place.visitId, estimate] as const)
    )).then(entries => {
      if (!cancelled) { setTravelEstimates(Object.fromEntries(entries)); setEstimatingTravel(false) }
    })
    return () => { cancelled = true }
  }, [selectedDay, travelSignature, trip.destination, trip.travelPreferences?.shortDistanceKm, trip.travelPreferences?.longDistanceMode, JSON.stringify(trip.segmentTravelModes || {})])
  const openTravelPicker = (fromIndex: number) => {
    const from = dayPlaces[fromIndex]; const to = dayPlaces[fromIndex + 1]
    if (!from || !to) return
    setTravelPicker({ open: true, fromIndex }); setTravelAlternatives({}); setLoadingAlternatives(true)
    Promise.all((["walking", "transit", "driving"] as SegmentEstimate["mode"][]).map(mode =>
      estimateTravelSegment(from, to, trip.destination, trip.travelPreferences, mode).then(result => [mode, result] as const)
    )).then(entries => {
      setTravelAlternatives(Object.fromEntries(entries)); setLoadingAlternatives(false)
    }).catch(() => {
      setTravelAlternatives({}); setLoadingAlternatives(false)
    })
  }
  const travelPickerFrom = dayPlaces[travelPicker.fromIndex]
  const travelPickerTo = dayPlaces[travelPicker.fromIndex + 1]
  const travelPickerKey = travelPickerFrom && travelPickerTo ? segmentKey(travelPickerFrom, travelPickerTo) : ""
  const selectedTravelMode = travelPickerKey
    ? (trip.segmentTravelModes?.[travelPickerKey] || travelEstimates[travelPickerFrom.visitId]?.mode)
    : undefined
  useEffect(() => {
    const next = isReorder ? dayPlaces.map(place => place.visitId) : []
    draftVisitOrderRef.current = next
  }, [isReorder, selectedDay])

  const changeDay = (nextDay: number) => {
    if (nextDay < 1 || nextDay > trip.days || nextDay === selectedDay) return
    setSlideDirection(nextDay > selectedDay ? "left" : "right")
    setSelectedDay(nextDay)
  }

  const handleSwipeStart = (event: React.TouchEvent) => {
    const touch = event.touches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const handleSwipeEnd = (event: React.TouchEvent) => {
    if (!swipeStart.current || isReorder) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - swipeStart.current.x
    const dy = touch.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return
    changeDay(dx < 0 ? selectedDay + 1 : selectedDay - 1)
  }

  const handleDragStart = (event: React.PointerEvent<HTMLButtonElement>, visitId: string) => {
    event.preventDefault()
    const slot = event.currentTarget.closest<HTMLElement>("[data-reorder-slot]")
    if (!slot) return
    const rect = slot.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    lastDropTargetRef.current = null
    finalDropTargetRef.current = null
    draftVisitOrderRef.current = dayPlaces.map(place => place.visitId)
    dragVisitIdRef.current = visitId
    setDragVisitId(visitId)
    const overlay = {
      top: rect.top, left: rect.left, width: rect.width, height: rect.height,
      offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
    }
    dragOverlayRef.current = overlay
    setDragOverlay(overlay)
    if (navigator.vibrate) navigator.vibrate(12)
  }

  const handleDragMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const currentOverlay = dragOverlayRef.current
    const activeVisitId = dragVisitIdRef.current
    if (!activeVisitId || !currentOverlay) return
    event.preventDefault()
    const pointerX = event.clientX
    const pointerY = event.clientY
    const nextLeft = pointerX - currentOverlay.offsetX
    const nextTop = pointerY - currentOverlay.offsetY
    const draggedCenterY = nextTop + currentOverlay.height / 2
    const nextOverlay = { ...currentOverlay, left: nextLeft, top: nextTop }
    dragOverlayRef.current = nextOverlay
    if (dragCardRef.current) {
      dragCardRef.current.style.transform = `translate3d(${nextLeft}px, ${nextTop}px, 0) scale(0.94)`
    }

    const scrollArea = reorderScrollRef.current
    if (!scrollArea) return
    const scrollRect = scrollArea.getBoundingClientRect()
    const current = draftVisitOrderRef.current
    const remaining = current.filter(visitId => visitId !== activeVisitId)
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reorder-slot]"))
    const elementMap = new Map(elements.map(element => [element.dataset.visitId || "", element]))

    let insertionIndex: number
    if (draggedCenterY <= scrollRect.top + 72) {
      insertionIndex = 0
      scrollArea.scrollTop = Math.max(0, scrollArea.scrollTop - 28)
    } else if (draggedCenterY >= scrollRect.bottom - 72) {
      insertionIndex = remaining.length
      scrollArea.scrollTop += 28
    } else {
      insertionIndex = remaining.filter(visitId => {
        const element = elementMap.get(visitId)
        if (!element) return false
        const rect = element.getBoundingClientRect()
        return draggedCenterY > rect.top + rect.height / 2
      }).length
    }

    const targetKey = String(insertionIndex)
    if (targetKey !== lastDropTargetRef.current) {
      lastDropTargetRef.current = targetKey
      const next = [...remaining]
      next.splice(insertionIndex, 0, activeVisitId)
      if (next.some((visitId, index) => visitId !== current[index])) {
        finalDropTargetRef.current = activeVisitId
        draftVisitOrderRef.current = next
        const orderMap = new Map(next.map((visitId, index) => [visitId, index]))
        elements.forEach(element => {
          const visitId = element.dataset.visitId
          if (visitId && orderMap.has(visitId)) {
            element.style.transition = "none"
            element.style.transform = "none"
            element.style.order = String(orderMap.get(visitId))
          }
        })
      }
    }
  }

  const handleDragEnd = (event?: React.PointerEvent<HTMLButtonElement>) => {
    const activeVisitId = dragVisitIdRef.current
    const finalTargetId = finalDropTargetRef.current
    if (event) {
      event.preventDefault()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (activeVisitId && finalTargetId) onReorder(draftVisitOrderRef.current)
    lastDropTargetRef.current = null
    finalDropTargetRef.current = null
    dragVisitIdRef.current = null
    dragOverlayRef.current = null
    setDragOverlay(null)
    setDragVisitId(null)
  }

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
      <div className="flex flex-col h-full" onContextMenu={event => event.preventDefault()}
        style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#EEE9DC] shrink-0">
          <button onClick={onCancelReorder} className="text-[15px] px-1" style={{ color: SEC }}>取消</button>
          <span className="text-[15px] font-semibold text-[#2B2924]">调整顺序</span>
          <button onClick={onDoneReorder} className="text-[15px] font-semibold text-[#C8A200] px-1">完成</button>
        </div>
        <p className="px-4 pt-3 text-[12px] shrink-0" style={{ color: SEC }}>按住右侧手柄上下拖动，松手后保存当前位置</p>
        <div ref={reorderScrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col" style={{ scrollbarWidth: "none" }}>
          {dayPlaces.map(place => {
            const isDragged = dragVisitId === place.visitId
            return (
              <div key={place.visitId} data-reorder-slot data-visit-id={place.visitId} className="mb-3 shrink-0"
                style={isDragged && dragOverlay ? {
                  height: dragOverlay.height + 48,
                  minHeight: dragOverlay.height + 48,
                  flexShrink: 0,
                } : { flexShrink: 0 }}>
                <div ref={isDragged ? dragCardRef : undefined}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 border transition-[box-shadow,background-color,border-color] duration-150
                    ${isDragged
                      ? "bg-[#FFF3AE] border-[#E0BE24]"
                      : dragVisitId ? "bg-white border-[#EEE9DC]" : "bg-white border-transparent"}`}
                  style={isDragged && dragOverlay ? {
                    position: "fixed", top: 0, left: 0,
                    width: dragOverlay.width, height: dragOverlay.height, zIndex: 100,
                    transform: `translate3d(${dragOverlay.left}px, ${dragOverlay.top}px, 0) scale(0.94)`,
                    willChange: "transform", boxShadow: "0 12px 26px rgba(127,100,0,0.24)",
                  } : { boxShadow: "0 2px 8px rgba(43,41,36,0.08)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[#2B2924] truncate">{place.name}</p>
                    <p className="text-[12px]" style={{ color: SEC }}>{visitTimeLabel(place) || TYPE_LABEL[place.type]}</p>
                  </div>
                  <button type="button" aria-label={`拖动${place.name}调整顺序`}
                    onPointerDown={event => handleDragStart(event, place.visitId)}
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={() => handleDragEnd()}
                    className={`w-12 h-12 -mr-2 flex items-center justify-center shrink-0 rounded-xl cursor-grab active:cursor-grabbing transition-colors
                      ${isDragged ? "bg-[#E4C641] text-[#2B2924]" : "bg-[#F7F4EA] text-[#A9A69F]"}`}
                    style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}>
                    <GripVertical size={24} strokeWidth={2.3} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
      <style>{`@keyframes tripflowDayInLeft{from{opacity:.45;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}@keyframes tripflowDayInRight{from{opacity:.45;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div className="overflow-x-auto shrink-0 px-4 pt-2 pb-2" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2">
          {Array.from({ length: trip.days }, (_, i) => i + 1).map(day => (
            <button key={day} onClick={() => changeDay(day)}
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
      <div key={selectedDay} className="flex-1 overflow-y-auto px-4 pb-2"
        style={{ scrollbarWidth: "none", animation: `${slideDirection === "left" ? "tripflowDayInLeft" : "tripflowDayInRight"} 180ms ease-out` }}>
        {dayPlaces.length === 0 ? (
          <Empty icon={CalendarDays} title="这一天还没有安排" desc="从待安排地点选择，或新建一个地点" action={{ label: "从待安排地点选择", onClick: onAddOptions }} />
        ) : view === "normal" ? (
          <div>
            {dayPlaces.map((place, idx) => (
              <div key={place.visitId}>
                <div className="bg-white rounded-2xl px-4 py-3.5 flex items-start gap-3" style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.06)" }}>
                  <div className="w-8 h-8 rounded-full bg-[#F8DF72] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[13px] font-bold text-[#2B2924]">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#2B2924]">{place.name}</p>
                    {visitTimeLabel(place) && <p className="text-[13px] font-semibold mt-0.5 text-[#8A7200]">{visitTimeLabel(place)}</p>}
                    <p className="text-[12px] mt-0.5" style={{ color: SEC }}>{TYPE_LABEL[place.type]}{place.note ? ` · ${place.note}` : ""}</p>
                    {place.address && <p className="text-[11px] mt-0.5 truncate" style={{ color: "#C8C4BC" }}>{place.address}</p>}
                  </div>
                  <button onClick={() => onActions(place.visitId)}
                    className="w-11 h-11 flex items-center justify-center shrink-0 -mr-2 -mt-1">
                    <MoreHorizontal size={17} style={{ color: TERC }} />
                  </button>
                </div>
                {idx < dayPlaces.length - 1 && <TravelEstimateRow estimate={travelEstimates[place.visitId]} loading={estimatingTravel && !travelEstimates[place.visitId]} onOpen={() => openTravelPicker(idx)} />}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {dayPlaces.map((place, idx) => (
              <div key={place.visitId}>
                <button className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 active:bg-[#FFFCF3]"
                  style={{ boxShadow: "0 1px 4px rgba(43,41,36,0.05)" }}
                  onClick={() => setExpandedId(expandedId === place.visitId ? null : place.visitId)}>
                  <div className="w-6 h-6 rounded-full bg-[#F8DF72] flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-[#2B2924]">{idx + 1}</span>
                  </div>
                  <span className="flex-1 text-left text-[14px] font-medium text-[#2B2924] truncate">{place.name}</span>
                  {place.arrivalTime && <span className="text-[11px] font-semibold text-[#8A7200]">{visitTimeLabel(place)}</span>}
                  <button onClick={e => { e.stopPropagation(); onActions(place.visitId) }}
                    className="w-11 h-11 flex items-center justify-center -mr-2">
                    <MoreHorizontal size={14} style={{ color: TERC }} />
                  </button>
                </button>
                {expandedId === place.visitId && (
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
      <Sheet open={travelPicker.open} onClose={() => setTravelPicker(current => ({ ...current, open: false }))} title="选择交通方式">
        <div className="px-5 pb-7">
          {travelPickerFrom && travelPickerTo && (
            <>
              <p className="text-[13px] mb-4 truncate" style={{ color: SEC }}>
                {travelPickerFrom.name} → {travelPickerTo.name}
              </p>
              <div className="flex flex-col gap-2">
                {([
                  { mode: "walking" as const, label: "步行", Icon: Footprints },
                  { mode: "transit" as const, label: "公共交通", Icon: Bus },
                  { mode: "driving" as const, label: "驾车", Icon: Car },
                ]).map(({ mode, label, Icon }) => {
                  const estimate = travelAlternatives[mode]
                  const active = selectedTravelMode === mode
                  const unavailable = !loadingAlternatives && estimate?.status !== "ready"
                  return (
                    <button key={mode} type="button" disabled={loadingAlternatives || unavailable}
                      onClick={() => {
                        if (!estimate || estimate.status !== "ready" || !travelPickerKey) return
                        onTravelModeChange(travelPickerKey, mode)
                        setTravelEstimates(current => ({ ...current, [travelPickerFrom.visitId]: estimate }))
                        setTravelPicker(current => ({ ...current, open: false }))
                        showToast(`已改为${label}`)
                      }}
                      className={`w-full min-h-16 rounded-2xl border px-4 py-3 flex items-center gap-3 text-left transition-colors disabled:opacity-45 ${active ? "border-[#E4C641] bg-[#FFF8D8]" : "border-[#EEE9DC] bg-white active:bg-[#FFFCF3]"}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-[#F8DF72]" : "bg-[#F7F4EA]"}`}>
                        <Icon size={19} style={{ color: active ? "#2B2924" : SEC }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-[#2B2924]">{label}</p>
                        <p className="text-[12px] mt-0.5" style={{ color: TERC }}>
                          {loadingAlternatives ? "正在估算…" : estimate?.status === "ready"
                            ? `${formatTravelDistance(estimate.distanceMeters)} · 约${formatTravelDuration(estimate.durationSeconds)}`
                            : "当前路线暂不可用"}
                        </p>
                      </div>
                      {active && <span className="text-[12px] font-medium text-[#8A7200]">当前</span>}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] mt-4 leading-relaxed" style={{ color: TERC }}>仅修改这一段行程，其他地点之间的交通方式保持不变。</p>
            </>
          )}
        </div>
      </Sheet>
    </div>
  )
}

// ─── Memo Tab ─────────────────────────────────────────────────────────────────

function MemoTab({ trip, onChange, onFoldersChange, onTrashChange, showToast }:
  { trip: Trip; onChange: (memos: TripMemo[]) => void; onFoldersChange: (folders: MemoFolder[]) => void; onTrashChange: (trash: TrashedMemoFolder[]) => void; showToast: (msg: string) => void }) {
  const [category, setCategory] = useState<MemoCategory | null>(null)
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [folderCreateOpen, setFolderCreateOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [trashOpen, setTrashOpen] = useState(false)
  const [editor, setEditor] = useState<{ open: boolean; id: string | null; type: MemoType; title: string; content: string; items: ChecklistItem[] }>({
    open: false, id: null, type: "text", title: "", content: "", items: [],
  })

  const inferredCustomFolders = [...new Set(trip.memos.map(memo => memo.category).filter(value => value.startsWith("custom_")))]
    .map(id => ({ id, title: trip.memos.find(memo => memo.category === id)?.title || "自定义备忘", desc: "自定义文件夹" }))
  const folders = trip.memoFolders || [...DEFAULT_MEMO_FOLDERS, ...inferredCustomFolders]
  const activeTrash = (trip.trashedMemoFolders || []).filter(entry => Date.now() - entry.trashedAt < 30 * 86400000)
  const categoryInfo = folders.find(item => item.id === category)
  const categoryMemos = category ? trip.memos.filter(memo => memo.category === category).sort((a, b) => b.updatedAt - a.updatedAt) : []
  const changeMemo = (memoId: string, fn: (memo: TripMemo) => TripMemo) =>
    onChange(trip.memos.map(memo => memo.id === memoId ? fn(memo) : memo))

  const openNewMemo = (type: MemoType) => {
    setTypePickerOpen(false)
    setEditor({ open: true, id: null, type, title: type === "text" ? "新笔记" : "新清单", content: "", items: [] })
  }
  const openEditMemo = (memo: TripMemo) => setEditor({
    open: true, id: memo.id, type: memo.type, title: memo.title, content: memo.content,
    items: memo.items.map(item => ({ ...item })),
  })
  const saveMemo = () => {
    if (!category || !editor.title.trim()) return
    if (editor.id) {
      onChange(trip.memos.map(memo => memo.id === editor.id ? {
        ...memo, title: editor.title.trim(), content: editor.content,
        items: editor.items, updatedAt: Date.now(),
      } : memo))
      showToast("备忘已更新")
    } else {
      onChange([...trip.memos, {
        id: genMemoId(), category, type: editor.type, title: editor.title.trim(),
        content: editor.content, items: editor.items, updatedAt: Date.now(),
      }])
      showToast(editor.type === "text" ? "文字笔记已创建" : "清单已创建")
    }
    setEditor(current => ({ ...current, open: false }))
  }
  const deleteMemo = (memo: TripMemo) => {
    if (!window.confirm(`确定删除“${memo.title}”吗？`)) return
    onChange(trip.memos.filter(item => item.id !== memo.id))
    showToast("备忘已删除")
  }
  const createFolder = () => {
    const title = folderName.trim()
    if (!title) return
    const folder: MemoFolder = { id: `custom_${genMemoId("folder")}`, title, desc: "自定义文件夹" }
    onFoldersChange([...folders, folder])
    setFolderCreateOpen(false); setFolderName("")
    showToast("文件夹已创建")
  }
  const deleteCurrentFolder = () => {
    if (!category || !categoryInfo || !window.confirm(`确定删除“${categoryInfo.title}”文件夹吗？`)) return
    const folderMemos = trip.memos.filter(memo => memo.category === category)
    onTrashChange([...activeTrash, { folder: { ...categoryInfo }, memos: folderMemos.map(memo => ({ ...memo, items: memo.items.map(item => ({ ...item })) })), trashedAt: Date.now() }])
    onFoldersChange(folders.filter(folder => folder.id !== category))
    onChange(trip.memos.filter(memo => memo.category !== category))
    setCategory(null)
    showToast("文件夹已移入回收站")
  }
  const restoreFolder = (entry: TrashedMemoFolder) => {
    onFoldersChange([...folders.filter(folder => folder.id !== entry.folder.id), entry.folder])
    onChange([...trip.memos.filter(memo => memo.category !== entry.folder.id), ...entry.memos])
    onTrashChange(activeTrash.filter(value => value.trashedAt !== entry.trashedAt))
    showToast("文件夹已恢复")
  }

  if (!category) {
    return (
      <>
      <div className="flex flex-col h-full overflow-y-auto px-4 pt-3 pb-5" style={{ scrollbarWidth: "none" }}>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-[20px] font-bold text-[#2B2924]">备忘</h2>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: SEC }}>创建文件夹后，再添加文字笔记或清单</p>
          </div>
          <button onClick={() => setTrashOpen(true)} aria-label="备忘回收站"
            className="w-11 h-11 rounded-full bg-white border border-[#EEE9DC] flex items-center justify-center shadow-sm active:scale-95 transition-transform shrink-0">
            <Trash2 size={19} strokeWidth={1.8} style={{ color: SEC }} />
          </button>
          <button onClick={() => setFolderCreateOpen(true)} aria-label="新建文件夹"
            className="w-11 h-11 rounded-full bg-[#F8DF72] flex items-center justify-center shadow-md active:scale-95 transition-transform shrink-0">
            <Plus size={22} strokeWidth={2.4} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {folders.map(folder => {
            const preset = MEMO_CATEGORIES.find(item => item.key === folder.id)
            const Icon = preset?.icon || NotebookPen
            const memos = trip.memos.filter(memo => memo.category === folder.id)
            const checklistItems = memos.filter(memo => memo.type === "checklist").flatMap(memo => memo.items)
            const completed = checklistItems.filter(item => item.completed).length
            return (
              <button key={folder.id} onClick={() => setCategory(folder.id)}
                className="min-h-36 bg-white rounded-3xl border border-[#EEE9DC] p-4 text-left active:scale-[0.98] transition-transform shadow-[0_2px_8px_rgba(43,41,36,0.05)]">
                <div className="w-10 h-10 rounded-2xl bg-[#F7E8AA] flex items-center justify-center mb-4">
                  <Icon size={20} strokeWidth={1.6} className="text-[#2B2924]" />
                </div>
                <p className="text-[16px] font-semibold text-[#2B2924] truncate">{folder.title}</p>
                <p className="text-[11px] leading-relaxed mt-1" style={{ color: SEC }}>{folder.desc}</p>
                <p className="text-[11px] mt-3" style={{ color: TERC }}>
                  {memos.length === 0 ? "暂无内容" : checklistItems.length > 0 ? `${memos.length}条内容 · 已完成${completed}/${checklistItems.length}` : `${memos.length}条内容`}
                </p>
              </button>
            )
          })}
        </div>
      </div>
      <Sheet open={folderCreateOpen} onClose={() => setFolderCreateOpen(false)} title="新建文件夹">
        <div className="px-5 pb-7">
          <label className="block text-[13px] font-medium mb-2">文件夹名称</label>
          <input value={folderName} autoFocus maxLength={20} onChange={event => setFolderName(event.target.value)} placeholder="例如：酒店信息"
            className="w-full h-12 rounded-2xl border border-[#E5DFD0] bg-[#FFFCF3] px-4 text-[15px] outline-none focus:border-[#E4C641] mb-5" />
          <Btn variant="primary" className="w-full" disabled={!folderName.trim()} onClick={createFolder}>创建文件夹</Btn>
        </div>
      </Sheet>
      <Sheet open={trashOpen} onClose={() => setTrashOpen(false)} title="备忘回收站">
        <div className="px-4 pb-7">
          {activeTrash.length === 0 ? <p className="py-10 text-center text-[13px]" style={{ color: TERC }}>回收站为空</p> : activeTrash.map(entry => {
            const remain = Math.max(1, 30 - Math.floor((Date.now() - entry.trashedAt) / 86400000))
            return <div key={`${entry.folder.id}-${entry.trashedAt}`} className="flex items-center gap-3 py-3 border-b border-[#EEE9DC] last:border-0">
              <div className="w-10 h-10 rounded-2xl bg-[#F7E8AA] flex items-center justify-center"><NotebookPen size={18} /></div>
              <div className="flex-1 min-w-0"><p className="text-[14px] font-semibold truncate">{entry.folder.title}</p><p className="text-[11px]" style={{ color: TERC }}>{entry.memos.length}条内容 · {remain}天后永久删除</p></div>
              <button onClick={() => restoreFolder(entry)} className="px-3 h-9 rounded-xl bg-[#F8DF72] text-[12px] font-semibold">恢复</button>
              <button onClick={() => { if (window.confirm("永久删除该文件夹吗？")) onTrashChange(activeTrash.filter(value => value.trashedAt !== entry.trashedAt)) }} className="w-9 h-9 rounded-xl flex items-center justify-center active:bg-[#FFF0EC]"><Trash2 size={15} className="text-[#C96B58]" /></button>
            </div>
          })}
        </div>
      </Sheet>
      </>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center gap-2 px-3 pt-2 pb-3 border-b border-[#EEE9DC]">
        <button onClick={() => setCategory(null)} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-[#EEE9DC]">
          <ChevronLeft size={21} style={{ color: SEC }} />
        </button>
        <div className="flex-1">
          <h2 className="text-[18px] font-bold text-[#2B2924]">{categoryInfo?.title || "备忘文件夹"}</h2>
          <p className="text-[11px]" style={{ color: SEC }}>{categoryMemos.length} 条内容</p>
        </div>
        <button onClick={deleteCurrentFolder} aria-label="删除文件夹" className="w-10 h-10 rounded-full bg-white border border-[#EEE9DC] flex items-center justify-center active:scale-95">
          <Trash2 size={17} className="text-[#C96B58]" />
        </button>
        <button onClick={() => setTypePickerOpen(true)} className="w-10 h-10 rounded-full bg-[#F8DF72] flex items-center justify-center active:scale-95">
          <Plus size={20} strokeWidth={2.4} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {categoryMemos.length === 0 ? (
          <Empty icon={NotebookPen} title="这里还没有备忘" desc="可以添加文字笔记或待办清单" action={{ label: "添加第一条内容", onClick: () => setTypePickerOpen(true) }} />
        ) : (
          <div className="flex flex-col gap-3">
            {categoryMemos.map(memo => {
              const completed = memo.items.filter(item => item.completed).length
              return (
                <div key={memo.id} className="bg-white rounded-3xl border border-[#EEE9DC] p-4 shadow-[0_2px_8px_rgba(43,41,36,0.05)]">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-2xl bg-[#FFF6CC] flex items-center justify-center shrink-0">
                      {memo.type === "text" ? <FileText size={18} /> : <ListChecks size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#2B2924] truncate">{memo.title}</p>
                      <p className="text-[11px]" style={{ color: TERC }}>{memo.type === "text" ? "文字笔记" : `已完成 ${completed}/${memo.items.length}`}</p>
                    </div>
                    <button onClick={() => openEditMemo(memo)} className="w-9 h-9 flex items-center justify-center rounded-xl active:bg-[#F7F4EA]"><Edit3 size={15} style={{ color: SEC }} /></button>
                    <button onClick={() => deleteMemo(memo)} className="w-9 h-9 flex items-center justify-center rounded-xl active:bg-[#FFF0EC]"><Trash2 size={15} className="text-[#C96B58]" /></button>
                  </div>
                  {memo.type === "text" ? (
                    <button onClick={() => openEditMemo(memo)} className="w-full text-left text-[13px] leading-relaxed whitespace-pre-wrap min-h-12" style={{ color: memo.content ? SEC : TERC }}>
                      {memo.content || "点击编辑笔记内容"}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {memo.items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 min-h-10">
                          <button onClick={() => changeMemo(memo.id, current => ({ ...current, items: current.items.map(value => value.id === item.id ? { ...value, completed: !value.completed } : value), updatedAt: Date.now() }))}
                            className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${item.completed ? "bg-[#F8DF72] border-[#E4C641]" : "bg-white border-[#CFC9BC]"}`}>
                            {item.completed && <Check size={14} />}
                          </button>
                          <input value={item.text} placeholder="输入清单项目"
                            onChange={event => changeMemo(memo.id, current => ({ ...current, items: current.items.map(value => value.id === item.id ? { ...value, text: event.target.value } : value), updatedAt: Date.now() }))}
                            className={`flex-1 min-w-0 bg-transparent outline-none text-[13px] py-2 ${item.completed ? "line-through" : ""}`}
                            style={{ color: item.completed ? TERC : "#2B2924" }} />
                          <button onClick={() => changeMemo(memo.id, current => ({ ...current, items: current.items.filter(value => value.id !== item.id), updatedAt: Date.now() }))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg active:bg-[#FFF0EC]"><X size={14} style={{ color: TERC }} /></button>
                        </div>
                      ))}
                      <button onClick={() => changeMemo(memo.id, current => ({ ...current, items: [...current.items, { id: genMemoId("i"), text: "", completed: false }], updatedAt: Date.now() }))}
                        className="h-10 rounded-xl border border-dashed border-[#D8D1C2] text-[12px] flex items-center justify-center gap-1.5 mt-1" style={{ color: SEC }}>
                        <Plus size={14} /> 添加项目
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Sheet open={typePickerOpen} onClose={() => setTypePickerOpen(false)} title="添加备忘">
        <div className="px-4 pb-7 grid grid-cols-2 gap-3">
          <button onClick={() => openNewMemo("text")} className="rounded-3xl bg-[#FFFCF3] border border-[#EEE9DC] p-5 text-left active:bg-[#FFF6CC]">
            <FileText size={24} className="mb-4 text-[#8A7200]" /><p className="text-[16px] font-semibold">文字笔记</p><p className="text-[11px] mt-1" style={{ color: SEC }}>记录地址、提示和想法</p>
          </button>
          <button onClick={() => openNewMemo("checklist")} className="rounded-3xl bg-[#FFFCF3] border border-[#EEE9DC] p-5 text-left active:bg-[#FFF6CC]">
            <ListChecks size={24} className="mb-4 text-[#8A7200]" /><p className="text-[16px] font-semibold">清单</p><p className="text-[11px] mt-1" style={{ color: SEC }}>逐项添加并勾选完成</p>
          </button>
        </div>
      </Sheet>

      <Sheet open={editor.open} onClose={() => setEditor(current => ({ ...current, open: false }))} title={editor.id ? "编辑备忘" : editor.type === "text" ? "新建文字笔记" : "新建清单"}>
        <div className="px-5 pb-7">
          <label className="block text-[13px] font-medium mb-2">标题</label>
          <input value={editor.title} maxLength={40} onChange={event => setEditor(current => ({ ...current, title: event.target.value }))}
            className="w-full h-12 rounded-2xl border border-[#E5DFD0] bg-[#FFFCF3] px-4 text-[15px] outline-none focus:border-[#E4C641] mb-4" />
          {editor.type === "text" && <>
            <label className="block text-[13px] font-medium mb-2">内容</label>
            <textarea value={editor.content} onChange={event => setEditor(current => ({ ...current, content: event.target.value }))}
              placeholder="记录营业时间、预约方式、注意事项……" className="w-full min-h-40 rounded-2xl border border-[#E5DFD0] bg-[#FFFCF3] p-4 text-[14px] leading-relaxed outline-none resize-none focus:border-[#E4C641] mb-5" />
          </>}
          {editor.type === "checklist" && <p className="text-[12px] leading-relaxed mb-5" style={{ color: SEC }}>保存清单后，可以在卡片中添加、编辑、删除和勾选项目。</p>}
          <Btn variant="primary" className="w-full" disabled={!editor.title.trim()} onClick={saveMemo}>保存</Btn>
        </div>
      </Sheet>
    </div>
  )
}

// ─── Map Tab ──────────────────────────────────────────────────────────────────

function AMapCanvas({ places, destination, selectedId, routeDay, overview, onSelect }:
  { places: Place[]; destination: string; selectedId: string | null; routeDay?: number; overview: boolean; onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const routeRefs = useRef<any[]>([])
  const routeCacheRef = useRef<Map<string, any[]>>(new Map())
  const [mapError, setMapError] = useState("")
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadAMap().then(async AMap => {
      if (cancelled || !containerRef.current) return
      const firstLocated = places.find(place => Number.isFinite(place.lng) && Number.isFinite(place.lat))
      mapRef.current = new AMap.Map(containerRef.current, {
        zoom: firstLocated ? 13 : 11,
        center: firstLocated ? [firstLocated.lng, firstLocated.lat] : [116.397428, 39.90923],
        viewMode: "2D", resizeEnable: true,
        mapStyle: "amap://styles/whitesmoke",
        features: ["bg", "point", "road"],
      })
      mapRef.current.addControl(new AMap.ToolBar({ position: "RB" }))
      mapRef.current.addControl(new AMap.Scale())
      if (destination) mapRef.current.setCity(destination)
      setMapReady(true)
      window.setTimeout(() => mapRef.current?.resize?.(), 100)
    }).catch(error => {
      if (!cancelled) setMapError(error?.message === "AMAP_NOT_CONFIGURED" ? "地图服务尚未配置" : "高德地图加载失败，请检查 Key、安全密钥和域名设置")
    })
    return () => {
      cancelled = true
      markersRef.current.forEach(marker => marker.setMap?.(null))
      markersRef.current = []
      routeRefs.current.forEach(route => route.setMap?.(null))
      routeRefs.current = []
      mapRef.current?.destroy?.()
      mapRef.current = null
    }
  }, [destination])

  useEffect(() => {
    let cancelled = false
    if (!mapReady) return
    loadAMap().then(async AMap => {
      if (cancelled || !mapRef.current) return
      mapRef.current.setFeatures(overview ? ["bg", "road"] : ["bg", "point", "road"])
      markersRef.current.forEach(marker => marker.setMap?.(null))
      routeRefs.current.forEach(route => route.setMap?.(null))
      routeRefs.current = []
      const routeDays = [...new Set(places.flatMap(place => place.visits.map(visit => visit.day)))]
        .filter(day => routeDay === undefined || day === routeDay)
        .sort((a, b) => a - b)
      const routeGroups = routeDays.map(day => ({
        day,
        stops: places.flatMap(place => place.visits
          .filter(visit => visit.day === day && Number.isFinite(place.lng) && Number.isFinite(place.lat))
          .map(visit => ({ place, visit })))
          .sort((a, b) => a.visit.order - b.visit.order),
      })).filter(group => group.stops.length > 1)

      await Promise.all(routeGroups.map(async group => {
        const signature = `${group.day}:${group.stops.map(({ place }) => `${place.lng},${place.lat}`).join("|")}`
        let path = routeCacheRef.current.get(signature)
        if (!path) {
          path = await new Promise<any[]>((resolve, reject) => {
            const driving = new AMap.Driving({
              policy: AMap.DrivingPolicy?.LEAST_TIME,
              hideMarkers: true,
              showTraffic: false,
              autoFitView: false,
            })
            const points = group.stops.map(({ place }) => [place.lng, place.lat])
            driving.search(points[0], points[points.length - 1], { waypoints: points.slice(1, -1) }, (status: string, result: any) => {
              if (status !== "complete" || !result?.routes?.[0]) { reject(new Error("AMAP_ROUTE_FAILED")); return }
              const routePath = result.routes[0].steps?.flatMap((step: any) => Array.isArray(step.path) ? step.path : []) || []
              routePath.length > 1 ? resolve(routePath) : reject(new Error("AMAP_ROUTE_EMPTY"))
            })
          }).catch(() => [])
          if (path.length) routeCacheRef.current.set(signature, path)
        }
        if (cancelled || !mapRef.current || path.length < 2) return
        const route = new AMap.Polyline({
          path,
          strokeColor: dayRouteColor(group.day),
          strokeWeight: 7,
          strokeOpacity: 1,
          isOutline: true,
          outlineColor: "rgba(255,255,255,.92)",
          borderWeight: 2,
          lineJoin: "round",
          lineCap: "round",
          showDir: true,
          zIndex: 80,
        })
        route.setMap(mapRef.current)
        routeRefs.current.push(route)
      }))
      markersRef.current = places.filter(place => Number.isFinite(place.lng) && Number.isFinite(place.lat)).map(place => {
        const selected = place.id === selectedId
        const scheduledDays = [...new Set(place.visits.map(visit => visit.day))].sort((a, b) => a - b)
        const isPool = scheduledDays.length === 0
        const sortedVisits = [...place.visits].sort((a, b) => a.day - b.day || a.order - b.order)
        const dayVisit = routeDay ? sortedVisits.find(visit => visit.day === routeDay) : sortedVisits[0]
        const markerText = dayVisit ? String(dayVisit.order) : ""
        const markerColor = dayVisit ? dayRouteColor(dayVisit.day) : "#FFFFFF"
        const circleStyle = isPool
          ? "background:#fff;border:3px solid #A9A69F;color:#A9A69F"
          : `background:${markerColor};border:2.5px solid rgba(255,255,255,.96);color:#FFFFFF;box-shadow:0 3px 9px rgba(43,41,36,.30)`
        const inner = isPool ? '<span style="display:block;width:7px;height:7px;border-radius:50%;background:#A9A69F"></span>' : escapeHtml(markerText)
        const namePill = selected
          ? `<div style="position:absolute;left:50%;bottom:36px;transform:translateX(-50%);padding:5px 9px;border-radius:10px;background:#fff;border:1px solid #E5DFD0;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.16);color:#2B2924">${escapeHtml(place.name)}</div>`
          : ""
        const marker = new AMap.Marker({
          position: [place.lng, place.lat], title: place.name, anchor: "bottom-center",
          content: `<div style="position:relative;width:34px;height:42px;display:flex;align-items:flex-start;justify-content:center;filter:${selected ? "drop-shadow(0 4px 6px rgba(0,0,0,.32))" : "none"}">${namePill}<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 12px/1 sans-serif;box-sizing:border-box;${circleStyle}">${inner}</div><div style="position:absolute;top:28px;width:2px;height:10px;background:${isPool ? "#A9A69F" : markerColor}"></div></div>`,
          zIndex: selected ? 220 : 120,
        })
        marker.on("click", () => onSelect(place.id))
        marker.setMap(mapRef.current)
        return marker
      })
      const selectedPlace = selectedId ? places.find(place => place.id === selectedId) : null
      if (selectedPlace && Number.isFinite(selectedPlace.lng) && Number.isFinite(selectedPlace.lat)) {
        mapRef.current.setZoomAndCenter(16, [selectedPlace.lng, selectedPlace.lat], false, 260)
      } else {
        const fitOverlays = [...markersRef.current, ...routeRefs.current]
        if (fitOverlays.length) mapRef.current.setFitView(fitOverlays, false, [72, 36, 100, 36], 16)
        if (overview && mapRef.current.getZoom?.() > 11.5) mapRef.current.setZoom(11.5, false, 260)
      }
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [places, selectedId, routeDay, overview, onSelect, mapReady])

  return <div className="absolute inset-0">
    <div ref={containerRef} className="absolute inset-0" style={{ width: "100%", height: "100%", minHeight: 320 }} />
    {mapError && <div className="absolute inset-0 flex items-center justify-center bg-[#EEEAE2] px-8 text-center text-[13px]" style={{ color: SEC }}>{mapError}</div>}
    {!mapError && places.length > 0 && places.every(place => !Number.isFinite(place.lng) || !Number.isFinite(place.lat)) &&
      <div className="absolute top-16 inset-x-6 rounded-2xl bg-white/95 px-4 py-3 text-[12px] shadow-md z-10" style={{ color: SEC }}>现有地点尚未关联高德位置。重新搜索并选择地点后，标记会显示在地图上。</div>}
  </div>
}

function MapTab({ trip, filter, setFilter, listOpen, setListOpen, onMarker, selectedId, setSelectedId }:
  { trip: Trip; filter: "all" | "pool" | number; setFilter: (f: "all" | "pool" | number) => void; listOpen: boolean; setListOpen: (v: boolean) => void; onMarker: (id: string) => void; selectedId: string | null; setSelectedId: (id: string | null) => void }) {
  const daysWithPlaces = [...new Set(trip.places.flatMap(p => p.visits.map(v => v.day)))].sort((a, b) => a - b)
  const filterOpts = [
    { key: "all"  as const, label: "全部" },
    { key: "pool" as const, label: "待安排" },
    ...daysWithPlaces.map(d => ({ key: d as number, label: `第${d}天` }))
  ]
  const visible = (p: Place) => filter === "all" || (filter === "pool" && p.visits.length === 0) || (typeof filter === "number" && p.visits.some(v => v.day === filter))

  const visiblePlaces = trip.places.filter(visible).sort((a, b) => {
    if (filter === "pool") return 0
    const visitA = typeof filter === "number"
      ? a.visits.find(visit => visit.day === filter)
      : [...a.visits].sort((x, y) => x.day - y.day || x.order - y.order)[0]
    const visitB = typeof filter === "number"
      ? b.visits.find(visit => visit.day === filter)
      : [...b.visits].sort((x, y) => x.day - y.day || x.order - y.order)[0]
    if (!visitA && !visitB) return 0
    if (!visitA) return 1
    if (!visitB) return -1
    return visitA.day - visitB.day || visitA.order - visitB.order
  })
  const hasRealMap = Boolean(AMAP_KEY && AMAP_SECURITY_CODE)
  let barLabel = ""
  if (filter === "all")        barLabel = `全部 ${trip.places.length} 个地点`
  else if (filter === "pool")  barLabel = `${getPool(trip.places).length} 个待安排地点`
  else                         barLabel = `第${filter}天 · ${getDayPlaces(trip.places, filter as number).length} 个地点`

  return (
    <div className="relative flex-1 h-full overflow-hidden" style={{ background: "#EEEAE2" }}>
      {hasRealMap && <AMapCanvas places={visiblePlaces} destination={trip.destination} selectedId={selectedId}
        routeDay={typeof filter === "number" ? filter : undefined}
        overview={filter === "all"}
        onSelect={id => { setSelectedId(id); onMarker(id) }} />}
      <svg viewBox="0 0 390 520" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice"
        style={{ display: hasRealMap ? "none" : "block" }}
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
          const isPool = place.visits.length === 0
          const displayVisit = [...place.visits]
            .filter(visit => typeof filter !== "number" || visit.day === filter)
            .sort((a, b) => a.day - b.day || a.order - b.order)[0]
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
                  <circle cx={place.coords.x} cy={place.coords.y} r={14} fill={dayRouteColor(displayVisit?.day || 1)} stroke="#FFFFFF" strokeWidth={2.5} />
                  <text x={place.coords.x} y={place.coords.y} textAnchor="middle" dominantBaseline="central"
                    fontSize="10" fontWeight="700" fill="#FFFFFF"
                    style={{ userSelect: "none", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                    {displayVisit?.order || ""}
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
              className="shrink-0 px-4 h-8 rounded-full text-[12px] font-semibold transition-all outline-none focus:outline-none"
              style={{
                color: "#2B2924",
                background: typeof f.key === "number" ? dayColor(f.key) : filter === f.key ? "#F8DF72" : "#FFFFFF",
                boxShadow: filter === f.key ? "0 7px 16px rgba(43,41,36,.24)" : "0 3px 8px rgba(43,41,36,.10)",
              }}>
              {f.label}
            </button>
          ))}
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
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: p.visits.length ? dayRouteColor((typeof filter === "number" ? p.visits.find(v => v.day === filter) : [...p.visits].sort((a,b) => a.day-b.day || a.order-b.order)[0])?.day || 1) : "#EEE9DC" }}>
                    {p.visits.length
                      ? <span className="text-[10px] font-bold text-white">{(typeof filter === "number" ? p.visits.find(v => v.day === filter) : [...p.visits].sort((a,b) => a.day-b.day || a.order-b.order)[0])?.order || ""}</span>
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
  const exampleHydrationInFlightRef = useRef("")

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
  const [addForm,      setAddForm]      = useState<PlaceForm>({ name: "", type: "attraction", note: "", address: "" })
  const [createForm,   setCreateForm]   = useState({ name: "", dest: "", dateMode: "pending" as DateMode, days: 7, startDate: "" })

  const [dayPicker,    setDayPicker]    = useState({ open: false, placeId: "", visitId: "", selectedDay: null as number | null, mode: "arrange" as DayPickerMode })
  const [placeAct,     setPlaceAct]     = useState({ open: false, id: "", source: "itinerary" as "itinerary" | "pool" })
  const [timeEditor,   setTimeEditor]   = useState({ open: false, visitId: "", arrivalTime: "", durationMinutes: null as number | null })
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

  // Example places used to contain only layout coordinates for the old mock map.
  // Resolve missing POI data through AMap so the example remains truthful and its
  // markers, routes and travel estimates work exactly like user-created places.
  const missingExampleMapSignature = trip?.id === INIT_TRIP.id
    ? trip.places
      .filter(place => !place.amapPoiId || !Number.isFinite(place.lng) || !Number.isFinite(place.lat))
      .map(place => `${place.id}:${place.name}`)
      .join("|")
    : ""

  useEffect(() => {
    if (!trip || trip.id !== INIT_TRIP.id || !missingExampleMapSignature) return
    if (!AMAP_KEY || !AMAP_SECURITY_CODE) return
    if (exampleHydrationInFlightRef.current === missingExampleMapSignature) return

    exampleHydrationInFlightRef.current = missingExampleMapSignature
    const missingPlaces = trip.places.filter(place =>
      !place.amapPoiId || !Number.isFinite(place.lng) || !Number.isFinite(place.lat)
    )

    const normalizeName = (value: string) => value
      .replace(/[\s·・（）()\-—]/g, "")
      .replace(/公园|景区|博物院|博物馆|餐厅|烤鸭店|机场/g, "")
      .toLowerCase()

    void (async () => {
      const resolved: Array<{ placeId: string; poi: AMapSuggestion }> = []
      for (const place of missingPlaces) {
        try {
          const suggestions = await searchAMapPlaces(place.name, trip.destination)
          const target = normalizeName(place.name)
          const poi = suggestions.find(item => {
            if (!Number.isFinite(item.lng) || !Number.isFinite(item.lat)) return false
            const candidate = normalizeName(item.name)
            return candidate === target || candidate.includes(target) || target.includes(candidate)
          }) || suggestions.find(item => Number.isFinite(item.lng) && Number.isFinite(item.lat))
          if (poi) resolved.push({ placeId: place.id, poi })
        } catch {
          // Keep the example usable when AMap is temporarily unavailable. A later
          // reload can retry without introducing guessed coordinates.
        }
      }

      if (resolved.length === 0) return
      const poiByPlaceId = new Map(resolved.map(item => [item.placeId, item.poi]))
      setTrips(current => current.map(item => item.id !== INIT_TRIP.id ? item : {
        ...item,
        places: item.places.map(place => {
          const poi = poiByPlaceId.get(place.id)
          if (!poi) return place
          return {
            ...place,
            amapPoiId: poi.id || place.amapPoiId,
            lng: poi.lng,
            lat: poi.lat,
            address: poi.address || place.address,
          }
        }),
      }))
      showToast(`已关联 ${resolved.length} 个示例地点的高德位置`)
    })()

  }, [missingExampleMapSignature, trip?.id, trip?.destination])

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
    const cnt = getDayPlaces(trip!.places, day).length
    const visit: Visit = { id: genVisitId(), day, order: cnt + 1, arrivalTime: "", durationMinutes: null }
    updateTrip(t => ({ ...t, places: t.places.map(p => p.id === placeId ? { ...p, visits: [...p.visits, visit] } : p) }))
    showToast(`已将${place.name}安排到第${day}天`, () => {
      updateTrip(t => ({ ...t, places: t.places.map(p => p.id === placeId ? { ...p, visits: p.visits.filter(v => v.id !== visit.id) } : p) }))
    })
  }

  const moveVisitToDay = (visitId: string, day: number) => {
    const found = trip ? getVisit(trip.places, visitId) : null
    if (!found) return
    const previous = { ...found.visit }
    const order = getDayPlaces(trip!.places, day).length + 1
    updateTrip(t => ({ ...t, places: t.places.map(p => ({ ...p, visits: p.visits.map(v => v.id === visitId ? { ...v, day, order } : v) })) }))
    showToast(`已将${found.place.name}移动到第${day}天`, () => {
      updateTrip(t => ({ ...t, places: t.places.map(p => ({ ...p, visits: p.visits.map(v => v.id === visitId ? previous : v) })) }))
    })
  }

  const deleteVisit = (visitId: string) => {
    const found = trip ? getVisit(trip.places, visitId) : null
    if (!found) return
    updateTrip(t => ({ ...t, places: t.places.map(p => ({ ...p, visits: p.visits.filter(v => v.id !== visitId) })) }))
    showToast(`已删除${found.place.name}的本次安排`)
  }

  const updateVisitTiming = (visitId: string, arrivalTime: string, durationMinutes: number | null) => {
    updateTrip(t => ({
      ...t,
      places: t.places.map(p => ({
        ...p,
        visits: p.visits.map(v => v.id === visitId ? { ...v, arrivalTime, durationMinutes } : v),
      })),
    }))
    showToast("到达时间与停留时长已保存")
  }

  const deletePlace = (placeId: string) => {
    updateTrip(t => ({ ...t, places: t.places.filter(p => p.id !== placeId) }))
    showToast("地点已删除")
  }

  const reorderVisit = (orderedVisitIds: string[]) => {
    if (orderedVisitIds.length < 2) return
    updateTrip(t => {
      const orderMap = new Map(orderedVisitIds.map((visitId, index) => [visitId, index + 1]))
      return { ...t, places: t.places.map(p => ({ ...p, visits: p.visits.map(v => orderMap.has(v.id) ? { ...v, order: orderMap.get(v.id)! } : v) })) }
    })
  }

  const enterReorder = () => {
    if (trip) setReorderSnap(trip.places.map(p => ({ ...p, visits: p.visits.map(v => ({ ...v })) })))
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

  const savePlace = (form: PlaceForm, target: "pool" | "itinerary", day?: number) => {
    const { hotelCheckInDay, hotelCheckOutDay, ...placeFields } = form
    if (editingId) {
      updateTrip(t => ({ ...t, places: t.places.map(p => p.id === editingId ? {
        ...p, ...placeFields,
        hotelStay: form.type === "hotel" && hotelCheckInDay && hotelCheckOutDay ? { checkInDay: hotelCheckInDay, checkOutDay: hotelCheckOutDay } : undefined,
      } : p) }))
      showToast("地点已更新")
      setScreen("workspace")
    } else {
      const targetDay = day || selectedDay
      const placeId = genId()
      if (target === "itinerary" && form.type === "hotel") {
        const checkInDay = Math.max(1, Math.min(trip?.days || 1, hotelCheckInDay || targetDay))
        const checkOutDay = Math.max(checkInDay, Math.min(trip?.days || 1, hotelCheckOutDay || checkInDay))
        updateTrip(t => {
          const startDays = new Set<number>()
          for (let current = checkInDay + 1; current <= checkOutDay; current += 1) startDays.add(current)
          const shifted = t.places.map(place => ({
            ...place,
            visits: place.visits.map(visit => startDays.has(visit.day) ? { ...visit, order: visit.order + 1 } : visit),
          }))
          const visits: Visit[] = []
          for (let current = checkInDay; current <= checkOutDay; current += 1) {
            if (current > checkInDay) visits.push({ id: genVisitId(), day: current, order: 1, arrivalTime: "", durationMinutes: null })
            if (current < checkOutDay || checkInDay === checkOutDay) {
              const endOrder = getDayPlaces(shifted, current).length + 1
              visits.push({ id: genVisitId(), day: current, order: endOrder, arrivalTime: "", durationMinutes: null })
            }
          }
          const hotel: Place = { id: placeId, ...placeFields, hotelStay: { checkInDay, checkOutDay }, dayAssigned: null, order: 0, visits, coords: { x: 195, y: 186 } }
          return { ...t, places: [hotel, ...shifted] }
        })
        showToast(`${form.name}已按住宿日期加入行程`)
        setSelectedDay(checkInDay)
      } else {
        const visit: Visit | null = target === "itinerary"
          ? { id: genVisitId(), day: targetDay, order: getDayPlaces(trip?.places || [], targetDay).length + 1, arrivalTime: "", durationMinutes: null }
          : null
        const np: Place = { id: placeId, ...placeFields, dayAssigned: null, order: 0, visits: visit ? [visit] : [], coords: { x: 195, y: 186 } }
        updateTrip(t => ({ ...t, places: [np, ...t.places] }))
        showToast(target === "itinerary" ? `${form.name}已添加到第${targetDay}天` : `${form.name}已添加到待安排地点`)
        if (target === "itinerary") setSelectedDay(targetDay)
      }
      setScreen("workspace")
      setWsTab(target === "itinerary" ? "itinerary" : "pool")
    }
    setEditingId(null)
    setAddForm({ name: "", type: "attraction", note: "", address: "" })
  }

  const createTrip = () => {
    const nt: Trip = { id: genId(), name: createForm.name, destination: createForm.dest, dateMode: createForm.dateMode, days: createForm.days, startDate: createForm.startDate, places: [], memos: [] }
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
      places: t.places.map(p => ({ ...p, visits: p.visits
        .filter(v => v.day !== day)
        .map(v => v.day > day ? { ...v, day: v.day - 1 } : v) }))
    }))
    if (selectedDay > (trip?.days || 1) - 1) setSelectedDay(Math.max(1, (trip?.days || 1) - 1))
  }

  const openAddPlace  = () => { setEditingId(null); setAddForm({ name: "", type: "attraction", note: "", address: "" }); setScreen("add-place") }
  const openEditPlace = (id: string) => {
    const p = trip?.places.find(pl => pl.id === id)
    if (!p) return
    setEditingId(id); setAddForm({
      name: p.name, type: p.type, note: p.note, address: p.address,
      amapPoiId: p.amapPoiId, lng: p.lng, lat: p.lat,
      hotelCheckInDay: p.hotelStay?.checkInDay,
      hotelCheckOutDay: p.hotelStay?.checkOutDay,
    }); setScreen("add-place")
  }

  const activeVisitInfo = placeAct.source === "itinerary" && placeAct.id && trip
    ? getVisit(trip.places, placeAct.id)
    : null
  const actVisit = activeVisitInfo?.visit || null
  const actPlace = placeAct.source === "itinerary"
    ? activeVisitInfo?.place || null
    : placeAct.id ? trip?.places.find(p => p.id === placeAct.id) || null : null
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
          <AddPlaceScreen form={addForm} setForm={setAddForm} editingId={editingId} destination={trip?.destination || ""} tripDays={trip?.days || 1}
            tripStartDate={trip?.startDate || ""} tripDateMode={trip?.dateMode || "pending"}
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
                  onArrange={id => setDayPicker({ open: true, placeId: id, visitId: "", selectedDay: null, mode: "arrange" })}
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
                  onReorder={reorderVisit}
                  onTravelModeChange={(key, mode) => updateTrip(t => ({
                    ...t,
                    segmentTravelModes: { ...(t.segmentTravelModes || {}), [key]: mode },
                  }))}
                  showToast={showToast} />
              )}
              {wsTab === "map" && (
                <MapTab trip={trip} filter={mapFilter} setFilter={setMapFilter}
                  listOpen={mapListOpen} setListOpen={setMapListOpen}
                  selectedId={mapSelectedId} setSelectedId={setMapSelectedId}
                  onMarker={id => setMapSum({ open: true, id })} />
              )}
              {wsTab === "memo" && (
                <MemoTab trip={trip}
                  onChange={memos => updateTrip(t => ({ ...t, memos }))}
                  onFoldersChange={memoFolders => updateTrip(t => ({ ...t, memoFolders }))}
                  onTrashChange={trashedMemoFolders => updateTrip(t => ({ ...t, trashedMemoFolders }))}
                  showToast={showToast} />
              )}
            </div>

            {/* Bottom nav — hidden in reorder mode */}
            {!isReorder && (
              <div className="shrink-0 border-t border-[#EEE9DC] bg-white flex items-center px-3 pt-2 pb-6 gap-1">
                {([
                  { tab: "pool"      as WsTab, icon: LayoutList,  label: "地点池" },
                  { tab: "itinerary" as WsTab, icon: CalendarDays, label: "每日行程" },
                  { tab: "map"       as WsTab, icon: MapIcon,      label: "地图" },
                  { tab: "memo"      as WsTab, icon: NotebookPen,  label: "备忘" },
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
          title={dayPicker.mode === "move" ? "移动到哪一天？" : dayPicker.mode === "repeat" ? "再安排到哪一天？" : "安排到哪一天？"}>
          <div className="px-4 pb-6">
            {Array.from({ length: trip?.days || 0 }, (_, i) => i + 1).map(day => {
              const cnt     = getDayPlaces(trip?.places || [], day).length
              const sel     = dayPicker.selectedDay === day
              const currentVisit = dayPicker.mode === "move" && trip ? getVisit(trip.places, dayPicker.visitId) : null
              const isCurr  = dayPicker.mode === "move" && currentVisit?.visit.day === day
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
                  if (dayPicker.mode === "move" && dayPicker.visitId) moveVisitToDay(dayPicker.visitId, dayPicker.selectedDay)
                  else assignPlace(dayPicker.placeId, dayPicker.selectedDay)
                  setDayPicker(d => ({ ...d, open: false }))
                }
              }}>
              {dayPicker.mode === "move" ? "确认移动" : dayPicker.mode === "repeat" ? "确认再次安排" : "确认安排"}
            </Btn>
          </div>
        </Sheet>

        {/* ── Itinerary Place Actions Sheet ───────────────────────── */}
        {placeAct.source === "itinerary" && (
          <Sheet open={placeAct.open} onClose={() => setPlaceAct(a => ({ ...a, open: false }))}>
            {actPlace && actVisit && (
              <div className="pb-6">
                <div className="px-5 pb-3 border-b border-[#EEE9DC]">
                  <p className="text-[16px] font-semibold text-[#2B2924]">{actPlace.name}</p>
                  <p className="text-[12px]" style={{ color: SEC }}>当前安排：第{actVisit.day}天{visitTimeLabel({ ...actPlace, ...actVisit, placeId: actPlace.id, visitId: actVisit.id }) ? ` · ${visitTimeLabel({ ...actPlace, ...actVisit, placeId: actPlace.id, visitId: actVisit.id })}` : ""}</p>
                </div>
                {[
                  { label: "安排到其他日期", icon: ChevronRight, fn: () => { setPlaceAct(a => ({ ...a, open: false })); setDayPicker({ open: true, placeId: actPlace.id, visitId: actVisit.id, selectedDay: actVisit.day, mode: "move" }) } },
                  { label: "再安排一次", icon: Plus, fn: () => { setPlaceAct(a => ({ ...a, open: false })); setDayPicker({ open: true, placeId: actPlace.id, visitId: "", selectedDay: null, mode: "repeat" }) } },
                  { label: "设置到达时间与停留时长", icon: Clock3, fn: () => { setPlaceAct(a => ({ ...a, open: false })); setTimeEditor({ open: true, visitId: actVisit.id, arrivalTime: actVisit.arrivalTime, durationMinutes: actVisit.durationMinutes }) } },
                  { label: "编辑地点",       icon: Edit3,        fn: () => { setPlaceAct(a => ({ ...a, open: false })); openEditPlace(actPlace.id) } },
                  { label: "在高德/百度地图中查看", icon: Navigation2, fn: () => { setPlaceAct(a => ({ ...a, open: false })); setExtMapPlaceId(actPlace.id) } },
                ].map(({ label, icon: Icon, fn }) => (
                  <button key={label} onClick={fn} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#FFFCF3] text-[#2B2924]">
                    <Icon size={17} strokeWidth={1.5} style={{ color: SEC }} />
                    <span className="text-[15px]">{label}</span>
                  </button>
                ))}
                <div className="mx-5 h-px bg-[#EEE9DC] my-1" />
                <button onClick={() => { setPlaceAct(a => ({ ...a, open: false })); setDlg({ title: `删除${actPlace.name}的本次安排？`, desc: `只删除第${actVisit.day}天的这一次安排，地点本身和其他日期的安排会保留。`, onConfirm: () => deleteVisit(actVisit.id) }) }}
                  className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#FFFCF3]">
                  <Trash2 size={17} strokeWidth={1.5} className="text-[#C96B58]" />
                  <span className="text-[15px] text-[#C96B58]">删除本次安排</span>
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

        {/* ── Visit time editor ─────────────────────────────────── */}
        <Sheet open={timeEditor.open} onClose={() => setTimeEditor(v => ({ ...v, open: false }))} title="到达时间与停留时长">
          <div className="px-5 pb-7">
            <label className="block text-[13px] font-medium text-[#2B2924] mb-2">到达时间（选填）</label>
            <input type="time" value={timeEditor.arrivalTime}
              onChange={event => setTimeEditor(v => ({ ...v, arrivalTime: event.target.value }))}
              className="w-full h-12 rounded-2xl border border-[#E5DFD0] bg-[#FFFCF3] px-4 text-[15px] text-[#2B2924] outline-none focus:border-[#E4C641] mb-5" />
            <label className="block text-[13px] font-medium text-[#2B2924] mb-2">预计停留（选填）</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[30, 60, 120].map(minutes => (
                <button key={minutes} type="button" onClick={() => setTimeEditor(v => ({ ...v, durationMinutes: minutes }))}
                  className={`h-10 rounded-xl border text-[13px] font-medium ${timeEditor.durationMinutes === minutes ? "bg-[#F7E8AA] border-[#E4C641] text-[#2B2924]" : "bg-white border-[#E5DFD0]"}`}
                  style={{ color: timeEditor.durationMinutes === minutes ? "#2B2924" : SEC }}>
                  {minutes < 60 ? `${minutes}分钟` : `${minutes / 60}小时`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-6">
              <input type="number" min="1" max="1440" inputMode="numeric" placeholder="自定义分钟数"
                value={timeEditor.durationMinutes && ![30, 60, 120].includes(timeEditor.durationMinutes) ? timeEditor.durationMinutes : ""}
                onChange={event => setTimeEditor(v => ({ ...v, durationMinutes: event.target.value ? Math.max(1, Number(event.target.value)) : null }))}
                className="flex-1 h-11 rounded-xl border border-[#E5DFD0] bg-white px-3 text-[14px] outline-none focus:border-[#E4C641]" />
              <button type="button" onClick={() => setTimeEditor(v => ({ ...v, durationMinutes: null }))}
                className="h-11 px-3 rounded-xl border border-[#E5DFD0] bg-white text-[13px]" style={{ color: SEC }}>不设置</button>
            </div>
            <Btn variant="primary" className="w-full" onClick={() => {
              updateVisitTiming(timeEditor.visitId, timeEditor.arrivalTime, timeEditor.durationMinutes)
              setTimeEditor(v => ({ ...v, open: false }))
            }}>保存</Btn>
          </div>
        </Sheet>

        {/* ── Map Place Summary Sheet ─────────────────────────────── */}
        <Sheet open={mapSum.open} onClose={() => setMapSum(m => ({ ...m, open: false }))}>
          {mapPlace && (
            <div className="px-5 pb-8">
              <TBadge type={mapPlace.type} />
              <h2 className="text-[20px] font-bold text-[#2B2924] mt-2 mb-1">{mapPlace.name}</h2>
              {mapPlace.address && <p className="text-[13px] mb-1" style={{ color: SEC }}>{mapPlace.address}</p>}
              {mapPlace.note    && <p className="text-[13px] mb-1" style={{ color: SEC }}>备注：{mapPlace.note}</p>}
              <p className="text-[13px] mb-5" style={{ color: TERC }}>
                当前状态：{mapPlace.visits.length > 0 ? mapPlace.visits.slice().sort((a, b) => a.day - b.day).map(v => `第${v.day}天`).join("、") : "待安排地点"}
              </p>
              <div className="flex gap-2.5">
                <Btn variant="primary" className="flex-1 text-[14px]"
                  onClick={() => {
                    setMapSum(m => ({ ...m, open: false }))
                    setDayPicker({ open: true, placeId: mapPlace.id, visitId: "", selectedDay: null, mode: mapPlace.visits.length > 0 ? "repeat" : "arrange" })
                  }}>
                  {mapPlace.visits.length > 0 ? "再安排一次" : "安排到某一天"}
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
            <div className="fixed inset-0 bg-black/40" style={{ zIndex: 1100 }} onClick={() => setExtMapPlaceId(null)} />
            <div className="fixed inset-x-5 top-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 max-w-[370px] mx-auto shadow-2xl" style={{ zIndex: 1200 }}>
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
