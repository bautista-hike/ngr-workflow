import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import axios from 'axios'

interface User {
  email: string
  name: string
  picture: string
  isSuperadmin?: boolean
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isSuperadmin: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSuperadmin, setIsSuperadmin] = useState(false)

  // Verificar si hay una sesión guardada al cargar
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('google_token')
        const userData = localStorage.getItem('user_data')
        
        if (token && userData) {
          try {
            // Verificar con el backend si el token sigue siendo válido
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
            const response = await axios.post(`${API_URL}/api/verify-token`, {
              token
            })
            
            if (response.data.valid && response.data.authorized) {
              const parsedUser = JSON.parse(userData)
              const userWithRole = {
                ...parsedUser,
                isSuperadmin: response.data.is_superadmin || false
              }
              setUser(userWithRole)
              setIsSuperadmin(response.data.is_superadmin || false)
            } else {
              // Token inválido o usuario no autorizado
              localStorage.removeItem('google_token')
              localStorage.removeItem('user_data')
            }
          } catch (error) {
            // Error al verificar, limpiar datos
            console.error('Error al verificar token:', error)
            localStorage.removeItem('google_token')
            localStorage.removeItem('user_data')
          }
        }
      } catch (error) {
        console.error('Error en checkAuth:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkAuth()
  }, [])

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Guardar token temporalmente
        localStorage.setItem('google_token', tokenResponse.access_token)
        
        // Obtener información del usuario de Google
        const userInfoResponse = await axios.get(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }
        )
        
        const userData = {
          email: userInfoResponse.data.email,
          name: userInfoResponse.data.name,
          picture: userInfoResponse.data.picture,
        }
        
        // Verificar con el backend si el usuario está autorizado
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        console.log('Enviando verificación al backend:', { email: userData.email })
        const authResponse = await axios.post(`${API_URL}/api/verify-user`, {
          email: userData.email,
          token: tokenResponse.access_token,
        })
        
        console.log('Respuesta del backend:', authResponse.data)
        
        if (authResponse.data.authorized) {
          const userWithRole = {
            ...userData,
            isSuperadmin: authResponse.data.is_superadmin || false
          }
          setUser(userWithRole)
          setIsSuperadmin(authResponse.data.is_superadmin || false)
          localStorage.setItem('user_data', JSON.stringify(userWithRole))
        } else {
          localStorage.removeItem('google_token')
          alert(`❌ No tienes acceso a esta aplicación.\n\nEmail: ${userData.email}\n\nContacta al administrador para agregar tu email a la lista de usuarios autorizados.`)
        }
      } catch (error: any) {
        console.error('Error durante el login:', error)
        const errorMessage = error.response?.data?.detail || error.message || 'Error desconocido'
        console.error('Mensaje de error del backend:', errorMessage)
        localStorage.removeItem('google_token')
        alert(`Error al iniciar sesión:\n\n${errorMessage}\n\nPor favor, verifica tu configuración o contacta al administrador.`)
      }
    },
    onError: () => {
      alert('Error al iniciar sesión con Google')
    },
  })

  const logout = () => {
    setUser(null)
    setIsSuperadmin(false)
    localStorage.removeItem('google_token')
    localStorage.removeItem('user_data')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isSuperadmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
