/**
 * Botão primário/secondary/ghost reutilizável.
 */
const VARIANTS = {
  primary:   'text-black font-semibold hover:opacity-90',
  secondary: 'text-white border hover:bg-white/5',
  ghost:     'text-gray-400 hover:text-white hover:bg-white/5',
}

export default function Button({ children, variant = 'primary', size = 'md', onClick, disabled, className = '', type = 'button' }) {
  const base  = 'inline-flex items-center gap-2 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 disabled:opacity-40 disabled:pointer-events-none'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }

  const style = variant === 'primary'
    ? { background: '#12F0C6', '--tw-ring-color': '#12F0C6' }
    : { '--tw-ring-color': '#12F0C6', borderColor: 'rgba(255,255,255,0.12)' }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`${base} ${sizes[size] || sizes.md} ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
