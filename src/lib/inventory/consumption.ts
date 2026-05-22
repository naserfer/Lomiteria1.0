'use client'

import { createClient } from '@/lib/supabase/client'
import { CartItem, type ExtraIngredientSelection, type RemovedIngredientInfo } from '@/store/cartStore'
import { fetchRecipesForProducts } from '@/lib/api/ingredients'
import type { IngredientConsumption, IngredientRequirement, IngredientUnit } from '@/types/ingredients'

type InventoryRow = {
  id: string
  stock_actual: number
  stock_minimo: number
  unidad: string
  producto_id: string | null
  productos?: {
    nombre: string | null
  } | null
}

const unitFactor: Record<string, number> = {
  g: 1,
  gr: 1,
  grs: 1,
  kg: 1000,
  kilogramo: 1000,
  unidad: 1,
  unidades: 1,
  ml: 1,
  mililitro: 1,
  l: 1000,
  litro: 1000
}

const normalizeUnit = (unit: string | null | undefined): IngredientUnit | string => {
  if (!unit) return 'unidad'
  const lower = unit.toLowerCase()
  if (lower.includes('kg')) return 'kg'
  if (lower.includes('g')) return 'g'
  if (lower.includes('ml')) return 'ml'
  if (lower.includes('l')) return 'l'
  return 'unidad'
}

const convertUnits = (value: number, from: IngredientUnit, to: IngredientUnit | string) => {
  if (from === to) return value
  const fromFactor = unitFactor[from]
  const toFactor = unitFactor[to] ?? unitFactor[normalizeUnit(to) as IngredientUnit]
  if (!fromFactor || !toFactor) {
    return value
  }
  return (value * fromFactor) / toFactor
}

interface ApplyInventoryArgs {
  tenantId: string
  items: CartItem[]
  pedidoId: string
  pedidoNumero: number
  usuarioId: string | null
  /** Por defecto descuenta stock (salida). `entrada` lo devuelve (p. ej. al eliminar una línea). */
  modo?: 'salida' | 'entrada'
  motivoSuffix?: string
}

const normalizeProductName = (value: string) => value.trim().toLowerCase()

const collectIngredientTotals = (
  totalsMap: Map<string, IngredientConsumption>,
  requirements: IngredientRequirement[],
  multiplier: number
) => {
  requirements.forEach((ingredient) => {
    const key = ingredient.slug
    const increment = ingredient.quantityPerItem * multiplier

    if (totalsMap.has(key)) {
      const current = totalsMap.get(key)!
      current.total += increment
    } else {
      totalsMap.set(key, {
        slug: ingredient.slug,
        label: ingredient.label,
        unit: ingredient.unit,
        total: increment
      })
    }
  })
}

/**
 * Descuenta inventario estimado según las recetas definidas para cada producto.
 * Si un insumo no existe en inventario, se ignora y sólo se registra en consola.
 */
