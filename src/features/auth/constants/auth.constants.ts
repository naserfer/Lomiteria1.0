export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  NETWORK_ERROR: 'Error de conexión',
  GENERIC: 'Error al iniciar sesión',
  EMPTY_EMAIL: 'El correo electrónico es requerido',
  EMPTY_PASSWORD: 'La contraseña es requerida',
  INVALID_EMAIL: 'Formato de correo electrónico inválido'
}

export const SIGNUP_ERRORS = {
  EMPTY_NAME: 'El nombre es requerido',
  EMPTY_BUSINESS: 'El nombre del negocio es requerido',
  EMPTY_EMAIL: 'El correo electrónico es requerido',
  INVALID_EMAIL: 'Formato de correo electrónico inválido',
  EMPTY_PASSWORD: 'La contraseña es requerida',
  SHORT_PASSWORD: 'La contraseña debe tener al menos 6 caracteres',
  EMPTY_CONFIRM: 'Debes confirmar tu contraseña',
  PASSWORDS_MISMATCH: 'Las contraseñas no coinciden',
  GENERIC: 'Error al crear la cuenta',
}

export const DEV_CREDENTIALS = {
  email: 'admin@lomiteria-don-juan.com',
  password: 'Admin123!'
}

export const VALIDATION_RULES = {
  MIN_PASSWORD_LENGTH: 6,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
}

export const REDIRECT_URLS = {
  DEFAULT: '/home',
  LOGIN: '/'
}
