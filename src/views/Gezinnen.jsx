import { useRef, useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'
import { adultVan, age, gLabel, nm, sortM } from '../lib/calc'
import { useSaver } from '../lib/useSaver'
import { Pen } from '../components/Icons'
import PersonDialog from '../components/PersonDialog'

export default function Gezinnen() {
  const { S, e, update, run, openDialog } = useApp()
  const [famId, setFamId] = useState(() => S.fams[0]?.id)
  const [sel, setSel] = useState(null)
  const [over, setOver] = useState(null)
  const drag = useRef(null)
  const saver = useSaver()
  const f = S.fams.find(x => x.id === famId) || S.fams[0]
  if (!f) return <div className="card empty"><h3>Nog geen families</h3><p><button className="btn primary" onClick={() => openDialog(<NieuweFamilie onDone={setFamId} />)}>+ Familie toevoegen</button></p></div>

  const gz = S.gezinnen.filter(g => g.f === f.id)
  const pool = sortM(S.persons.filter(p => p.f === f.id && !p.g), e)
  const P = id => S.persons.find(p => p.id === id)

  const moveTo = async (pid, dest) => {
    const p = P(pid); if (!p) return
    setSel(null)
    if (dest === 'pool') {
      update(n => { n.persons.find(x => x.id === pid).g = null })
      await run(sb.from('personen').update({ gezin_id: null }).eq('id', pid))
    } else {
      const g = S.gezinnen.find(x => x.id === dest); if (!g) return
      update(n => { const x = n.persons.find(y => y.id === pid); x.g = g.id; x.f = g.f })
      await run(sb.from('personen').update({ gezin_id: g.id, familie_id: g.f }).eq('id', pid))
    }
  }
  const newGezin = async () => {
    const d = await run(sb.from('gezinnen').insert({ familie_id: f.id }).select().single())
    if (!d) return
    update(n => { n.gezinnen.push({ id: d.id, f: d.familie_id, naam: '' }) })
    if (sel) await moveTo(sel, d.id)
  }
  const delGezin = async id => {
    update(n => { n.persons.forEach(p => { if (p.g === id) p.g = null }); n.gezinnen = n.gezinnen.filter(g => g.id !== id) })
    await run(sb.from('gezinnen').delete().eq('id', id))
  }
  const rename = (id, naam) => {
    update(n => { n.gezinnen.find(g => g.id === id).naam = naam })
    saver('gez' + id, () => run(sb.from('gezinnen').update({ naam }).eq('id', id)))
  }
  const dropProps = dest => ({
    onDragOver: ev => { if (drag.current !== null) { ev.preventDefault(); setOver(dest) } },
    onDragLeave: ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(null) },
    onDrop: ev => { ev.preventDefault(); const id = drag.current; drag.current = null; setOver(null); if (id !== null) moveTo(id, dest) },
    onClick: ev => { if (sel && !ev.target.closest('.chip, button, input')) moveTo(sel, dest) },
  })
  const chip = p => {
    const a = age(p, e)
    return (
      <div key={p.id} className={'chip' + (a !== null && a < adultVan(e) ? ' kid' : '') + (sel === p.id ? ' sel' : '')} draggable
        onDragStart={ev => { drag.current = p.id; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(p.id)) }}
        onDragEnd={() => { drag.current = null; setOver(null) }}
        onClick={ev => { if (!ev.target.closest('button')) setSel(sel === p.id ? null : p.id) }}>
        <span>{nm(p)}</span>{p.kk && <small title="Koude kant">❄</small>}<small>{a === null ? 'volw.' : a < 0 ? '—' : a + ' jr'}</small>
        <button aria-label={'Bewerk ' + p.v} onClick={() => openDialog(<PersonDialog p={p} />)}><Pen /></button>
      </div>
    )
  }

  return (
    <>
      <div className="pagehead"><h2>Gezinnen</h2><p>Sleep personen naar een gezin. Op je telefoon tik je eerst een persoon aan en daarna het gezin. Kinderen onder de {e.tar.koppelTot} worden in de teams aan een volwassene uit hun gezin gekoppeld.</p></div>
      <div className="famtabs">
        {S.fams.map(x => {
          const los = S.persons.filter(p => p.f === x.id && !p.g).length
          return <button key={x.id} className={x.id === f.id ? 'on' : ''} onClick={() => { setFamId(x.id); setSel(null) }}>{x.naam}{los > 0 && <small>{los} los</small>}</button>
        })}
        <button onClick={() => openDialog(<NieuweFamilie onDone={setFamId} />)}>+ Familie</button>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={() => openDialog(<PersonDialog famDefault={f.id} />)}>+ Persoon toevoegen</button>
        {sel && <><span className="muted">{P(sel)?.v} geselecteerd. Tik op een gezin.</span><button className="btn ghost sm" onClick={() => setSel(null)}>Annuleren</button></>}
      </div>
      <div className="ggrid">
        <section {...dropProps('pool')} className={'gblock pool' + (sel ? ' target' : '') + (over === 'pool' ? ' drop-on' : '')}>
          <header><h3>Nog niet ingedeeld</h3><span className="cnt">{pool.length}</span></header>
          <div className="chips">{pool.length ? pool.map(chip) : <span className="muted" style={{ fontSize: 14 }}>Iedereen zit in een gezin.</span>}</div>
        </section>
        {gz.map(g => {
          const m = sortM(S.persons.filter(p => p.g === g.id), e)
          return (
            <section key={g.id} {...dropProps(g.id)} className={'gblock' + (sel ? ' target' : '') + (over === g.id ? ' drop-on' : '')}>
              <header>
                <input value={g.naam} placeholder={gLabel(S, { ...g, naam: '' }, e)} aria-label="Naam gezin" onChange={ev => rename(g.id, ev.target.value)} />
                <span className="cnt">{m.length}</span>
                <button className="btn ghost sm" aria-label="Gezin opheffen" onClick={() => delGezin(g.id)}>✕</button>
              </header>
              <div className="chips">{m.length ? m.map(chip) : <span className="muted" style={{ fontSize: 14 }}>Sleep hier personen naartoe.</span>}</div>
            </section>
          )
        })}
        <button className="addblock" onClick={newGezin}>+ Nieuw gezin</button>
      </div>
    </>
  )

}

function NieuweFamilie({ onDone }) {
  const { run, update, closeDialog, toast } = useApp()
  const [naam, setNaam] = useState('')
  const save = async () => {
    const t = naam.trim(); if (!t) return
    const d = await run(sb.from('families').insert({ naam: t, achternaam: t }).select().single())
    if (d) { update(n => { n.fams.push({ id: d.id, naam: d.naam, ach: d.achternaam }) }); onDone(d.id); toast('Familie toegevoegd') }
    closeDialog()
  }
  return (
    <>
      <h3>Familie toevoegen</h3>
      <div className="f"><label className="lbl" htmlFor="fn">Naam van de familie</label><input className="field" id="fn" autoFocus value={naam} onChange={ev => setNaam(ev.target.value)} /></div>
      <footer><span /><div className="row"><button className="btn" onClick={closeDialog}>Annuleren</button><button className="btn primary" onClick={save}>Toevoegen</button></div></footer>
    </>
  )
}
