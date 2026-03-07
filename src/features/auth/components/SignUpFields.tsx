interface SignUpFieldsProps {
  nombre: string
  nombreNegocio: string
  email: string
  password: string
  confirmPassword: string
  onNombreChange: (v: string) => void
  onNombreNegocioChange: (v: string) => void
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onConfirmPasswordChange: (v: string) => void
  disabled?: boolean
}

export function SignUpFields({
  nombre,
  nombreNegocio,
  email,
  password,
  confirmPassword,
  onNombreChange,
  onNombreNegocioChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  disabled = false,
}: SignUpFieldsProps) {
  return (
    <>
      {/* Nombre */}
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
          Tu nombre
        </label>
        <input
          id="nombre"
          type="text"
          value={nombre}
          onChange={(e) => onNombreChange(e.target.value)}
          required
          autoComplete="name"
          className="w-full px-4 py-3 border border-orange-500 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition text-gray-900 placeholder:text-gray-400"
          placeholder="Juan Pérez"
          disabled={disabled}
        />
      </div>

      {/* Nombre del negocio */}
      <div>
        <label htmlFor="nombreNegocio" className="block text-sm font-medium text-gray-700 mb-2">
          Nombre del negocio
        </label>
        <input
          id="nombreNegocio"
          type="text"
          value={nombreNegocio}
          onChange={(e) => onNombreNegocioChange(e.target.value)}
          required
          autoComplete="organization"
          className="w-full px-4 py-3 border border-orange-500 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition text-gray-900 placeholder:text-gray-400"
          placeholder="Atlas Burger"
          disabled={disabled}
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-2">
          Correo electrónico
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          autoComplete="email"
          className="w-full px-4 py-3 border border-orange-500 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition text-gray-900 placeholder:text-gray-400"
          placeholder="tu@email.com"
          disabled={disabled}
        />
      </div>

      {/* Contraseña */}
      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-2">
          Contraseña
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full px-4 py-3 border border-orange-500 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition text-gray-900 placeholder:text-gray-400"
          placeholder="Mínimo 6 caracteres"
          disabled={disabled}
        />
      </div>

      {/* Confirmar contraseña */}
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
          Confirmar contraseña
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full px-4 py-3 border border-orange-500 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition text-gray-900 placeholder:text-gray-400"
          placeholder="••••••••"
          disabled={disabled}
        />
      </div>
    </>
  )
}