export async function applyInventoryConsumption({
  tenantId,
  items,
  pedidoId,
  pedidoNumero,
  usuarioId
}: ApplyInventoryArgs) {
  if (!tenantId || !items.length) return

  const supabase = createClient()
  const totalsMap = new Map<string, IngredientConsumption>()
  const productIds = Array.from(
    new Set(
      items
        .filter((item) => !item.customization?.resolvedRecipe?.length && item.producto_id)
        .map((item) => item.producto_id as string)
    )
  )
  const recipeMap = productIds.length
    ? await fetchRecipesForProducts(tenantId, productIds)
    : new Map<string, IngredientRequirement[]>()

  for (const item of items) {
    if (item.customization?.resolvedRecipe?.length) {
      collectIngredientTotals(totalsMap, item.customization.resolvedRecipe, item.cantidad)
      continue
    }

    if (!item.producto_id) continue

    const recipe = recipeMap.get(item.producto_id)
    if (!recipe?.length) continue

    collectIngredientTotals(totalsMap, recipe, item.cantidad)
  }

  const ingredientTotals = Array.from(totalsMap.values())
  if (!ingredientTotals.length) return

  const { data: inventoryRows, error } = await supabase
    .from('inventario')
    .select('id, stock_actual, stock_minimo, unidad, producto_id, productos:producto_id ( nombre )')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Error cargando inventario para consumo:', error)
    return
  }

  if (!inventoryRows?.length) return

  const inventoryMap = new Map<string, InventoryRow>()

  inventoryRows.forEach(row => {
    const productosData = row.productos as unknown as { nombre: string | null } | null
    const displayName = productosData?.nombre
    
    if (displayName) {
      const inventoryRow: InventoryRow = {
        id: row.id,
        stock_actual: Number(row.stock_actual ?? 0),
        stock_minimo: Number(row.stock_minimo ?? 0),
        unidad: row.unidad,
        producto_id: row.producto_id,
        productos: productosData
      }
      inventoryMap.set(normalizeProductName(displayName), inventoryRow)
    }
  })

  for (const ingredient of ingredientTotals) {
    const inventoryRow =
      inventoryMap.get(normalizeProductName(ingredient.label)) ??
      inventoryMap.get(ingredient.slug)

    if (!inventoryRow) {
      console.warn(
        `[Inventario] No se encontró insumo "${ingredient.label}". Crea un producto con ese nombre y asócialo al inventario para habilitar el descuento automático.`
      )
      continue
    }

    const inventoryUnit = normalizeUnit(inventoryRow.unidad) as IngredientUnit
    const quantityToDiscount = convertUnits(ingredient.total, ingredient.unit, inventoryUnit)
    if (!quantityToDiscount || Number.isNaN(quantityToDiscount)) {
      continue
    }

    const previousStock = Number(inventoryRow.stock_actual ?? 0)
    const newStock = Math.max(previousStock - quantityToDiscount, 0)

    const { error: updateError } = await supabase
      .from('inventario')
      .update({
        stock_actual: newStock
      })
      .eq('id', inventoryRow.id)

    if (updateError) {
      console.error('Error actualizando inventario:', updateError)
      continue
    }

    await supabase.from('movimientos_inventario').insert({
      inventario_id: inventoryRow.id,
      pedido_id: pedidoId,
      tipo: 'salida',
      cantidad: -quantityToDiscount,
      stock_anterior: previousStock,
      stock_nuevo: newStock,
      motivo: `Consumo automático por pedido #${pedidoNumero}`,
      usuario_id: usuarioId ?? undefined
    })
  }
}

