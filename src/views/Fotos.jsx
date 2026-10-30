import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'
import { bewaarCode, leesCode } from '../lib/familie'
import { mbTxt, signedUrls, tijd, uploadMedia, verwerkFoto, verwerkVideo, verwijderMedia } from '../lib/media'
import Viewer from '../components/Viewer'

const LIMIET = 1024 * 1024 * 1024 // gratis Supabase-opslag, ongeveer
const STATUS = { wacht: 'In de wachtrij', foto: 'Foto verkleinen…', video: 'Video omzetten', upload: 'Uploaden…', klaar: 'Klaar', fout: 'Mislukt' }

export default function Fotos() {
  const { role, toast } = useApp()
  const [status, setStatus] = useState('laden')
  const [items, setItems] = useState([])
  const [thumbs, setThumbs] = useState({})
  const [filter, setFilter] = useState('alle')
  const [open, setOpen] = useState(null)
  const [rij, setRij] = useState([])
  const [codeInput, setCodeInput] = useState('')
  const [naam, setNaam] = useState(() => { try { return localStorage.getItem('fd-naam') || '' } catch { return '' } })
  const [jaarKeuze, setJaarKeuze] = useState('auto')
  const fileRef = useRef(null)
  const [mijnId, setMijnId] = useState(null)
  const [paneel, setPaneel] = useState(false)
  const bezig = rij.some(r => !['klaar', 'fout'].includes(r.status))

  const toegang = useCallback(async code => {
    if (role.staff) {
      const { data: { session } } = await sb.auth.getSession()
      setMijnId(session?.user?.id || null); return true
    }
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      const { error } = await sb.auth.signInAnonymously()
      if (error) { setStatus('uit'); return false }
    }
    const { data, error } = await sb.rpc('fd_word_familie', { p_code: code })
    if (error) { setStatus('fout'); return false }
    const { data: { session: s2 } } = await sb.auth.getSession()
    setMijnId(s2?.user?.id || null)
    if (!data) { setStatus('code'); return false }
    return true
  }, [role.staff])

  const laad = useCallback(async () => {
    const { data, error } = await sb.from('media').select('*').order('genomen_op', { ascending: false, nullsFirst: false })
    if (error) { setStatus('fout'); return }
    setItems(data); setStatus('ok')
    try { setThumbs(await signedUrls(data.map(m => m.thumb_pad))) } catch { toast('Miniaturen laden mislukt') }
  }, [toast])

  useEffect(() => {
    if (!role.checked) return
    ;(async () => { if (await toegang(leesCode())) await laad() })()
  }, [role.checked, role.staff, toegang, laad])

  const submitCode = async ev => {
    ev.preventDefault()
    const c = codeInput.trim()
    if (await toegang(c)) { bewaarCode(c); await laad() } else toast('Deze familiecode klopt niet')
  }

  const jaren = useMemo(() => [...new Set(items.map(m => m.jaar))].sort((a, b) => b - a), [items])
  const zicht = useMemo(() => filter === 'alle' ? items : items.filter(m => m.jaar === filter), [items, filter])
  const groepen = useMemo(() => {
    const g = []; zicht.forEach((m, i) => { let x = g.find(y => y.jaar === m.jaar); if (!x) g.push(x = { jaar: m.jaar, lijst: [] }); x.lijst.push({ m, i }) })
    return g
  }, [zicht])
  const alleJaren = useMemo(() => { const nu = new Date().getFullYear(); const s = new Set(jaren); for (let j = 2017; j <= nu + 1; j++) s.add(j); return [...s].sort((a, b) => b - a) }, [jaren])
  const gebruikt = items.reduce((s, m) => s + Number(m.grootte || 0), 0)
  const magWijzigen = m => role.beheerder || (mijnId && m.geupload_door === mijnId)

  const kies = async ev => {
    const files = [...ev.target.files]; ev.target.value = ''
    if (!files.length) return
    try { localStorage.setItem('fd-naam', naam) } catch { /* privé */ }
    const nieuw = files.map(f => ({ id: crypto.randomUUID(), f, naam: f.name, status: 'wacht', p: 0, fout: '' }))
    setRij(r => [...r.filter(x => x.status !== 'klaar'), ...nieuw])
    const { data: { session } } = await sb.auth.getSession()
    for (const r of nieuw) {
      const zet = patch => setRij(rs => rs.map(x => x.id === r.id ? { ...x, ...patch } : x))
      try {
        const isVideo = r.f.type.startsWith('video/') || /\.(mov|mp4|m4v|webm|avi|mkv|3gp)$/i.test(r.f.name)
        zet({ status: isVideo ? 'video' : 'foto' })
        const res = isVideo ? await verwerkVideo(r.f, p => zet({ p })) : await verwerkFoto(r.f)
        zet({ status: 'upload', p: 1 })
        const jaar = jaarKeuze === 'auto' ? res.datum.getFullYear() : +jaarKeuze
        const opgeslagen = await uploadMedia(res, { jaar, naam: naam.trim(), uid: session.user.id })
        const u = await signedUrls([opgeslagen.thumb_pad])
        setThumbs(t => ({ ...t, ...u }))
        setItems(it => [...it, opgeslagen].sort((a, b) => new Date(b.genomen_op) - new Date(a.genomen_op)))
        zet({ status: 'klaar', fout: res.zonderGeluid ? 'Opgeslagen zonder geluid' : '' })
      } catch (err) {
        console.error(err)
        zet({ status: 'fout', fout: err.message || String(err) })
      }
    }
  }

  const verwijder = async m => {
    if (!confirm(m.soort === 'foto' ? 'Deze foto verwijderen?' : 'Deze video verwijderen?')) return
    try {
      await verwijderMedia(m)
      const rest = zicht.filter(x => x.id !== m.id)
      setItems(it => it.filter(x => x.id !== m.id))
      setOpen(o => rest.length ? Math.min(o, rest.length - 1) : null)
      toast('Verwijderd')
    } catch (err) { toast('Verwijderen mislukt: ' + err.message) }
  }
  const zetJaar = async (m, jaar) => {
    setItems(it => it.map(x => x.id === m.id ? { ...x, jaar } : x))
    const { error } = await sb.from('media').update({ jaar }).eq('id', m.id)
    if (error) { toast('Opslaan mislukt'); laad() } else toast(`Verplaatst naar ${jaar}`)
  }

  if (status === 'laden') return <div className="loading">Even laden…</div>
  if (status === 'uit') return <div className="card empty"><h3>De fotogalerij is nog niet klaar</h3><p>De beheerder moet in Supabase anonieme toegang aanzetten.</p></div>
  if (status === 'fout') return <div className="card empty"><h3>Geen verbinding</h3><p>De foto’s konden niet worden opgehaald. Controleer je internetverbinding en probeer het opnieuw.</p></div>
  if (status === 'code') return (
    <section className="hero codebox">
      <h2>Foto’s van de familiedag</h2>
      <p>Vul de familiecode in die je in de familie-app hebt gekregen. Je hoeft dit maar één keer te doen.</p>
      <form className="row" onSubmit={submitCode} style={{ flexWrap: 'nowrap' }}>
        <input className="field" value={codeInput} onChange={ev => setCodeInput(ev.target.value)} placeholder="Familiecode" autoComplete="off" autoCapitalize="none" aria-label="Familiecode" />
        <button className="btn primary" type="submit">Doorgaan</button>
      </form>
    </section>
  )

  return (
    <>
      <div className="pagehead spread" style={{ alignItems: 'flex-end' }}>
        <div><h2>Foto’s</h2><p>{items.length ? `${items.filter(m => m.soort === 'foto').length} foto’s en ${items.filter(m => m.soort === 'video').length} video’s` : 'Deel je foto’s en video’s met de hele familie.'}</p></div>
        <button className="btn primary" disabled={bezig} onClick={() => { setPaneel(true); if (naam.trim()) fileRef.current?.click() }}>+ Toevoegen</button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={kies} />
      </div>

      {(paneel || rij.length > 0) && (
        <div className="card upcard">
          <div className="spread" style={{ marginBottom: 10 }}>
            <h3 style={{ fontSize: 18 }}>Toevoegen</h3>
            {!bezig && <button className="btn ghost sm" aria-label="Sluiten" onClick={() => { setPaneel(false); setRij([]) }}>✕</button>}
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}><label className="lbl" htmlFor="unaam">Je naam (staat bij wat je toevoegt)</label>
              <input className="field" id="unaam" value={naam} onChange={ev => setNaam(ev.target.value)} placeholder="Bijvoorbeeld Ria" /></div>
            <div style={{ flex: '1 1 180px' }}><label className="lbl" htmlFor="ujaar">Jaar</label>
              <select className="field" id="ujaar" style={{ width: '100%' }} value={jaarKeuze} onChange={ev => setJaarKeuze(ev.target.value)}>
                <option value="auto">Automatisch (opnamedatum)</option>
                {alleJaren.map(j => <option key={j} value={j}>{j}</option>)}
              </select></div>
            <button className="btn primary" disabled={bezig} onClick={() => fileRef.current?.click()}>Kies foto’s en video’s</button>
          </div>
          {rij.length > 0 && (
            <ul className="queue">
              {rij.map(r => (
                <li key={r.id} className={'q-' + r.status}>
                  <span className="qn">{r.naam}</span>
                  <span className="qs">{STATUS[r.status]}{r.status === 'video' ? ` ${Math.round(r.p * 100)}%` : ''}{r.fout ? ` · ${r.fout}` : ''}</span>
                  {['video', 'foto', 'upload'].includes(r.status) && <span className="qbar"><i style={{ width: r.status === 'video' ? `${r.p * 100}%` : '100%' }} className={r.status !== 'video' ? 'busy' : ''} /></span>}
                </li>
              ))}
            </ul>
          )}
          {bezig && <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>Laat deze pagina open tot alles klaar is. Video’s omzetten kan even duren.</p>}
        </div>
      )}

      {jaren.length > 0 && (
        <div className="famtabs" style={{ marginTop: 16 }}>
          <button className={filter === 'alle' ? 'on' : ''} onClick={() => setFilter('alle')}>Alle</button>
          {jaren.map(j => <button key={j} className={filter === j ? 'on' : ''} onClick={() => setFilter(j)}>{j}</button>)}
        </div>
      )}

      {!items.length ? <div className="card empty" style={{ marginTop: 16 }}><h3>Nog geen foto’s</h3><p>Voeg de eerste toe met de knop hierboven.</p></div>
        : groepen.map(g => (
          <section key={g.jaar} className="ygroup">
            <h3>{g.jaar}</h3>
            <div className="pgrid">
              {g.lijst.map(({ m, i }) => (
                <button key={m.id} className="ptile" onClick={() => setOpen(i)} aria-label={(m.soort === 'foto' ? 'Foto' : 'Video') + ' openen'}>
                  {thumbs[m.thumb_pad] ? <img src={thumbs[m.thumb_pad]} alt="" loading="lazy" decoding="async" /> : <span className="ph" />}
                  {m.soort === 'video' && <span className="vbadge">▶ {tijd(m.duur)}</span>}
                </button>
              ))}
            </div>
          </section>
        ))}

      {role.beheerder && items.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="spread"><b>Opslag</b><span className="muted num">{mbTxt(gebruikt)} van ongeveer 1 GB</span></div>
          <div className="qbar" style={{ marginTop: 8 }}><i style={{ width: `${Math.min(100, gebruikt / LIMIET * 100)}%` }} /></div>
        </div>
      )}

      {open !== null && zicht[open] && (
        <Viewer items={zicht} index={open} thumbs={thumbs} onIndex={setOpen} onClose={() => setOpen(null)}
          magWijzigen={magWijzigen} onVerwijder={verwijder} onJaar={zetJaar} jaren={alleJaren} toast={toast} />
      )}
    </>
  )
}
