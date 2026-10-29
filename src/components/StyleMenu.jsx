import { useEffect, useRef, useState } from 'react'
import { Palette } from './Icons'

export const STYLES = [
  ['zomer', 'Zomerfeest', ['#1470D1', '#FFC93C', '#E6F4FF']],
  ['f-strand', 'Strandfeest', ['#007C80', '#FF5D73', '#F5E6C4']],
  ['f-kermis', 'Kermis', ['#E02D3C', '#FFD43B', '#1F1747']],
  ['f-picknick', 'Picknick', ['#2F9E44', '#E03131', '#EEF6EA']],
  ['f-confetti', 'Confetti', ['#7048E8', '#F06595', '#F2C500']],
]
const valid = s => STYLES.some(x => x[0] === s) ? s : 'zomer'

export default function StyleMenu({ toast }) {
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState(() => { try { return valid(localStorage.getItem('familiedag-stijl')) } catch { return 'zomer' } })
  const ref = useRef(null), btn = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.style = cur
    try { localStorage.setItem('familiedag-stijl', cur) } catch { /* privémodus */ }
  }, [cur])

  useEffect(() => {
    if (!open) return
    const click = ev => { if (!ref.current?.contains(ev.target)) setOpen(false) }
    const key = ev => { if (ev.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('click', click); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', key) }
  }, [open])

  return (
    <div className="stylepick" ref={ref}>
      <button ref={btn} className="btn" id="stijlbtn" aria-haspopup="true" aria-expanded={open} aria-label="Kies stijl" title="Stijl kiezen" onClick={() => setOpen(o => !o)}><Palette /></button>
      {open && (
        <div className="stylemenu" role="menu">
          {STYLES.map(([k, l, c]) => (
            <button key={k} role="menuitemradio" aria-checked={cur === k} className={cur === k ? 'on' : ''}
              onClick={() => { setCur(k); setOpen(false); toast('Stijl: ' + l) }}>
              <span className="sw">{c.map(x => <i key={x} style={{ background: x }} />)}</span>{l}
              {cur === k && <span className="ck">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
