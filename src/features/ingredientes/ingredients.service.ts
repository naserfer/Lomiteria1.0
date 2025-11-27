import { supabase } from '@/core/supabase'
import type { IngredientDefinition, IngredientRequirement, IngredientUnit } from './ingredients.types'

interface RecipeRow {
  producto_id: string
  cantidad: number
  unidad: IngredientUnit | null
  ingrediente: {
    id: string
    slug: string
    nombre: string
    unidad: IngredientUnit
  } | null
}

export async function fetchTenantIngredients(tenantId: string): Promise<IngredientDefinition[]> {
  const { data, error } = await supabase
    .from('ingredientes')
    .select(
      'id, tenant_id, slug, nombre, unidad, icono, precio_publico, stock_minimo_sugerido, descripcion, activo'
    )
    .eq('tenant_id', tenantId)
    .order('nombre')

  if (error) {
    console.error('Error fetching ingredientes', error)
    throw error
  }

  return (data ?? []) as IngredientDefinition[]
}

export async function fetchRecipesForProducts(
  tenantId: string,
  productIds: string[]
): Promise<Map<string, IngredientRequirement[]>> {
  if (!productIds.length) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('recetas_producto')
    .select(
      `
        producto_id,
        cantidad,
        unidad,
        ingrediente:ingrediente_id ( id, slug, nombre, unidad )
      `
    )
    .eq('tenant_id', tenantId)
    .in('producto_id', productIds)

  if (error) {
    console.error('Error fetching recetas_producto', error)
    throw error
  }

  const map = new Map<string, IngredientRequirement[]>()

  if (!data) return map

  data.forEach((row) => {
    // Type assertion segura: sabemos que Supabase devuelve este formato
    const typedRow = row as unknown as RecipeRow
    if (!typedRow.ingrediente) return

    const requirement: IngredientRequirement = {
      ingredienteId: typedRow.ingrediente.id,
      slug: typedRow.ingrediente.slug,
      label: typedRow.ingrediente.nombre,
      unit: typedRow.unidad ?? typedRow.ingrediente.unidad,
      quantityPerItem: typedRow.cantidad
    }

    const existing = map.get(typedRow.producto_id) ?? []
    existing.push(requirement)
    map.set(typedRow.producto_id, existing)
  })

  return map
}

export async function fetchProductRecipe(
  tenantId: string,
  productId: string
): Promise<IngredientRequirement[]> {
  const map = await fetchRecipesForProducts(tenantId, [productId])
  return map.get(productId) ?? []
}



