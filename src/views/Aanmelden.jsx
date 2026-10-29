import { useEffect, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'
import { TYPES, euro } from '../lib/calc'
import { Search } from '../components/Icons'

const leesCode = () => { try { return localStorage.getItem('fd-code') || '' } catch { return '' } }
const lftTxt = l => l === null || l === undefined ? 'volwassen' : l + ' jaar'

export default function Aanmelden() {
  const { role, toast, setPub } = useApp()
  const [code, setCode] = useState(leesCode)
  const [status, setStatus] = useState('laden')
  const [info, setInfo] = useState(null)
  const [codeInput, setCodeInput] = useState('')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  const [g, setG] = useState(null)
  const [anker, setAnker] = useState(null)
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)
  const gcRef = useRef(null)
  const useCode = role.staff ? '' : code

  const start = async c => {
    const { data, error } = await sb.rpc('fd_start', { p_code: c })
    if (error) { setStatus('fout'); return false }
    if (!data.ok) { setStatus('code'); return false }
    setInfo(data); setPub(data); setStatus('ok'); return true
  }

  useEffect(() => { if (role.checked) start(useCode) }, [role.checked, role.staff]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'ok' || g) return
    const t = q.trim()
    if (t.length < 2) { setHits([]); return }
    const h = setTimeout(async () => {
      const { data, error } = await sb.rpc('fd_zoek', { p_code: useCode, p_q: t })
      if (error) { toast(error.message); return }
      setHits(data || [])
    }, 250)
    return () => clearTimeout(h)
  }, [q, status, g, useCode, toast])

  const submitCode = async ev => {
    ev.preventDefault()
    const c = codeInput.trim()
    if (await start(c)) { try { localStorage.setItem('fd-code', c) } catch { /* privémodus */ } setCode(c) }
    else toast('Deze familiecode klopt niet')
  }

  const pick = async p => {
    const { data, error } = await sb.rpc('fd_gezin', { p_code: useCode, p_persoon: p.id })
    if (error) { toast(error.message); return }
    const d = {}; (data.leden || []).forEach(l => { if (l.type) d[l.id] = l.type })
    setG(data); setAnker(p.id); setQ(p.naam); setDraft(d); setHits([])
    setTimeout(() => gcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  const save = async () => {
    setBusy(true)
    const keuzes = Object.entries(draft).map(([id, t]) => ({ persoon_id: +id, type: t }))
    const { error } = await sb.rpc('fd_aanmelden', { p_code: useCode, p_anker: anker, p_keuzes: keuzes })
    setBusy(false)
    if (error) { toast(error.message); return }
    const miss = g.leden.filter(l => !draft[l.id]).length
    toast(miss ? `Aanmelding opgeslagen, ${miss} nog niet ingevuld` : 'Aanmelding opgeslagen')
  }

  if (status === 'laden') return <div className="loading">Even laden…</div>
  if (status === 'fout') return <div className="card empty"><h3>Geen verbinding</h3><p>De gegevens konden niet worden opgehaald. Controleer je internetverbinding en probeer het opnieuw.</p></div>
  if (status === 'code') return (
    <section className="hero codebox">
      <h2>Welkom bij de familiedag</h2>
      <p>Vul de familiecode in die je in de familie-app hebt gekregen. Je hoeft dit maar één keer te doen.</p>
      <form className="row" onSubmit={submitCode} style={{ flexWrap: 'nowrap' }}>
        <input className="field" value={codeInput} onChange={ev => setCodeInput(ev.target.value)} placeholder="Familiecode" autoComplete="off" autoCapitalize="none" aria-label="Familiecode" />
        <button className="btn primary" type="submit">Doorgaan</button>
      </form>
    </section>
  )
  if (info?.vervallen) return <div className="card empty"><h3>Geen familiedag in {info.jaar}</h3><p>{info.notitie || 'Deze editie is vervallen.'}</p></div>

  const tot = g ? g.leden.reduce((s, l) => s + (draft[l.id] ? +(l.prijzen[draft[l.id]] || 0) : 0), 0) : 0

  return (
    <>
      <section className="hero">
        <h2>Wie komen er op de familiedag?</h2>
        <p>Zoek je naam op en geef voor je hele gezin aan wie er komt. Betalen doe je bij aankomst.</p>
        <div className="search"><Search />
          <input className="field" type="search" placeholder="Typ een naam, bijvoorbeeld Gerrit" value={q} autoComplete="off"
            onChange={ev => { setQ(ev.target.value); setG(null) }} aria-label="Zoek op naam" />
        </div>
        {!g && q.trim().length >= 2 && (
          <div className="results">
            {hits.length ? hits.map(p => (
              <button key={p.id} className="res" onClick={() => pick(p)}>
                <span><b>{p.naam}</b><br /><small>Familie {p.familie}</small></span><small>{lftTxt(p.leeftijd)}</small>
              </button>
            )) : <p className="muted">Geen naam gevonden die lijkt op “{q}”. Controleer de spelling of vraag de organisatie om je toe te voegen.</p>}
          </div>
        )}
      </section>
      {g && (
        <article className="card gcard" ref={gcRef}>
          <header>
            <div><h3>{g.label}</h3><span className="muted">Familie {g.familie} · {g.leden.length} personen</span></div>
            <button className="btn ghost sm" onClick={() => { setG(null); setQ('') }}>Andere naam zoeken</button>
          </header>
          {g.losse_familie && <div style={{ padding: '12px 20px 0' }}><div className="note">Dit gezin is nog niet samengesteld, daarom zie je de hele familie. Vul in voor wie je kunt.</div></div>}
          {g.leden.map(l => (
            <div className="mrow" key={l.id}>
              <div className="who"><b>{l.naam}{l.organisatie && <> <span className="badge">Organisatie</span></>}</b><span>{l.groep} · {lftTxt(l.leeftijd)}</span></div>
              <div className="opts" role="radiogroup" aria-label={'Aanwezigheid ' + l.naam}>
                {TYPES.map(t => (
                  <button key={t.k} className={`opt t-${t.k} ${draft[l.id] === t.k ? 'on' : ''}`} role="radio" aria-checked={draft[l.id] === t.k}
                    onClick={() => setDraft(d => ({ ...d, [l.id]: t.k }))}>
                    {t.l}<small>{euro(+(l.prijzen[t.k] || 0))}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="gfoot">
            <div><span className="muted">Te betalen bij aankomst</span><div className="total">{euro(tot)}</div></div>
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Bezig…' : 'Aanmelding opslaan'}</button>
          </div>
        </article>
      )}
    </>
  )
}
