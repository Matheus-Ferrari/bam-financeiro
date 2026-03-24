import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Sliders,
  Settings,
  ChevronRight,
  Users,
  HeartPulse,
  FolderPlus,
  Award,
  CreditCard,
} from 'lucide-react'
import { useHealth } from '../hooks/useFinanceiro'

const NAV_ITEMS = [
  { to: '/dashboard',           label: 'Dashboard',           icon: LayoutDashboard },
  { to: '/clientes',            label: 'Clientes',            icon: Users           },
  { to: '/receitas',            label: 'Receitas',            icon: TrendingUp      },
  { to: '/despesas',            label: 'Despesas',            icon: TrendingDown    },
  { to: '/despesas-locais',     label: 'Despesas Fixas',      icon: CreditCard      },
  { to: '/projetos-adicionais', label: 'Proj. Adicionais',   icon: FolderPlus      },
  { to: '/comissoes',           label: 'Comissões',           icon: Award           },
  { to: '/projecoes',           label: 'Projeções',           icon: BarChart2       },
  { to: '/cenarios',            label: 'Cenários',            icon: Sliders         },
  { to: '/saude',               label: 'Saúde Financeira',    icon: HeartPulse      },
  { to: '/configuracoes',       label: 'Configurações',       icon: Settings        },
]

const PAGE_TITLES = {
  '/dashboard':           'Dashboard',
  '/receitas':            'Receitas',
  '/despesas':            'Despesas',
  '/despesas-locais':     'Despesas Fixas',
  '/projetos-adicionais': 'Projetos Adicionais',
  '/comissoes':           'Comissões',
  '/projecoes':           'Projeções',
  '/cenarios':            'Cenários',
  '/clientes':            'Clientes',
  '/saude':               'Saúde Financeira',
  '/configuracoes':       'Configurações',
}

export default function MainLayout() {
  const location = useLocation()
  const { data: health } = useHealth()
  const pageTitle = PAGE_TITLES[location.pathname] || 'BAM Financeiro'
  const apiOk     = health?.status === 'ok'

  return (
    <div className="flex h-screen bg-black overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-bam-border bg-bam-surface-2"
             style={{ background: '#0D1012', borderColor: 'rgba(255,255,255,0.06)' }}>

        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b"
             style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <img
            src="/LogoBam.png"
            alt="BAM Financeiro"
            className="h-9 w-auto object-contain"
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            Menu
          </p>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-bam-green-glow text-bam-green'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
              style={({ isActive }) => isActive ? { color: '#12F0C6', background: 'rgba(18,240,198,0.08)' } : {}}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={12} style={{ color: '#12F0C6' }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status API */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${apiOk ? 'bg-green-400' : 'bg-red-500'}`}
                  style={apiOk ? { background: '#12F0C6', boxShadow: '0 0 6px #12F0C6' } : {}} />
            <span className="text-xs text-gray-500">
              API {apiOk ? 'conectada' : 'offline'}
            </span>
          </div>
          <p className="text-[10px] text-gray-700 mt-1">v1.0.0 · BAM Financeiro</p>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b flex-shrink-0"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#000' }}>
          <div>
            <h1 className="text-lg font-semibold text-white">{pageTitle}</h1>
            <p className="text-xs text-gray-500 -mt-0.5">BAM Financeiro · Gestão Executiva</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <img
              src="/LogoBam.png"
              alt="BAM"
              className="h-8 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
            />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8 page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
