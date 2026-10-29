import { useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'
import { TL, ageTxt, counts, euro, finance, kGroups, nm, price } from '../lib/calc'
import { Check } from '../components/Icons'

const STL = { open: 'Open', betaald: 'Betaald', gratis: 'Gratis', deels: 'Deels betaald' }

export default function Kassa() {
  const { S, e, update, run, toast } = useApp()
  const [kf, setKf] = useState('alle')
  const [kq, setKq] = useState('')
  if (e.vervallen) return <Vervallen e={e} />
  const f = finance(S, e), c = counts(S, e)
  const all = kGroups(S, e)
  let gs = all
  if (kf === 'open') gs = gs.filter(g => g.st === 'open' || g.st === 'deels')
  if (kf === 'betaald') gs = gs.filter(g => g.st === 'betaald' || g.st === 'gratis')
  const q = kq.trim().toLowerCase()
  if (q) gs = gs.filter(g => g.label.toLowerCase().includes(q) || g.att.some(p => nm(p).toLowerCase().includes(q)))

  const setPaid = async (ids, val) => {
    update(n => { const ed = n.editions.find(x => x.jaar === e.jaar); ids.forEach(id => { if (val) ed.betaald[id] = true; else delete ed.betaald[id] }) })
    await run(sb.from('aanmeldingen').update({ betaald: val, betaald_op: val ? new Date().toISOString() : null }).eq('jaar', e.jaar).in('persoon_id', ids))
  }

  return (
    <>
      <div className="pagehead"><h2>Kassa</h2><p>Wie is er, wat moet er betaald worden en wat is al binnen. Tik op het vinkje als iemand heeft betaald.</p></div>
      <div className="stats">
        <div className="stat"><span>Startbudget</span><strong>{euro(f.start)}</strong></div>
        <div className="stat"><span>Te ontvangen</span><strong>{euro(f.due)}</strong></div>
        <div className="stat"><span>Ontvangen</span><strong>{euro(f.paid)}</strong></div>
        <div className="stat hl"><span>Nog open</span><strong>{euro(f.open)}</strong></div>
      </div>
      <div className="stats" style={{ marginTop: 10 }}>
        <div className="stat"><span>Aanwezig</span><strong>{c.aanw}</strong></div>
        <div className="stat"><span>Eten mee</span><strong>{c.eten}</strong></div>
        <div className="stat"><span>Spelen mee</span><strong>{c.spelen}</strong></div>
        <div className="stat"><span>Nog niet opgegeven</span><strong>{c.onb}</strong></div>
      </div>
      <div className="toolbar">
        <div className="seg">{[['alle', 'Alle'], ['open', 'Nog te betalen'], ['betaald', 'Betaald']].map(([k, l]) =>
          <button key={k} className={kf === k ? 'on' : ''} onClick={() => setKf(k)}>{l}</button>)}</div>
        <input className="field" type="search" placeholder="Zoek op naam" value={kq} onChange={ev => setKq(ev.target.value)} style={{ maxWidth: 260 }} aria-label="Zoek op naam" />
      </div>
      <div className="klist">
        {!all.length ? <div className="card empty"><h3>Nog geen aanmeldingen</h3><p>Zodra families zich aanmelden voor {e.jaar}, verschijnen ze hier met het bedrag dat ze bij aankomst betalen.</p></div>
          : !gs.length ? <div className="card empty"><h3>Niets gevonden</h3><p>Pas het filter of de zoekterm aan.</p></div>
          : gs.map(g => (
            <article key={g.key} className={'kg st-' + g.st}>
              <header>
                <div><h3>{g.label}</h3><span className="meta">{g.loose ? 'Nog niet in gezinnen · ' : ''}{g.att.length} aanwezig</span></div>
                <div className="kamt">
                  <span className={'stpill ' + g.st}>{STL[g.st]}</span>
                  <strong>{euro(g.st === 'deels' ? g.due - g.paid : g.due)}</strong>
                  {g.due > 0 && <button className={'btn sm ' + (g.st === 'betaald' ? '' : 'primary')} onClick={async () => {
                    const val = g.st !== 'betaald'
                    await setPaid(g.att.filter(p => price(p, e, e.aanw[p.id]) > 0).map(p => p.id), val)
                    toast(val ? `${g.label}: betaald` : 'Betaling teruggedraaid')
                  }}>{g.st === 'betaald' ? 'Terugdraaien' : 'Alles betaald'}</button>}
                </div>
              </header>
              <div className="scroll-x"><table className="ktable"><tbody>
                {g.att.map(p => {
                  const t = e.aanw[p.id], pr = price(p, e, t)
                  return (
                    <tr key={p.id}>
                      <td>{nm(p)}{e.org.includes(p.id) && <> <span className="badge">Organisatie</span></>}<br /><span className="meta">{ageTxt(p, e)}</span></td>
                      <td><span className={'pill t-' + t}>{TL[t]}</span></td>
                      <td className="amt">{euro(pr)}</td>
                      <td className="chk">{pr > 0 && <button className={'tick ' + (e.betaald[p.id] ? 'on' : '')} aria-label={'Betaald ' + p.v} aria-pressed={!!e.betaald[p.id]} onClick={() => setPaid([p.id], !e.betaald[p.id])}><Check /></button>}</td>
                    </tr>
                  )
                })}
              </tbody></table></div>
            </article>
          ))}
      </div>
    </>
  )
}

export function Vervallen({ e }) {
  return <div className="card empty"><h3>Geen familiedag in {e.jaar}</h3><p>{e.notitie || 'Deze editie is vervallen.'} Kies een ander jaar bovenin.</p></div>
}
