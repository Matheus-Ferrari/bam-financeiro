import { useState, useMemo, useEffect } from 'react'
import {
  Users, Plus, Search, RefreshCw, Edit2, Trash2, DollarSign, CheckCircle,
  TrendingUp, AlertTriangle, Phone, MessageCircle, Mail, Eye, Copy, Clock,
  FileText, Receipt, FolderPlus,
} from 'lucide-react'
import { useClientes, useFechamento } from '../hooks/useFinanceiro'
import { clientesAPI } from '../services/api'
import ProjetosAdicionais from './ProjetosAdicionais'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import ModalCliente from '../components/modals/ModalCliente'
import DrawerCliente from '../components/modals/DrawerCliente'
import { formatCompact, formatCurrency } from '../utils/formatters'

const GREEN = '#12F0C6'

const STATUS_BADGE = {
  ativo:     'success',
  inativo:   'error',
  prospecto: 'warning',
}

const STATUS_PGTO_BADGE = {
  pago:     'success',
  pendente: 'warning',
  atrasado: 'error',
}

const COBRANCA_BADGE = {
  sem_cobrar:          'neutral',
  cobrar_hoje:         'error',
  cobrado:             'info',
  aguardando_retorno:  'warning',
  prometeu_pagamento:  'info',
  pago:                'success',
  atrasado:            'error',
}

const COBRANCA_LABEL = {
  sem_cobrar:         'Sem cobrar',
  cobrar_hoje:        'Cobrar hoje',
  cobrado:            'Cobrado',
  aguardando_retorno: 'Aguardando',
  prometeu_pagamento: 'Prometeu pagar',
  pago:               'Pago',
  atrasado:           'Atrasado',
}

const TEMPLATES_MSG = {
  cobranca_whatsapp: (c) =>
    `Olá, ${c.nome_contato_principal || c.nome_contato_financeiro || c.responsavel || c.nome}! Tudo bem? Estou entrando em contato para lembrar sobre o pagamento referente ao serviço deste mês. Qualquer dúvida, fico à disposição.`,
  cobranca_email_assunto: (c) =>
    `Cobrança / lembrete de pagamento - ${c.empresa || c.nome}`,
  cobranca_email_corpo: (c) =>
    `Olá, ${c.nome_contato_financeiro || c.nome_contato_principal || c.responsavel || c.nome}, tudo bem?\n\nEstamos enviando este lembrete referente ao pagamento do período atual.\nQualquer dúvida, ficamos à disposição.\n\nAtenciosamente.`,
  envio_nf: (c) =>
    `Olá, ${c.nome_contato_financeiro || c.responsavel || c.nome}! Segue em anexo a Nota Fiscal referente aos serviços prestados neste mês. Qualquer dúvida, estamos à disposição.`,
  envio_boleto: (c) =>
    `Olá, ${c.nome_contato_financeiro || c.responsavel || c.nome}! Segue o boleto referente ao pagamento deste mês. Qualquer dúvida, ficamos à disposição.`,
}

function copyText(text) {
  navigator.clipboard.writeText(text)
}

function abrirWhatsApp(cliente) {
  const fone = (cliente.whatsapp || cliente.whatsapp_financeiro || cliente.telefone || '').replace(/\D/g, '')
  if (!fone) return
  const msg = encodeURIComponent(TEMPLATES_MSG.cobranca_whatsapp(cliente))
  window.open(`https://wa.me/55${fone}?text=${msg}`, '_blank')
}

function abrirEmail(cliente) {
  const email = cliente.email_financeiro || cliente.email_principal || ''
  if (!email) return
  const assunto = encodeURIComponent(TEMPLATES_MSG.cobranca_email_assunto(cliente))
  const corpo = encodeURIComponent(TEMPLATES_MSG.cobranca_email_corpo(cliente))
  window.open(`mailto:${email}?subject=${assunto}&body=${corpo}`, '_self')
}

