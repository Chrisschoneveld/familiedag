import { useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'
import { mapPersoon } from '../lib/data'

export default function PersonDialog({ p, famDefault }) {
  const { S, update, run, closeDialog, toast } = useApp()
  const isNew = !p
  const [f, setF] = useState(() => p
    ? { v: p.v, a: p.a, gb: p.gb, f: p.f, email: p.email, kk: p.kk }
    : { v: '', a: S.fams.find(x => x.id === famDefault)?.ach || '', gb: '', f: famDefault || S.fams[0]?.id, email: '', kk: false })
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))

  const save = async () => {
    const v = f.v.trim(), gb = f.gb.trim(), email = f.email.trim().toLowerCase()
    if (!v) { toast('Vul een voornaam in'); return }
    if (gb && !/^\d{4}(-\d{2}-\d{2})?$/.test(gb)) { toast('Schrijf de geboortedatum als 2019 of 2019-05-14'); return }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { toast('Dit e-mailadres klopt niet'); return }
    const row = { voornaam: v, achternaam: f.a.trim(), geboorte: gb || null, familie_id: +f.f, email: email || null, koude_kant: f.kk }
    if (isNew) {
      const d = await run(sb.from('personen').insert(row).select().single())
      if (d) update(n => { n.persons.push(mapPersoon(d)) })
    } else {
      if (p.f !== +f.f) row.gezin_id = null
      update(n => {
        const x = n.persons.find(y => y.id === p.id)
        Object.assign(x, { v: row.voornaam, a: row.achternaam, gb: gb, f: row.familie_id, email: email, kk: row.koude_kant })
        if (row.gezin_id === null) x.g = null
      })
      await run(sb.from('personen').update(row).eq('id', p.id))
    }
    closeDialog(); toast('Persoon opgeslagen')
  }

  const del = async () => {
    if (!confirm(`${p.v} verwijderen? Aanmeldingen en organisatie van deze persoon verdwijnen ook.`)) return
    update(n => {
      n.persons = n.persons.filter(x => x.id !== p.id)
      n.editions.forEach(x => { x.org = x.org.filter(i => i !== p.id); delete x.aanw[p.id]; delete x.betaald[p.id] })
    })
    await run(sb.from('personen').delete().eq('id', p.id))
    closeDialog(); toast('Persoon verwijderd')
  }

  return (
    <>
      <h3>{isNew ? 'Persoon toevoegen' : 'Persoon bewerken'}</h3>
      <div className="grid2">
        <div className="f"><label className="lbl" htmlFor="pv">Voornaam</label><input className="field" id="pv" autoFocus value={f.v} onChange={ev => set('v', ev.target.value)} /></div>
        <div className="f"><label className="lbl" htmlFor="pa">Achternaam</label><input className="field" id="pa" value={f.a} onChange={ev => set('a', ev.target.value)} /></div>
      </div>
      <div className="f"><label className="lbl" htmlFor="pgb">Geboortedatum of -jaar</label><input className="field" id="pgb" value={f.gb} placeholder="Leeg laten voor volwassenen, of 2019 of 2019-05-14" onChange={ev => set('gb', ev.target.value)} /></div>
      <div className="f"><label className="lbl" htmlFor="pf">Familie</label>
        <select className="field" id="pf" style={{ width: '100%' }} value={f.f} onChange={ev => set('f', +ev.target.value)}>
          {S.fams.map(x => <option key={x.id} value={x.id}>{x.naam}</option>)}
        </select></div>
      <div className="f"><label className="lbl" htmlFor="pe">E-mailadres (nodig om in te loggen als organisatie)</label><input className="field" id="pe" type="email" value={f.email} onChange={ev => set('email', ev.target.value)} /></div>
      <div className="f"><label className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><input type="checkbox" checked={f.kk} onChange={ev => set('kk', ev.target.checked)} /> Koude kant (aangetrouwd), hoeft niet te organiseren</label></div>
      <footer>
        {isNew ? <span /> : <button className="btn danger" onClick={del}>Verwijderen</button>}
        <div className="row"><button className="btn" onClick={closeDialog}>Annuleren</button><button className="btn primary" onClick={save}>Opslaan</button></div>
      </footer>
    </>
  )
}
