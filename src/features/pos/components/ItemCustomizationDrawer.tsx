'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { X, Loader2, Minus, Plus, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCartStore, type ComboProductItem, type CartItemCustomization } from '@/store/cartStore'
import { fetchProductRecipe, fetchTenantIngredients } from '@/lib/api/ingredients'
import type { IngredientDefinition, IngredientRequirement } from '@/types/ingredients'
import { formatGuaranies } from '@/lib/utils/format'
import { getExtrasPrecioRedondeModo, getExtrasPrecioRedondePaso } from '@/lib/env/posExtras'
import {
  type ExtrasPrecioTenantPolicy,
  extrasPolicyFromTenantRow,
  parseTipoRecargoExtra,
  resolvePrecioExtraPOS,
} from '@/lib/pos/extraPrecioPolicy'
import { useTenant } from '@/contexts/TenantContext'

interface ItemCustomizationDrawerProps {
  open: boolean
  itemId: string | null
  onClose: () => void
  darkMode?: boolean
}

const MAX_QUANTITY = 9

// ─── Hook compartido: lógica de edición de ingredientes ─────────────────────

function useIngredientEditor(
  tenantId: string | undefined,
  productoId: string | undefined,
  existingCustomization: CartItemCustomization | undefined,
  isActive: boolean,
  extrasPolicy: ExtrasPrecioTenantPolicy
) {
  const [baseRecipe, setBaseRecipe] = useState<IngredientRequirement[]>([])
  const [catalog, setCatalog] = useState<IngredientDefinition[]>([])
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const recipeSlugs = useMemo(() => new Set(baseRecipe.map((ing) => ing.slug)), [baseRecipe])

  const addableIngredients = useMemo(
    () =>
      catalog.filter(
        (ingredient) =>
          Boolean(ingredient.permite_extra_en_carrito) &&
          !recipeSlugs.has(ingredient.slug)
      ),
    [catalog, recipeSlugs]
  )

  // Cargar catálogo de ingredientes
  useEffect(() => {
    if (!isActive || !tenantId) return
    let active = true
    setCatalogLoading(true)
    fetchTenantIngredients(tenantId)
      .then((data) => { if (active) setCatalog(data) })
      .catch(() => { if (active) setCatalog([]) })
      .finally(() => { if (active) setCatalogLoading(false) })
    return () => { active = false }
  }, [isActive, tenantId])

  // Cargar receta del producto
  useEffect(() => {
    if (!isActive || !tenantId || !productoId) {
      setBaseRecipe([])
      return
    }
    let active = true
    setRecipeLoading(true)
    fetchProductRecipe(tenantId, productoId)
      .then((recipe) => { if (active) setBaseRecipe(recipe) })
      .catch(() => { if (active) setBaseRecipe([]) })
      .finally(() => { if (active) setRecipeLoading(false) })
    return () => { active = false }
  }, [isActive, tenantId, productoId])

  // Inicializar cantidades desde customización existente
  useEffect(() => {
    if (!isActive) return
    const cust = existingCustomization
    const next: Record<string, number> = {}
    baseRecipe.forEach((ing) => {
      const removed = cust?.removedIngredients.some((r) => r.slug === ing.slug)
      if (removed) { next[ing.slug] = 0; return }
      const extra = cust?.extras.find((e) => e.slug === ing.slug)
      const extraUnits = extra ? extra.quantityPerItem : 0
      next[ing.slug] = Math.min(MAX_QUANTITY, 1 + extraUnits)
    })
    addableIngredients.forEach((ing) => {
      const extra = cust?.extras.find((e) => e.slug === ing.slug)
      next[ing.slug] = Math.min(MAX_QUANTITY, extra?.quantityPerItem ?? 0)
    })
    setQuantities(next)
    setNotes(cust?.notes ?? '')
  }, [isActive, existingCustomization, baseRecipe, addableIngredients])

  const priceBySlug = useMemo(() => {
    const map: Record<string, number> = {}
    const step = getExtrasPrecioRedondePaso()
    const mode = getExtrasPrecioRedondeModo()
    catalog.forEach((ing) => {
      const raw = ing.precio_publico ?? 0
      map[ing.slug] = resolvePrecioExtraPOS({
        raw,
        tipoRecargo: parseTipoRecargoExtra(ing.tipo_recargo_extra),
        step,
        mode,
        policy: extrasPolicy,
      })
    })
    return map
  }, [catalog, extrasPolicy])

  const extraCostPerUnit = useMemo(() => {
    let sum = 0
    baseRecipe.forEach((ing) => {
      const qty = quantities[ing.slug] ?? 1
      if (qty > 1) {
        sum += (qty - 1) * (priceBySlug[ing.slug] ?? 0)
      }
    })
    addableIngredients.forEach((ing) => {
      const qty = quantities[ing.slug] ?? 0
      if (qty > 0) {
        sum += qty * (priceBySlug[ing.slug] ?? 0)
      }
    })
    return sum
  }, [baseRecipe, addableIngredients, quantities, priceBySlug])

  const changeQuantity = useCallback((slug: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[slug] ?? 1
      return { ...prev, [slug]: Math.max(0, Math.min(MAX_QUANTITY, current + delta)) }
    })
  }, [])

  const buildCustomization = useCallback((): { customization: CartItemCustomization | null; extraCost: number } => {
    const addableBySlug = new Map(addableIngredients.map((ing) => [ing.slug, ing]))
    const removedIngredients = baseRecipe
      .filter((ing) => (quantities[ing.slug] ?? 1) === 0)
      .map((ing) => ({ slug: ing.slug, label: ing.label }))

    const baseExtras = baseRecipe
      .filter((ing) => (quantities[ing.slug] ?? 1) > 1)
      .map((ing) => {
        const qty = quantities[ing.slug] ?? 1
        return {
          // `ingredienteId` es opcional en `IngredientRequirement`, pero lo agregamos
          // para mantener consistencia con `addableExtras`.
          ingredienteId: ing.ingredienteId,
          slug: ing.slug,
          label: ing.label,
          unit: ing.unit,
          quantityPerItem: qty - 1,
          unitPrice: priceBySlug[ing.slug] ?? 0
        }
      })

    const addableExtras = addableIngredients
      .filter((ing) => (quantities[ing.slug] ?? 0) > 0)
      .map((ing) => ({
        ingredienteId: ing.id,
        slug: ing.slug,
        label: ing.nombre,
        unit: ing.unidad,
        quantityPerItem: quantities[ing.slug] ?? 0,
        unitPrice: priceBySlug[ing.slug] ?? 0
      }))

    const extras = [...baseExtras, ...addableExtras]

    const resolvedRecipe: IngredientRequirement[] = baseRecipe
      .filter((ing) => (quantities[ing.slug] ?? 1) > 0)
      .map((ing) => ({ ...ing, quantityPerItem: ing.quantityPerItem * (quantities[ing.slug] ?? 1) }))
      .concat(
        extras
          .filter((extra) => addableBySlug.has(extra.slug))
          .map((extra) => ({
            ingredienteId: extra.ingredienteId,
            slug: extra.slug,
            label: extra.label,
            unit: extra.unit,
            quantityPerItem: extra.quantityPerItem
          }))
      )

    const hasChanges = removedIngredients.length > 0 || extras.length > 0 || notes.trim().length > 0
    if (!hasChanges) return { customization: null, extraCost: 0 }

    return {
      customization: { removedIngredients, extras, resolvedRecipe, notes: notes.trim() || undefined },
      extraCost: extraCostPerUnit
    }
  }, [baseRecipe, addableIngredients, quantities, priceBySlug, notes, extraCostPerUnit])

  const reset = useCallback(() => {
    setQuantities({})
    setNotes('')
    setBaseRecipe([])
  }, [])

  return {
    baseRecipe, addableIngredients, recipeLoading, catalogLoading, quantities, notes, setNotes,
    priceBySlug, extraCostPerUnit, changeQuantity, buildCustomization, reset,
    isReady: !recipeLoading && !catalogLoading
  }
}

