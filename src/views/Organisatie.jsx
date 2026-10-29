import { useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'
import { canOrg, exists, famName, nm } from '../lib/calc'
import PersonDialog from '../components/PersonDialog'

export default function Organisatie() {
  const { S, e, update, run, toast, setCur, openDialog } = useApp()
  const [showAll, setShowAll] = useState(false)
  const [add, setAdd] = useState('')
  const P = id => S.persons.find(p => p.id === id)
  const cur = e.org.map(P).filter(Boolean)
  const last = id => { let m = null; S.editions.forEach(x => { if (x.jaar < e.jaar && !x.vervallen && x.org.includes(id)) m = Math.max(m ?? 0, x.jaar) }); return m }
  const rot = S.persons.filter(p => canOrg(p, e) && exists(p, e) && !e.org.includes(p.id) && !p.kk)
    .map(p => ({ p, l: last(p.id) })).sort((a, b) => (a.l ?? 0) - (b.l ?? 0) || a.p.f - b.p.f)
  const shown = showAll ? rot : rot.slice(0, 14)
  const kkN = S.persons.filter(p => p.kk && canOrg(p, e)).length
  const opties = S.persons.filter(p => canOrg(p, e) && !e.org.includes(p.id) && !p.kk)
  const label = p => `${nm(p)} (${famName(S, p.f)})`

  const addOrg = async pid => {
    if (e.org.includes(pid)) return
    update(n => { n.editions.find(x => x.jaar === e.jaar).org.push(pid) })
    await run(sb.from('organisatie').insert({ jaar: e.jaar, persoon_id: pid }), `${P(pid).v} toegevoegd aan organisatie ${e.jaar}`)
  }
  const delOrg = async pid => {
    update(n => { const x = n.editions.find(y => y.jaar === e.jaar); x.org = x.org.filter(i => i !== pid) })
    await run(sb.from('organisatie').delete().eq('jaar', e.jaar).eq('persoon_id', pid))
  }
  const koudeKant = async pid => {
    update(n => { n.persons.find(p => p.id === pid).kk = true })
    await run(sb.from('personen').update({ koude_kant: true }).eq('id', pid), `${P(pid).v} gemarkeerd als koude kant`)
  }
  const addFromInput = () => {
    const p = opties.find(x => label(x) === add)
    if (!p) { toast('Kies een naam uit de lijst'); return }
    setAdd(''); addOrg(p.id)
  }

  return (
    <>
      <div className="pagehead"><h2>Organisatie</h2><p>Per jaar wie de familiedag organiseert. De organisatie van het actieve jaar kan inloggen, ziet de kassa en is scheidsrechter bij de spellen.</p></div>
      <div className="cols">
        <div className="stack">
          <div className="card">
            <div className="spread"><h3 style={{ fontSize: 20 }}>Organisatie {e.jaar}</h3><span className="muted">{cur.length} personen</span></div>
            <div style={{ margin: '12px 0' }}>
              {cur.length ? cur.map(p => (
                <span className="tag" key={p.id}>
                  <button className="tname" onClick={() => openDialog(<PersonDialog p={p} />)} title="Bewerk persoon">{nm(p)}</button>
                  {!p.email && <span className="nomail">geen e-mail</span>}
                  <button onClick={() => delOrg(p.id)} aria-label={'Verwijder ' + p.v}>×</button>
                </span>
              )) : <span className="muted">Nog niemand aangewezen.</span>}
            </div>
            {cur.some(p => !p.email) && <p className="muted" style={{ fontSize: 14, margin: '0 0 12px' }}>Wie geen e-mailadres heeft, kan niet inloggen. Tik op een naam om het in te vullen.</p>}
            <div className="row">
              <input className="field" list="orgopts" placeholder="Naam toevoegen" style={{ flex: 1, minWidth: 180 }} value={add}
                onChange={ev => setAdd(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') addFromInput() }} aria-label="Naam toevoegen aan organisatie" />
              <datalist id="orgopts">{opties.map(p => <option key={p.id} value={label(p)} />)}</datalist>
              <button className="btn primary" onClick={addFromInput}>Toevoegen</button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 20, marginBottom: 4 }}>Wie is aan de beurt?</h3>
            <p className="muted" style={{ margin: '0 0 10px' }}>Iedereen vanaf {e.tar.orgVan ?? 18} jaar die het langst geleden of nog nooit heeft georganiseerd. De koude kant hoeft niet en staat er niet tussen{kkN ? ` (${kkN} ${kkN === 1 ? 'persoon' : 'personen'})` : ''}. Markeer iemand met ❄ als koude kant.</p>
            <div className="scroll-x"><table className="dtable">
              <thead><tr><th>Naam</th><th>Familie</th><th className="r">Laatst</th><th /></tr></thead>
              <tbody>{shown.map(({ p, l }) => (
                <tr key={p.id}>
                  <td>{nm(p)}</td><td className="muted">{famName(S, p.f)}</td>
                  <td className="r">{l ?? <span className="muted">nooit</span>}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" title="Markeer als koude kant" aria-label={`Markeer ${p.v} als koude kant`} onClick={() => koudeKant(p.id)}>❄</button>
                    <button className="btn ghost sm" onClick={() => addOrg(p.id)}>+ {e.jaar}</button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
            {rot.length > 14 && <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setShowAll(s => !s)}>{showAll ? 'Toon minder' : 'Toon alle ' + rot.length}</button>}
          </div>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 20, marginBottom: 6 }}>Logboek</h3>
          <ul className="log">
            {S.editions.slice().sort((a, b) => b.jaar - a.jaar).map(x => (
              <li key={x.jaar} className={x.jaar === e.jaar ? 'cur' : ''}>
                <button className="yr" onClick={() => setCur(x.jaar)}>{x.jaar}</button>
                <div>{x.vervallen ? <span className="muted">{x.notitie || 'Vervallen'}</span>
                  : x.org.length ? x.org.map(id => <span className="tag" key={id}>{P(id) ? nm(P(id)) : '?'}</span>)
                  : <span className="muted">Nog niet bekend</span>}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
