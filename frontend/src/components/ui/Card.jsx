/**
 * Card base reutilizável — superfície grafite com borda sutil.
 * Props: title, subtitle, action (ReactNode), className, children
 */
export default function Card({ title, subtitle, action, className = '', children }) {
  return (
    <div
      className={`rounded-xl border p-5 ${className}`}
      style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      {(title || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title    && <h3 className="text-sm font-semibold text-white">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="ml-4 flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
