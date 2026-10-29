export const TYPES = [
  { k: 'hele_dag', l: 'Hele dag' },
  { k: 'alleen_eten', l: 'Alleen eten' },
  { k: 'eerder_weg', l: 'Eerder weg' },
  { k: 'afwezig', l: 'Afwezig' },
]
export const TL = Object.fromEntries(TYPES.map(t => [t.k, t.l]))
export const TEAMC = [
  { n: 'Geel', c: '#F2C500', t: '#3A2F00' }, { n: 'Groen', c: '#2E9E5B', t: '#fff' }, { n: 'Rood', c: '#D9433B', t: '#fff' },
  { n: 'Paars', c: '#7A4BC2', t: '#fff' }, { n: 'Oranje', c: '#F07F16', t: '#2B1600' }, { n: 'Roze', c: '#E85A9E', t: '#fff' },
  { n: 'Blauw', c: '#2F7FD8', t: '#fff' }, { n: 'Turquoise', c: '#17A2A1', t: '#fff' }, { n: 'Bruin', c: '#8A5A3B', t: '#fff' },
  { n: 'Grijs', c: '#6B7280', t: '#fff' },
]

const EUR = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
export const euro = n => EUR.format(n || 0)
export const nm = p => p.v + (p.a ? ' ' + p.a : '')
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

export function age(p, e) {
  if (!p.gb) return null
  const s = String(p.gb).trim()
  if (/^\d{4}$/.test(s)) return e.jaar - (+s)
  const d = new Date(s); if (isNaN(d)) return null
  const r = e.datum ? new Date(e.datum) : new Date(e.jaar, 5, 30)
  let a = r.getFullYear() - d.getFullYear()
  const m = r.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && r.getDate() < d.getDate())) a--
  return a
}
export const exists = (p, e) => { const a = age(p, e); return a === null || a >= 0 }
export const adultVan = e => e.tar.cats.length ? Math.max(...e.tar.cats.map(c => +c.van || 0)) : 16
export const isAdult = (p, e) => { const a = age(p, e); return a === null || a >= adultVan(e) }
export const canOrg = (p, e) => { const a = age(p, e); return a === null || a >= (e.tar.orgVan ?? 18) }
export function cat(p, e) {
  const cs = e.tar.cats; if (!cs.length) return null
  const a = age(p, e)
  const top = cs.reduce((m, c) => (+c.van > +m.van ? c : m), cs[0])
  if (a === null) return top
  return cs.find(c => a >= +c.van && (c.tot === null || c.tot === '' || a <= +c.tot)) || top
}
export function price(p, e, t) { if (!t) return 0; const c = cat(p, e); if (!c) return 0; return +((e.tar.prijs[c.id] || {})[t] || 0) }
export function ageTxt(p, e) { const a = age(p, e); if (a === null) return 'volwassen'; if (a < 0) return 'nog niet geboren'; return a + ' jaar' }
export function sortM(m, e) { return m.slice().sort((x, y) => { const a = age(x, e), b = age(y, e); return (b === null ? 999 : b) - (a === null ? 999 : a) || x.v.localeCompare(y.v) }) }
export const famName = (S, id) => (S.fams.find(f => f.id === id) || {}).naam || ''

