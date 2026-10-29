import { useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'
import { finance } from '../lib/calc'

export default function NieuweEditie() {
  const { S, run, closeDialog, toast, reload, setCur } = useApp()
  const [jaar, setJaar] = useState(Math.max(...S.editions.map(e => e.jaar)) + 1)
  const [datum, setDatum] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const y = +jaar
    if (!y || S.editions.some(x => x.jaar === y)) { toast('Dit jaar bestaat al'); return }
    const prev = S.editions.filter(x => !x.vervallen && x.jaar < y).sort((a, b) => b.jaar - a.jaar)[0] || S.editions.at(-1)
    setBusy(true)
    const ok = await run(sb.from('edities').insert({
      jaar: y, datum: datum || null, startbudget: prev ? Math.round(finance(S, prev).result * 100) / 100 : null,
      menu_tot: prev?.tar.menuTot ?? 16, koppel_tot: prev?.tar.koppelTot ?? 4, org_van: prev?.tar.orgVan ?? 18,
    }).select().single())
    if (ok && prev) {
      for (const c of prev.tar.cats) {
        const g = await run(sb.from('leeftijdsgroepen').insert({ jaar: y, naam: c.naam, van: c.van, tot: c.tot }).select().single())
        if (g) await run(sb.from('tarieven').insert(['hele_dag', 'alleen_eten', 'eerder_weg', 'afwezig'].map(t => ({ groep_id: g.id, type: t, bedrag: (prev.tar.prijs[c.id] || {})[t] || 0 }))))
      }
    }
    await reload(); setBusy(false)
    if (ok) { setCur(y); closeDialog(); toast(`Editie ${y} gemaakt`) }
  }

  return (
    <>
      <h3>Nieuwe editie</h3>
      <div className="grid2">
        <div className="f"><label className="lbl" htmlFor="ny">Jaar</label><input className="field" id="ny" type="number" value={jaar} onChange={ev => setJaar(ev.target.value)} /></div>
        <div className="f"><label className="lbl" htmlFor="nd">Datum</label><input className="field" id="nd" type="date" value={datum} onChange={ev => setDatum(ev.target.value)} /></div>
      </div>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Tarieven worden overgenomen van het laatste jaar. Het startbudget wordt wat er dat jaar naar verwachting over is.</p>
      <footer><span /><div className="row"><button className="btn" onClick={closeDialog}>Annuleren</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Bezig…' : 'Editie maken'}</button></div></footer>
    </>
  )
}
