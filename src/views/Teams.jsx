import { useRef, useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'
import { TEAMC, age, ageTxt, famName, makeTeams, nm, sortM, teamPools } from '../lib/calc'
import { Vervallen } from './Kassa'

export default function Teams() {
  const { S, e, update, run, toast } = useApp()
  const [tn, setTn] = useState(null)
  const [tsel, setTsel] = useState(null)
  const [over, setOver] = useState(null)
  const drag = useRef(null)
  if (e.vervallen) return <Vervallen e={e} />

  const T = e.teams
  const n = tn ?? (T ? T.list.length : 6)
  const { players, small, refs } = teamPools(S, e)
  const P = id => S.persons.find(p => p.id === id)

  const store = async ind => {
    update(x => { x.editions.find(y => y.jaar === e.jaar).teams = ind })
    await run(sb.from('teams').upsert({ jaar: e.jaar, indeling: ind, gemaakt_op: new Date().toISOString() }))
  }
  const hussel = async () => {
    const ind = makeTeams(S, e, n)
    if (!ind) { toast('Nog niemand aangemeld voor de spellen'); return }
    setTsel(null); await store(ind); toast('Teams gehusseld')
  }
  const move = async (pid, to) => {
    if (!T) return
    const ind = structuredClone(T)
    ind.list.forEach(t => { t.leden = t.leden.filter(id => id !== pid) })
    ind.list[to].leden.push(pid)
    setTsel(null); await store(ind)
  }

  let changed = false
  if (T) {
    const inT = new Set(T.list.flatMap(t => t.leden)), pl = new Set(players.map(p => p.id))
    changed = [...pl].some(id => !inT.has(id)) || [...inT].some(id => !pl.has(id))
  }

  return (
    <>
      <div className="pagehead"><h2>Teams</h2><p>Families worden zoveel mogelijk over de teams verdeeld. Kinderen onder de {e.tar.koppelTot} lopen mee met een ouder en tellen niet mee in de teamgrootte. De organisatie is scheidsrechter.</p></div>
      <div className="card spread">
        <div className="row">
          <span className="muted">Aantal teams</span>
          <div className="stepper">
            <button aria-label="Minder teams" onClick={() => setTn(Math.max(2, n - 1))}>−</button>
            <output>{n}</output>
            <button aria-label="Meer teams" onClick={() => setTn(Math.min(10, n + 1))}>+</button>
          </div>
          <span className="muted num">{players.length} spelers · {small.length} meelopers · {refs.length} scheidsrechters</span>
        </div>
        <button className="btn primary" onClick={hussel}>{T ? 'Opnieuw husselen' : 'Teams maken'}</button>
      </div>
      {!T && !players.length && <div className="card empty" style={{ marginTop: 14 }}><h3>Nog niemand aangemeld voor de spellen</h3><p>Teams maken kan zodra er aanmeldingen binnen zijn.</p></div>}
      {!T && players.length > 0 && <div className="card empty" style={{ marginTop: 14 }}><h3>Nog geen teams</h3><p>Kies het aantal teams en klik op Teams maken.</p></div>}
      {T && changed && <div className="note" style={{ marginTop: 14 }}>De aanmeldingen zijn veranderd sinds deze indeling. Klik op Opnieuw husselen om iedereen mee te nemen.</div>}
      {T && T.warn.length > 0 && <div className="note" style={{ marginTop: 14 }}>
        {T.warn.length} {T.warn.length === 1 ? 'kind zit' : 'kinderen zitten'} nog niet in een gezin en {T.warn.length === 1 ? 'is' : 'zijn'} tijdelijk aan een volwassene uit de familie gekoppeld: {T.warn.map(id => P(id)?.v).filter(Boolean).join(', ')}. Stel de gezinnen samen bij <a href="#gezinnen">Gezinnen</a>.
      </div>}
      {T && tsel && <p className="muted" style={{ margin: '12px 0 0' }}>Tik op de kleur van het team waar {P(tsel)?.v} naartoe moet.</p>}
      {T && (
        <div className="tgrid">
          {T.list.map((t, i) => {
            const c = TEAMC[i % TEAMC.length]
            const leden = sortM(t.leden.map(P).filter(Boolean), e)
            const subs = id => Object.entries(T.ml).filter(([, v]) => v === id).map(([k]) => P(+k)).filter(Boolean)
            const nsub = leden.reduce((s, p) => s + subs(p.id).length, 0)
            const fams = new Set(leden.map(p => p.f)).size
            return (
              <article key={i} className={'team' + (over === i ? ' drop-on' : '')} style={{ '--tc': c.c, '--tt': c.t }}
                onDragOver={ev => { if (drag.current !== null) { ev.preventDefault(); setOver(i) } }}
                onDragLeave={ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(null) }}
                onDrop={ev => { ev.preventDefault(); const id = drag.current; drag.current = null; setOver(null); if (id !== null) move(id, i) }}>
                <header onClick={() => tsel && move(tsel, i)}>
                  <h3>Team {c.n}</h3>
                  <span className="num">{leden.length} spelers{nsub ? ` + ${nsub} meelopers` : ''} · {fams} families</span>
                </header>
                <p className="refs">Scheidsrechter: {t.scheids.length ? t.scheids.map(id => P(id) ? nm(P(id)) : '').join(', ') : 'nog niemand'}</p>
                <ul>
                  {leden.map(p => (
                    <li key={p.id}>
                      <div className={'trow' + (tsel === p.id ? ' sel' : '')} draggable
                        onDragStart={ev => { drag.current = p.id; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(p.id)) }}
                        onDragEnd={() => { drag.current = null; setOver(null) }}
                        onClick={() => setTsel(tsel === p.id ? null : p.id)}>
                        <span>{nm(p)}</span><span className="fm">{famName(S, p.f)}</span><span className="ag">{age(p, e) ?? ''}</span>
                      </div>
                      {subs(p.id).map(k => <div className="tsub" key={k.id}>↳ <b>{k.v}</b> loopt mee · {ageTxt(k, e)}</div>)}
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
