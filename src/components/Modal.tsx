import { useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm'
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  type = 'info',
  onConfirm,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
}: ModalProps) {
  // Cerrar con ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      case 'confirm':
        return '❓'
      default:
        return 'ℹ️'
    }
  }

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return {
          border: 'border-green-600',
          bg: 'bg-green-900/20',
          button: 'bg-green-600 hover:bg-green-700',
        }
      case 'warning':
        return {
          border: 'border-yellow-600',
          bg: 'bg-yellow-900/20',
          button: 'bg-yellow-600 hover:bg-yellow-700',
        }
      case 'error':
        return {
          border: 'border-red-600',
          bg: 'bg-red-900/20',
          button: 'bg-red-600 hover:bg-red-700',
        }
      case 'confirm':
        return {
          border: 'border-orange-600',
          bg: 'bg-orange-900/20',
          button: 'bg-orange-600 hover:bg-orange-700',
        }
      default:
        return {
          border: 'border-blue-600',
          bg: 'bg-blue-900/20',
          button: 'bg-blue-600 hover:bg-blue-700',
        }
    }
  }

  const colors = getColorClasses()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className={`relative bg-gray-900 rounded-lg shadow-2xl border-2 ${colors.border} max-w-md w-full transform transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${colors.border} ${colors.bg}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getIcon()}</span>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="text-gray-300">{children}</div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex gap-3 justify-end">
          {type === 'confirm' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors font-medium border border-gray-700"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) {
                onConfirm()
              } else {
                onClose()
              }
            }}
            className={`px-4 py-2 ${colors.button} text-white rounded-md transition-colors font-medium`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
