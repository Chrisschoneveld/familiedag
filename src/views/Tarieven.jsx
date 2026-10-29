import { useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'
import { TYPES } from '../lib/calc'
import { useSaver } from '../lib/useSaver'
import NieuweEditie from '../components/NieuweEditie'

const num = v => (v === '' || v === null || v === undefined) ? null : Number(v)

export default function Tarieven() {
  const { S, e, role, update, run, toast, openDialog } = useApp()
  const saver = useSaver()
  const [code, setCode] = useState('')
  const t = e.tar
  const ed = fn => update(n => fn(n.editions.find(x => x.jaar === e.jaar)))

  const setCat = (id, field, val) => {
    ed(x => { x.tar.cats.find(c => c.id === id)[field] = val })
    saver(`c${id}${field}`, () => run(sb.from('leeftijdsgroepen').update({ [field]: field === 'naam' ? val : (field === 'van' ? (val ?? 0) : val) }).eq('id', id)))
  }
  const setPrijs = (gid, type, val) => {
    ed(x => { x.tar.prijs[gid] = x.tar.prijs[gid] || {}; x.tar.prijs[gid][type] = val })
    saver(`p${gid}${type}`, () => run(sb.from('tarieven').upsert({ groep_id: gid, type, bedrag: val || 0 })))
  }
  const setGrens = (key, col, val) => {
    ed(x => { x.tar[key] = val })
    saver(col, () => run(sb.from('edities').update({ [col]: val ?? 0 }).eq('jaar', e.jaar)))
  }
  const setEd = (key, col, val) => {
    ed(x => { x[key] = val })
    saver(col, () => run(sb.from('edities').update({ [col]: val }).eq('jaar', e.jaar)))
  }
  const addCat = async () => {
    const g = await run(sb.from('leeftijdsgroepen').insert({ jaar: e.jaar, naam: 'Nieuwe groep', van: 0, tot: 0 }).select().single())
    if (!g) return
    await run(sb.from('tarieven').insert(TYPES.map(x => ({ groep_id: g.id, type: x.k, bedrag: 0 }))))
    ed(x => { x.tar.cats.push({ id: g.id, naam: g.naam, van: g.van, tot: g.tot }); x.tar.prijs[g.id] = { hele_dag: 0, alleen_eten: 0, eerder_weg: 0, afwezig: 0 } })
  }
  const delCat = async id => {
    if (!confirm('Deze leeftijdsgroep verwijderen?')) return
    ed(x => { x.tar.cats = x.tar.cats.filter(c => c.id !== id); delete x.tar.prijs[id] })
    await run(sb.from('leeftijdsgroepen').delete().eq('id', id))
  }
  const maakActief = async () => {
    update(n => { n.actief = e.jaar })
    await run(sb.from('instellingen').update({ actief_jaar: e.jaar }).eq('id', 1), `${e.jaar} is nu het actieve jaar`)
  }
  const wijzigCode = async () => {
    const { error } = await sb.rpc('fd_set_familiecode', { p_code: code })
    if (error) { toast(error.message); return }
    setCode(''); toast('Familiecode gewijzigd')
  }

  return (
    <>
      <div className="pagehead"><h2>Tarieven {e.jaar}</h2><p>Leeftijd wordt berekend op de dag zelf. Zonder geboortedatum geldt iemand als volwassene. Wijzigingen gelden alleen voor {e.jaar} en worden automatisch opgeslagen.</p></div>
      <div className="stack">
        <div className="card">
          <div className="spread" style={{ marginBottom: 10 }}><h3 style={{ fontSize: 20 }}>Prijs per leeftijdsgroep</h3><button className="btn sm" onClick={addCat}>+ Leeftijdsgroep</button></div>
          <div className="scroll-x"><table className="dtable">
            <thead><tr><th>Groep</th><th className="r">Van</th><th className="r">Tot en met</th>{TYPES.map(x => <th key={x.k} className="r"><span className={'pill t-' + x.k}>{x.l}</span></th>)}<th /></tr></thead>
            <tbody>{t.cats.map(c => (
              <tr key={c.id}>
                <td><input className="field" value={c.naam} style={{ minWidth: 150 }} onChange={ev => setCat(c.id, 'naam', ev.target.value)} aria-label="Naam groep" /></td>
                <td className="r"><input className="field n" type="number" min="0" value={c.van ?? ''} style={{ width: 70 }} onChange={ev => setCat(c.id, 'van', num(ev.target.value))} aria-label="Van leeftijd" /></td>
                <td className="r"><input className="field n" type="number" min="0" value={c.tot ?? ''} placeholder="ouder" style={{ width: 80 }} onChange={ev => setCat(c.id, 'tot', num(ev.target.value))} aria-label="Tot en met leeftijd" /></td>
                {TYPES.map(x => (
                  <td key={x.k} className="r"><input className="field n" type="number" min="0" step="0.5" value={(t.prijs[c.id] || {})[x.k] ?? 0}
                    onChange={ev => setPrijs(c.id, x.k, num(ev.target.value) ?? 0)} aria-label={`${c.naam} ${x.l}`} /></td>
                ))}
                <td>{t.cats.length > 1 && <button className="btn ghost sm" aria-label="Verwijder groep" onClick={() => delCat(c.id)}>✕</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 20, marginBottom: 12 }}>Leeftijdsgrenzen</h3>
          <div className="row" style={{ gap: 20 }}>
            {[['menuTot', 'menu_tot', 'Kindermenu onder'], ['koppelTot', 'koppel_tot', 'In teams koppelen aan ouder onder'], ['orgVan', 'org_van', 'Organiseren vanaf']].map(([k, col, l]) => (
              <div key={k}><label className="lbl" htmlFor={k}>{l}</label><div className="row">
                <input className="field n" id={k} type="number" min="0" value={t[k] ?? ''} style={{ width: 80 }} onChange={ev => setGrens(k, col, num(ev.target.value))} /><span className="muted">jaar</span>
              </div></div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 20, marginBottom: 12 }}>Editie {e.jaar}</h3>
          <div className="row" style={{ gap: 20, alignItems: 'flex-end' }}>
            <div><label className="lbl" htmlFor="edat">Datum</label><input className="field" id="edat" type="date" value={e.datum || ''} onChange={ev => setEd('datum', 'datum', ev.target.value || null)} /></div>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={e.vervallen} onChange={ev => setEd('vervallen', 'vervallen', ev.target.checked)} /> Vervallen</label>
            <button className="btn" onClick={() => openDialog(<NieuweEditie />)}>Nieuwe editie maken</button>
          </div>
          <p className="muted" style={{ margin: '14px 0 0' }}>
            {S.actief === e.jaar ? 'Dit is het actieve jaar: families melden zich hiervoor aan, en de organisatie van dit jaar kan inloggen.'
              : `Het actieve jaar is ${S.actief}. Families melden zich daarvoor aan.`}
          </p>
          {role.beheerder && S.actief !== e.jaar && <button className="btn primary" style={{ marginTop: 10 }} onClick={maakActief}>Maak {e.jaar} het actieve jaar</button>}
        </div>
        {role.beheerder && (
          <div className="card">
            <h3 style={{ fontSize: 20, marginBottom: 4 }}>Familiecode</h3>
            <p className="muted" style={{ margin: '0 0 12px' }}>De code waarmee de familie zich kan aanmelden. Na een wijziging moet iedereen de nieuwe code één keer invullen.</p>
            <div className="row"><input className="field" value={code} onChange={ev => setCode(ev.target.value)} placeholder="Nieuwe familiecode" autoComplete="off" style={{ maxWidth: 260 }} aria-label="Nieuwe familiecode" />
              <button className="btn primary" disabled={code.trim().length < 4} onClick={wijzigCode}>Code wijzigen</button></div>
          </div>
        )}
      </div>
    </>
  )
}
