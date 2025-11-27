/**
 * Formatea un número como moneda en Guaraníes (Gs)
 * Usa punto (.) como separador de miles y no decimales
 * 
 * @param amount - El monto a formatear
 * @returns String formateado como "Gs 1.000.000"
 */
export function formatGuaranies(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(num)) return 'Gs 0'
  
  // Convertir a entero (guaraníes no usan decimales)
  const integer = Math.round(num)
  
  // Formatear con puntos como separadores de miles
  const formatted = integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  
  return `Gs ${formatted}`
}

/**
 * Formatea un número simple con puntos como separadores de miles
 * Útil para mostrar números sin el prefijo "Gs"
 * 
 * @param amount - El número a formatear
 * @returns String formateado como "1.000.000"
 */
export function formatNumber(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(num)) return '0'
  
  const integer = Math.round(num)
  return integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

