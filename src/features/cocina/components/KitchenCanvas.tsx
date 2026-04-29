'use client'

import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import {
  KITCHEN_STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_EMOJIS,
  STAGE_MS_ENTREGADO,
  getOrderColor,
  playCoinSound,
  playNewOrderSound,
  playComboSound,
  type KitchenOrder,
  type KitchenStage,
  type KitchenStats,
} from '../utils/cocina.utils'
import { createStimulusGate } from '../utils/eventDirector'
import {
  isCocinaKanbanPagerWidth,
  isCocinaKanbanWideWidth,
  isCocinaKitchenKpiDesktopWidth,
  isCocinaMobileWidth,
} from '../utils/cocina-layout'

/* ═══════════════ CONSTANTS ═══════════════ */

/** Máximo de pedidos entregados visibles en la columna "Entregado" en modo móvil ultraCompact (rendimiento + UX). */
const MOBILE_MAX_DELIVERED = 30

const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  local: 'Local',
  para_llevar: 'Para llevar',
}

const WORKER_EMOJIS: Record<KitchenStage, string[]> = {
  nuevo: ['🧑‍💼'],
  cocinando: ['👨‍🍳', '👩‍🍳'],
  empacando: ['🧑‍🏭'],
  entregado: ['🤝'],
}

const STAGE_BG: Record<KitchenStage, string> = {
  nuevo: 'from-orange-50 to-orange-100/50 dark:from-gray-800 dark:to-gray-800/90',
  cocinando: 'from-red-50 to-red-100/50 dark:from-gray-800 dark:to-gray-800/90',
  empacando: 'from-green-50 to-green-100/50 dark:from-gray-800 dark:to-gray-800/90',
  entregado: 'from-yellow-50 to-amber-100/50 dark:from-gray-800 dark:to-gray-800/90',
}

// Ventana (ms) desde que el pedido pasó a "entregado" para considerar la entrega reciente (sonido + ticker).
const RECENT_DELIVERY_WINDOW_MS = 60_000

const EMPTY_MESSAGES: Record<KitchenStage, string> = {
  nuevo: 'Esperando el próximo pedido... 🎯',
  cocinando: 'La parrilla espera el próximo pedido... 🔥',
  empacando: 'Listo para empacar... 📦',
  entregado: '¡A despachar se ha dicho! 🚀',
}

const CONFETTI_COLORS = ['#FFD700', '#FF6B35', '#4CAF50', '#4A90D9', '#FF3E3E', '#9B59B6', '#FF69B4']

const COMBO_THRESHOLDS = [
  { min: 3, label: 'COMBO x3!', emoji: '⚡' },
  { min: 5, label: 'RACHA x5!', emoji: '🔥' },
  { min: 8, label: 'IMPARABLE x8!', emoji: '💥' },
  { min: 10, label: '¡LEYENDA x10!', emoji: '👑' },
]

