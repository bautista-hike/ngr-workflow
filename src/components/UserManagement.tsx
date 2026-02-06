import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, addUser, removeUser, UserListResponse } from '../api/adminApi'

interface UserManagementProps {
  onClose: () => void
}

export default function UserManagement({ onClose }: UserManagementProps) {
  const [newUserEmail, setNewUserEmail] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<UserListResponse>({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  const addUserMutation = useMutation({
    mutationFn: addUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setMessage({ type: 'success', text: 'Usuario agregado exitosamente' })
      setNewUserEmail('')
      setTimeout(() => setMessage(null), 3000)
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Error al agregar usuario' })
      setTimeout(() => setMessage(null), 5000)
    },
  })

  const removeUserMutation = useMutation({
    mutationFn: removeUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setMessage({ type: 'success', text: 'Usuario eliminado exitosamente' })
      setTimeout(() => setMessage(null), 3000)
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Error al eliminar usuario' })
      setTimeout(() => setMessage(null), 5000)
    },
  })

  const handleAddUser = () => {
    if (!newUserEmail.trim()) {
      setMessage({ type: 'error', text: 'Por favor ingresa un email válido' })
      setTimeout(() => setMessage(null), 3000)
      return
    }
    addUserMutation.mutate(newUserEmail.trim())
  }

  const handleRemoveUser = (email: string) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar a ${email}?`)) {
      removeUserMutation.mutate(email)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">👥 Administración de Usuarios</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {message && (
            <div
              className={`mb-4 p-3 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-900/30 border border-green-600 text-green-300'
                  : 'bg-red-900/30 border border-red-600 text-red-300'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Agregar nuevo usuario */}
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">Agregar Nuevo Usuario</h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                className="flex-1 px-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddUser()
                  }
                }}
              />
              <button
                onClick={handleAddUser}
                disabled={addUserMutation.isPending}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {addUserMutation.isPending ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>

          {/* Lista de usuarios */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <p className="mt-2 text-gray-400">Cargando usuarios...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-900/30 border border-red-600 rounded-md text-red-300">
              Error al cargar usuarios. Por favor, intenta nuevamente.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Superadmins */}
              {data && data.superadmins.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    🔑 Superadmins ({data.total_superadmins})
                  </h3>
                  <div className="space-y-2">
                    {data.superadmins.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-orange-500">🔑</span>
                          <span className="text-white font-medium">{email}</span>
                        </div>
                        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-700 rounded">
                          No se puede eliminar
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Usuarios autorizados */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  👤 Usuarios Autorizados ({data?.total_users || 0})
                </h3>
                {data && data.authorized_users.length === 0 ? (
                  <p className="text-gray-400 p-4 bg-gray-800 rounded-lg border border-gray-700">
                    No hay usuarios autorizados
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data?.authorized_users.map((email) => {
                      const isSuperadmin = data.superadmins.includes(email)
                      return (
                        <div
                          key={email}
                          className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            {isSuperadmin && <span className="text-orange-500">🔑</span>}
                            <span className="text-white">{email}</span>
                          </div>
                          {!isSuperadmin && (
                            <button
                              onClick={() => handleRemoveUser(email)}
                              disabled={removeUserMutation.isPending}
                              className="px-3 py-1 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
