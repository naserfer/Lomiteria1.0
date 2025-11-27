'use client'

import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

interface DetailItem {
  label: string
  value: string
}

interface FeedbackModalProps {
  open: boolean
  type: 'success' | 'error'
  title: string
  message: string
  details?: DetailItem[]
  onClose: () => void
  darkMode?: boolean
  actionLabel?: string
  onAction?: () => void
}

export function FeedbackModal({
  open,
  type,
  title,
  message,
  details = [],
  onClose,
  darkMode = false,
  actionLabel = 'Aceptar',
  onAction
}: FeedbackModalProps) {
  if (!open) return null

  const isSuccess = type === 'success'
  const iconClasses = isSuccess
    ? 'bg-emerald-100 text-emerald-600'
    : 'bg-red-100 text-red-600'
  const headingColor = isSuccess
    ? 'text-emerald-600'
    : 'text-red-600'
  const bodyText = darkMode ? 'text-gray-300' : 'text-gray-600'
  const borderColor = isSuccess
    ? 'border-emerald-100'
    : 'border-red-100'
  const detailLabelColor = darkMode ? 'text-gray-300' : 'text-gray-500'
  const detailValueColor = darkMode ? 'text-white' : 'text-gray-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl ${
          darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
        } animate-in fade-in zoom-in duration-200`}
      >
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Cerrar"
          >
            <X className={darkMode ? 'text-gray-300' : 'text-gray-500'} size={20} />
          </button>
        </div>

        <div className="px-8 pb-8 -mt-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${iconClasses}`}>
              {isSuccess ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
            </div>
            <div>
              <p className={`text-sm font-semibold uppercase tracking-wide ${headingColor}`}>
                {isSuccess ? '¡Listo!' : 'Atención'}
              </p>
              <h2 className="text-2xl font-bold leading-tight">{title}</h2>
            </div>
          </div>

          <p className={`text-base ${bodyText}`}>
            {message}
          </p>

          {details.length > 0 && (
            <dl
              className={`mt-6 border ${borderColor} rounded-2xl divide-y ${
                darkMode
                  ? 'bg-gray-800/60 divide-gray-800'
                  : 'bg-gray-50 divide-gray-100'
              }`}
            >
              {details.map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4 px-5 py-3 text-sm">
                  <dt className={`font-medium ${detailLabelColor}`}>{label}</dt>
                  <dd className={`text-right font-semibold ${detailValueColor}`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                darkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cerrar
            </button>
            {onAction && (
              <button
                onClick={() => {
                  onAction()
                  onClose()
                }}
                className={`px-4 py-2 rounded-xl font-semibold text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-105 ${
                  type === 'success'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