function formatElapsed(ms: number): string {
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function formatGs(n: number): string {
  return 'Gs. ' + n.toLocaleString('es-PY')
}

function formatCompactGs(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

/* ═══════════════ ROLLING DIGIT COUNTER ═══════════════ */

function RollingDigit({ digit, delay }: { digit: string; delay: number }) {
  const [current, setCurrent] = useState(digit)
  const [rolling, setRolling] = useState(false)

  useEffect(() => {
    if (digit !== current) {
      setRolling(true)
      const t = setTimeout(() => {
        setCurrent(digit)
        setRolling(false)
      }, 350)
      return () => clearTimeout(t)
    }
  }, [digit, current])

  return (
    <span
      className="inline-block overflow-hidden relative"
      style={{
        width: /\d/.test(digit) ? '0.62em' : 'auto',
        height: '1.15em',
        verticalAlign: 'bottom',
      }}
    >
      <span
        className={rolling ? 'animate-digit-roll' : ''}
        style={{
          display: 'inline-block',
          animationDelay: `${delay * 30}ms`,
        }}
      >
        {rolling ? digit : current}
      </span>
    </span>
  )
}

function MoneyCounter({ value, label, icon }: { value: number; label: string; icon: string }) {
  const formatted = formatGs(value)

  return (
    <div className="flex items-center gap-2">
      <span className="text-xl">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-400 dark:text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
        <span className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
          {formatted.split('').map((ch, i) => (
            <RollingDigit key={`${i}-${ch}`} digit={ch} delay={i} />
          ))}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════ COMBO / STREAK BADGE ═══════════════ */

function ComboBadge({ streak, lastOrderTime }: { streak: number; lastOrderTime: number }) {
  const threshold = [...COMBO_THRESHOLDS].reverse().find((t) => streak >= t.min)
  if (!threshold) return null

  const elapsed = Date.now() - lastOrderTime
  const COMBO_WINDOW = 5 * 60_000
  const remaining = Math.max(0, 1 - elapsed / COMBO_WINDOW)
  const isGold = streak >= 5

  return (
    <div className="flex items-center gap-2 animate-combo-pop">
      <div
        className={`
          px-3 py-1.5 rounded-full font-black text-sm flex items-center gap-1.5 shadow-lg
          ${isGold ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white' : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'}
        `}
      >
        <span className="text-base">{threshold.emoji}</span>
        <span>{threshold.label}</span>
      </div>
      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${remaining * 100}%`,
            background: isGold
              ? 'linear-gradient(90deg, #FFD700, #FF8C00)'
              : 'linear-gradient(90deg, #FF6B35, #FF3E3E)',
          }}
        />
      </div>
    </div>
  )
}

/* ═══════════════ CONFETTI BURST (enhanced) ═══════════════ */

function ConfettiBurst({ onDone, intensity }: { onDone: () => void; intensity?: number }) {
  const count = intensity ?? (20 + Math.floor(Math.random() * 20))
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: Math.random() * 0.4,
        size: 4 + Math.random() * 8,
        rotation: Math.random() * 360,
        isCircle: Math.random() > 0.5,
      })),
    [count]
  )

  useEffect(() => {
    const t = setTimeout(onDone, 1500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}

/* ═══════════════ EMBER PARTICLES (cooking fire) ═══════════════ */

function EmberParticles() {
  const embers = useMemo(
    () =>
      Array.from({ length: 11 }).map((_, i) => ({
        id: i,
        left: 8 + Math.random() * 84,
        delay: Math.random() * 2.2,
        duration: 0.55 + Math.random() * 0.75,
        ex: -18 + Math.random() * 36,
        size: Math.random() > 0.45 ? 'w-2 h-2' : 'w-1.5 h-1.5',
      })),
    []
  )

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
      {embers.map((e) => (
        <div
          key={e.id}
          className={`absolute ${e.size} rounded-full animate-ember`}
          style={{
            left: `${e.left}%`,
            bottom: '5px',
            background: `radial-gradient(circle, #FF6B35, #FF3E3E)`,
            animationDelay: `${e.delay}s`,
            animationDuration: `${e.duration}s`,
            animationIterationCount: 'infinite',
            '--ex': `${e.ex}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

/* ═══════════════ ORDER CARD (on steroids) ═══════════════ */

function OrderCard({
  order,
  isNew,
  compact = false,
  ultraCompact = false,
  minHeight,
  onClick,
}: {
  order: KitchenOrder
  isNew: boolean
  compact?: boolean
  ultraCompact?: boolean
  minHeight?: number
  onClick?: () => void
}) {
  const typeColor = getOrderColor(order.tipo)
  const typeLabel = ORDER_TYPE_LABELS[order.tipo] ?? order.tipo
  const isDone = order.stage === 'entregado'
  const isCooking = order.stage === 'cocinando'
  const isNuevo = order.stage === 'nuevo'
  const isEmpacando = order.stage === 'empacando'

  if (ultraCompact) {
    return (
      <div
        onClick={onClick}
        style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
        className={`
          relative h-fit bg-white dark:bg-gray-700/90 rounded-lg shadow-sm border p-1.5
          ${isNew ? 'animate-slam-in' : 'animate-fade-in-up'}
          ${isDone ? 'opacity-75 border-yellow-200 dark:border-amber-700/50' : 'border-gray-100 dark:border-gray-600'}
          ${isCooking ? 'animate-fire-shimmer-strong' : ''}
          ${onClick ? 'cursor-pointer active:scale-[0.97]' : ''}
          transition-all duration-200
        `}
      >
        <div className="flex items-center justify-between mb-0.5 relative z-[1]">
          <span className="text-[11px] font-black text-gray-800 dark:text-gray-100 leading-none">#{order.numero_pedido}</span>
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: typeColor }}
            title={typeLabel}
          />
        </div>
        <div className="relative z-[1] mb-0.5">
          <span className="text-[10px] font-bold text-green-600 dark:text-green-400 leading-none truncate block">
            {formatCompactGs(order.total)}
          </span>
        </div>
        {!isDone && (
          <>
            <div className="w-full h-0.5 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden mb-0.5 relative z-[1]">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                  isCooking ? 'animate-cooking-progress' : isNuevo ? 'animate-nuevo-progress' : isEmpacando ? 'animate-empacando-progress' : ''
                }`}
                style={{
                  width: `${Math.min(order.progress * 100, 100)}%`,
                  backgroundColor: STAGE_COLORS[order.stage],
                }}
              />
            </div>
            <span className="text-[9px] text-gray-400 dark:text-gray-400 font-medium leading-none relative z-[1]">
              {formatElapsed(order.elapsed)}
            </span>
          </>
        )}
        {isDone && (
          <span className="text-[9px] text-green-600 dark:text-green-400 font-semibold leading-none relative z-[1]">
            {formatElapsed(order.elapsed)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
      className={`
        relative h-fit bg-white dark:bg-gray-700/90 rounded-xl shadow-sm border ${compact ? 'p-2.5' : 'p-3'}
        ${isNew ? 'animate-slam-in' : 'animate-fade-in-up'}
        ${isDone ? 'opacity-75 scale-[0.97] border-yellow-200 dark:border-amber-700/50' : 'border-gray-100 dark:border-gray-600'}
        ${isCooking ? 'animate-fire-shimmer-strong' : ''}
        ${!isDone && isNuevo ? 'animate-order-nuevo' : ''}
        ${!isDone && isEmpacando ? 'animate-order-empacando' : ''}
        ${isDone ? 'animate-order-entregado' : ''}
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/40 active:scale-[0.98]' : 'hover:shadow-md'}
        dark:hover:shadow-black/20 transition-all duration-200
      `}
    >
      {isCooking && <EmberParticles />}

      <div className="flex items-center justify-between mb-1.5 relative z-[1]">
        <span className={`${compact ? 'text-[13px]' : 'text-sm'} font-extrabold text-gray-800 dark:text-gray-100`}>#{order.numero_pedido}</span>
        <span
          className={`${compact ? 'text-[9px] px-1.5' : 'text-[10px] px-2'} font-bold py-0.5 rounded-full text-white`}
          style={{ backgroundColor: typeColor }}
        >
          {typeLabel}
        </span>
      </div>

      <div className="flex items-center justify-between mb-1.5 relative z-[1]">
        <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-bold text-green-600 dark:text-green-400`}>{formatGs(order.total)}</span>
      </div>

      {!isDone && (
        <>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden mb-1 relative z-[1]">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                isCooking ? 'animate-cooking-progress' : isNuevo ? 'animate-nuevo-progress' : isEmpacando ? 'animate-empacando-progress' : ''
              }`}
              style={{
                width: `${Math.min(order.progress * 100, 100)}%`,
                backgroundColor: STAGE_COLORS[order.stage],
              }}
            />
          </div>
          <div className="flex items-center justify-between relative z-[1]">
            <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-gray-400 dark:text-gray-400 font-medium`}>
              {formatElapsed(order.elapsed)}
            </span>
            <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-gray-300 dark:text-gray-500`}>
              {Math.round(order.progress * 100)}%
            </span>
          </div>
        </>
      )}

      {isDone && (
        <div className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-green-600 dark:text-green-400 font-semibold flex items-center gap-1 relative z-[1]`}>
          <span>✅ Listo</span>
          <span className="text-green-500 dark:text-green-400/90">~{formatElapsed(order.elapsed)}</span>
        </div>
      )}
    </div>
  )
}

/* ═══════════════ STAGE COLUMN (enhanced) ═══════════════ */

function StageColumn({
  stage,
  orders,
  hasNewDelivery,
  hasNewOrder,
  compact = false,
  ultraCompact = false,
  minHeight,
  orderCardMinHeight,
  targetVisibleCards,
  showConfettiBurst = true,
  onConfettiDone,
  onOrderClick,
}: {
  stage: KitchenStage
  orders: KitchenOrder[]
  hasNewDelivery: boolean
  hasNewOrder: boolean
  compact?: boolean
  ultraCompact?: boolean
  minHeight?: number
  orderCardMinHeight?: number
  targetVisibleCards?: number
  /** Confetti pesado: el padre puede limitarlo por cooldown (evita saturación). */
  showConfettiBurst?: boolean
  onConfettiDone: () => void
  onOrderClick?: (order: KitchenOrder) => void
}) {
  const isCooking = stage === 'cocinando'
  const isDelivered = stage === 'entregado'
  const hasOrders = orders.length > 0
  const effectiveVisibleCards = Math.max(1, Math.min(targetVisibleCards ?? 3, orders.length || 1))
  const dynamicCardMinHeight = useMemo(() => {
    if (!minHeight || !orderCardMinHeight) return orderCardMinHeight
    const chromeReserve = compact ? 98 : 118
    const available = Math.max(80, minHeight - chromeReserve)
    const candidate = Math.floor(available / effectiveVisibleCards)
    const contentBase = compact ? 74 : 88
    const contentMax = compact ? 112 : 132
    return Math.max(contentBase, Math.min(candidate, contentMax))
  }, [compact, effectiveVisibleCards, minHeight, orderCardMinHeight])
  const shouldForceCardMinHeight = orders.length <= effectiveVisibleCards

  const columnBorderAndAnim = useMemo(() => {
    if (!hasOrders) return 'border-gray-100/80 dark:border-gray-600'
    switch (stage) {
      case 'nuevo':
        return 'animate-column-nuevo border-orange-200/55 dark:border-orange-600/45'
      case 'cocinando':
        return 'animate-fire-shimmer-strong border-orange-200/60 dark:border-orange-600/50'
      case 'empacando':
        return 'animate-column-empacando border-emerald-200/55 dark:border-emerald-600/45'
      case 'entregado':
        return hasNewDelivery
          ? 'animate-gold-pulse border-amber-200/60 dark:border-amber-600/50'
          : 'animate-column-entregado border-amber-200/55 dark:border-amber-600/45'
      default:
        return 'border-gray-100/80 dark:border-gray-600'
    }
  }, [hasOrders, stage, hasNewDelivery])

  const headerEmojiAnim = useMemo(() => {
    if (!hasOrders) return ''
    if (stage === 'nuevo') return 'animate-pulse-nuevo'
    if (stage === 'cocinando') return 'animate-pulse-fire'
    if (stage === 'empacando') return 'animate-pulse-empacando'
    if (stage === 'entregado') return 'animate-pulse-gold'
    return ''
  }, [hasOrders, stage])

  if (ultraCompact) {
    return (
      <div
        className={`
          relative flex flex-col rounded-xl bg-gradient-to-b ${STAGE_BG[stage]}
          border overflow-hidden h-full min-h-[180px] min-w-0 max-h-full
          ${columnBorderAndAnim}
        `}
      >
        {hasNewDelivery && showConfettiBurst && <ConfettiBurst onDone={onConfettiDone} />}

        {/* Header ultra-compact: emoji centrado + badge */}
        <div
          className={`px-1 py-1.5 flex flex-col items-center gap-0.5 border-b dark:border-gray-600 flex-shrink-0 ${hasNewOrder && hasOrders ? 'animate-shake' : ''}`}
          style={{ borderColor: `${STAGE_COLORS[stage]}25` }}
        >
          <span className={`text-base leading-none ${headerEmojiAnim}`} aria-hidden>
            {STAGE_EMOJIS[stage]}
          </span>
          <span
            className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full text-white min-w-[20px] text-center tabular-nums leading-none"
            style={{ backgroundColor: STAGE_COLORS[stage] }}
            aria-label={`${STAGE_LABELS[stage]}: ${orders.length}`}
          >
            {orders.length}
          </span>
        </div>

        {/* Orders — scrollable, constrained to column height */}
        <div className="min-h-0 flex-1 p-1 space-y-1 overflow-y-auto custom-scrollbar">
          {orders.length === 0 && (
            <div className="flex items-center justify-center py-4">
              <span className="text-base" aria-hidden>{STAGE_EMOJIS[stage]}</span>
            </div>
          )}
          {orders.map((order, i) => (
            <OrderCard
              key={order.id}
              order={order}
              isNew={i === 0 && hasNewOrder}
              compact
              ultraCompact
              onClick={onOrderClick ? () => onOrderClick(order) : undefined}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
      className={`
        relative flex flex-col rounded-2xl bg-gradient-to-b ${STAGE_BG[stage]}
        border overflow-hidden h-full min-h-[300px] min-w-0
        ${columnBorderAndAnim}
      `}
    >
      {hasNewDelivery && showConfettiBurst && <ConfettiBurst onDone={onConfettiDone} />}

      {/* Header — shake aquí para no pisar la animación del borde de la columna */}
      <div
        className={`${compact ? 'px-3 py-2' : 'px-4 py-3'} flex items-center justify-between border-b dark:border-gray-600 ${hasNewOrder && hasOrders ? 'animate-shake' : ''}`}
        style={{ borderColor: `${STAGE_COLORS[stage]}25` }}
      >
        <div className="flex items-center gap-2">
          <span className={`${compact ? 'text-lg' : 'text-xl'} ${headerEmojiAnim}`}>
            {STAGE_EMOJIS[stage]}
          </span>
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-gray-700 dark:text-gray-200`}>
            {STAGE_LABELS[stage]} · {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
          </span>
        </div>
        <span
          className="text-xs font-extrabold px-2.5 py-1 rounded-full text-white min-w-[28px] text-center"
          style={{ backgroundColor: STAGE_COLORS[stage] }}
        >
          {orders.length}
        </span>
      </div>

      {/* Orders */}
      <div className={`flex-1 ${compact ? 'p-2 space-y-1.5' : 'p-2.5 space-y-2'} overflow-y-auto custom-scrollbar`}>
        {orders.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <span className="text-sm text-gray-500 dark:text-gray-300 italic text-center px-2">
              {EMPTY_MESSAGES[stage]}
            </span>
          </div>
        )}
        {orders.map((order, i) => (
          <OrderCard
            key={order.id}
            order={order}
            isNew={i === 0 && hasNewOrder}
            compact={compact}
            minHeight={shouldForceCardMinHeight ? dynamicCardMinHeight : undefined}
            onClick={onOrderClick ? () => onOrderClick(order) : undefined}
          />
        ))}
      </div>

      {/* Workers footer */}
      <div className={`${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} border-t border-gray-100/60 dark:border-gray-600 flex items-center gap-1`}>
        {WORKER_EMOJIS[stage].map((emoji, j) => (
          <span
            key={j}
            className={`${compact ? 'text-base' : 'text-lg'} ${orders.length > 0 ? 'animate-worker-bounce' : ''}`}
            style={{ animationDelay: `${j * 0.2}s` }}
          >
            {emoji}
          </span>
        ))}
        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto font-medium">
          {stage === 'nuevo' && 'Recepción'}
          {stage === 'cocinando' && 'Cocina'}
          {stage === 'empacando' && 'Empaque'}
          {stage === 'entregado' && 'Despacho'}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════ ACTIVITY TICKER (Upgrade Dopamina) ═══════════════ */

const HIGH_SCORE_GS = 200_000

function tickerEmojiByTotal(total: number, isDelivery: boolean): string {
  if (isDelivery) return total >= HIGH_SCORE_GS ? '🪙' : '💰'
  if (total >= HIGH_SCORE_GS) return '🪙'
  if (total >= 50_000) return '💰'
  return '💵'
}

interface TickerEvent {
  id: string
  text: string
  emoji: string
  ts: number
  total?: number
  isDelivery?: boolean
}

function ActivityTicker({ events }: { events: TickerEvent[] }) {
  const baseEvents = useMemo(() => {
    if (events.length === 0) return []
    const minEventsForTrack = 8
    const desired = Math.max(minEventsForTrack, events.length)
    return Array.from({ length: desired }, (_, i) => events[i % events.length])
  }, [events])

  const loopEvents = useMemo(() => [...baseEvents, ...baseEvents], [baseEvents])

  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-slate-900 to-gray-900 dark:from-slate-900 dark:to-gray-900 rounded-lg h-8 flex items-center relative border border-slate-700/60 dark:border-gray-800/70">
      {events.length === 0 ? (
        <div className="flex items-center justify-center gap-2 w-full py-1">
          <span className="text-slate-400 dark:text-gray-500 text-xs font-medium">Esperando actividad...</span>
          <span className="text-slate-500 dark:text-gray-600">•</span>
        </div>
      ) : (
        <div
          className="flex w-max items-center justify-start gap-8 whitespace-nowrap animate-ticker pr-8"
          style={{ '--ticker-duration': `${Math.max(baseEvents.length * 3.2, 18)}s` } as React.CSSProperties}
        >
          {loopEvents.map((ev, i) => {
          const isHighScore = ev.total != null && ev.total >= HIGH_SCORE_GS
          const amountText =
            ev.total != null
              ? ev.isDelivery
                ? `+${formatGs(ev.total)}`
                : formatGs(ev.total)
              : null
          const labelText =
            ev.total != null && amountText != null ? ev.text.replace(amountText, '').trim() : null

          return (
            <span
              key={`${ev.id}-${i}`}
              className={`
                inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border
                ${isHighScore ? 'border-amber-400/70 bg-amber-500/10 shadow-[0_0_12px_rgba(251,191,36,0.25)]' : 'border-transparent'}
              `}
            >
              <span className="text-sm" title={isHighScore ? 'High score' : undefined}>
                {ev.emoji}
              </span>
              {amountText != null && labelText != null ? (
                <>
                  <span className="text-xs font-medium text-slate-300 dark:text-gray-400">{labelText}</span>
                  <span className="text-xs font-bold text-emerald-300 dark:text-emerald-300 tabular-nums">{amountText}</span>
                </>
              ) : (
                <span className="text-xs font-medium text-slate-200 dark:text-gray-300">{ev.text}</span>
              )}
              <span className="text-slate-500 dark:text-gray-600">•</span>
            </span>
          )
        })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════ RECORD BREAKER BANNER ═══════════════ */

function RecordBanner({ text }: { text: string }) {
  return (
    <div
      className="animate-slam-in rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 ring-2 ring-amber-300/80 ring-offset-2 ring-offset-gray-900 dark:ring-offset-gray-800 shadow-[0_0_24px_rgba(245,158,11,0.5),0_0_48px_rgba(251,191,36,0.2)]"
    >
      <span className="text-xl drop-shadow-md">🏆</span>
      <span className="text-sm font-black text-white tracking-wide drop-shadow-sm">{text}</span>
      <span className="text-xl drop-shadow-md">🏆</span>
    </div>
  )
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */

export default function KitchenCanvas({
  orders,
  stats,
  newDeliveryIds,
  onDeliveryAnimated,
  onStreakChange,
  sessionId,
  onOrderClick,
  stageOverrides,
}: {
  orders: KitchenOrder[]
  stats: KitchenStats
  newDeliveryIds: string[]
  onDeliveryAnimated: (id: string) => void
  onStreakChange?: (streak: number) => void
  /** Id del turno de caja; al cambiar (nuevo turno = Empezar el día), se reinicia la racha. */
  sessionId?: string | null
  onOrderClick?: (order: KitchenOrder) => void
  stageOverrides?: Record<string, KitchenStage>
}) {
  const soundPlayed = useRef<Set<string>>(new Set())
  const prevOrderCount = useRef(orders.length)
  const hasInitializedOrders = useRef(false)
  const prevSessionId = useRef<string | undefined>(sessionId ?? undefined)
  const [newOrderStages, setNewOrderStages] = useState<Set<KitchenStage>>(new Set())
  const [tickerEvents, setTickerEvents] = useState<TickerEvent[]>([])
  const [streak, setStreak] = useState(0)
  const prevStreakRef = useRef(0)
  const lastOrderTime = useRef(Date.now())
  const prevRevenueRef = useRef(stats.todayRevenue)
  const [record, setRecord] = useState<string | null>(null)
  const bestRevenueRef = useRef(0)
  const [isMobile, setIsMobile] = useState(false)
  /** Ancho actual; define kanban ancho vs pager vs móvil. */
  const [viewportWidth, setViewportWidth] = useState(1280)
  const [activeStage, setActiveStage] = useState<KitchenStage>('nuevo') // kept for potential future use, unused in mobile 4-col layout
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'delivery' | 'local' | 'para_llevar'>('all')
  const [isTickerCollapsed, setIsTickerCollapsed] = useState(false)
  const [tabletPage, setTabletPage] = useState(0)
  const tabletPagerRef = useRef<HTMLDivElement>(null)
  const [viewportHeight, setViewportHeight] = useState(900)
  const [kpiFlash, setKpiFlash] = useState({
    pedidos: false,
    facturado: false,
    entregados: false,
    ticket: false,
  })
  const [kpiDeltaPop, setKpiDeltaPop] = useState({
    pedidos: null as string | null,
    facturado: null as string | null,
    entregados: null as string | null,
    ticket: null as string | null,
  })
  const [deliveryConfettiOk, setDeliveryConfettiOk] = useState(false)
  const stimulusGateRef = useRef(createStimulusGate())
  const ordersRef = useRef(orders)
  ordersRef.current = orders
  const prevKpiRef = useRef({
    pedidos: stats.todayTotal,
    facturado: stats.todayRevenue,
    entregados: stats.deliveredCount,
    ticket: 0,
  })
  const isKanbanWide = isCocinaKanbanWideWidth(viewportWidth)
  const isKanbanPager = isCocinaKanbanPagerWidth(viewportWidth)
  const isKitchenKpiDesktop = isCocinaKitchenKpiDesktopWidth(viewportWidth)
  const showTypeFilters = !isKanbanWide

  const newDeliveryIdsKey = newDeliveryIds.join(',')

  useEffect(() => {
    if (newDeliveryIds.length === 0) {
      setDeliveryConfettiOk(false)
      return
    }
    const list = ordersRef.current
    const touchesEntregado = list.some(
      (o) => o.stage === 'entregado' && newDeliveryIds.includes(o.id)
    )
    if (!touchesEntregado) {
      setDeliveryConfettiOk(false)
      return
    }
    const ok = stimulusGateRef.current.tryFire('confettiBurst')
    setDeliveryConfettiOk(ok)
    if (ok) {
      const t = setTimeout(() => setDeliveryConfettiOk(false), 1700)
      return () => clearTimeout(t)
    }
  }, [newDeliveryIds, newDeliveryIdsKey])

  useEffect(() => {
    const updateViewportType = () => {
      const width = window.innerWidth
      const height = window.visualViewport?.height ?? window.innerHeight
      setViewportWidth(width)
      setIsMobile(isCocinaMobileWidth(width))
      setViewportHeight(height)
    }
    updateViewportType()
    window.addEventListener('resize', updateViewportType)
    window.visualViewport?.addEventListener('resize', updateViewportType)
    return () => {
      window.removeEventListener('resize', updateViewportType)
      window.visualViewport?.removeEventListener('resize', updateViewportType)
    }
  }, [])

  useEffect(() => {
    // Caja cerrada o sin sesión: nunca debe haber combo activo
    if (!sessionId) {
      setStreak(0)
      prevSessionId.current = undefined
      return
    }

    // Reiniciar racha al empezar un nuevo turno (Empezar el día)
    if (sessionId !== prevSessionId.current) {
      setStreak(0)
      prevSessionId.current = sessionId
    }
  }, [sessionId])

  // Detect new orders → sound + streak + ticker
  useEffect(() => {
    const count = orders.length

    // Primer snapshot: no considerar pedidos como nuevos ni disparar animaciones/sonidos
    if (!hasInitializedOrders.current) {
      prevOrderCount.current = count
      hasInitializedOrders.current = true
      return
    }

    if (count > prevOrderCount.current) {
      const diff = count - prevOrderCount.current
      const newOrders = orders.slice(0, diff)

      if (stimulusGateRef.current.tryFire('newOrder')) {
        playNewOrderSound()
      }

      const now = Date.now()
      const COMBO_WINDOW = 5 * 60_000
      if (now - lastOrderTime.current < COMBO_WINDOW) {
        setStreak((s) => {
          const next = s + diff
          if (next >= 5 && s < 5 && stimulusGateRef.current.tryFire('comboSound')) {
            playComboSound()
          }
          return next
        })
      } else {
        setStreak(diff)
      }
      lastOrderTime.current = now

      const stages = new Set(newOrders.map((o) => o.stage))
      setNewOrderStages(stages)
      setTimeout(() => setNewOrderStages(new Set()), 500)

      setTickerEvents((prev) => {
        const newEvents: TickerEvent[] = newOrders.map((o) => ({
          id: `new-${o.id}`,
          text: `Nuevo pedido #${o.numero_pedido} · ${formatGs(o.total)} (${ORDER_TYPE_LABELS[o.tipo] ?? o.tipo})`,
          emoji: tickerEmojiByTotal(o.total, false),
          ts: Date.now(),
          total: o.total,
          isDelivery: false,
        }))
        return [...newEvents, ...prev].slice(0, 20)
      })
    }
    prevOrderCount.current = count
  }, [orders])

  // Detect deliveries → sound + ticker; limpiar newDeliveryIds siempre para no dejar confetti/estilo persistente
  useEffect(() => {
    newDeliveryIds.forEach((id) => {
      if (!soundPlayed.current.has(id)) {
        soundPlayed.current.add(id)

        const order = orders.find((o) => o.id === id)
        if (order) {
          // "Reciente" = tiempo en etapa entregado <= ventana (no elapsed desde creación)
          const timeInEntregado = order.elapsed - STAGE_MS_ENTREGADO
          const isRecentDelivery =
            order.stage === 'entregado' && timeInEntregado <= RECENT_DELIVERY_WINDOW_MS

          if (isRecentDelivery) {
            if (stimulusGateRef.current.tryFire('coin')) {
              playCoinSound()
            }
            setTickerEvents((prev) => [
              {
                id: `del-${id}`,
                text: `Entregado #${order.numero_pedido} · +${formatGs(order.total)}`,
                emoji: tickerEmojiByTotal(order.total, true),
                ts: Date.now(),
                total: order.total,
                isDelivery: true,
              },
              ...prev,
            ].slice(0, 20))
          }
        }
        // Siempre notificar para quitar id de newDeliveryIds y evitar confetti/estilo en entregas viejas
        onDeliveryAnimated(id)
      }
    })
  }, [newDeliveryIds, orders, onDeliveryAnimated])

  // Record breaker: solo mostrar banner cuando se supera un récord anterior (bestRevenueRef > 0) para no mostrar al abrir
  useEffect(() => {
    if (stats.todayRevenue > prevRevenueRef.current) {
      if (stats.todayRevenue > bestRevenueRef.current && bestRevenueRef.current > 0) {
        bestRevenueRef.current = stats.todayRevenue
        setRecord('¡NUEVO RÉCORD DE FACTURACIÓN!')
        setTimeout(() => setRecord(null), 4000)
      }
      if (bestRevenueRef.current === 0) {
        bestRevenueRef.current = stats.todayRevenue
      }
      prevRevenueRef.current = stats.todayRevenue
    }
  }, [stats.todayRevenue])

  // Streak decay
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastOrderTime.current
      if (elapsed > 5 * 60_000 && streak > 0) {
        setStreak(0)
      }
    }, 5_000)
    return () => clearInterval(interval)
  }, [streak])

  // Si no hay pedidos activos, no tiene sentido mostrar combo
  useEffect(() => {
    if (orders.length === 0 || stats.activeCount === 0) {
      setStreak(0)
    }
  }, [orders.length, stats.activeCount])

  // Report streak to parent
  useEffect(() => {
    onStreakChange?.(streak)
  }, [streak, onStreakChange])

  // Ticker al subir racha (3, 5, 8, 10)
  useEffect(() => {
    if (streak < 3 || streak <= prevStreakRef.current) {
      prevStreakRef.current = streak
      return
    }
    const prev = prevStreakRef.current
    prevStreakRef.current = streak
    const thresholds = [3, 5, 8, 10] as const
    const hit = thresholds.find((t) => streak >= t && prev < t)
    if (hit) {
      setTickerEvents((prevEvents) => [
        {
          id: `combo-${hit}-${Date.now()}`,
          text: `Combo x${hit} – ${hit} pedidos al hilo sin pausa`,
          emoji: hit >= 10 ? '👑' : hit >= 5 ? '🔥' : '⚡',
          ts: Date.now(),
        },
        ...prevEvents,
      ].slice(0, 20))
    }
  }, [streak])

  // Compute pedidos/hora
  const pedidosHora = useMemo(() => {
    const now = new Date()
    const hoursElapsed = now.getHours() + now.getMinutes() / 60
    if (hoursElapsed < 0.5) return stats.todayTotal
    return Math.round(stats.todayTotal / hoursElapsed)
  }, [stats.todayTotal])

  const ticketPromedio = useMemo(() => {
    if (stats.todayTotal <= 0) return 0
    return Math.round(stats.todayRevenue / stats.todayTotal)
  }, [stats.todayRevenue, stats.todayTotal])

  useEffect(() => {
    const next = {
      pedidos: stats.todayTotal,
      facturado: stats.todayRevenue,
      entregados: stats.deliveredCount,
      ticket: ticketPromedio,
    }
    const prev = prevKpiRef.current
    const pulses = {
      pedidos: next.pedidos > prev.pedidos,
      facturado: next.facturado > prev.facturado,
      entregados: next.entregados > prev.entregados,
      ticket: next.ticket > prev.ticket,
    }
    if (pulses.pedidos || pulses.facturado || pulses.entregados || pulses.ticket) {
      setKpiFlash(pulses)
      setKpiDeltaPop({
        pedidos: pulses.pedidos ? `+${next.pedidos - prev.pedidos}` : null,
        facturado: pulses.facturado
          ? `+Gs. ${(next.facturado - prev.facturado).toLocaleString('es-PY')}`
          : null,
        entregados: pulses.entregados ? `+${next.entregados - prev.entregados}` : null,
        ticket:
          pulses.ticket && next.ticket > prev.ticket
            ? `▲ Gs. ${(next.ticket - prev.ticket).toLocaleString('es-PY')}`
            : null,
      })
      const tFlash = setTimeout(
        () => setKpiFlash({ pedidos: false, facturado: false, entregados: false, ticket: false }),
        520
      )
      const tPop = setTimeout(
        () =>
          setKpiDeltaPop({
            pedidos: null,
            facturado: null,
            entregados: null,
            ticket: null,
          }),
        820
      )
      prevKpiRef.current = next
      return () => {
        clearTimeout(tFlash)
        clearTimeout(tPop)
      }
    }
    prevKpiRef.current = next
  }, [stats.todayTotal, stats.todayRevenue, stats.deliveredCount, ticketPromedio])

  const desktopSizing = useMemo(() => {
    // Reserva espacio real para: navbar global + paddings + ticker + header interno.
    // Con esto el kanban siempre entra en viewport y el ticker queda visible.
    const kanbanHeight = Math.max(260, Math.min(610, Math.round(viewportHeight - 315)))
    // El grid desktop usa padding vertical (`p-2.5` => 20px totales).
    // Si el minHeight del stage excede el alto útil interno, se recorta el footer.
    const stageMinHeight = Math.max(220, kanbanHeight - 20)
    if (viewportHeight <= 760) {
      return {
        compact: true,
        stageMinHeight,
        kanbanHeight,
        orderCardMinHeight: 76,
        targetVisibleCards: 2,
        headerPad: 'px-2.5 py-2',
      }
    }
    if (viewportHeight <= 900) {
      return {
        compact: true,
        stageMinHeight,
        kanbanHeight,
        orderCardMinHeight: 88,
        targetVisibleCards: 3,
        headerPad: 'px-3 py-2',
      }
    }
    return {
      compact: false,
      stageMinHeight,
      kanbanHeight,
      orderCardMinHeight: 100,
      targetVisibleCards: 4,
      headerPad: 'px-3 py-2.5',
    }
  }, [viewportHeight])

  const groups = useMemo(() => {
    const g: Record<KitchenStage, KitchenOrder[]> = {
      nuevo: [],
      cocinando: [],
      empacando: [],
      entregado: [],
    }
    orders.forEach((o) => {
      const effectiveStage = stageOverrides?.[o.id] ?? o.stage
      g[effectiveStage].push({ ...o, stage: effectiveStage })
    })
    return g
  }, [orders, stageOverrides])

  const filteredGroups = useMemo(() => {
    if (activeTypeFilter === 'all') return groups
    return {
      nuevo: groups.nuevo.filter((o) => o.tipo === activeTypeFilter),
      cocinando: groups.cocinando.filter((o) => o.tipo === activeTypeFilter),
      empacando: groups.empacando.filter((o) => o.tipo === activeTypeFilter),
      entregado: groups.entregado.filter((o) => o.tipo === activeTypeFilter),
    } satisfies Record<KitchenStage, KitchenOrder[]>
  }, [activeTypeFilter, groups])

  const handleConfettiDone = useCallback(
    (stage: KitchenStage) => {
      groups[stage].forEach((o) => {
        if (newDeliveryIds.includes(o.id)) {
          onDeliveryAnimated(o.id)
        }
      })
    },
    [groups, newDeliveryIds, onDeliveryAnimated]
  )

  const hasNewDeliveryInStage = (stage: KitchenStage) =>
    filteredGroups[stage].some((o) => newDeliveryIds.includes(o.id))


  const handleTabletScroll = useCallback(() => {
    const node = tabletPagerRef.current
    if (!node) return
    const page = Math.round(node.scrollLeft / Math.max(node.clientWidth, 1))
    setTabletPage(Math.min(1, Math.max(0, page)))
  }, [])

  return (
    <div className="h-full w-full flex flex-col min-w-0">
      {/* ─── Top Bar: negocio (izq) + energía (der) ─── */}
      <div className={`${isKitchenKpiDesktop ? `${desktopSizing.headerPad} pr-32 xl:pr-36` : 'px-4 py-3'} border-b border-gray-100 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/80`}>
        {isKitchenKpiDesktop && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5 mb-2">
            <div className={`relative overflow-hidden rounded-lg border border-orange-300/70 dark:border-orange-700/50 bg-gradient-to-br from-orange-50 via-orange-100/70 to-amber-50 dark:from-orange-900/30 dark:via-orange-900/20 dark:to-amber-900/20 px-2.5 py-1.5 shadow-[0_0_0_1px_rgba(251,146,60,0.15),0_8px_18px_-12px_rgba(251,146,60,0.65)] ${kpiFlash.pedidos ? 'animate-celebrate' : ''}`}>
              {kpiDeltaPop.pedidos && (
                <span className="absolute left-1/2 top-2 z-30 pointer-events-none text-[11px] font-black text-orange-600 dark:text-orange-300 drop-shadow-sm whitespace-nowrap animate-kpi-pop-float">
                  {kpiDeltaPop.pedidos}
                </span>
              )}
              <div className="absolute right-1.5 top-1 text-sm opacity-80">📋</div>
              {kpiFlash.pedidos && <div className="absolute inset-0 bg-orange-300/20 animate-pulse pointer-events-none" />}
              <p className="text-[10px] font-bold tracking-wide text-orange-700 dark:text-orange-300">PEDIDOS DEL DÍA</p>
              <p className="text-[15px] leading-5 font-black text-orange-800 dark:text-orange-100 tabular-nums">{stats.todayTotal.toLocaleString('es-PY')}</p>
              <div className="mt-1 h-1 rounded-full bg-orange-200/80 dark:bg-orange-800/60 overflow-hidden">
                <div className="h-full w-2/3 bg-gradient-to-r from-orange-500 to-amber-400" />
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-lg border border-emerald-300/70 dark:border-emerald-700/50 bg-gradient-to-br from-emerald-50 via-emerald-100/70 to-green-50 dark:from-emerald-900/30 dark:via-emerald-900/20 dark:to-green-900/20 px-2.5 py-1.5 shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_8px_18px_-12px_rgba(16,185,129,0.65)] ${kpiFlash.facturado ? 'animate-celebrate' : ''}`}>
              {kpiDeltaPop.facturado && (
                <span className="absolute left-1/2 top-2 z-30 pointer-events-none text-[10px] font-black text-emerald-600 dark:text-emerald-300 drop-shadow-sm whitespace-nowrap animate-kpi-pop-float">
                  {kpiDeltaPop.facturado}
                </span>
              )}
              <div className="absolute right-1.5 top-1 text-sm opacity-80">💰</div>
              {kpiFlash.facturado && <div className="absolute inset-0 bg-emerald-300/20 animate-pulse pointer-events-none" />}
              <p className="text-[10px] font-bold tracking-wide text-emerald-700 dark:text-emerald-300">FACTURADO</p>
              <p className="text-[15px] leading-5 font-black text-emerald-800 dark:text-emerald-100 tabular-nums">{formatGs(stats.todayRevenue)}</p>
              <div className="mt-1 h-1 rounded-full bg-emerald-200/80 dark:bg-emerald-800/60 overflow-hidden">
                <div className="h-full w-4/5 bg-gradient-to-r from-emerald-500 to-lime-400" />
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-lg border border-yellow-300/70 dark:border-yellow-700/50 bg-gradient-to-br from-yellow-50 via-yellow-100/70 to-amber-50 dark:from-yellow-900/30 dark:via-yellow-900/20 dark:to-amber-900/20 px-2.5 py-1.5 shadow-[0_0_0_1px_rgba(245,158,11,0.15),0_8px_18px_-12px_rgba(245,158,11,0.65)] ${kpiFlash.entregados ? 'animate-celebrate' : ''}`}>
              {kpiDeltaPop.entregados && (
                <span className="absolute left-1/2 top-2 z-30 pointer-events-none text-[11px] font-black text-yellow-700 dark:text-yellow-200 drop-shadow-sm whitespace-nowrap animate-kpi-pop-float">
                  {kpiDeltaPop.entregados}
                </span>
              )}
              <div className="absolute right-1.5 top-1 text-sm opacity-80">✅</div>
              {kpiFlash.entregados && <div className="absolute inset-0 bg-yellow-300/20 animate-pulse pointer-events-none" />}
              <p className="text-[10px] font-bold tracking-wide text-yellow-700 dark:text-yellow-300">ENTREGADOS</p>
              <p className="text-[15px] leading-5 font-black text-yellow-800 dark:text-yellow-100 tabular-nums">{stats.deliveredCount.toLocaleString('es-PY')}</p>
              <div className="mt-1 h-1 rounded-full bg-yellow-200/80 dark:bg-yellow-800/60 overflow-hidden">
                <div className="h-full w-3/4 bg-gradient-to-r from-yellow-500 to-orange-400" />
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-lg border border-violet-300/70 dark:border-violet-700/50 bg-gradient-to-br from-violet-50 via-violet-100/70 to-fuchsia-50 dark:from-violet-900/30 dark:via-violet-900/20 dark:to-fuchsia-900/20 px-2.5 py-1.5 shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_18px_-12px_rgba(139,92,246,0.65)] ${kpiFlash.ticket ? 'animate-celebrate' : ''}`}>
              {kpiDeltaPop.ticket && (
                <span className="absolute left-1/2 top-2 z-30 pointer-events-none text-[10px] font-black text-violet-600 dark:text-violet-200 drop-shadow-sm whitespace-nowrap animate-kpi-pop-float">
                  {kpiDeltaPop.ticket}
                </span>
              )}
              <div className="absolute right-1.5 top-1 text-sm opacity-80">🧾</div>
              {kpiFlash.ticket && <div className="absolute inset-0 bg-violet-300/20 animate-pulse pointer-events-none" />}
              <p className="text-[10px] font-bold tracking-wide text-violet-700 dark:text-violet-300">TICKET PROM.</p>
              <p className="text-[15px] leading-5 font-black text-violet-800 dark:text-violet-100 tabular-nums">{formatGs(ticketPromedio)}</p>
              <div className="mt-1 h-1 rounded-full bg-violet-200/80 dark:bg-violet-800/60 overflow-hidden">
                <div className="h-full w-3/5 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={isKitchenKpiDesktop ? 'text-base' : 'text-lg'}>🔥</span>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 dark:text-gray-400 font-semibold uppercase tracking-wider">En cocina</span>
              <span className={`${isKitchenKpiDesktop ? 'text-base' : 'text-lg'} font-black text-gray-900 dark:text-gray-100 tabular-nums`}>{stats.activeCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={isKitchenKpiDesktop ? 'text-lg' : 'text-xl'}>⚡</span>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 dark:text-gray-400 font-semibold uppercase tracking-wider">Ritmo (ped/h)</span>
              <span className={`${isKitchenKpiDesktop ? 'text-base' : 'text-lg'} font-black text-gray-900 dark:text-gray-100 tabular-nums`}>{pedidosHora}</span>
            </div>
          </div>
        </div>
        <div className={`flex items-center ${isKitchenKpiDesktop ? 'gap-2' : 'gap-3'} flex-wrap`}>
          {streak >= 3 && stats.activeCount > 0 && (
            <ComboBadge streak={streak} lastOrderTime={lastOrderTime.current} />
          )}
        </div>
        </div>
      </div>

      {/* ─── Contenido: kanban + ticker ─── */}
      <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col relative">
        {/* Stage tabs removed for mobile — all 4 columns are now always visible */}

        {showTypeFilters && (
          <div className="px-2.5 pb-2">
            <div className="relative w-full">
              <div className="w-full overflow-x-auto scroll-smooth snap-x snap-mandatory custom-scrollbar pb-0.5">
                <div className="inline-flex min-w-max gap-2 pr-8">
                {([
                  { id: 'all', label: 'Todos' },
                  { id: 'delivery', label: 'Delivery' },
                  { id: 'local', label: 'Local' },
                  { id: 'para_llevar', label: 'Para llevar' },
                ] as const).map((opt) => {
                  const active = activeTypeFilter === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setActiveTypeFilter(opt.id)}
                      className={`snap-start shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
                </div>
              </div>
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/90 dark:from-gray-900/90 to-transparent"
                aria-hidden
              />
            </div>
          </div>
        )}

        {record && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-[720px] px-3">
            <RecordBanner text={record} />
          </div>
        )}

        {isMobile ? (
          <div className="flex-1 w-full min-w-0 grid grid-cols-4 grid-rows-1 gap-1 px-1.5 pb-1.5 overflow-hidden min-h-0">
            {KITCHEN_STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                orders={
                  stage === 'entregado'
                    ? filteredGroups[stage].slice(0, MOBILE_MAX_DELIVERED)
                    : filteredGroups[stage]
                }
                hasNewDelivery={hasNewDeliveryInStage(stage)}
                hasNewOrder={newOrderStages.has(stage)}
                showConfettiBurst={!hasNewDeliveryInStage(stage) || stage !== 'entregado' || deliveryConfettiOk}
                compact
                ultraCompact
                onConfettiDone={() => handleConfettiDone(stage)}
                onOrderClick={onOrderClick}
              />
            ))}
          </div>
        ) : isKanbanPager ? (
          <div className="flex-1 w-full min-w-0 overflow-hidden min-h-0 px-3 pb-2">
            <div
              ref={tabletPagerRef}
              onScroll={handleTabletScroll}
              className="flex w-full min-w-full gap-3 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth h-full"
            >
              {[['nuevo', 'cocinando'], ['empacando', 'entregado']].map((pair, i) => (
                <div
                  key={i}
                  className="snap-start shrink-0 w-full min-w-full grid grid-cols-2 gap-3 h-full"
                >
                  {pair.map((stage) => {
                    const stageKey = stage as KitchenStage
                    return (
                      <StageColumn
                        key={stageKey}
                        stage={stageKey}
                        orders={filteredGroups[stageKey]}
                        hasNewDelivery={hasNewDeliveryInStage(stageKey)}
                        hasNewOrder={newOrderStages.has(stageKey)}
                        showConfettiBurst={
                          !hasNewDeliveryInStage(stageKey) || stageKey !== 'entregado' || deliveryConfettiOk
                        }
                        onConfettiDone={() => handleConfettiDone(stageKey)}
                        onOrderClick={onOrderClick}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-1.5 pt-2">
              {[0, 1].map((dot) => (
                <span
                  key={dot}
                  className={`h-1.5 rounded-full transition-all ${tabletPage === dot ? 'w-5 bg-gray-700 dark:bg-gray-200' : 'w-1.5 bg-gray-300 dark:bg-gray-600'}`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div
            className="w-full min-w-0 grid grid-cols-4 gap-2.5 p-2.5 overflow-x-auto overflow-y-hidden min-h-0 flex-none"
            style={{ height: `${desktopSizing.kanbanHeight}px` }}
          >
            {KITCHEN_STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                orders={filteredGroups[stage]}
                hasNewDelivery={hasNewDeliveryInStage(stage)}
                hasNewOrder={newOrderStages.has(stage)}
                showConfettiBurst={
                  !hasNewDeliveryInStage(stage) || stage !== 'entregado' || deliveryConfettiOk
                }
                compact={desktopSizing.compact}
                minHeight={desktopSizing.stageMinHeight}
                orderCardMinHeight={desktopSizing.orderCardMinHeight}
                targetVisibleCards={desktopSizing.targetVisibleCards}
                onConfettiDone={() => handleConfettiDone(stage)}
                onOrderClick={onOrderClick}
              />
            ))}
          </div>
        )}

        {isMobile ? (
          <div className="px-3 pb-3 flex-shrink-0">
            <button
              onClick={() => setIsTickerCollapsed((prev) => !prev)}
              className="w-full mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-300 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/80"
            >
              {isTickerCollapsed ? 'Mostrar actividad' : 'Ocultar actividad'}
            </button>
            {!isTickerCollapsed && <ActivityTicker events={tickerEvents} />}
          </div>
        ) : (
          <div className="px-2.5 pb-0.5 pt-0 mt-1 flex-shrink-0">
            <ActivityTicker events={tickerEvents} />
          </div>
        )}
      </div>
    </div>
  )
}
