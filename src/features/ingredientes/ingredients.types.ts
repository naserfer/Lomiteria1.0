export type IngredientUnit = 'unidad' | 'g' | 'kg' | 'ml' | 'l'

export interface IngredientDefinition {
  id: string
  tenant_id: string
  slug: string
  nombre: string
  unidad: IngredientUnit
  icono: string | null
  precio_publico: number
  stock_minimo_sugerido: number | null
  descripcion?: string | null
  activo: boolean
}

export interface IngredientRequirement {
  ingredienteId?: string
  slug: string
  label: string
  unit: IngredientUnit
  quantityPerItem: number
}

export interface IngredientConsumption {
  slug: string
  label: string
  unit: IngredientUnit
  total: number
}



