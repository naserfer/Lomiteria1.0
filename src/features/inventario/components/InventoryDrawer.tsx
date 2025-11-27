'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X, PlusCircle, Search } from 'lucide-react'
import { supabase } from '@/core/supabase'
import type { IngredientDefinition } from '@/features/ingredientes/ingredients.types'

type Operation = 'entrada' | 'salida' | 'ajuste'
const INGREDIENT_CATEGORY_NAME = 'Insumos Base'

interface InventoryDrawerProps {
  open: boolean
  onClose: () => void
  tenantId: string
  usuarioId: string | null
  onSaved?: () => void
}

export function InventoryDrawer({ open, onClose, tenantId, usuarioId, onSaved }: InventoryDrawerProps) {
  const [ingredients, setIngredients] = useState<IngredientDefinition[]>([])
  const [loadingIngredients, setLoadingIngredients] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState<string>('')
  const [operation, setOperation] = useState<Operation>('entrada')
  const [quantity, setQuantity] = useState<number>(0)
  const [stockMin, setStockMin] = useState<number>(0)
  const [controlStock, setControlStock] = useState(true)
  const [note, setNote] = useState('')
  const [currentStock, setCurrentStock] = useState<number | null>(null)
  const [currentProductId, setCurrentProductId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return

    let isMounted = true
    const loadIngredients = async () => {
      setLoadingIngredients(true)
      const { data, error } = await supabase
        .from('ingredientes')
        .select(
          'id, tenant_id, slug, nombre, unidad, icono, precio_publico, stock_minimo_sugerido, descripcion, activo'
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
      setStockMin(ingredients[0].stock_minimo_sugerido ?? 0)
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
      setControlStock(true)
      setNote('')
      setErrorMessage(null)
      setSearch('')
    }
  }, [open])

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
      return
    }

    const loadInventory = async () => {
      setLoadingInventory(true)
      setErrorMessage(null)

      const productId = await ensureIngredientProduct(selectedIngredient, {
        tenantId,
        createIfMissing: false
      })

      setCurrentProductId(productId)

      if (!productId) {
        setCurrentStock(null)
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
        setStockMin(Number(data.stock_minimo ?? selectedIngredient.stock_minimo_sugerido ?? 0))
        setControlStock(Boolean(data.controlar_stock))
      } else {
        setCurrentStock(null)
        setStockMin(selectedIngredient.stock_minimo_sugerido ?? 0)
      }

      setLoadingInventory(false)
    }

    loadInventory()
  }, [selectedIngredient, tenantId, open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!selectedIngredient) {
      setErrorMessage('Selecciona un ingrediente')
      return
    }

    if (quantity <= 0 && operation !== 'ajuste') {
      setErrorMessage('La cantidad debe ser mayor a cero')
      return
    }

    setIsSaving(true)

    try {
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
      const previousStock = Number(existing?.stock_actual ?? 0)
      let newStock = previousStock

      switch (operation) {
        case 'entrada':
          newStock = previousStock + quantity
          break
        case 'salida':
          newStock = Math.max(previousStock - quantity, 0)
          break
        case 'ajuste':
          newStock = quantity
          break
      }

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
        stock_anterior: previousStock,
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

  if (!open) return null

  const noIngredientsAvailable = !loadingIngredients && ingredients.length === 0

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !isSaving && onClose()}
      />
      <div className="relative ml-auto h-full w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-orange-500" />
              Cargar insumos críticos
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Controlá huevos, panes, queso y salsas con una sola acción.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form
          id="inventory-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
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
                      setStockMin(ingredient.stock_minimo_sugerido ?? 0)
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
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                type="number"
                min="0"
                step="0.01"
                value={stockMin}
                onChange={(e) => setStockMin(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
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

        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between bg-gray-50/60 dark:bg-gray-900/60">
          <div>
            {selectedIngredient && currentStock !== null && (
              <p className="text-xs text-gray-500">
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
          </div>
          <button type="submit" form="inventory-form" className="hidden" />
          <button
            type="submit"
            form="inventory-form"
            disabled={isSaving || !selectedIngredient}
            className="px-5 py-3 rounded-xl font-semibold bg-orange-500 text-white hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar movimiento
          </button>
        </div>
      </div>
    </div>
  )
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
        orden: 99
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

