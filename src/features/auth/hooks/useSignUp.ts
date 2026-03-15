'use client'

import { useState } from 'react'
import { signUp as signUpAction } from '@/app/actions/auth'
import { validateSignUpForm } from '../utils/validators'

export function useSignUp() {
  const [nombre, setNombre] = useState('')
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    const validationError = validateSignUpForm({
      nombre,
      nombreNegocio,
      email,
      password,
      confirmPassword,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      const result = await signUpAction(nombre, nombreNegocio, email, password)

      if (result?.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      if (result?.requiresEmailConfirmation) {
        setSuccessMessage(result.message || 'Revisá tu correo para confirmar tu cuenta.')
        setLoading(false)
        return
      }

      if (result?.success && result?.redirectTo) {
        window.location.href = result.redirectTo
      }
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta')
      setLoading(false)
    }
  }

  return {
    nombre,
    setNombre,
    nombreNegocio,
    setNombreNegocio,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    successMessage,
    handleSignUp,
  }
}
