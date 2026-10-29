import { useApp } from '../ctx'
import { sb } from '../supabase'
import { counts, euro, finance } from '../lib/calc'
import { useSaver } from '../lib/useSaver'
import { Vervallen } from './Kassa'

export default function Budget() {
  const { S, e, update, run } = useApp()
  const saver = useSaver()
  if (e.vervallen) return <Vervallen e={e} />
  const f = finance(S, e), c = counts(S, e)
  const ed = fn => update(n => fn(n.editions.find(x => x.jaar === e.jaar)))

  const setStart = v => {
    const val = v === '' ? null : Number(v)
    ed(x => { x.start = val })
    saver('start', () => run(sb.from('edities').update({ startbudget: val }).eq('jaar', e.jaar)))
  }
  const addK = async () => {
    const d = await run(sb.from('kosten').insert({ jaar: e.jaar, omschrijving: '', bedrag: 0 }).select().single())
    if (d) ed(x => { x.kosten.push({ id: d.id, oms: '', bedrag: 0 }) })
  }
  const setK = (id, field, val) => {
    ed(x => { x.kosten.find(k => k.id === id)[field] = val })
    saver(`k${id}${field}`, () => run(sb.from('kosten').update(field === 'oms' ? { omschrijving: val } : { bedrag: val || 0 }).eq('id', id)))
  }
  const delK = async id => {
    ed(x => { x.kosten = x.kosten.filter(k => k.id !== id) })
    await run(sb.from('kosten').delete().eq('id', id))
  }

  return (
    <>
      <div className="pagehead"><h2>Budget {e.jaar}</h2><p>Het startbudget is wat er vorig jaar over was. De opbrengsten komen uit de aanmeldingen en rekenen direct mee.</p></div>
      <div className="stats">
        <div className="stat"><span>Startbudget</span>
          <input className="field n num" type="number" step="0.01" value={e.start ?? ''} placeholder="Vul in" onChange={ev => setStart(ev.target.value)}
            style={{ font: '800 22px var(--fd)', padding: '4px 8px', width: '100%', textAlign: 'left' }} aria-label="Startbudget" /></div>
        <div className="stat"><span>Verwachte opbrengsten</span><strong>{euro(f.due)}</strong></div>
        <div className="stat"><span>Kosten</span><strong>{euro(f.kosten)}</strong></div>
        <div className="stat hl"><span>Verwacht over</span><strong>{euro(f.result)}</strong></div>
      </div>
      <p className="muted num" style={{ margin: '10px 2px 0' }}>{c.buffet} eten van het buffet, {c.kids} kindermenu’s · al ontvangen {euro(f.paid)}</p>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="spread" style={{ marginBottom: 8 }}><h3 style={{ fontSize: 20 }}>Kosten</h3><button className="btn sm" onClick={addK}>+ Kostenpost</button></div>
        <div className="scroll-x"><table className="dtable">
          <thead><tr><th>Omschrijving</th><th className="r">Bedrag</th><th /></tr></thead>
          <tbody>{e.kosten.length ? e.kosten.map(k => (
            <tr key={k.id}>
              <td><input className="field" value={k.oms} placeholder="Bijvoorbeeld buffet" onChange={ev => setK(k.id, 'oms', ev.target.value)} aria-label="Omschrijving" /></td>
              <td className="r"><input className="field n" type="number" min="0" step="0.01" value={k.bedrag} style={{ width: 120 }} onChange={ev => setK(k.id, 'bedrag', ev.target.value === '' ? 0 : Number(ev.target.value))} aria-label="Bedrag" /></td>
              <td className="r"><button className="btn ghost sm" aria-label="Verwijder kostenpost" onClick={() => delK(k.id)}>✕</button></td>
            </tr>
          )) : <tr><td colSpan="3" className="muted">Nog geen kosten ingevuld.</td></tr>}</tbody>
        </table></div>
      </div>
    </>
  )
}
