import { AlertTriangle } from 'lucide-react'

export default function EmptyState({ title = 'Sem dados', description = 'Nenhum dado disponível.', icon: Icon = AlertTriangle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
           style={{ background: 'rgba(18,240,198,0.08)' }}>
        <Icon size={22} style={{ color: '#12F0C6' }} />
      </div>
      <p className="text-sm font-medium text-gray-300">{title}</p>
      <p className="text-xs text-gray-600 mt-1 max-w-xs">{description}</p>
    </div>
  )
}
