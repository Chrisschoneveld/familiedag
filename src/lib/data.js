import { sb } from '../supabase'

const must = ({ data, error }) => { if (error) throw error; return data }

export const mapPersoon = r => ({ id: r.id, v: r.voornaam, a: r.achternaam || '', f: r.familie_id, gb: r.geboorte || '', g: r.gezin_id, kk: !!r.koude_kant, email: r.email || '' })

export async function loadAll() {
  const sel = (t, cols = '*') => sb.from(t).select(cols).then(must)
  const [fam, gez, per, edi, grp, tar, aan, org, kos, tms, ins] = await Promise.all([
    sel('families'), sel('gezinnen'), sel('personen'), sel('edities'), sel('leeftijdsgroepen'), sel('tarieven'),
    sel('aanmeldingen'), sel('organisatie'), sel('kosten'), sel('teams'), sel('instellingen', 'id,actief_jaar'),
  ])
  const editions = edi.sort((a, b) => a.jaar - b.jaar).map(x => {
    const cats = grp.filter(g => g.jaar === x.jaar).sort((a, b) => a.van - b.van).map(g => ({ id: g.id, naam: g.naam, van: g.van, tot: g.tot }))
    const prijs = {}; cats.forEach(c => { prijs[c.id] = {} })
    tar.forEach(t => { if (prijs[t.groep_id]) prijs[t.groep_id][t.type] = Number(t.bedrag) })
    const aanw = {}, betaald = {}
    aan.filter(a => a.jaar === x.jaar).forEach(a => { aanw[a.persoon_id] = a.type; if (a.betaald) betaald[a.persoon_id] = true })
    return {
      jaar: x.jaar, datum: x.datum || '', vervallen: x.vervallen, notitie: x.notitie || '',
      start: x.startbudget === null ? null : Number(x.startbudget),
      tar: { cats, prijs, menuTot: x.menu_tot, koppelTot: x.koppel_tot, orgVan: x.org_van },
      aanw, betaald,
      org: org.filter(o => o.jaar === x.jaar).map(o => o.persoon_id),
      kosten: kos.filter(k => k.jaar === x.jaar).sort((a, b) => a.id - b.id).map(k => ({ id: k.id, oms: k.omschrijving, bedrag: Number(k.bedrag) })),
      teams: (tms.find(t => t.jaar === x.jaar) || {}).indeling || null,
    }
  })
  return {
    fams: fam.sort((a, b) => a.id - b.id).map(f => ({ id: f.id, naam: f.naam, ach: f.achternaam || '' })),
    persons: per.sort((a, b) => a.id - b.id).map(mapPersoon),
    gezinnen: gez.sort((a, b) => a.id - b.id).map(g => ({ id: g.id, f: g.familie_id, naam: g.naam || '' })),
    editions,
    actief: ins[0]?.actief_jaar ?? editions.at(-1)?.jaar,
  }
}
