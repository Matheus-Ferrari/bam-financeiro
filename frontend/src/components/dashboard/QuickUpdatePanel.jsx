import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { quickUpdateAPI } from '../../services/api'
import { formatCurrency } from '../../utils/formatters'

const EXAMPLES = [
  'Cliente Atlas pagou 1200 hoje',
  'Marcar Promanage como pago',
  'Adicionar despesa de servidor de 500',
  'Atualizar caixa para 11000',
]

export default function QuickUpdatePanel({ onApplied }) {
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [parseResult, setParseResult] = useState(null)
  const [error, setError] = useState('')

  // Refs para controle sem re-render
  const recognitionRef    = useRef(null)
  const shouldKeepRef     = useRef(false) // true enquanto o usuário não clicou em "Parar"
  const finalAccumRef     = useRef('')    // espelho do texto acumulado para callbacks fechados

  const speechSupported = useMemo(
    () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  )

  // Cria (ou recria) a instância de reconhecimento e instala os handlers
  const buildRecognition = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new Recognition()
    rec.lang = 'pt-BR'
    rec.interimResults = true
    rec.continuous = true   // ← mantém ativo mesmo com pausa natural

    rec.onresult = (event) => {
      let newFinal = ''
      let newInterim = ''

      // Percorre apenas os resultados novos desta sessão
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? ''
        if (event.results[i].isFinal) {
          newFinal += piece + ' '
        } else {
          newInterim = piece
        }
      }

      if (newFinal) {
        // Acumula ao texto já salvo; não apaga nada anterior
        finalAccumRef.current = (finalAccumRef.current + newFinal).trimStart()
        setText(finalAccumRef.current)
        setInterim('')
      } else {
        setInterim(newInterim)
      }
    }

    rec.onerror = (e) => {
      // "no-speech" e "aborted" são esperados em pausa/restart — ignorar
      if (e.error === 'no-speech' || e.error === 'aborted') return
      shouldKeepRef.current = false
      setListening(false)
      setInterim('')
      setError('Erro no microfone: ' + e.error + '. Tente novamente.')
    }

    rec.onend = () => {
      setInterim('')
      // Reinicia automaticamente se o usuário ainda não clicou em "Parar"
      if (shouldKeepRef.current) {
        try { rec.start() } catch { /* ignora se já estava a iniciar */ }
      } else {
        setListening(false)
      }
    }

    return rec
  }

  useEffect(() => {
    return () => {
      shouldKeepRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch { /* nada */ }
      }
    }
  }, [])

  const startListening = () => {
    if (!speechSupported) return
    setError('')
    setParseResult(null)
    finalAccumRef.current = text  // preserva o que já estava digitado

    const rec = buildRecognition()
    recognitionRef.current = rec
    shouldKeepRef.current = true
    setListening(true)
    try { rec.start() } catch { /* já iniciado */ }
  }

  const stopListening = () => {
    shouldKeepRef.current = false
    if (interim.trim()) {
      const consolidated = `${finalAccumRef.current} ${interim}`.trim()
      finalAccumRef.current = consolidated
      setText(consolidated)
    }
    setListening(false)
    setInterim('')
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* nada */ }
    }
  }

  const toggleListening = () => {
    if (!speechSupported) return
    if (listening) stopListening()
    else startListening()
  }

  const handleParse = async () => {
    if (!text.trim()) return
    setError('')
    setParsing(true)
    setParseResult(null)
    try {
      const res = await quickUpdateAPI.parse(text.trim())
      setParseResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Falha ao interpretar atualização.')
    } finally {
      setParsing(false)
    }
  }

  const handleApply = async () => {
    if (!parseResult) return
    setError('')
    setApplying(true)
    try {
      await quickUpdateAPI.apply({
        parsed_payload: parseResult,
        confirmed: true,
      })
      setParseResult(null)
      setText('')
      setInterim('')
      finalAccumRef.current = ''
      if (typeof onApplied === 'function') onApplied()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Falha ao aplicar atualização.')
    } finally {
      setApplying(false)
    }
  }

  const parsed = parseResult?.parsed

  return (
    <Card title="Atualização Rápida" subtitle="Digite ou fale, revise a prévia e confirme">
      <div className="space-y-4">
        <div
          className="rounded-lg border p-3"
          style={{
            borderColor: listening ? 'rgba(18,240,198,0.35)' : 'rgba(255,255,255,0.08)',
            background: '#1A1E21',
            transition: 'border-color 0.25s',
          }}
        >
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              finalAccumRef.current = e.target.value
            }}
            rows={3}
            className="w-full resize-none bg-transparent text-sm text-white placeholder:text-gray-600 outline-none"
            placeholder="Ex: Cliente Atlas pagou 1200 hoje"
          />
          {interim && (
            <p className="text-xs mt-1 italic" style={{ color: 'rgba(18,240,198,0.6)' }}>
              {interim}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant={listening ? 'secondary' : 'ghost'} size="sm" onClick={toggleListening} disabled={!speechSupported}>
              {listening ? <MicOff size={13} /> : <Mic size={13} />}
              {listening ? 'Parar' : 'Microfone'}
            </Button>
            {listening && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: '#12F0C6' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#12F0C6' }} />
                Modo contínuo — fale à vontade
              </span>
            )}
            <Button variant="primary" size="sm" onClick={handleParse} disabled={parsing || !text.trim()}>
              {parsing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Gerar prévia
            </Button>
            {parseResult && (
              <Button variant="ghost" size="sm" onClick={() => { setParseResult(null); setError('') }}>
                <XCircle size={13} /> Cancelar prévia
              </Button>
            )}
          </div>
          {!speechSupported && (
            <p className="text-xs text-amber-400 mt-2">Microfone indisponível neste navegador (use Chrome).</p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        {parseResult && (
          <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'rgba(18,240,198,0.2)', background: 'rgba(18,240,198,0.05)' }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Prévia estruturada</p>
              <Badge variant={parseResult.ok ? 'success' : 'warning'} dot>
                {parseResult.ok ? 'Reconhecida' : 'Parcial'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <Item label="Ação" value={parsed?.action_type || '—'} />
              <Item label="Cliente" value={parsed?.cliente || '—'} />
              <Item label="Valor" value={parsed?.valor != null ? formatCurrency(parsed.valor) : '—'} />
              <Item label="Movimentação" value={parsed?.tipo_movimentacao || '—'} />
            </div>

            {(parseResult.warnings || []).length > 0 && (
              <div className="space-y-1">
                {parseResult.warnings.map((warning, idx) => (
                  <p key={idx} className="text-xs text-amber-300">• {warning}</p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={handleApply} disabled={applying}>
                {applying ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Confirmar e aplicar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setParseResult(null)} disabled={applying}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((item) => (
            <button
              key={item}
              onClick={() => setText(item)}
              className="text-[11px] px-2 py-1 rounded-md border transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#9CA3AF' }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

function Item({ label, value }) {
  return (
    <div className="rounded-md px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <p className="text-gray-500">{label}</p>
      <p className="text-white mt-0.5">{value}</p>
    </div>
  )
}
