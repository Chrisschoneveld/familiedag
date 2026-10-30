import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sb, configured } from './supabase'
import { Ctx } from './ctx'
import { loadAll } from './lib/data'
import { fmtDate } from './lib/calc'
import StyleMenu from './components/StyleMenu'
import NieuweEditie from './components/NieuweEditie'
import { Lock } from './components/Icons'
import Aanmelden from './views/Aanmelden'
import Kassa from './views/Kassa'
import Teams from './views/Teams'
import Gezinnen from './views/Gezinnen'
import Organisatie from './views/Organisatie'
import Tarieven from './views/Tarieven'
import Budget from './views/Budget'
import Login from './views/Login'
import Fotos from './views/Fotos'

const VIEWS = [
  { id: 'aanmelden', l: 'Aanmelden', pub: true, C: Aanmelden },
  { id: 'fotos', l: 'Foto’s', pub: true, C: Fotos },
  { id: 'kassa', l: 'Kassa', C: Kassa },
  { id: 'teams', l: 'Teams', C: Teams },
  { id: 'gezinnen', l: 'Gezinnen', C: Gezinnen },
  { id: 'organisatie', l: 'Organisatie', C: Organisatie },
  { id: 'tarieven', l: 'Tarieven', C: Tarieven },
  { id: 'budget', l: 'Budget', C: Budget },
  { id: 'login', l: 'Inloggen', pub: true, C: Login },
]
const viewFromHash = () => { const h = window.location.hash.slice(1); return VIEWS.some(v => v.id === h) ? h : 'aanmelden' }