export function gLabel(S, g, e) {
  if (g.naam) return g.naam
  const ad = S.persons.filter(p => p.g === g.id && isAdult(p, e))
  return ad.length ? 'Gezin ' + ad.map(p => p.v).join(' & ') : 'Nieuw gezin'
}
export function groups(S, e) {
  const out = []
  for (const f of S.fams) {
    for (const g of S.gezinnen.filter(g => g.f === f.id)) {
      out.push({ key: 'g' + g.id, label: gLabel(S, g, e), fam: f, members: sortM(S.persons.filter(p => p.g === g.id && exists(p, e)), e) })
    }
    const rest = S.persons.filter(p => p.f === f.id && !p.g && exists(p, e))
    if (rest.length) out.push({ key: 'f' + f.id, label: 'Familie ' + f.naam, fam: f, loose: true, members: sortM(rest, e) })
  }
  return out
}
export function finance(S, e) {
  let due = 0, paid = 0
  S.persons.forEach(p => {
    if (!exists(p, e)) return
    const t = e.aanw[p.id]; if (!t || t === 'afwezig') return
    const pr = price(p, e, t); due += pr; if (e.betaald[p.id]) paid += pr
  })
  const kosten = e.kosten.reduce((s, k) => s + (+k.bedrag || 0), 0), start = +e.start || 0
  return { due, paid, open: due - paid, kosten, start, result: start + due - kosten }
}
export function counts(S, e) {
  const c = { aanw: 0, eten: 0, buffet: 0, kids: 0, spelen: 0, onb: 0 }; const org = new Set(e.org)
  S.persons.forEach(p => {
    if (!exists(p, e)) return
    const t = e.aanw[p.id], a = age(p, e)
    if (!t) { c.onb++; return } if (t === 'afwezig') return
    c.aanw++
    if (t === 'hele_dag' || t === 'alleen_eten') { c.eten++; if (a !== null && a < e.tar.menuTot) c.kids++; else c.buffet++ }
    if ((t === 'hele_dag' || t === 'eerder_weg') && !org.has(p.id) && (a === null || a >= e.tar.koppelTot)) c.spelen++
  })
  return c
}
export function kGroups(S, e) {
  return groups(S, e).map(g => {
    const att = g.members.filter(p => e.aanw[p.id] && e.aanw[p.id] !== 'afwezig')
    const due = att.reduce((s, p) => s + price(p, e, e.aanw[p.id]), 0)
    const paid = att.filter(p => e.betaald[p.id]).reduce((s, p) => s + price(p, e, e.aanw[p.id]), 0)
    const st = due === 0 ? 'gratis' : paid >= due ? 'betaald' : paid > 0 ? 'deels' : 'open'
    return { ...g, att, due, paid, st }
  }).filter(g => g.att.length)
}
export function teamPools(S, e) {
  const org = new Set(e.org), k = e.tar.koppelTot, players = [], small = []
  S.persons.forEach(p => {
    if (!exists(p, e)) return
    const t = e.aanw[p.id]; if (t !== 'hele_dag' && t !== 'eerder_weg') return
    if (org.has(p.id)) return
    const a = age(p, e); (a !== null && a < k ? small : players).push(p)
  })
  const refs = e.org.filter(id => { const t = e.aanw[id]; return t && t !== 'afwezig' })
  return { players, small, refs }
}
export function makeTeams(S, e, n) {
  const { players, small, refs } = teamPools(S, e)
  if (!players.length) return null
  const av = adultVan(e)
  const famSize = {}; players.forEach(p => famSize[p.f] = (famSize[p.f] || 0) + 1)
  const order = shuffle(players.slice()).sort((a, b) => famSize[b.f] - famSize[a.f])
  const T = Array.from({ length: n }, () => ({ leden: [], fam: {}, gez: {}, kids: 0, adults: 0 }))
  order.forEach(p => {
    const a = age(p, e), kid = a !== null && a < av
    let best = null, bc = Infinity
    T.forEach(t => {
      const cost = t.leden.length * 6 + (t.fam[p.f] || 0) * 9 + (p.g ? (t.gez[p.g] || 0) * 25 : 0) + (kid ? t.kids * 4 : t.adults * 2) + Math.random() * 2
      if (cost < bc) { bc = cost; best = t }
    })
    best.leden.push(p.id); best.fam[p.f] = (best.fam[p.f] || 0) + 1
    if (p.g) best.gez[p.g] = (best.gez[p.g] || 0) + 1
    kid ? best.kids++ : best.adults++
  })
  const ml = {}, warn = [], loadT = T.map(() => 0)
  const tOf = id => T.findIndex(t => t.leden.includes(id))
  small.forEach(k => {
    let cand = k.g ? players.filter(p => p.g === k.g && isAdult(p, e)) : []
    if (!cand.length && k.g) cand = players.filter(p => p.g === k.g)
    if (!cand.length) { warn.push(k.id); cand = players.filter(p => p.f === k.f && isAdult(p, e)) }
    if (!cand.length) { warn.push(k.id); return }
    cand = shuffle(cand.slice()).sort((a, b) => loadT[tOf(a.id)] - loadT[tOf(b.id)])
    ml[k.id] = cand[0].id; loadT[tOf(cand[0].id)]++
  })
  const list = T.map(t => ({ leden: t.leden, scheids: [] }))
  refs.forEach((r, i) => list[i % n].scheids.push(r))
  return { list, ml, warn: [...new Set(warn)] }
}
export function fmtDate(e) {
  if (!e) return ''
  if (e.vervallen) return e.notitie || 'Vervallen'
  if (!e.datum) return 'Datum nog niet bekend'
  return new Date(e.datum).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
