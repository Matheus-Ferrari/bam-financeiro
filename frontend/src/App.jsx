import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }    from './context/AuthContext'
import ProtectedRoute      from './components/auth/ProtectedRoute'
import MainLayout          from './layouts/MainLayout'
import Dashboard           from './pages/Dashboard'
import Receitas            from './pages/Receitas'
import Despesas            from './pages/Despesas'
import Projecoes           from './pages/Projecoes'
import Cenarios            from './pages/Cenarios'
import Clientes            from './pages/Clientes'
import SaudeFinanceira     from './pages/SaudeFinanceira'
import Configuracoes       from './pages/Configuracoes'

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="receitas"      element={<Receitas />} />
            <Route path="despesas"      element={<Despesas />} />
            <Route path="projecoes"     element={<Projecoes />} />
            <Route path="cenarios"      element={<Cenarios />} />
            <Route path="clientes"      element={<Clientes />} />
            <Route path="saude"         element={<SaudeFinanceira />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}