// ─── UI de ingredientes reutilizable ────────────────────────────────────────

function IngredientEditorUI({
  baseRecipe, addableIngredients, recipeLoading, quantities, priceBySlug, changeQuantity,
  notes, setNotes, darkMode
}: {
  baseRecipe: IngredientRequirement[]
  addableIngredients: IngredientDefinition[]
  recipeLoading: boolean
  quantities: Record<string, number>
  priceBySlug: Record<string, number>
  changeQuantity: (slug: string, delta: number) => void
  notes: string
  setNotes: (v: string) => void
  darkMode?: boolean
}) {
  return (
    <>
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-500 mb-2">
          Ingredientes — sumar o quitar (+ suma al total)
        </p>
        {recipeLoading ? (
          <div className="flex items-center gap-2 py-4 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
          </div>
        ) : baseRecipe.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">Este producto no tiene receta base.</p>
        ) : (
          <div className="space-y-2">
            {baseRecipe.map((ing) => {
              const qty = quantities[ing.slug] ?? 1
              const unitPrice = priceBySlug[ing.slug] ?? 0
              const extraCost = qty > 1 ? (qty - 1) * unitPrice : 0
              return (
                <div
                  key={ing.slug}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${
                    qty > 0
                      ? darkMode
                        ? 'border-green-500/40 bg-green-500/10'
                        : 'border-green-200 bg-green-50'
                      : darkMode
                        ? 'border-gray-700 bg-gray-800/50 opacity-80'
                        : 'border-gray-200 bg-gray-100'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{ing.label}</p>
                    <p className="text-xs text-gray-500">
                      {ing.quantityPerItem}{ing.unit}
                      {unitPrice > 0 && (
                        <span className="ml-1">· +{formatGuaranies(unitPrice)} c/u</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => changeQuantity(ing.slug, -1)}
                      disabled={qty <= 0}
                      className="p-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700"
                      aria-label="Quitar una"
                    >
                      <Minus size={18} />
                    </button>
                    <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 font-bold tabular-nums">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(ing.slug, 1)}
                      disabled={qty >= MAX_QUANTITY}
                      className="p-2.5 rounded-xl border-2 border-orange-500 bg-orange-500 text-white disabled:opacity-40 disabled:bg-gray-400 disabled:border-gray-400"
                      aria-label="Sumar una"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  {extraCost > 0 && (
                    <p className="text-xs font-semibold text-orange-500 shrink-0">
                      +{formatGuaranies(extraCost)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-500 mb-2">
          Extras agregables
        </p>
        {addableIngredients.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">
            No hay materias primas habilitadas como extra.
          </p>
        ) : (
          <div className="space-y-2">
            {addableIngredients.map((ing) => {
              const qty = quantities[ing.slug] ?? 0
              const unitPrice = priceBySlug[ing.slug] ?? 0
              const extraCost = qty > 0 ? qty * unitPrice : 0
              return (
                <div
                  key={ing.slug}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${
                    qty > 0
                      ? darkMode
                        ? 'border-orange-500/40 bg-orange-500/10'
                        : 'border-orange-200 bg-orange-50'
                      : darkMode
                        ? 'border-gray-700 bg-gray-800/50'
                        : 'border-gray-200 bg-gray-100'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{ing.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {ing.unidad}
                      {unitPrice > 0 && <span className="ml-1">· +{formatGuaranies(unitPrice)} c/u</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => changeQuantity(ing.slug, -1)}
                      disabled={qty <= 0}
                      className="p-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700"
                      aria-label="Quitar extra"
                    >
                      <Minus size={18} />
                    </button>
                    <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 font-bold tabular-nums">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(ing.slug, 1)}
                      disabled={qty >= MAX_QUANTITY}
                      className="p-2.5 rounded-xl border-2 border-orange-500 bg-orange-500 text-white disabled:opacity-40 disabled:bg-gray-400 disabled:border-gray-400"
                      aria-label="Agregar extra"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  {extraCost > 0 && (
                    <p className="text-xs font-semibold text-orange-500 shrink-0">
                      +{formatGuaranies(extraCost)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas (ej: sin cortar)"
          className={`w-full rounded-xl px-3 py-2.5 text-sm border ${
            darkMode
              ? 'bg-gray-800 border-gray-700'
              : 'bg-gray-50 border-gray-200'
          } focus:outline-none focus:ring-2 focus:ring-orange-500`}
        />
      </div>
    </>
  )
}

// ─── Drawer principal ───────────────────────────────────────────────────────

export function ItemCustomizationDrawer({ open, itemId, onClose, darkMode }: ItemCustomizationDrawerProps) {
  const { tenant } = useTenant()
  const extrasPolicy = useMemo(() => extrasPolicyFromTenantRow(tenant), [tenant])
  const item = useCartStore((state) => state.items.find((it) => it.id === itemId))
  const updateCustomization = useCartStore((state) => state.updateItemCustomization)
  const updateComboProductCustomization = useCartStore((state) => state.updateComboProductCustomization)

  const isCombo = item?.tipo === 'combo' && Boolean(item.comboItems?.length)

  // ── Estado para combos: qué sub-producto se está editando ──
  const [editingComboProductId, setEditingComboProductId] = useState<string | null>(null)

  const editableComboProducts = useMemo(() =>
    item?.comboItems?.filter((ci) => ci.tiene_receta) ?? [],
    [item?.comboItems]
  )

  const editingComboProduct = useMemo(() =>
    item?.comboItems?.find((ci) => ci.producto_id === editingComboProductId),
    [item?.comboItems, editingComboProductId]
  )

  // ── Hook de ingredientes: para producto individual o sub-producto de combo ──
  const activeProductId = (isCombo ? editingComboProductId : item?.producto_id) ?? undefined
  const activeCustomization = isCombo
    ? editingComboProduct?.customization
    : item?.customization

  const editor = useIngredientEditor(
    tenant?.id,
    activeProductId,
    activeCustomization,
    open && Boolean(activeProductId),
    extrasPolicy
  )

  const { reset } = editor

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setEditingComboProductId(null)
      reset()
    }
  }, [open, reset])

  // Reset editor al cambiar de sub-producto en combo
  useEffect(() => {
    if (isCombo && editingComboProductId) {
      reset()
    }
  }, [isCombo, editingComboProductId, reset])

  if (!open || !item) return null

  // ── Guardar: producto individual ──
  const handleSaveProduct = () => {
    const { customization, extraCost } = editor.buildCustomization()
    updateCustomization(item.id, customization, extraCost)
    onClose()
  }

  // ── Guardar: sub-producto de combo ──
  const handleSaveComboProduct = () => {
    if (!editingComboProductId) return
    const { customization } = editor.buildCustomization()
    updateComboProductCustomization(item.id, editingComboProductId, customization)
    setEditingComboProductId(null)
  }

  // ── Función de resumen de customizaciones de un comboItem ──
  const renderComboProductSummary = (ci: ComboProductItem) => {
    if (!ci.customization) return null
    const { removedIngredients, extras } = ci.customization
    if (removedIngredients.length === 0 && extras.length === 0) return null
    return (
      <div className="mt-0.5 space-y-0.5">
        {removedIngredients.map((r) => (
          <div key={r.slug} className="text-red-400 text-[10px]">- {r.label}</div>
        ))}
        {extras.map((e) => (
          <div key={e.slug} className="text-green-500 text-[10px]">+ {e.label}{e.quantityPerItem > 1 ? ` (x${e.quantityPerItem})` : ''}</div>
        ))}
      </div>
    )
  }

  const lineTotal = (item.precio + (item.extraCostPerUnit ?? 0)) * item.cantidad

  // ── COMBO: vista selector de sub-producto ──
  if (isCombo && !editingComboProductId) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className={`relative ml-auto h-full w-full max-w-md flex flex-col shadow-2xl ${
          darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            darkMode ? 'border-gray-800' : 'border-gray-200'
          }`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold truncate">{item.nombre}</h2>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                  COMBO
                </span>
              </div>
              <p className="text-xs text-gray-500">{formatGuaranies(item.precio)}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full shrink-0 hover:bg-black/10" aria-label="Cerrar">
              <X size={22} />
            </button>
          </div>

          {/* Contenido del combo */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">
              Contenido del combo
            </p>

            {item.comboItems?.map((ci) => {
              const canEdit = ci.tiene_receta
              const hasCustom = ci.customization && (
                ci.customization.removedIngredients.length > 0 || ci.customization.extras.length > 0
              )
              return (
                <div
                  key={ci.producto_id}
                  className={`rounded-xl border p-3 ${
                    darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">
                        {ci.nombre}
                        {ci.cantidad > 1 && <span className="text-gray-500 ml-1">x{ci.cantidad}</span>}
                      </p>
                      {renderComboProductSummary(ci)}
                    </div>
                    {canEdit ? (
                      <button
                        onClick={() => setEditingComboProductId(ci.producto_id)}
                        className={`text-[11px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                          hasCustom
                            ? 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40'
                            : darkMode
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        Editar
                        <ChevronRight size={12} />
                      </button>
                    ) : (
                      <span className={`text-[10px] px-2 py-1 rounded ${
                        darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                      }`}>
                        Sin receta
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {editableComboProducts.length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">
                Ningún producto de este combo tiene receta editable.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className={`px-4 py-4 border-t ${
            darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex justify-between items-baseline mb-3 text-sm">
              <span className="text-gray-500">Total combo</span>
              <span className="text-xl font-bold text-orange-500">{formatGuaranies(lineTotal)}</span>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Listo
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Vista de edición de ingredientes (producto individual O sub-producto de combo) ──
  const isEditingComboChild = isCombo && Boolean(editingComboProductId)
  const headerTitle = isEditingComboChild ? editingComboProduct?.nombre ?? '' : item.nombre
  const headerSubtitle = isEditingComboChild
    ? `Parte de ${item.nombre}`
    : `Base ${formatGuaranies(item.precio)}`

  const handleSave = isEditingComboChild ? handleSaveComboProduct : handleSaveProduct
  const handleBack = isEditingComboChild ? () => setEditingComboProductId(null) : onClose

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative ml-auto h-full w-full max-w-md flex flex-col shadow-2xl ${
          darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${
            darkMode ? 'border-gray-800' : 'border-gray-200'
          }`}
        >
          {isEditingComboChild && (
            <button
              onClick={handleBack}
              className="p-2 rounded-full shrink-0 hover:bg-black/10 mr-1"
              aria-label="Volver"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold truncate">{headerTitle}</h2>
            <p className="text-xs text-gray-500">{headerSubtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full shrink-0 hover:bg-black/10"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>

        {/* Contenido: editor de ingredientes */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <IngredientEditorUI
            baseRecipe={editor.baseRecipe}
            addableIngredients={editor.addableIngredients}
            recipeLoading={editor.recipeLoading}
            quantities={editor.quantities}
            priceBySlug={editor.priceBySlug}
            changeQuantity={editor.changeQuantity}
            notes={editor.notes}
            setNotes={editor.setNotes}
            darkMode={darkMode}
          />
        </div>

        {/* Footer */}
        <div
          className={`px-4 py-4 border-t ${
            darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'
          }`}
        >
          {!isEditingComboChild && editor.extraCostPerUnit > 0 && (
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>Extras ingredientes</span>
              <span>+{formatGuaranies(editor.extraCostPerUnit)}</span>
            </div>
          )}
          {!isEditingComboChild && (
            <div className="flex justify-between items-baseline mb-3 text-sm">
              <span className="text-gray-500">Total</span>
              <span className="text-xl font-bold text-orange-500">
                {formatGuaranies((item.precio + editor.extraCostPerUnit) * item.cantidad)}
              </span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={!editor.isReady}
            className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {!editor.isReady ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check size={20} />
            )}
            {isEditingComboChild ? 'Guardar y volver' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