export function getIngredientEstimationFromItems(
  tenantId: string,
  items: Array<{ producto_id: string | null; producto_nombre: string; cantidad: number }>
): Promise<IngredientConsumption[]> {
  const productIds = Array.from(
    new Set(items.map((item) => item.producto_id).filter((id): id is string => Boolean(id)))
  )

  if (!productIds.length) {
    return Promise.resolve([])
  }

  return fetchRecipesForProducts(tenantId, productIds).then((recipeMap) => {
    const totalsMap = new Map<string, IngredientConsumption>()

    items.forEach((item) => {
      if (!item.producto_id) return
      const recipe = recipeMap.get(item.producto_id)
      if (!recipe?.length) return
      collectIngredientTotals(totalsMap, recipe, item.cantidad)
    })

    return Array.from(totalsMap.values())
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos para el sistema optimizado
// ─────────────────────────────────────────────────────────────────────────────
type RecetaIngrediente = {
  id: string
  slug: string
  nombre: string
  unidad: string
  tipo_inventario: string
  stock_actual: number
  controlar_stock: boolean
  tenant_id: string
}

type RecetaRow = {
  id: string
  producto_id: string
  ingrediente_id: string
  cantidad: number
  unidad: string
  obligatorio: boolean
  ingredientes: RecetaIngrediente | null
}

/**
 * Descuenta ingredientes o inventario según tipo de producto.
 *
 * OPTIMIZADO — antes: N×3 queries por pedido (GET+PATCH+INSERT por ingrediente).
 * Ahora:
 *   1 SELECT productos
 *   1 SELECT recetas_producto (todos los productos, con JOIN a ingredientes)
 *   1 RPC aplicar_salidas_ingredientes_pedido (batch stock + movimientos), o fallback N PATCH + INSERT movimientos
 *   1 INSERT items_pedido_customizacion (batch)
 *   1 SELECT inventario    (solo productos sin receta)
 *   N PATCH inventario     (uno por producto sin receta)
 *   1 INSERT movimientos_inventario (batch)
 */
export async function descontarIngredientesPorPedido({
  tenantId,
  items,
  pedidoId,
  pedidoNumero,
  usuarioId,
  modo = 'salida',
  motivoSuffix,
}: ApplyInventoryArgs): Promise<{ success: boolean; errores: string[] }> {
  if (!tenantId || !items.length) return { success: true, errores: [] }

  const supabase = createClient()
  const errores: string[] = []
  const esEntrada = modo === 'entrada'
  const motivoBase = esEntrada
    ? `${motivoSuffix ?? 'Devolución'} pedido #${pedidoNumero}`
    : `Venta pedido #${pedidoNumero}`

  try {
    // ── Expandir combos en items individuales para descuento de inventario ──
    // Cada sub-producto de un combo se trata como un item independiente.
    const expandedItems: CartItem[] = []
    for (const item of items) {
      if (item.tipo === 'combo' && item.comboItems?.length) {
        for (const ci of item.comboItems) {
          expandedItems.push({
            id: item.id,
            producto_id: ci.producto_id,
            nombre: ci.nombre,
            precio: 0,
            cantidad: ci.cantidad * item.cantidad,
            subtotal: 0,
            tipo: 'producto',
            customization: ci.customization,
          })
        }
      } else {
        expandedItems.push(item)
      }
    }

    // ── QUERY 1: todos los productos del pedido ───────────────────────────
    const productoIds = [
      ...new Set(expandedItems.map(i => i.producto_id).filter((id): id is string => Boolean(id)))
    ]

    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select('id, nombre, tiene_receta')
      .in('id', productoIds)

    if (productosError) {
      console.error('Error al obtener productos:', productosError)
      errores.push('Error al obtener información de productos')
      return { success: false, errores }
    }

    const productosMap = new Map((productos ?? []).map(p => [p.id, p]))
    const itemsConReceta = expandedItems.filter(
      i => i.producto_id && productosMap.get(i.producto_id)?.tiene_receta
    )
    const itemsSinReceta = expandedItems.filter(
      i =>
        i.producto_id &&
        productosMap.get(i.producto_id) &&
        !productosMap.get(i.producto_id)!.tiene_receta
    )

    // ── QUERY 2: TODAS las recetas en un solo fetch con JOIN a ingredientes ─
    // Obtenemos stock_actual embebido → eliminamos el GET por ingrediente
    const productIdsConReceta = [...new Set(itemsConReceta.map(i => i.producto_id as string))]
    const recetaMap = new Map<string, RecetaRow[]>()

    if (productIdsConReceta.length > 0) {
      const { data: recetas, error: recetasError } = await supabase
        .from('recetas_producto')
        .select(`
          id, ingrediente_id, cantidad, unidad, obligatorio, producto_id,
          ingredientes:ingrediente_id (
            id, slug, nombre, unidad, tipo_inventario,
            stock_actual, controlar_stock, tenant_id
          )
        `)
        .eq('tenant_id', tenantId)
        .in('producto_id', productIdsConReceta)

      if (recetasError) {
        console.error('Error al obtener recetas:', recetasError)
        errores.push('Error al obtener recetas de productos')
      } else {
        for (const r of (recetas ?? []) as unknown as RecetaRow[]) {
          if (!recetaMap.has(r.producto_id)) recetaMap.set(r.producto_id, [])
          recetaMap.get(r.producto_id)!.push(r)
        }
      }
    }

    // Ingredientes agregados como extras fuera de receta (ej: extra bacon en producto sin bacon base)
    const extraSlugs = Array.from(
      new Set(
        itemsConReceta.flatMap((item) =>
          (item.customization?.extras ?? []).map((extra) => extra.slug)
        )
      )
    )
    const extraIngredientMap = new Map<string, RecetaIngrediente>()
    if (extraSlugs.length > 0) {
      const { data: extraIngredients, error: extrasError } = await supabase
        .from('ingredientes')
        .select('id, slug, nombre, unidad, tipo_inventario, stock_actual, controlar_stock, tenant_id')
        .eq('tenant_id', tenantId)
        .in('slug', extraSlugs)

      if (extrasError) {
        console.error('Error al obtener ingredientes extra:', extrasError)
      } else {
        for (const ing of (extraIngredients ?? []) as unknown as RecetaIngrediente[]) {
          extraIngredientMap.set(ing.slug, ing)
        }
      }
    }

    // ── Acumular consumos por ingrediente único ────────────────────────────
    // Si varios ítems comparten un ingrediente, se suman en memoria antes
    // de hacer cualquier UPDATE a la DB.
    type IngConsumo = {
      ing: RecetaIngrediente
      cantidadTotal: number
      stockAnterior: number
    }
    const ingredienteTotals = new Map<string, IngConsumo>()

    const customizacionesBatch: Array<{
      item_pedido_id: string
      ingrediente_id: string
      tipo: 'extra' | 'removido' | 'modificado'
      cantidad_original: number
      cantidad_ajustada: number
      precio_extra: number
    }> = []

    for (const item of itemsConReceta) {
      if (!item.producto_id) continue
      const receta = recetaMap.get(item.producto_id) ?? []
      const recipeSlugs = new Set(receta.map((r) => r.ingredientes?.slug).filter(Boolean))

      const removidos = new Set(
        (item.customization?.removedIngredients ?? []).map((x: { slug: string }) => x.slug)
      )
      const extrasMap = new Map(
        (item.customization?.extras ?? []).map(
          (x: { slug: string; quantityPerItem: number; unitPrice: number }) => [
            x.slug,
            { quantityPerItem: x.quantityPerItem, unitPrice: x.unitPrice },
          ]
        )
      )

      for (const r of receta) {
        const ing = r.ingredientes
        if (!ing || !ing.controlar_stock) continue

        if (removidos.has(ing.slug)) {
          customizacionesBatch.push({
            item_pedido_id: item.id,
            ingrediente_id: ing.id,
            tipo: 'removido',
            cantidad_original: r.cantidad,
            cantidad_ajustada: 0,
            precio_extra: 0,
          })
          continue
        }

        let cantidadItem = r.cantidad * item.cantidad

        if (extrasMap.has(ing.slug)) {
          const extraConfig = extrasMap.get(ing.slug)!
          const extraPorItem = extraConfig.quantityPerItem
          const extraPrecioLinea = Math.max(0, extraPorItem * (extraConfig.unitPrice ?? 0) * item.cantidad)
          cantidadItem += extraPorItem * item.cantidad
          customizacionesBatch.push({
            item_pedido_id: item.id,
            ingrediente_id: ing.id,
            tipo: 'extra',
            cantidad_original: r.cantidad,
            cantidad_ajustada: r.cantidad + extraPorItem,
            precio_extra: extraPrecioLinea,
          })
        }

        if (ingredienteTotals.has(ing.id)) {
          ingredienteTotals.get(ing.id)!.cantidadTotal += cantidadItem
        } else {
          ingredienteTotals.set(ing.id, {
            ing,
            cantidadTotal: cantidadItem,
            stockAnterior: Number(ing.stock_actual ?? 0)
          })
        }
      }

      // Extras agregados que no estaban en la receta original
      for (const [extraSlug, extraConfig] of extrasMap.entries()) {
        const extraPorItem = extraConfig.quantityPerItem
        if (recipeSlugs.has(extraSlug) || extraPorItem <= 0) continue
        const ing = extraIngredientMap.get(extraSlug)
        if (!ing || !ing.controlar_stock) continue

        const cantidadItem = extraPorItem * item.cantidad
        const extraPrecioLinea = Math.max(0, extraPorItem * (extraConfig.unitPrice ?? 0) * item.cantidad)

        customizacionesBatch.push({
          item_pedido_id: item.id,
          ingrediente_id: ing.id,
          tipo: 'extra',
          cantidad_original: 0,
          cantidad_ajustada: extraPorItem,
          precio_extra: extraPrecioLinea,
        })

        if (ingredienteTotals.has(ing.id)) {
          ingredienteTotals.get(ing.id)!.cantidadTotal += cantidadItem
        } else {
          ingredienteTotals.set(ing.id, {
            ing,
            cantidadTotal: cantidadItem,
            stockAnterior: Number(ing.stock_actual ?? 0)
          })
        }
      }
    }

    // ── Salidas de ingredientes: 1 RPC (DB) o fallback N PATCH + INSERT batch ─
    type MovPlan = {
      ingId: string
      ing: RecetaIngrediente
      cantidadTotal: number
      stockAnterior: number
      nuevoStock: number
    }

    const movimientosPlan: MovPlan[] = []
    for (const [ingId, { ing, cantidadTotal, stockAnterior }] of ingredienteTotals) {
      movimientosPlan.push({
        ingId,
        ing,
        cantidadTotal,
        stockAnterior,
        nuevoStock: esEntrada
          ? stockAnterior + cantidadTotal
          : Math.max(stockAnterior - cantidadTotal, 0),
      })
    }

    if (movimientosPlan.length > 0) {
      const p_movs = movimientosPlan.map((row) => ({
        tenant_id: row.ing.tenant_id,
        ingrediente_id: row.ingId,
        pedido_id: pedidoId,
        cantidad: row.cantidadTotal,
        stock_anterior: row.stockAnterior,
        stock_nuevo: row.nuevoStock,
        motivo: motivoBase,
        ...(usuarioId ? { usuario_id: usuarioId } : {}),
      }))

      const { error: rpcError } = esEntrada
        ? { error: { message: 'entrada_no_rpc' } }
        : await supabase.rpc('aplicar_salidas_ingredientes_pedido', {
            p_movs: p_movs,
          })

      if (rpcError) {
        console.warn(
          '[Inventario] RPC aplicar_salidas_ingredientes_pedido no disponible o falló; modo por fila:',
          rpcError
        )
        const movimientosBatch: Array<{
          tenant_id: string
          ingrediente_id: string
          tipo: string
          cantidad: number
          stock_anterior: number
          stock_nuevo: number
          motivo: string
          pedido_id: string
          usuario_id?: string
        }> = []

        for (const row of movimientosPlan) {
          const { ing, ingId, cantidadTotal, stockAnterior, nuevoStock } = row
          const { error: updateError } = await supabase
            .from('ingredientes')
            .update({ stock_actual: nuevoStock, updated_at: new Date().toISOString() })
            .eq('id', ingId)

          if (updateError) {
            console.error(`Error al descontar ${ing.nombre}:`, updateError)
            errores.push(`Error al descontar ${ing.nombre}`)
            continue
          }

          movimientosBatch.push({
            tenant_id: ing.tenant_id,
            ingrediente_id: ingId,
            tipo: esEntrada ? 'entrada' : 'salida',
            cantidad: cantidadTotal,
            stock_anterior: stockAnterior,
            stock_nuevo: nuevoStock,
            motivo: motivoBase,
            pedido_id: pedidoId,
            ...(usuarioId ? { usuario_id: usuarioId } : {}),
          })
        }

        if (movimientosBatch.length > 0) {
          const { error } = await supabase.from('movimientos_ingredientes').insert(movimientosBatch)
          if (error) console.error('Error al insertar movimientos de ingredientes:', error)
        }
      }
    }

    // ── 1 INSERT batch para todas las customizaciones ─────────────────────
    if (!esEntrada && customizacionesBatch.length > 0) {
      const { error } = await supabase.from('items_pedido_customizacion').insert(customizacionesBatch)
      if (error) console.error('Error al insertar customizaciones:', error)
    }

    // ── Productos sin receta (inventario de productos terminados) ─────────
    if (itemsSinReceta.length > 0) {
      // QUERY: 1 solo SELECT para todos los productos sin receta
      const prodIdsSinReceta = itemsSinReceta.map(i => i.producto_id as string)

      const { data: inventarios, error: invError } = await supabase
        .from('inventario')
        .select('id, producto_id, stock_actual, controlar_stock, unidad, tenant_id')
        .eq('tenant_id', tenantId)
        .in('producto_id', prodIdsSinReceta)

      if (!invError && inventarios) {
        const invMap = new Map(
          (inventarios as Array<{ producto_id: string } & Record<string, unknown>>).map(inv => [
            inv.producto_id,
            inv
          ])
        )
        const movimientosInv: Array<{
          tenant_id: string
          inventario_id: string
          pedido_id: string
          tipo: string
          cantidad: number
          stock_anterior: number
          stock_nuevo: number
          motivo: string
          usuario_id?: string
        }> = []

        for (const item of itemsSinReceta) {
          if (!item.producto_id) continue
          const inv = invMap.get(item.producto_id) as any
          if (!inv || !inv.controlar_stock) continue

          const stockAnterior = Number(inv.stock_actual ?? 0)
          if (!esEntrada && stockAnterior < item.cantidad) {
            errores.push(
              `Stock insuficiente de ${item.nombre}. Disponible: ${stockAnterior}, solicitado: ${item.cantidad}`
            )
            continue
          }

          const stockNuevo = esEntrada ? stockAnterior + item.cantidad : stockAnterior - item.cantidad
          const { error: updateErr } = await supabase
            .from('inventario')
            .update({ stock_actual: stockNuevo, updated_at: new Date().toISOString() })
            .eq('id', inv.id)

          if (updateErr) {
            console.error(`Error al actualizar inventario de ${item.nombre}:`, updateErr)
            errores.push(`Error al descontar ${item.nombre}`)
            continue
          }

          movimientosInv.push({
            tenant_id: tenantId,
            inventario_id: inv.id,
            pedido_id: pedidoId,
            tipo: esEntrada ? 'entrada' : 'salida',
            cantidad: esEntrada ? item.cantidad : -item.cantidad,
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
            motivo: motivoBase,
            ...(usuarioId ? { usuario_id: usuarioId } : {})
          })
        }

        // 1 INSERT batch para todos los movimientos de inventario
        if (movimientosInv.length > 0) {
          await supabase.from('movimientos_inventario').insert(movimientosInv)
        }
      }
    }

    return { success: errores.length === 0, errores }
  } catch (error) {
    console.error('Error en descontarIngredientesPorPedido:', error)
    errores.push('Error general al procesar descuento de inventario')
    return { success: false, errores }
  }
}

export type ItemPedidoCustomizacionRow = {
  tipo: 'extra' | 'removido' | 'modificado'
  precio_extra?: number | null
  cantidad_original?: number | null
  cantidad_ajustada?: number | null
  ingredientes?: { slug: string; nombre: string } | Array<{ slug: string; nombre: string }> | null
}

export type ItemPedidoForRevert = {
  id: string
  producto_id: string | null
  producto_nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  notas?: string | null
  items_pedido_customizacion?: ItemPedidoCustomizacionRow[]
}

/** Convierte una línea persistida en `items_pedido` al formato de carrito para revertir inventario. */
export function itemPedidoRowToCartItem(row: ItemPedidoForRevert): CartItem {
  const removedIngredients: RemovedIngredientInfo[] = []
  const extras: ExtraIngredientSelection[] = []

  for (const c of row.items_pedido_customizacion ?? []) {
    const ing = Array.isArray(c.ingredientes) ? c.ingredientes[0] : c.ingredientes
    const slug = ing?.slug?.trim()
    const label = ing?.nombre?.trim() ?? slug ?? ''
    if (!slug) continue

    if (c.tipo === 'removido') {
      removedIngredients.push({ slug, label })
      continue
    }
    if (c.tipo === 'extra') {
      const orig = Number(c.cantidad_original ?? 0)
      const adj = Number(c.cantidad_ajustada ?? 0)
      const quantityPerItem = Math.max(0, adj - orig)
      if (quantityPerItem <= 0) continue
      const precioExtra = Math.max(0, Number(c.precio_extra ?? 0))
      const unitPrice =
        row.cantidad > 0 ? Math.round(precioExtra / (quantityPerItem * row.cantidad)) : 0
      extras.push({
        slug,
        label,
        unit: 'unidad',
        quantityPerItem,
        unitPrice,
      })
    }
  }

  return {
    id: row.id,
    producto_id: row.producto_id,
    nombre: row.producto_nombre,
    precio: Number(row.precio_unitario ?? 0),
    cantidad: Math.max(1, Math.floor(Number(row.cantidad ?? 1))),
    subtotal: Number(row.subtotal ?? 0),
    notas: row.notas ?? undefined,
    tipo: 'producto',
    customization:
      removedIngredients.length > 0 || extras.length > 0
        ? { removedIngredients, extras, resolvedRecipe: [] }
        : undefined,
  }
}

/**
 * Devuelve stock de ingredientes/inventario al quitar una línea de un pedido confirmado.
 * Espejo de `descontarIngredientesPorPedido` para un solo ítem (movimientos tipo entrada).
 */
export async function revertirIngredientesPorItemPedido({
  tenantId,
  item,
  pedidoId,
  pedidoNumero,
  usuarioId,
}: {
  tenantId: string
  item: ItemPedidoForRevert
  pedidoId: string
  pedidoNumero: number
  usuarioId?: string | null
}): Promise<{ success: boolean; errores: string[] }> {
  if (!tenantId || !item.producto_id) return { success: true, errores: [] }

  const cartItem = itemPedidoRowToCartItem(item)
  return descontarIngredientesPorPedido({
    tenantId,
    items: [cartItem],
    pedidoId,
    pedidoNumero,
    usuarioId,
    modo: 'entrada',
    motivoSuffix: 'quita línea',
  })
}
