export interface LoginCredentials {
  email: string
  password: string
}

export interface SignUpCredentials {
  nombre: string
  nombreNegocio: string
  email: string
  password: string
  confirmPassword: string
}

export interface AuthError {
  message: string
  code?: string
}

export interface AuthResponse {
  error?: string
  data?: any
}

export interface LoginFormProps {
  onSuccess?: () => void
  redirectUrl?: string
}

export interface SignUpFormProps {
  onSuccess?: () => void
}

export interface OAuthProvider {
  provider: 'google' | 'apple'
  label: string
  icon: string
}