export default function App() {
  const [view, setView] = useState(viewFromHash)
  const [session, setSession] = useState(null)
  const [role, setRole] = useState({ staff: false, beheerder: false, checked: !configured })
  const [S, setS] = useState(null)
  const [pub, setPub] = useState(null)
  const [msg, setMsg] = useState('')
  const [dlg, setDlg] = useState(null)
  const tRef = useRef(), dRef = useRef()

  const toast = useCallback(m => { setMsg(m); clearTimeout(tRef.current); tRef.current = setTimeout(() => setMsg(''), 2400) }, [])
  const update = useCallback(fn => setS(prev => { if (!prev) return prev; const n = structuredClone(prev); fn(n); return n }), [])
  const setCur = useCallback(y => update(n => { n.cur = y }), [update])
  const openDialog = useCallback(node => setDlg(node), [])
  const closeDialog = useCallback(() => setDlg(null), [])

  const reload = useCallback(async () => {
    try {
      const d = await loadAll()
      setS(prev => ({ ...d, cur: prev?.cur && d.editions.some(x => x.jaar === prev.cur) ? prev.cur : d.actief }))
    } catch (err) { toast('Laden mislukt: ' + (err.message || err)) }
  }, [toast])

  const run = useCallback(async (p, okMsg) => {
    try {
      const r = await p
      if (r && r.error) throw r.error
      if (okMsg) toast(okMsg)
      return r ? (r.data ?? null) : null
    } catch (err) {
      console.error(err)
      toast('Opslaan mislukt: ' + (err.message || err))
      reload()
      return undefined
    }
  }, [toast, reload])

  // routering via #kassa, #teams, …
  useEffect(() => {
    const f = () => { setView(viewFromHash()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  // inlogstatus
  useEffect(() => {
    if (!sb) return
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = sb.auth.onAuthStateChange((ev, s) => {
      setSession(s)
      if (ev === 'SIGNED_IN' && /access_token|error_description/.test(window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + '#kassa')
        setView('kassa')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // anonieme sessies (fotogalerij) tellen niet als inloggen
  const echt = session && !session.user.is_anonymous ? session : null

  // rol bepalen en gegevens laden
  const uid = echt?.user?.id
  useEffect(() => {
    if (!sb) return
    if (!uid) { setRole({ staff: false, beheerder: false, checked: true }); setS(null); return }
    let stop = false
    ;(async () => {
      const [a, b] = await Promise.all([sb.rpc('fd_is_staff'), sb.rpc('fd_is_beheerder')])
      if (stop) return
      const r = { staff: !!a.data, beheerder: !!b.data, checked: true }
      setRole(r)
      if (r.staff) await reload()
    })()
    return () => { stop = true }
  }, [uid, reload])

  // kassa live bijwerken als anderen aanmelden of afvinken
  useEffect(() => {
    if (!sb || !role.staff) return
    const ch = sb.channel('aanmeldingen-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aanmeldingen' }, p => {
        update(n => {
          if (p.eventType === 'DELETE') {
            const e = n.editions.find(x => x.jaar === p.old.jaar)
            if (e) { delete e.aanw[p.old.persoon_id]; delete e.betaald[p.old.persoon_id] }
          } else {
            const r = p.new, e = n.editions.find(x => x.jaar === r.jaar)
            if (e) { e.aanw[r.persoon_id] = r.type; if (r.betaald) e.betaald[r.persoon_id] = true; else delete e.betaald[r.persoon_id] }
          }
        })
      }).subscribe()
    return () => { sb.removeChannel(ch) }
  }, [role.staff, update])

  // dialoogvenster openen en sluiten
  useEffect(() => {
    const d = dRef.current; if (!d) return
    if (dlg && !d.open) d.showModal()
    if (!dlg && d.open) d.close()
  }, [dlg])

  const e = S ? S.editions.find(x => x.jaar === S.cur) : null
  const ctx = useMemo(() => ({ S, e, session: echt, authSession: session, role, update, run, reload, toast, setCur, openDialog, closeDialog, setPub }),
    [S, e, echt, session, role, update, run, reload, toast, setCur, openDialog, closeDialog])

  const staff = role.staff && S
  const tabs = VIEWS.filter(v => v.id === 'aanmelden' || v.id === 'fotos' || (staff && !v.pub) || (v.id === 'login' && !echt))
  const eersteBeheer = tabs.findIndex(v => !v.pub)
  const cur = VIEWS.find(v => v.id === view)
  let Content
  if (!configured) Content = Setup
  else if (cur.pub) Content = cur.C
  else if (!role.checked || (role.staff && !S)) Content = Loading
  else if (!role.staff) Content = Login
  else Content = cur.C

  const sub = staff && e ? fmtDate(e) : pub ? fmtDate({ ...pub, datum: pub.datum || '' }) : ''

  return (
    <Ctx.Provider value={ctx}>
      <header className="top">
        <div className="topin">
          <div className="brand"><h1>Familiedag</h1><p>{sub}</p></div>
          <div className="ctrls">
            <StyleMenu toast={toast} />
            {staff && (
              <select className="field" id="year" aria-label="Kies jaar" value={S.cur}
                onChange={ev => ev.target.value === 'new' ? openDialog(<NieuweEditie />) : setCur(+ev.target.value)}>
                {S.editions.slice().sort((a, b) => b.jaar - a.jaar).map(x =>
                  <option key={x.jaar} value={x.jaar}>{x.jaar}{x.vervallen ? ' (vervallen)' : ''}{x.jaar === S.actief ? ' •' : ''}</option>)}
                <option value="new">Nieuwe editie…</option>
              </select>
            )}
            {!staff && pub && <span className="btn" style={{ pointerEvents: 'none' }}>{pub.jaar}</span>}
          </div>
        </div>
        <nav className="tabs">
          {tabs.map((v, i) => (
            <span key={v.id} style={{ display: 'contents' }}>
              {i === eersteBeheer && <span className="sep" />}
              <a href={'#' + v.id} className={view === v.id ? 'on' : ''}>{!v.pub && <Lock />}{v.id === 'login' && <Lock />}{v.l}</a>
            </span>
          ))}
        </nav>
      </header>
      <main><Content /></main>
      <div className="foot">
        {echt ? <span>Ingelogd als {echt.user.email}. <button className="linkbtn" onClick={() => sb.auth.signOut().then(() => { window.location.hash = '#aanmelden' })}>Uitloggen</button></span> : <span />}
      </div>
      <dialog ref={dRef} onClose={() => setDlg(null)}><div className="dlg">{dlg}</div></dialog>
      <div id="toast" role="status" className={msg ? 'show' : ''}>{msg}</div>
    </Ctx.Provider>
  )
}

function Loading() { return <div className="loading">Even laden…</div> }
function Setup() {
  return <div className="card empty"><h3>Nog niet gekoppeld aan Supabase</h3><p>Zet VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in .env.local (lokaal) of als variabelen in GitHub. Zie de README.</p></div>
}
