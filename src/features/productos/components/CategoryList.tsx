'use client'

interface Category {
  id: string
  nombre: string
  orden: number
}

interface Props {
  categories: Category[]
  selectedCategory: string | null
  onSelectCategory: (categoryId: string | null) => void
  darkMode?: boolean
}

export default function CategoryList({ categories, selectedCategory, onSelectCategory, darkMode }: Props) {
  return (
    <div className={`rounded-2xl shadow-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Categorías</h2>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => onSelectCategory(null)}
          className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
            selectedCategory === null
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
              : darkMode 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
              selectedCategory === cat.id
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                : darkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}

