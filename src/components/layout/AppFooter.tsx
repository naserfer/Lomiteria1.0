'use client'

import { useTenant } from '@/contexts/TenantContext'
import { APP_VERSION_LABEL } from '@/utils/strings'

type AppFooterProps = {
  isDark?: boolean
  className?: string
  variant?: 'default' | 'login'
}

export function AppFooter({
  isDark,
  className = '',
  variant = 'default'
}: AppFooterProps) {
  const { darkMode } = useTenant()
  const effectiveDark = isDark !== undefined ? isDark : darkMode
  const showVersionLabel = variant === 'login'

  return (
    <footer
      className={`flex-shrink-0 flex items-center justify-center text-center text-sm px-2 ${
        effectiveDark 
          ? 'bg-gray-900/50 text-gray-400 border-t border-gray-800' 
          : 'bg-orange-50/50 text-gray-500 border-t border-orange-100'
      } ${className}`.trim()}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
      }}
    >
      <div className="flex flex-col items-center justify-center leading-snug py-3">
        <p>ARDENTIUM Labs® 2025</p>
        {showVersionLabel && (
          <p className="mt-0.5 text-xs text-inherit opacity-80">
            {APP_VERSION_LABEL}
          </p>
        )}
      </div>
    </footer>
  )
}
