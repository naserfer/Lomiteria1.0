'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, Minus, Plus, Search, Check, Undo2 } from 'lucide-react'
import { useCartStore } from '@/features/pedidos/cartStore'
import { fetchProductRecipe, fetchTenantIngredients } from '@/features/ingredientes/ingredients.service'
import type { IngredientDefinition, IngredientRequirement } from '@/features/ingredientes/ingredients.types'
import { formatGuaranies } from '@/shared/utils/format'
import { useTenant } from '@/features/auth/TenantContext'

interface ItemCustomizationDrawerProps {
  open: boolean
  itemId: string | null
  onClose: () => void
  darkMode?: boolean
}

type ExtraDraft = {
  slug: string
  label: string
  unit: IngredientRequirement['unit']
  quantity: number
  unitPrice: number
}

export function ItemCustomizationDrawer({ open, itemId, onClose, darkMode }: ItemCustomizationDrawerProps) {
  const { tenant } = useTenant()
  const item = useCartStore((state) => state.items.find((it) => it.id === itemId))
  const updateCustomization = useCartStore((state) => state.updateItemCustomization)

  const [catalog, setCatalog] = useState<IngredientDefinition[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [baseRecipe, setBaseRecipe] = useState<IngredientRequirement[]>([])
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [extras, setExtras] = useState<Record<string, ExtraDraft>>({})
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) {
      setRemoved(new Set())
      setExtras({})
      setNotes('')
      setSearch('')
    }
  }, [open])

  useEffect(() => {
    if (!open || !tenant) return
    let active = true
    const load = async () => {
      setCatalogLoading(true)
      try {
        const data = await fetchTenantIngredients(tenant.id)
        if (active) setCatalog(data)
      } catch (error) {
        console.error('Error cargando ingredientes', error)
        if (active) setCatalog([])
      } finally {
        if (active) setCatalogLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenant?.id])

  useEffect(() => {
    if (!open || !tenant || !item?.producto_id) {
      setBaseRecipe([])
      return
    }
    let active = true
    const loadRecipe = async () => {
      setRecipeLoading(true)
      try {
        const recipe = await fetchProductRecipe(tenant.id, item.producto_id)
        if (active) setBaseRecipe(recipe)
      } catch (error) {
        console.error('Error cargando receta', error)
        if (active) setBaseRecipe([])
      } finally {
        if (active) setRecipeLoading(false)
      }
    }
    loadRecipe()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenant?.id, item?.producto_id])

  useEffect(() => {
    if (!open || !item) return
    const removedSet = new Set(item.customization?.removedIngredients.map((ing) => ing.slug) ?? [])
    setRemoved(removedSet)

    const extrasDraft: Record<string, ExtraDraft> = {}
    item.customization?.extras.forEach((extra) => {
      extrasDraft[extra.slug] = {
        slug: extra.slug,
        label: extra.label,
        unit: extra.unit,
        quantity: extra.quantityPerItem,
        unitPrice: extra.unitPrice
      }
    })
    setExtras(extrasDraft)
    setNotes(item.customization?.notes ?? '')
    setSearch('')
  }, [open, item])

  const filteredCatalog = useMemo(() => {
    if (!search.trim()) return catalog
    const q = search.toLowerCase()
    return catalog.filter(
      (ingredient) => ingredient.nombre.toLowerCase().includes(q) || ingredient.slug.toLowerCase().includes(q)
    )
  }, [catalog, search])

  if (!open || !item) return null

  const toggleBaseIngredient = (slug: string) => {
    const next = new Set(removed)
    next.has(slug) ? next.delete(slug) : next.add(slug)
    setRemoved(next)
  }

  const changeExtraQuantity = (slug: string, delta: number) => {
    const ingredient = catalog.find((ing) => ing.slug === slug)
    if (!ingredient) return
    const current = extras[slug]?.quantity ?? 0
    const nextQuantity = Math.max(0, current + delta)

    if (nextQuantity === 0) {
      if (extras[slug]) {
        const { [slug]: _, ...rest } = extras
        setExtras(rest)
      }
      return
    }

    setExtras({
      ...extras,
      [slug]: {
        slug,
        label: ingredient.nombre,
        unit: ingredient.unidad,
        quantity: nextQuantity,
        unitPrice: ingredient.precio_publico ?? 0
      }
    })
  }

  const handleSave = () => {
    const removedIngredients = Array.from(removed).map((slug) => {
      const base = baseRecipe.find((ing) => ing.slug === slug)
      const fallback = catalog.find((ing) => ing.slug === slug)
      return {
        slug,
        label: base?.label ?? fallback?.nombre ?? slug
      }
    })

    const extrasList = Object.values(extras).filter((extra) => extra.quantity > 0)
    const extraCostPerUnit = extrasList.reduce((sum, extra) => sum + extra.quantity * extra.unitPrice, 0)

    const resolvedRecipe: IngredientRequirement[] = [
      ...baseRecipe
        .filter((ingredient) => !removed.has(ingredient.slug))
        .map((ingredient) => ({ ...ingredient })),
      ...extrasList.map((extra) => ({
        slug: extra.slug,
        label: extra.label,
        unit: extra.unit,
        quantityPerItem: extra.quantity
      }))
    ]

    const hasCustomizations =
      removedIngredients.length > 0 || extrasList.length > 0 || notes.trim().length > 0

    if (!hasCustomizations) {
      updateCustomization(item.id, null, 0)
      onClose()
      return
    }

    updateCustomization(
      item.id,
      {
        removedIngredients,
        extras: extrasList.map((extra) => ({
          slug: extra.slug,
          label: extra.label,
          unit: extra.unit,
          quantityPerItem: extra.quantity,
          unitPrice: extra.unitPrice
        })),
        resolvedRecipe,
        notes: notes.trim() || undefined
      },
      extraCostPerUnit
    )
    onClose()
  }

  const extraCostPerUnit = Object.values(extras).reduce((sum, extra) => sum + extra.quantity * extra.unitPrice, 0)
  const updatedLineTotal = (item.precio + extraCostPerUnit) * item.cantidad
  const noIngredients = !catalogLoading && catalog.length === 0

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative ml-auto h-full w-full max-w-xl flex flex-col ${
          darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
        }`}
      >
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            darkMode ? 'border-gray-800' : 'border-gray-200'
          }`}
        >
          <div>
            <p className="text-xs uppercase tracking-widest text-orange-500">Editor de pedido</p>
            <h2 className="text-2xl font-bold">{item.nombre}</h2>
            <p className="text-sm text-gray-500">
              Cantidad actual: {item.cantidad} • Precio base: {formatGuaranies(item.precio)}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-orange-500">Receta base</p>
                <h3 className="text-lg font-semibold">Ingredientes originales</h3>
              </div>
              {baseRecipe.length > 0 && (
                <button
                  onClick={() => {
                    setRemoved(new Set())
                    setExtras({})
                    setNotes('')
                  }}
                  className={`flex items-center gap-1 text-xs font-semibold ${
                    darkMode ? 'text-orange-300' : 'text-orange-600'
                  }`}
                >
                  <Undo2 size={12} /> Restablecer
                </button>
              )}
            </div>

            {recipeLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando receta...
              </div>
            ) : baseRecipe.length === 0 ? (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Este producto no tiene una receta configurada aún. Podés agregar extras manualmente.
              </p>
            ) : (
              <div className="space-y-3">
                {baseRecipe.map((ingredient) => {
                  const isRemoved = removed.has(ingredient.slug)
                  return (
                    <label
                      key={ingredient.slug}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 cursor-pointer transition ${
                        isRemoved
                          ? darkMode
                            ? 'border-red-500/40 bg-red-900/20'
                            : 'border-red-200 bg-red-50'
                          : darkMode
                            ? 'border-gray-800 bg-gray-800/60'
                            : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div>
                        <p className="font-semibold">{ingredient.label}</p>
                        <p className="text-xs text-gray-500">
                          {ingredient.quantityPerItem}
                          {ingredient.unit}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleBaseIngredient(ingredient.slug)}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                          isRemoved
                            ? 'border-red-500 text-red-500'
                            : 'border-green-500 text-green-500'
                        }`}
                      >
                        {isRemoved ? <X size={12} /> : <Check size={14} />}
                      </button>
                    </label>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <p className="text-xs uppercase tracking-widest text-orange-500 mb-3">Agregar extras</p>
            <div
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 border ${
                darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'
              }`}
            >
              <Search size={16} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar bacon, queso, salsas..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
            </div>

            {catalogLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando ingredientes...
              </div>
            ) : noIngredients ? (
              <p className={`mt-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Todavía no tenés ingredientes configurados.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                {filteredCatalog.map((ingredient) => {
                  const draft = extras[ingredient.slug]
                  const quantity = draft?.quantity ?? 0
                  const price = ingredient.precio_publico ?? 0
                  return (
                    <div
                      key={ingredient.slug}
                      className={`rounded-2xl border px-4 py-3 flex flex-col gap-2 ${
                        darkMode ? 'border-gray-800 bg-gray-800/60' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{ingredient.nombre}</p>
                          <p className="text-xs text-gray-500">
                            {ingredient.unidad.toUpperCase()} • {formatGuaranies(price)}
                          </p>
                        </div>
                        <span className="text-xl">{ingredient.icono ?? '🧂'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => changeExtraQuantity(ingredient.slug, -1)}
                            className={`p-1 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center font-semibold">{quantity}</span>
                          <button
                            onClick={() => changeExtraQuantity(ingredient.slug, 1)}
                            className="p-1 rounded-lg bg-orange-500 text-white"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        {quantity > 0 && (
                          <p className="text-sm font-semibold text-orange-500">
                            +{formatGuaranies(quantity * price)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <p className="text-xs uppercase tracking-widest text-orange-500 mb-2">Notas</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: entregar sin cortar, salsa aparte..."
              className={`w-full rounded-2xl border px-4 py-3 text-sm ${
                darkMode
                  ? 'bg-gray-900 border-gray-800 focus:border-orange-500'
                  : 'bg-white border-gray-200 focus:border-orange-500'
              } focus:outline-none`}
              rows={3}
            />
          </section>
        </div>

        <div
          className={`px-5 py-4 border-t ${
            darkMode ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex flex-col gap-2 mb-4 text-sm">
            <div className="flex justify-between">
              <span>Precio base:</span>
              <span>{formatGuaranies(item.precio)}</span>
            </div>
            <div className="flex justify-between">
              <span>Extras por unidad:</span>
              <span className="text-orange-500 font-semibold">
                +{formatGuaranies(extraCostPerUnit)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total nuevo:</span>
              <span>{formatGuaranies(updatedLineTotal)}</span>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={recipeLoading || catalogLoading}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {recipeLoading || catalogLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={18} />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}

