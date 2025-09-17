interface GlassButtonProps {
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
}

export function GlassButton({
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  children,
  className = ''
}: GlassButtonProps) {
  const getVariantStyles = () => {
    const variants = {
      primary: 'bg-blue-600/80 hover:bg-blue-600 border-blue-400/50 shadow-blue-500/25',
      secondary: 'bg-gray-600/80 hover:bg-gray-600 border-gray-400/50 shadow-gray-500/25',
      success: 'bg-green-600/80 hover:bg-green-600 border-green-400/50 shadow-green-500/25',
      danger: 'bg-red-600/80 hover:bg-red-600 border-red-400/50 shadow-red-500/25',
      warning: 'bg-yellow-600/80 hover:bg-yellow-600 border-yellow-400/50 shadow-yellow-500/25'
    }
    return variants[variant]
  }

  const getSizeStyles = () => {
    const sizes = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-6 py-4 text-lg'
    }
    return sizes[size]
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${getSizeStyles()}
        ${disabled ? 'bg-gray-600/30 border-gray-500/30 text-gray-500 cursor-not-allowed' : `${getVariantStyles()} text-white shadow-lg`}
        border rounded-lg font-medium transition-all duration-200
        ${className}
      `}
    >
      {children}
    </button>
  )
}