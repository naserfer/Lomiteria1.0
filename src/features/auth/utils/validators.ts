import { VALIDATION_RULES, SIGNUP_ERRORS } from '../constants/auth.constants'
import type { SignUpCredentials } from '../types/auth.types'

export const validateEmail = (email: string): boolean => {
  return VALIDATION_RULES.EMAIL_REGEX.test(email)
}

export const validatePassword = (password: string): boolean => {
  return password.length >= VALIDATION_RULES.MIN_PASSWORD_LENGTH
}

export const validateLoginForm = (email: string, password: string): string | null => {
  if (!email.trim()) {
    return 'El correo electrónico es requerido'
  }
  
  if (!validateEmail(email)) {
    return 'Formato de correo electrónico inválido'
  }
  
  if (!password) {
    return 'La contraseña es requerida'
  }
  
  if (!validatePassword(password)) {
    return `La contraseña debe tener al menos ${VALIDATION_RULES.MIN_PASSWORD_LENGTH} caracteres`
  }
  
  return null
}

export const validateSignUpForm = (credentials: SignUpCredentials): string | null => {
  if (!credentials.nombre.trim()) {
    return SIGNUP_ERRORS.EMPTY_NAME
  }

  if (!credentials.nombreNegocio.trim()) {
    return SIGNUP_ERRORS.EMPTY_BUSINESS
  }

  if (!credentials.email.trim()) {
    return SIGNUP_ERRORS.EMPTY_EMAIL
  }

  if (!validateEmail(credentials.email)) {
    return SIGNUP_ERRORS.INVALID_EMAIL
  }

  if (!credentials.password) {
    return SIGNUP_ERRORS.EMPTY_PASSWORD
  }

  if (!validatePassword(credentials.password)) {
    return SIGNUP_ERRORS.SHORT_PASSWORD
  }

  if (!credentials.confirmPassword) {
    return SIGNUP_ERRORS.EMPTY_CONFIRM
  }

  if (credentials.password !== credentials.confirmPassword) {
    return SIGNUP_ERRORS.PASSWORDS_MISMATCH
  }

  return null
}
