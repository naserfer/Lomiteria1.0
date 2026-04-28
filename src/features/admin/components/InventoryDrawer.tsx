'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X, PlusCircle, Search, Trash2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { IngredientDefinition } from '@/types/ingredients'

type Operation = 'entrada' | 'salida' | 'ajuste'
const INGREDIENT_CATEGORY_NAME = 'Insumos Base'

/** Formatea número con separador de miles (punto) y decimales (coma). Ej: 1000 → "1.000", 1500.5 → "1.500,5" */
function formatNumberWithThousands(value: number): string {
  if (Number.isNaN(value) || value === null || value === undefined) return '0'
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  const [intPart, decPart] = num.toString().split('.')
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decPart != null && decPart !== '' ? `${intFormatted},${decPart}` : intFormatted
}

/** Parsea string formateado (1.000 o 1.000,5) a número */
function parseFormattedNumber(str: string): number {
  if (!str || typeof str !== 'string') return 0
  const normalized = str.trim().replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

interface InventoryDrawerProps {
  open: boolean
  onClose: () => void
  tenantId: string
  usuarioId: string | null
  onSaved?: () => void
}

export function InventoryDrawer({ open, onClose, tenantId, usuarioId, onSaved }: InventoryDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [ingredients, setIngredients] = useState<IngredientDefinition[]>([])
  const [loadingIngredients, setLoadingIngredients] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState<string>('')
  const [operation, setOperation] = useState<Operation>('entrada')
  const [quantity, setQuantity] = useState<number>(0)
  const [stockMin, setStockMin] = useState<number>(0)
  const [precioPublico, setPrecioPublico] = useState<number>(0)
  const [controlStock, setControlStock] = useState(true)
  const [permiteExtraEnCarrito, setPermiteExtraEnCarrito] = useState(false)
  const [tipoRecargoExtra, setTipoRecargoExtra] = useState<'' | 'estandar' | 'proteina'>('')
  const [note, setNote] = useState('')
  const [currentStock, setCurrentStock] = useState<number | null>(null)
  const [currentProductId, setCurrentProductId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    let isMounted = true
    const loadIngredients = async () => {
      const supabase = createClient()
      setLoadingIngredients(true)
      const { data, error } = await supabase
        .from('ingredientes')
        .select(
          'id, tenant_id, slug, nombre, unidad, tipo_inventario, icono, precio_publico, tipo_recargo_extra, stock_actual, stock_minimo, stock_minimo_sugerido, controlar_stock, descripcion, activo, permite_extra_en_carrito'
        )
        .eq('tenant_id', tenantId)
        .eq('activo', true)
        .order('nombre')

      if (!isMounted) return

      if (error) {
        console.error('Error cargando ingredientes', error)
        setIngredients([])
      } else {
        setIngredients((data ?? []) as IngredientDefinition[])
      }
      setLoadingIngredients(false)
    }

    loadIngredients()

    return () => {
      isMounted = false
    }
  }, [open, tenantId])

  useEffect(() => {
    if (open && !selectedSlug && ingredients.length) {
      setSelectedSlug(ingredients[0].slug)
      setStockMin(Number(ingredients[0].stock_minimo ?? ingredients[0].stock_minimo_sugerido ?? 0))
    }
  }, [open, selectedSlug, ingredients])

  useEffect(() => {
    if (!open) {
      setSelectedSlug('')
      setQuantity(0)
      setOperation('entrada')
      setCurrentStock(null)
      setCurrentProductId(null)
      setStockMin(0)
      setPrecioPublico(0)
      setControlStock(true)
      setPermiteExtraEnCarrito(false)
      setTipoRecargoExtra('')
      setNote('')
      setErrorMessage(null)
      setSearch('')
      setShowDeleteConfirm(false)
    }
  }, [open])

  const handleConfirmDelete = async () => {
    if (!selectedIngredient) return
    setIsDeleting(true)
    setErrorMessage(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('ingredientes')
        .update({ activo: false })
        .eq('id', selectedIngredient.id)
        .eq('tenant_id', tenantId)

      if (error) throw error
      setShowDeleteConfirm(false)
      onSaved?.()
      onClose()
    } catch (err: unknown) {
      console.error('Error al eliminar materia prima:', err)
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo eliminar la materia prima')
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredIngredients = useMemo(() => {
    if (!search.trim()) return ingredients
    const query = search.toLowerCase()
    return ingredients.filter((ingredient) => ingredient.nombre.toLowerCase().includes(query))
  }, [ingredients, search])

  const selectedIngredient = useMemo(
    () => ingredients.find((ingredient) => ingredient.slug === selectedSlug) ?? null,
    [ingredients, selectedSlug]
  )

  useEffect(() => {
    if (!selectedIngredient || !open) {
      setCurrentStock(null)
      setCurrentProductId(null)
      setPrecioPublico(0)
      return
    }

    const loadInventory = async () => {
      const supabase = createClient()
      setLoadingInventory(true)
      setErrorMessage(null)

      const productId = await ensureIngredientProduct(selectedIngredient, {
        tenantId,
        createIfMissing: false
      })

      setCurrentProductId(productId)

      if (!productId) {
        setCurrentStock(Number(selectedIngredient.stock_actual ?? 0))
        setStockMin(Number(selectedIngredient.stock_minimo ?? selectedIngredient.stock_minimo_sugerido ?? 0))
        setPrecioPublico(Math.max(0, Math.round(Number(selectedIngredient.precio_publico ?? 0))))
        setControlStock(Boolean(selectedIngredient.controlar_stock ?? true))
        setPermiteExtraEnCarrito(Boolean(selectedIngredient.permite_extra_en_carrito))
        setTipoRecargoExtra(
          selectedIngredient.tipo_recargo_extra === 'estandar' ||
            selectedIngredient.tipo_recargo_extra === 'proteina'
            ? selectedIngredient.tipo_recargo_extra
            : ''
        )
        setLoadingInventory(false)
        return
      }

      const { data, error } = await supabase
        .from('inventario')
        .select('id, stock_actual, stock_minimo, unidad, controlar_stock')
        .eq('tenant_id', tenantId)
        .eq('producto_id', productId)
        .maybeSingle()

      if (error) {
        console.error('Error cargando inventario', error)
        setErrorMessage('No se pudo cargar la información del inventario.')
      } else if (data) {
        setCurrentStock(Number(data.stock_actual ?? 0))
        setStockMin(Number(selectedIngredient.stock_minimo ?? data.stock_minimo ?? selectedIngredient.stock_minimo_sugerido ?? 0))
        setPrecioPublico(Math.max(0, Math.round(Number(selectedIngredient.precio_publico ?? 0))))
        setControlStock(Boolean(data.controlar_stock))
        setPermiteExtraEnCarrito(Boolean(selectedIngredient.permite_extra_en_carrito))
        setTipoRecargoExtra(
          selectedIngredient.tipo_recargo_extra === 'estandar' ||
            selectedIngredient.tipo_recargo_extra === 'proteina'
            ? selectedIngredient.tipo_recargo_extra
            : ''
        )
      } else {
        setCurrentStock(Number(selectedIngredient.stock_actual ?? 0))
        setStockMin(Number(selectedIngredient.stock_minimo ?? selectedIngredient.stock_minimo_sugerido ?? 0))
        setPrecioPublico(Math.max(0, Math.round(Number(selectedIngredient.precio_publico ?? 0))))
        setControlStock(Boolean(selectedIngredient.controlar_stock ?? true))
        setPermiteExtraEnCarrito(Boolean(selectedIngredient.permite_extra_en_carrito))
        setTipoRecargoExtra(
          selectedIngredient.tipo_recargo_extra === 'estandar' ||
            selectedIngredient.tipo_recargo_extra === 'proteina'
            ? selectedIngredient.tipo_recargo_extra
            : ''
        )
      }

      setLoadingInventory(false)
    }

    loadInventory()
  }, [selectedIngredient, tenantId, open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const supabase = createClient()
    event.preventDefault()
    setErrorMessage(null)

    if (!selectedIngredient) {
      setErrorMessage('Selecciona un ingrediente')
      return
    }

    const tipoOriginal =
      selectedIngredient.tipo_recargo_extra === 'estandar' ||
      selectedIngredient.tipo_recargo_extra === 'proteina'
        ? selectedIngredient.tipo_recargo_extra
        : ''
    const ingredientConfigChanged =
      Boolean(selectedIngredient.permite_extra_en_carrito) !== permiteExtraEnCarrito ||
      Number(selectedIngredient.stock_minimo ?? selectedIngredient.stock_minimo_sugerido ?? 0) !== stockMin ||
      Number(selectedIngredient.precio_publico ?? 0) !== precioPublico ||
      Boolean(selectedIngredient.controlar_stock ?? true) !== controlStock ||
      tipoOriginal !== tipoRecargoExtra
    const hasStockMovement = operation === 'ajuste'
      ? quantity !== (currentStock ?? 0)
      : quantity > 0

    if (!hasStockMovement && !ingredientConfigChanged) {
      setErrorMessage('No hay cambios para guardar')
      return
    }

    setIsSaving(true)

    try {
      const previousStock = Number(currentStock ?? selectedIngredient.stock_actual ?? 0)
      if (!hasStockMovement) {
        const { error: updateOnlyIngredientError } = await supabase
          .from('ingredientes')
          .update({
            stock_minimo: stockMin,
            stock_minimo_sugerido: stockMin,
            precio_publico: precioPublico,
            controlar_stock: controlStock,
            permite_extra_en_carrito: permiteExtraEnCarrito,
            tipo_recargo_extra: permiteExtraEnCarrito ? tipoRecargoExtra || null : null
          })
          .eq('id', selectedIngredient.id)
          .eq('tenant_id', tenantId)

        if (updateOnlyIngredientError) throw updateOnlyIngredientError
        onSaved?.()
        onClose()
        return
      }

      const ensuredProductId = await ensureIngredientProduct(selectedIngredient, {
        tenantId,
        createIfMissing: true
      })

      if (!ensuredProductId) {
        throw new Error('No se pudo preparar el ingrediente en inventario')
      }

      setCurrentProductId(ensuredProductId)

      const { data: existing, error: fetchError } = await supabase
        .from('inventario')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('producto_id', ensuredProductId)
        .maybeSingle()

      if (fetchError) throw fetchError

      let inventoryId = existing?.id ?? null
      const previousStockInventory = Number(currentStock ?? selectedIngredient.stock_actual ?? existing?.stock_actual ?? 0)
      let newStock = previousStock

      switch (operation) {
        case 'entrada':
          newStock = previousStockInventory + quantity
          break
        case 'salida':
          newStock = Math.max(previousStockInventory - quantity, 0)
          break
        case 'ajuste':
          newStock = quantity
          break
      }

      const { error: updateIngredientError } = await supabase
        .from('ingredientes')
        .update({
          stock_actual: newStock,
          stock_minimo: stockMin,
          stock_minimo_sugerido: stockMin,
          precio_publico: precioPublico,
          controlar_stock: controlStock,
          permite_extra_en_carrito: permiteExtraEnCarrito,
          tipo_recargo_extra: permiteExtraEnCarrito ? tipoRecargoExtra || null : null
        })
        .eq('id', selectedIngredient.id)
        .eq('tenant_id', tenantId)

      if (updateIngredientError) throw updateIngredientError

      if (inventoryId) {
        const { error: updateError } = await supabase
          .from('inventario')
          .update({
            stock_actual: newStock,
            stock_minimo: stockMin,
            unidad: selectedIngredient.unidad,
            controlar_stock: controlStock
          })
          .eq('id', inventoryId)

        if (updateError) throw updateError
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('inventario')
          .insert({
            tenant_id: tenantId,
            producto_id: ensuredProductId,
            stock_actual: newStock,
            stock_minimo: stockMin,
            unidad: selectedIngredient.unidad,
            controlar_stock: controlStock
          })
          .select()
          .single()

        if (insertError) throw insertError
        inventoryId = inserted.id
      }

      await supabase.from('movimientos_inventario').insert({
        inventario_id: inventoryId,
        tipo: operation,
        cantidad: operation === 'salida' ? -quantity : quantity,
        stock_anterior: previousStockInventory,
        stock_nuevo: newStock,
        motivo: note || `Carga manual de ${selectedIngredient.nombre}`,
        usuario_id: usuarioId ?? undefined
      })

      onSaved?.()
      onClose()
    } catch (error: any) {
      console.error('Error guardando inventario', error)
      setErrorMessage(error?.message ?? 'Ocurrió un error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open || !mounted) return null

  const noIngredientsAvailable = !loadingIngredients && ingredients.length === 0

  const modalContent = (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Overlay: cubre todo el viewport, clic cierra */}
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-default border-0 bg-black/70 backdrop-blur-sm focus:outline-none"
        onClick={() => !isSaving && onClose()}
        aria-label="Cerrar"
        tabIndex={-1}
      />
      {/* Contenedor de centrado */}
      <div className="relative z-10 flex h-full items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white dark:bg-gray-900 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-modal-title"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/40">
                <PlusCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 id="stock-modal-title" className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  Cargar stock
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Agregar o ajustar stock de materias primas existentes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <form
            id="inventory-form"
            onSubmit={handleSubmit}
            className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6"
          >
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Ingrediente
            </label>
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-900">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar huevos, pan, queso..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
            </div>
            {loadingIngredients ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando ingredientes...
              </div>
            ) : noIngredientsAvailable ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                No hay ingredientes configurados para este tenant. Crealos desde el panel de administración.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {filteredIngredients.map((ingredient) => (
                  <button
                    type="button"
                    key={ingredient.slug}
                    onClick={() => {
                      setSelectedSlug(ingredient.slug)
                      setStockMin(Number(ingredient.stock_minimo ?? ingredient.stock_minimo_sugerido ?? 0))
                    }}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      selectedSlug === ingredient.slug
                        ? 'border-orange-500 bg-orange-50 text-orange-900'
                        : 'border-gray-200 hover:border-orange-200'
                    }`}
                  >
                    <span className="text-2xl">{ingredient.icono ?? '🥙'}</span>
                    <div>
                      <p className="text-sm font-semibold">{ingredient.nombre}</p>
                      {ingredient.descripcion && (
                        <p className="text-[11px] text-gray-500">{ingredient.descripcion}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {loadingInventory && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Buscando inventario...
              </p>
            )}
          </div>

          {selectedIngredient && (
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-4">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Resumen rápido
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Stock actual</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {currentStock !== null
                      ? `${currentStock.toLocaleString()} ${selectedIngredient.unidad}`
                      : 'Sin registro'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Stock mínimo sugerido</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {stockMin} {selectedIngredient.unidad}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Las ventas descuentan automáticamente según las recetas del POS.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Operación
            </label>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {(['entrada', 'salida', 'ajuste'] as Operation[]).map((op) => (
                <button
                  type="button"
                  key={op}
                  onClick={() => setOperation(op)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                    operation === op
                      ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/30'
                      : 'border-gray-200 text-gray-600 hover:border-orange-300'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Cantidad
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formatNumberWithThousands(quantity)}
                onChange={(e) => setQuantity(parseFormattedNumber(e.target.value))}
                onBlur={(e) => {
                  const v = parseFormattedNumber(e.target.value)
                  if (v >= 0) setQuantity(v)
                }}
                placeholder="0"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 [appearance:textfield]"
                required
              />
            </div>

            {selectedIngredient && (
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Unidad
                </label>
                <div className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">
                  {selectedIngredient.unidad.toUpperCase()}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Stock mínimo
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formatNumberWithThousands(stockMin)}
                onChange={(e) => setStockMin(parseFormattedNumber(e.target.value))}
                onBlur={(e) => {
                  const v = parseFormattedNumber(e.target.value)
                  if (v >= 0) setStockMin(v)
                }}
                placeholder="0"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 [appearance:textfield]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Precio extra en carrito (Gs.)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formatNumberWithThousands(precioPublico)}
              onChange={(e) => setPrecioPublico(Math.max(0, Math.round(parseFormattedNumber(e.target.value))))}
              onBlur={(e) => {
                const v = Math.max(0, Math.round(parseFormattedNumber(e.target.value)))
                setPrecioPublico(v)
              }}
              placeholder="0"
              className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 [appearance:textfield]"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Se usa para cobrar el extra de este ingrediente en el POS.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="control-stock"
              type="checkbox"
              checked={controlStock}
              onChange={(e) => setControlStock(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="control-stock" className="text-sm text-gray-600 dark:text-gray-300">
              Descontar automáticamente cuando se confirme un pedido
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="permite-extra-carrito"
              type="checkbox"
              checked={permiteExtraEnCarrito}
              onChange={(e) => {
                const on = e.target.checked
                setPermiteExtraEnCarrito(on)
                if (!on) setTipoRecargoExtra('')
              }}
              className="h-5 w-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="permite-extra-carrito" className="text-sm text-gray-600 dark:text-gray-300">
              Permitir esta materia prima como extra en carrito
            </label>
          </div>

          {permiteExtraEnCarrito && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 space-y-2">
              <label className="block text-sm font-medium text-amber-900 dark:text-amber-200">
                Banda de precio en POS
              </label>
              <select
                value={tipoRecargoExtra}
                onChange={(e) =>
                  setTipoRecargoExtra(e.target.value as '' | 'estandar' | 'proteina')
                }
                disabled={isSaving}
                className="w-full rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
              >
                <option value="">Sin banda</option>
                <option value="estandar">Est&aacute;ndar (2k–3k t&iacute;p.)</option>
                <option value="proteina">Prote&iacute;na (~6k m&iacute;n.)</option>
              </select>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80">
                El precio extra sigue carg&aacute;ndose en la ficha del ingrediente; la banda ajusta al rango del local.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Nota / Referencia
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ej: Compra semanal en mayorista, lote, etc."
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
              {errorMessage}
            </p>
          )}
          </form>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800 px-6 py-4 pb-6">
            <div className="flex flex-col items-start gap-1 min-w-0">
              {selectedIngredient && currentStock !== null && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Stock después de la operación:{' '}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {operation === 'entrada'
                      ? (currentStock + quantity).toLocaleString()
                      : operation === 'salida'
                        ? Math.max(currentStock - quantity, 0).toLocaleString()
                        : quantity.toLocaleString()}{' '}
                    {selectedIngredient.unidad}
                  </span>
                </p>
              )}
              {selectedIngredient && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                  className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:underline focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed mt-0.5"
                >
                  Eliminar esta materia prima
                </button>
              )}
            </div>
            <button type="submit" form="inventory-form" className="hidden" />
            <button
              type="submit"
              form="inventory-form"
              disabled={isSaving || !selectedIngredient}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 active:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 shrink-0"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar movimiento
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para eliminar materia prima */}
      {showDeleteConfirm && selectedIngredient && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            className="relative w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 id="delete-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                Eliminar materia prima
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              ¿Está seguro de eliminar <strong className="text-gray-900 dark:text-white">&quot;{selectedIngredient.nombre}&quot;</strong>? Esta acción no se puede deshacer y la materia prima dejará de aparecer en el sistema.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}

async function ensureIngredientProduct(
  ingredient: IngredientDefinition,
  {
    tenantId,
    createIfMissing
  }: {
    tenantId: string
    createIfMissing: boolean
  }
): Promise<string | null> {
  const supabase = createClient()
  const { data: existing, error } = await supabase
    .from('productos')
    .select('id, categoria_id')
    .eq('tenant_id', tenantId)
    .eq('nombre', ingredient.nombre)
    .maybeSingle()

  if (error) {
    console.error('Error buscando producto de ingrediente', error)
    return null
  }

  if (existing?.id) return existing.id

  if (!createIfMissing) return null

  let categoriaId: string | null = null

  const { data: existingCategory } = await supabase
    .from('categorias')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('nombre', INGREDIENT_CATEGORY_NAME)
    .maybeSingle()

  if (existingCategory?.id) {
    categoriaId = existingCategory.id
  } else {
    const { data: insertedCategory, error: categoryError } = await supabase
      .from('categorias')
      .insert({
        tenant_id: tenantId,
        nombre: INGREDIENT_CATEGORY_NAME,
        descripcion: 'Insumos críticos para recetas',
        orden: 99,
        activa: true,
        mostrar_en_pos: false,
      })
      .select('id')
      .single()

    if (categoryError) {
      console.error('Error creando categoría de insumos', categoryError)
    } else {
      categoriaId = insertedCategory.id
    }
  }

  const { data: insertedProduct, error: productError } = await supabase
    .from('productos')
    .insert({
      tenant_id: tenantId,
      categoria_id: categoriaId,
      nombre: ingredient.nombre,
      descripcion: ingredient.descripcion ?? 'Insumo crítico para el menú',
      precio: 0,
      disponible: false
    })
    .select('id')
    .single()

  if (productError) {
    console.error('Error creando producto de insumo', productError)
    return null
  }

  return insertedProduct.id
}
