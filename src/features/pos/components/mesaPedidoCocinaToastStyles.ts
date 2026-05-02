/** Clases compartidas: mismo colorway antes y después del “back” desde el POS */
export function mesaPedidoCocinaToastClassName(darkMode: boolean): string {
  return `fixed right-4 top-20 z-[65] rounded-lg border px-3 py-2 text-sm font-medium shadow-lg ${
    darkMode
      ? 'border-emerald-700/80 bg-emerald-950/90 text-emerald-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }`
}