export default function Clientes() {
  const { data, loading, error, refetch } = useClientes()

  // ── Competência atual ──────────────────────────────────────────
  const competencia = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  // Buscar dados do Fechamento (mesma fonte que FechamentoMes usa)
  const { data: fechData, refetch: refetchFech } = useFechamento(competencia)

  // Tab principal
  const [abaAtiva, setAbaAtiva]           = useState('clientes')

  // Filtros tabela clientes
  const [search, setSearch]               = useState('')
  const [statusFiltro, setStatus]         = useState('todos')
  const [filtroCobranca, setFiltroCob]    = useState('todos')
  const [filtroPgto, setFiltroPgto]       = useState('todos')

  // Modal criar/editar
  const [modalOpen, setModalOpen]         = useState(false)
  const [editTarget, setEditTarget]       = useState(null)

  // Drawer detalhes
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [drawerCliente, setDrawerCliente] = useState(null)

  // Delete
  const [deleting, setDeleting]           = useState(null)
  const [confirmDel, setConfirmDel]       = useState(null)

  // Loading states
  const [updatingPgto, setUpdatingPgto]   = useState(null)

  // ── Merge: backend clientes + fechamento values + localStorage ─
  // Fonte de verdade para valores: Fechamento page usa backend clientes_pagos/
  // clientes_pendentes + localStorage overrides. Reproduzimos a mesma lógica.
  const clientes = useMemo(() => {
    const raw = data?.clientes ?? []

    // Mapa de valores do fechamento (clientes_pagos + clientes_pendentes)
    const fechClientes = [
      ...(fechData?.clientes_pagos ?? []),
      ...(fechData?.clientes_pendentes ?? []),
    ]
    const fechMap = {}
    for (const fc of fechClientes) {
      fechMap[fc.id] = fc
    }

    // localStorage overrides (mesma chave que FechamentoMes.jsx)
    let cliOv = {}
    let cliMn = []
    try { cliOv = JSON.parse(localStorage.getItem(`bam-cov-${competencia}`) || '{}') } catch {}
    try { cliMn = JSON.parse(localStorage.getItem(`bam-cmn-${competencia}`) || '[]') } catch {}

    // Merge: raw backend → fechamento values → localStorage overrides
    const base = raw
      .map(c => ({ ...c, ...(fechMap[c.id] || {}), ...(cliOv[c.id] || {}) }))
      .filter(c => !cliOv[c.id]?._hidden)

    // Clientes manuais adicionados no Fechamento
    const manuais = cliMn
      .map(c => ({ ...c, ...(cliOv[c.id] || {}) }))
      .filter(c => !cliOv[c.id]?._hidden)

    return [...base, ...manuais]
  }, [data, fechData, competencia])

  // ── Resumo recalculado com dados mesclados ─────────────────────
  const resumo = useMemo(() => {
    const backendResumo = data?.resumo ?? {}
    const ativosArr = clientes.filter(c => c.status === 'ativo')
    const hoje = new Date().getDate()

    // "Previsto" = receita pendente: apenas ativos ainda não pagos
    // (mesma base do Fechamento do Mês — clientes pendentes, incluindo extras não pagos)
    const pendenteArr = ativosArr.filter(c => c.status_pagamento !== 'pago')
    // Extras manuais do fechamento ainda não pagos
    const extrasNaoPagos = (fechData?.clientes_extras ?? []).filter(c => c.status_pagamento !== 'pago')
    const totalPrevisto = [...pendenteArr, ...extrasNaoPagos].reduce((s, c) =>
      s + parseFloat(c.valor_previsto || c.valor_mensal || 0), 0)

    // "Recebido" = soma de pagos normais + extras pagos
    const extrasPagos = (fechData?.clientes_extras ?? []).filter(c => c.status_pagamento === 'pago')
    const totalRecebido = [
      ...clientes.filter(c => c.status_pagamento === 'pago'),
      ...extrasPagos,
    ].reduce((s, c) => s + parseFloat(c.valor_recebido || c.valor_mensal || c.valor_previsto || 0), 0)

    const pagosMes = clientes.filter(c =>
      c.status === 'ativo' && c.status_pagamento === 'pago'
    ).length

    let emAtraso = 0
    for (const c of ativosArr) {
      if (c.status_pagamento !== 'pago') {
        const dia = c.dia_pagamento
        if (dia && hoje > dia) emAtraso++
      }
    }

    return {
      ...backendResumo,
      total:                  clientes.length,
      ativos:                 ativosArr.length,
      total_previsto_receber: Math.round(totalPrevisto * 100) / 100,
      total_recebido:         Math.round(totalRecebido * 100) / 100,
      pagos_mes:              pagosMes,
      em_atraso:              emAtraso,
    }
  }, [clientes, data, fechData])
  const filtered = useMemo(() => clientes.filter(c => {
    const matchStatus = statusFiltro === 'todos' || c.status === statusFiltro
    const diaHj = new Date().getDate()
    const matchPgto =
      filtroPgto === 'todos' ||
      (filtroPgto === 'pago'     && c.status_pagamento === 'pago') ||
      (filtroPgto === 'pendente' && c.status_pagamento !== 'pago') ||
      (filtroPgto === 'atrasado' && (c.status_pagamento === 'atrasado' || (c.status_pagamento !== 'pago' && c.dia_pagamento && diaHj > c.dia_pagamento)))
    const matchCob =
      filtroCobranca === 'todos' ||
      (filtroCobranca === 'em_atraso'   && (c.status_pagamento === 'pendente' || c.cobranca_status === 'atrasado')) ||
      (filtroCobranca === 'nao_pagos'   && c.status_pagamento !== 'pago') ||
      (filtroCobranca === 'cobrar_hoje' && c.cobranca_status === 'cobrar_hoje')
    const q = search.toLowerCase()
    const matchSearch = !q || c.nome?.toLowerCase().includes(q) || c.responsavel?.toLowerCase().includes(q) || c.empresa?.toLowerCase().includes(q)
    return matchStatus && matchCob && matchPgto && matchSearch
  }), [clientes, statusFiltro, filtroPgto, filtroCobranca, search])

  // ── Agenda de cobrança ─────────────────────────────────────────
  const diaHoje = new Date().getDate()

  const cobrarHoje = useMemo(() =>
    clientes.filter(c => c.status === 'ativo' && c.status_pagamento !== 'pago' && c.dia_pagamento === diaHoje)
  , [clientes, diaHoje])

  const vencendoBreve = useMemo(() =>
    clientes.filter(c => c.status === 'ativo' && c.status_pagamento !== 'pago' && c.dia_pagamento && c.dia_pagamento > diaHoje && c.dia_pagamento <= diaHoje + 5)
  , [clientes, diaHoje])

  const atrasados = useMemo(() =>
    clientes.filter(c => c.status === 'ativo' && c.status_pagamento !== 'pago' && c.dia_pagamento && c.dia_pagamento < diaHoje)
  , [clientes, diaHoje])

  // ── Handlers ───────────────────────────────────────────────────
  const refetchAll = () => { refetch(); refetchFech() }

  const handleSave = async (formData) => {
    if (editTarget) {
      await clientesAPI.update(editTarget.id, formData)
    } else {
      await clientesAPI.create(formData)
    }
    refetchAll()
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try { await clientesAPI.remove(id); setConfirmDel(null); refetchAll() }
    finally { setDeleting(null) }
  }

  const handlePagamento = async (cliente, status) => {
    setUpdatingPgto(cliente.id)
    try {
      const updateData = {
        status_pagamento: status,
        data_pagamento:   status === 'pago' ? new Date().toISOString() : null,
        valor_recebido:   status === 'pago'
          ? (cliente.valor_recebido || cliente.valor_previsto || cliente.valor_mensal || 0)
          : (cliente.valor_recebido || 0),
        mes_referencia_pagamento: new Date().toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        cobranca_status: status === 'pago' ? 'pago' : cliente.cobranca_status,
      }
      await clientesAPI.update(cliente.id, updateData)
      // Sincronizar com localStorage do Fechamento para manter consistência
      try {
        const key = `bam-cov-${competencia}`
        const ov = JSON.parse(localStorage.getItem(key) || '{}')
        ov[cliente.id] = { ...(ov[cliente.id] || {}), ...updateData }
        localStorage.setItem(key, JSON.stringify(ov))
      } catch {}
      refetchAll()
    } finally { setUpdatingPgto(null) }
  }

  const handleCobranca = async (cliente, cobrancaStatus) => {
    await clientesAPI.update(cliente.id, {
      cobranca_status: cobrancaStatus,
      ultimo_contato:  new Date().toISOString().slice(0, 10),
    })
    refetchAll()
  }

  const openCreate  = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit    = (c) => { setEditTarget(c); setModalOpen(true); setDrawerOpen(false) }
  const openDrawer  = (c) => { setDrawerCliente(c); setDrawerOpen(true) }

  const emAtraso = atrasados.length
  const pagosMes = resumo.pagos_mes ?? 0

  if (loading) return <LoadingSpinner label="Carregando clientes..." />
  if (error)   return <p className="text-red-400 text-sm">{error}</p>

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPI cards - SEMPRE total geral */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiMini icon={<Users size={15} style={{ color: GREEN }} />}                  label="Total"     value={resumo.total ?? 0}                          color={GREEN} />
        <KpiMini icon={<CheckCircle size={15} style={{ color: '#10B981' }} />}         label="Ativos"    value={resumo.ativos ?? 0}                         color="#10B981" />
        <KpiMini icon={<DollarSign size={15} style={{ color: '#6366F1' }} />}          label="Previsto"  value={formatCompact(resumo.total_previsto_receber ?? 0)} color="#6366F1" />
        <KpiMini icon={<TrendingUp size={15} style={{ color: '#F59E0B' }} />}          label="Recebido"  value={formatCompact(resumo.total_recebido ?? 0)}  color="#F59E0B" />
        <KpiMini icon={<CheckCircle size={15} style={{ color: GREEN }} />}             label="Pagos"     value={pagosMes}                                   color={GREEN} />
        <KpiMini icon={<AlertTriangle size={15} style={{ color: '#EF4444' }} />}       label="Em Atraso" value={emAtraso}                                   color="#EF4444" />
      </div>

      {/* Abas: Clientes | Cobrança | Proj. Adicionais */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {[
          { key: 'clientes',  label: 'Clientes',              icon: Users      },
          { key: 'cobranca',  label: 'Cobrança & Faturamento',icon: Receipt    },
          { key: 'projetos',  label: 'Proj. Adicionais',      icon: FolderPlus },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setAbaAtiva(tab.key)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2"
            style={abaAtiva === tab.key
              ? { color: GREEN, borderColor: GREEN }
              : { color: '#6B7280', borderColor: 'transparent' }}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ ABA: CLIENTES ═══ */}
      {abaAtiva === 'clientes' && (
        <Card
          title="Base de Clientes"
          subtitle={`${filtered.length} de ${clientes.length} clientes`}
          action={
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus size={13} /> Novo Cliente
            </Button>
          }
        >
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600"
                placeholder="Buscar por nome, responsável ou empresa..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {['todos','ativo','inativo','prospecto'].map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
                  style={statusFiltro === s ? { background: GREEN, color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>
                  {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'todos',    label: 'Todos Pgto' },
                { key: 'pago',     label: 'Pagos' },
                { key: 'pendente', label: 'Pendentes' },
                { key: 'atrasado', label: 'Atrasados' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setFiltroPgto(key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={filtroPgto === key
                    ? { background: key === 'atrasado' ? '#EF4444' : GREEN, color: '#000' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'todos',       label: 'Todos' },
                { key: 'nao_pagos',   label: 'Não Pagos' },
                { key: 'em_atraso',   label: 'Em Atraso' },
                { key: 'cobrar_hoje', label: 'Cobrar Hoje' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setFiltroCob(key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={filtroCobranca === key
                    ? { background: key === 'todos' ? GREEN : '#EF4444', color: '#000' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>
                  {label}
                </button>
              ))}
            </div>

            <Button variant="ghost" size="sm" onClick={refetchAll}><RefreshCw size={13} /></Button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Nenhum cliente encontrado" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {['Nome','Status','Pagamento','Dia Pagt.','Previsto','Recebido','Pendente','Cobrança','Contato','Ações'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const temWpp  = !!(c.whatsapp || c.whatsapp_financeiro || c.telefone)
                    const temMail = !!(c.email_financeiro || c.email_principal)
                    return (
                      <tr key={c.id}
                          className="border-b hover:bg-white/[0.03] transition-colors cursor-pointer"
                          style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                          onClick={() => openDrawer(c)}>
                        <td className="py-3 px-3">
                          <p className="font-medium text-white">{c.nome}</p>
                          {c.responsavel && <p className="text-gray-600 text-[10px]">{c.responsavel}</p>}
                          {c.empresa && <p className="text-gray-700 text-[10px]">{c.empresa}</p>}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={STATUS_BADGE[c.status] ?? 'neutral'} dot>{c.status}</Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={STATUS_PGTO_BADGE[(c.status_pagamento || 'pendente').toLowerCase()] ?? 'warning'} dot>
                            {c.status_pagamento || 'pendente'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-gray-400">
                          {c.dia_pagamento ? `Dia ${c.dia_pagamento}` : '—'}
                        </td>
                        <td className="py-3 px-3 font-semibold" style={{ color: GREEN }}>
                          {formatCompact(c.valor_previsto ?? c.valor_mensal ?? 0)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {formatCompact(c.valor_recebido ?? 0)}
                        </td>
                        <td className="py-3 px-3 font-semibold">
                          {c.status_pagamento === 'pago' ? (
                            <span className="text-gray-600 text-[10px]">—</span>
                          ) : (
                            <span style={{ color: '#F59E0B' }}>
                              {formatCompact(Math.max(parseFloat(c.valor_previsto ?? c.valor_mensal ?? 0) - parseFloat(c.valor_recebido ?? 0), parseFloat(c.valor_previsto ?? c.valor_mensal ?? 0)))}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {c.cobranca_status && c.cobranca_status !== 'sem_cobrar' ? (
                            <Badge variant={COBRANCA_BADGE[c.cobranca_status] ?? 'neutral'} dot>
                              {COBRANCA_LABEL[c.cobranca_status] ?? c.cobranca_status}
                            </Badge>
                          ) : (
                            <span className="text-gray-700 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {temWpp && (
                              <button onClick={() => abrirWhatsApp(c)} title="WhatsApp"
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-green-500/10 transition">
                                <MessageCircle size={11} style={{ color: '#25D366' }} />
                              </button>
                            )}
                            {temMail && (
                              <button onClick={() => abrirEmail(c)} title="E-mail"
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-indigo-500/10 transition">
                                <Mail size={11} style={{ color: '#818CF8' }} />
                              </button>
                            )}
                            {!temWpp && !temMail && <span className="text-gray-700 text-[10px]">—</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => openDrawer(c)} title="Ver detalhes"
                              className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-[#12F0C6] hover:bg-[#12F0C6]/10 transition-colors">
                              <Eye size={12} />
                            </button>
                            {c.status_pagamento !== 'pago' ? (
                              <button onClick={() => handlePagamento(c, 'pago')} disabled={updatingPgto === c.id}
                                className="px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap"
                                style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                                Marcar pago
                              </button>
                            ) : (
                              <button onClick={() => handlePagamento(c, 'pendente')} disabled={updatingPgto === c.id}
                                title="Clique para reverter para pendente"
                                className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold border border-transparent hover:border-white/20 transition"
                                style={{ color: GREEN }}>
                                <CheckCircle size={10} /> Pago
                              </button>
                            )}
                            {c.status_pagamento !== 'pago' && (
                              <button onClick={() => handleCobranca(c, 'cobrado')} title="Marcar como cobrado"
                                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                                <Phone size={11} />
                              </button>
                            )}
                            <button onClick={() => openEdit(c)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-[#12F0C6] hover:bg-[#12F0C6]/10 transition-colors">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => setConfirmDel(c)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ═══ ABA: COBRANÇA & FATURAMENTO ═══ */}
      {abaAtiva === 'cobranca' && (
        <div className="space-y-6">

          {/* A) Clientes a Cobrar */}
          <Card title="Clientes a Cobrar" subtitle={`${clientes.filter(c => c.status === 'ativo' && c.status_pagamento !== 'pago').length} pendentes`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {['Nome','Vencimento','Previsto','Status','Contato','Ações'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientes
                    .filter(c => c.status === 'ativo' && c.status_pagamento !== 'pago')
                    .sort((a, b) => (a.dia_pagamento || 31) - (b.dia_pagamento || 31))
                    .map(c => {
                      const temWpp = !!(c.whatsapp || c.whatsapp_financeiro || c.telefone)
                      const temMail = !!(c.email_financeiro || c.email_principal)
                      const isAtrasado = c.dia_pagamento && diaHoje > c.dia_pagamento
                      return (
                        <tr key={c.id} className="border-b hover:bg-white/[0.03]" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <td className="py-3 px-3">
                            <p className="font-medium text-white">{c.nome}</p>
                            {c.responsavel && <p className="text-gray-600 text-[10px]">{c.responsavel}</p>}
                          </td>
                          <td className="py-3 px-3">
                            {c.dia_pagamento ? (
                              <span className={isAtrasado ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                                Dia {c.dia_pagamento} {isAtrasado && '(atrasado)'}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-3 font-semibold" style={{ color: GREEN }}>
                            {formatCurrency(c.valor_previsto ?? c.valor_mensal ?? 0)}
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={isAtrasado ? 'error' : 'warning'} dot>
                              {isAtrasado ? 'Atrasado' : 'Pendente'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-gray-400 text-[10px]">
                            {c.forma_contato || '—'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              {temWpp && (
                                <button onClick={() => abrirWhatsApp(c)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                                  style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}>
                                  <MessageCircle size={10} /> WhatsApp
                                </button>
                              )}
                              {temMail && (
                                <button onClick={() => abrirEmail(c)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                                  style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>
                                  <Mail size={10} /> E-mail
                                </button>
                              )}
                              <button onClick={() => handlePagamento(c, 'pago')} disabled={updatingPgto === c.id}
                                className="px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap"
                                style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                                Marcar pago
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  {clientes.filter(c => c.status === 'ativo' && c.status_pagamento !== 'pago').length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-xs text-gray-600">Todos os clientes estão pagos!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* B) NF e Boleto */}
          <Card title="NF e Boleto" subtitle="Estrutura preparada para futura integração via API">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <MiniCard label="NF emitidas" value="—" sublabel="Aguardando integração" color="#818CF8" icon={<FileText size={14} />} />
              <MiniCard label="Boletos gerados" value="—" sublabel="Aguardando integração" color="#F59E0B" icon={<Receipt size={14} />} />
              <MiniCard label="Cobranças enviadas" value="—" sublabel="Aguardando integração" color={GREEN} icon={<Mail size={14} />} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {['Cliente','CNPJ','Cód. Serviço NF','Status NF','Status Boleto','Última Emissão'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientes.filter(c => c.status === 'ativo').map(c => (
                    <tr key={c.id} className="border-b hover:bg-white/[0.03]" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      <td className="py-3 px-3 text-white font-medium">{c.nome}</td>
                      <td className="py-3 px-3 text-gray-400">{c.cnpj_cpf || c.cnpj_faturamento || '—'}</td>
                      <td className="py-3 px-3 text-gray-400">{c.codigo_servico_nf || '—'}</td>
                      <td className="py-3 px-3">
                        <Badge variant={c.nf_status === 'emitida' ? 'success' : 'neutral'} dot>
                          {c.nf_status || 'Não emitida'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={c.boleto_status === 'gerado' ? 'success' : 'neutral'} dot>
                          {c.boleto_status || 'Não gerado'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-gray-500">{c.nf_ultima_emissao || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* C) Agenda de Cobrança */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AgendaCard
              title="Cobrar Hoje"
              icon={<AlertTriangle size={14} />}
              color="#EF4444"
              clientes={cobrarHoje}
              onWhatsApp={abrirWhatsApp}
              onEmail={abrirEmail}
              onPago={(c) => handlePagamento(c, 'pago')}
            />
            <AgendaCard
              title="Vencendo em Breve"
              icon={<Clock size={14} />}
              color="#F59E0B"
              clientes={vencendoBreve}
              onWhatsApp={abrirWhatsApp}
              onEmail={abrirEmail}
              onPago={(c) => handlePagamento(c, 'pago')}
            />
            <AgendaCard
              title="Atrasados"
              icon={<AlertTriangle size={14} />}
              color="#EF4444"
              clientes={atrasados}
              onWhatsApp={abrirWhatsApp}
              onEmail={abrirEmail}
              onPago={(c) => handlePagamento(c, 'pago')}
            />
          </div>

          {/* D) Templates de Mensagem */}
          <Card title="Templates de Mensagem" subtitle="Modelos prontos para cobrança e comunicação">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Cobrança WhatsApp', template: TEMPLATES_MSG.cobranca_whatsapp({ nome: '{Nome do Cliente}', nome_contato_principal: '', nome_contato_financeiro: '', responsavel: '', empresa: '' }), color: '#25D366' },
                { title: 'Cobrança E-mail', template: TEMPLATES_MSG.cobranca_email_corpo({ nome: '{Nome do Cliente}', nome_contato_financeiro: '', nome_contato_principal: '', responsavel: '', empresa: '' }), color: '#818CF8' },
                { title: 'Envio de NF', template: TEMPLATES_MSG.envio_nf({ nome: '{Nome do Cliente}', nome_contato_financeiro: '', responsavel: '' }), color: '#F59E0B' },
                { title: 'Envio de Boleto', template: TEMPLATES_MSG.envio_boleto({ nome: '{Nome do Cliente}', nome_contato_financeiro: '', responsavel: '' }), color: GREEN },
              ].map(t => (
                <div key={t.title} className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: t.color }}>{t.title}</p>
                    <button onClick={() => copyText(t.template)} className="text-gray-600 hover:text-white transition" title="Copiar">
                      <Copy size={12} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed whitespace-pre-line">{t.template}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ ABA: PROJETOS ADICIONAIS ═══ */}
      {abaAtiva === 'projetos' && <ProjetosAdicionais />}

      {/* Drawer detalhes */}
      <DrawerCliente
        cliente={drawerCliente}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={openEdit}
        onPagamento={handlePagamento}
      />

      {/* Modal criar/editar */}
      <ModalCliente open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} cliente={editTarget} />

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-semibold text-white">Remover cliente?</p>
            <p className="text-xs text-gray-400">
              Tem certeza que deseja remover <span className="text-white font-medium">{confirmDel.nome}</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)} disabled={!!deleting}>Cancelar</Button>
              <Button size="sm" style={{ background: '#EF4444', color: '#fff' }}
                onClick={() => handleDelete(confirmDel.id)} disabled={!!deleting}>
                {deleting === confirmDel.id ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-componentes ────────────────────────────────────────────── */

function KpiMini({ icon, label, value, color }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2">{icon}<span className="text-xs text-gray-400">{label}</span></div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function MiniCard({ label, value, sublabel, color, icon }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-gray-600">{sublabel}</p>
    </div>
  )
}

function AgendaCard({ title, icon, color, clientes, onWhatsApp, onEmail, onPago }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color }}>{icon}</span>
        <p className="text-xs font-semibold text-gray-300">{title}</p>
        <Badge variant={clientes.length > 0 ? 'error' : 'success'}>{clientes.length}</Badge>
      </div>
      {clientes.length === 0 ? (
        <p className="text-[11px] text-gray-600">Nenhum cliente nesta categoria</p>
      ) : (
        <div className="space-y-2">
          {clientes.map(c => {
            const temWpp = !!(c.whatsapp || c.whatsapp_financeiro || c.telefone)
            const temMail = !!(c.email_financeiro || c.email_principal)
            return (
              <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div>
                  <p className="text-xs text-white font-medium">{c.nome}</p>
                  <p className="text-[10px] text-gray-500">
                    {c.dia_pagamento ? `Dia ${c.dia_pagamento}` : '—'} · {formatCurrency(c.valor_previsto ?? c.valor_mensal ?? 0)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {temWpp && (
                    <button onClick={() => onWhatsApp(c)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-green-500/10">
                      <MessageCircle size={10} style={{ color: '#25D366' }} />
                    </button>
                  )}
                  {temMail && (
                    <button onClick={() => onEmail(c)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-indigo-500/10">
                      <Mail size={10} style={{ color: '#818CF8' }} />
                    </button>
                  )}
                  <button onClick={() => onPago(c)} className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-black" style={{ background: GREEN }}>
                    Pago
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
