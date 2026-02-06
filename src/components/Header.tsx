import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'
import UserManagement from './UserManagement'

export default function Header() {
  const { user, logout, isSuperadmin } = useAuth()
  const [showUserManagement, setShowUserManagement] = useState(false)

  return (
    <header className="bg-gray-900 shadow-lg border-b border-gray-800 mb-8">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Procesamiento y Validación de Facturas
            </h1>
            <p className="text-sm text-gray-300 mt-1">
              Carga una imagen de factura para extraer y validar sus datos
            </p>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                {isSuperadmin && (
                  <button
                    onClick={() => setShowUserManagement(true)}
                    className="px-4 py-2 text-sm text-white bg-orange-600 rounded-md hover:bg-orange-700 transition-colors"
                  >
                    👥 Administrar Usuarios
                  </button>
                )}
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                  {isSuperadmin && (
                    <p className="text-xs text-orange-500 font-semibold">Superadmin</p>
                  )}
                </div>
                {user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-10 h-10 rounded-full border-2 border-orange-500"
                  />
                )}
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showUserManagement && (
        <UserManagement onClose={() => setShowUserManagement(false)} />
      )}
    </header>
  )
}
