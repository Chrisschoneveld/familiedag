import { useCallback, useEffect, useRef, useState } from 'react'
import { signedUrls, tijd } from '../lib/media'

const fmt = d => d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function Viewer({ items, index, thumbs, onIndex, onClose, magWijzigen, onVerwijder, onJaar, jaren, toast }) {
  const m = items[index]
  const [full, setFull] = useState({})
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 })
  const [bezig, setBezig] = useState(false)
  const ptrs = useRef(new Map()), start = useRef(null), lastTap = useRef(0)

  // volledige versie van deze en de buren ophalen
  useEffect(() => {
    const buren = [items[index], items[index - 1], items[index + 1]].filter(Boolean)
    signedUrls(buren.map(x => x.pad)).then(u => {
      setFull(f => ({ ...f, ...u }))
      buren.filter(x => x.soort === 'foto' && x !== m).forEach(x => { const i = new Image(); i.src = u[x.pad] })
    }).catch(() => {})
    setZoom({ s: 1, x: 0, y: 0 }); setDrag({ x: 0, y: 0 })
  }, [index, items]) // eslint-disable-line react-hooks/exhaustive-deps

  const ga = useCallback(d => { const n = index + d; if (n >= 0 && n < items.length) onIndex(n) }, [index, items.length, onIndex])

  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') ga(-1); if (e.key === 'ArrowRight') ga(1) }
    document.addEventListener('keydown', k)
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = o }
  }, [ga, onClose])

  if (!m) return null

  const afstand = () => { const [a, b] = [...ptrs.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
  const down = e => {
    if (e.target.closest('button, select')) return
    // bij een video geen capture, zodat de afspeelknoppen gewoon blijven werken
    if (!e.target.closest('video')) e.currentTarget.setPointerCapture(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size === 2) start.current = { pinch: afstand(), s: zoom.s }
    else start.current = { x: e.clientX, y: e.clientY, zx: zoom.x, zy: zoom.y }
  }
  const move = e => {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const st = start.current; if (!st) return
    if (ptrs.current.size === 2 && st.pinch) {
      setZoom(z => ({ ...z, s: Math.min(5, Math.max(1, st.s * afstand() / st.pinch)) }))
    } else if (ptrs.current.size === 1 && st.x !== undefined) {
      const dx = e.clientX - st.x, dy = e.clientY - st.y
      if (zoom.s > 1) setZoom(z => ({ ...z, x: st.zx + dx, y: st.zy + dy }))
      else setDrag({ x: dx, y: dy })
    }
  }
  const up = e => {
    const st = start.current
    ptrs.current.delete(e.pointerId)
    if (ptrs.current.size > 0) { start.current = null; return }
    start.current = null
    if (zoom.s <= 1.02) setZoom({ s: 1, x: 0, y: 0 })
    if (st && st.x !== undefined && zoom.s <= 1) {
      const dx = e.clientX - st.x, dy = e.clientY - st.y
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) ga(dx < 0 ? 1 : -1)
      else if (dy > 110 && Math.abs(dy) > Math.abs(dx)) { onClose(); return }
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        const nu = Date.now()
        if (nu - lastTap.current < 300 && m.soort === 'foto') setZoom({ s: 2.5, x: 0, y: 0 })
        lastTap.current = nu
      }
    } else if (st && st.x !== undefined && Math.abs(e.clientX - st.x) < 8 && Math.abs(e.clientY - st.y) < 8) {
      const nu = Date.now()
      if (nu - lastTap.current < 300) setZoom({ s: 1, x: 0, y: 0 })
      lastTap.current = nu
    }
    setDrag({ x: 0, y: 0 })
  }

  const deel = async () => {
    setBezig(true)
    try {
      const url = full[m.pad] || (await signedUrls([m.pad]))[m.pad]
      const blob = await (await fetch(url)).blob()
      const naam = `familiedag-${m.jaar}-${m.id.slice(0, 8)}.${m.soort === 'foto' ? 'webp' : 'mp4'}`
      const file = new File([blob], naam, { type: blob.type })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] })
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = naam; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }
    } catch (err) { if (err?.name !== 'AbortError') toast('Opslaan mislukt') }
    setBezig(false)
  }

  const fade = Math.max(0.35, 1 - Math.max(0, drag.y) / 400)
  const tf = zoom.s > 1 ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` : `translate(${drag.x}px, ${Math.max(0, drag.y)}px)`
  const src = full[m.pad] || thumbs[m.thumb_pad]

  return (
    <div className="viewer" style={{ background: `rgba(0,0,0,${fade})` }} role="dialog" aria-modal="true" aria-label="Foto bekijken">
      <div className="vtop">
        <button className="vbtn" onClick={onClose} aria-label="Sluiten">✕</button>
        <div className="vinfo"><b>{fmt(m.genomen_op)}</b><span>{index + 1} van {items.length}{m.naam ? ` · ${m.naam}` : ''}</span></div>
        <span style={{ width: 40 }} />
      </div>
      <div className="vstage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {m.soort === 'foto'
          ? <img key={m.id} src={src} alt="" draggable={false} style={{ transform: tf, transition: ptrs.current.size ? 'none' : 'transform .2s' }} />
          : <video key={m.id} src={full[m.pad]} poster={thumbs[m.thumb_pad]} controls playsInline autoPlay style={{ transform: tf }} />}
        {index > 0 && <button className="vnav prev" onClick={() => ga(-1)} aria-label="Vorige">‹</button>}
        {index < items.length - 1 && <button className="vnav next" onClick={() => ga(1)} aria-label="Volgende">›</button>}
      </div>
      <div className="vbar">
        <button className="vbtn wide" onClick={deel} disabled={bezig}>{bezig ? 'Bezig…' : 'Opslaan of delen'}</button>
        {m.soort === 'video' && <span className="vdur">{tijd(m.duur)}</span>}
        {magWijzigen(m) && <>
          <select className="vsel" value={m.jaar} onChange={e => onJaar(m, +e.target.value)} aria-label="Jaar">
            {jaren.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          <button className="vbtn danger" onClick={() => onVerwijder(m)}>Verwijderen</button>
        </>}
      </div>
    </div>
  )
}
