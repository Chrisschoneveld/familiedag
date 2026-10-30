import { sb } from '../supabase'

export const MAX_BYTES = 45 * 1024 * 1024 // ruim onder de 50 MB per bestand van Supabase Free
const BUCKET = 'media'

/* ---------- ondertekende links, onthouden om dataverkeer te sparen ---------- */
const KEY = 'fd-media-urls', GELDIG = 7 * 24 * 3600, HERGEBRUIK = 6 * 24 * 3600e3
let cache = {}
try {
  const ruw = JSON.parse(localStorage.getItem(KEY) || '{}'), nu = Date.now()
  for (const [k, v] of Object.entries(ruw)) if (nu - v.t < HERGEBRUIK) cache[k] = v
} catch { cache = {} }
const bewaar = () => { try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* vol of privé */ } }

export async function signedUrls(paden) {
  const nu = Date.now()
  const nodig = [...new Set(paden)].filter(p => !(cache[p] && nu - cache[p].t < HERGEBRUIK))
  for (let i = 0; i < nodig.length; i += 100) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(nodig.slice(i, i + 100), GELDIG)
    if (error) throw error
    data.forEach(d => { if (d.signedUrl && d.path) cache[d.path] = { u: d.signedUrl, t: nu } })
  }
  if (nodig.length) bewaar()
  return Object.fromEntries(paden.map(p => [p, cache[p]?.u]))
}
export const vergeetUrls = paden => { paden.forEach(p => delete cache[p]); bewaar() }

/* ---------- foto's: verkleinen en omzetten naar WebP ---------- */
async function laadBeeld(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* probeer via <img> */ }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image(); img.src = url
    await img.decode()
    return img
  } catch {
    throw new Error('Dit fotoformaat kan je browser niet openen. Probeer het op je telefoon of exporteer de foto als JPG.')
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
}

export async function naarWebp(bron, max, kwaliteit) {
  const sw = bron.naturalWidth || bron.width, sh = bron.naturalHeight || bron.height
  const s = Math.min(1, max / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bron, 0, 0, w, h)
  let blob = await new Promise(r => c.toBlob(r, 'image/webp', kwaliteit))
  if (!blob || blob.type !== 'image/webp') {
    // Safari kan zelf geen WebP maken: dan doet een WASM-encoder het
    const { encode } = await import('@jsquash/webp')
    const buf = await encode(ctx.getImageData(0, 0, w, h), { quality: Math.round(kwaliteit * 100) })
    blob = new Blob([buf], { type: 'image/webp' })
  }
  return { blob, w, h }
}

async function opnameDatum(file) {
  try {
    const exifr = (await import('exifr')).default
    const t = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] })
    const d = t?.DateTimeOriginal || t?.CreateDate
    if (d instanceof Date && !isNaN(d)) return d
  } catch { /* geen EXIF */ }
  return new Date(file.lastModified || Date.now())
}

export async function verwerkFoto(file) {
  const beeld = await laadBeeld(file)
  const groot = await naarWebp(beeld, 2048, 0.82)
  const klein = await naarWebp(beeld, 480, 0.7)
  if (beeld.close) beeld.close()
  return { soort: 'foto', blob: groot.blob, thumb: klein.blob, breedte: groot.w, hoogte: groot.h, duur: null, datum: await opnameDatum(file) }
}

/* ---------- video's: omzetten naar MP4 (H.264 + AAC) ---------- */
// opnamedatum uit de 'mvhd'-kop van een MP4/MOV-bestand (begin of eind van het bestand)
async function mvhdDatum(file) {
  const blok = 4 * 1024 * 1024
  const stukken = [[0, Math.min(file.size, blok)]]
  if (file.size > blok) stukken.push([Math.max(blok, file.size - blok), file.size])
  for (const [a, b] of stukken) {
    const buf = new Uint8Array(await file.slice(a, b).arrayBuffer())
    for (let i = 0; i < buf.length - 20; i++) {
      if (buf[i] === 0x6d && buf[i + 1] === 0x76 && buf[i + 2] === 0x68 && buf[i + 3] === 0x64) {
        const dv = new DataView(buf.buffer, buf.byteOffset + i + 8)
        const sec = buf[i + 4] === 1 ? Number(dv.getBigUint64(0)) : dv.getUint32(0)
        const d = new Date((sec - 2082844800) * 1000)
        if (sec > 0 && d.getFullYear() > 1995 && d.getTime() < Date.now() + 864e5) return d
      }
    }
  }
  return null
}

export async function verwerkVideo(file, onProgress) {
  const mb = await import('mediabunny')
  if (!(await mb.canEncodeAudio('aac'))) {
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder')
    registerAacEncoder()
  }
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
  try {
    const vt = await input.getPrimaryVideoTrack()
    if (!vt) throw new Error('Er zit geen videobeeld in dit bestand.')
    const duur = await input.computeDuration()
    const dw = vt.displayWidth, dh = vt.displayHeight
    let fps = null
    try { fps = (await vt.computePacketStats(90)).averagePacketRate } catch { /* onbekend */ }
    let datum = null
    try {
      const tags = await input.getMetadataTags()
      datum = tags.date || null
      const apple = Object.entries(tags.raw || {}).find(([k]) => /creationdate/i.test(k))
      if (!datum && apple) { const d = new Date(String(apple[1])); if (!isNaN(d)) datum = d }
    } catch { /* geen tags */ }
    if (!(datum instanceof Date) || isNaN(datum)) datum = await mvhdDatum(file)
    if (!(datum instanceof Date) || isNaN(datum)) datum = new Date(file.lastModified || Date.now())

    // kwaliteit afstemmen op de lengte, zodat het bestand onder de limiet blijft
    const audioBr = 96000
    const budget = (MAX_BYTES * 8) / Math.max(duur, 1) - audioBr
    const br = Math.round(Math.min(2500000, budget * 0.9))
    if (br < 250000) throw new Error('Deze video is te lang om onder de 50 MB te blijven. Knip hem op in kortere delen.')
    const lang = br >= 1200000 ? 1280 : br >= 650000 ? 960 : 640
    const s = Math.min(1, lang / Math.max(dw, dh))
    const even = n => Math.max(2, Math.round(n / 2) * 2)

    // miniatuur van een beeld uit het begin
    let thumb = null
    try {
      const sink = new mb.CanvasSink(vt, { width: even(Math.min(480, dw)) })
      const wc = await sink.getCanvas(Math.min(0.5, duur / 2)) || await sink.getCanvas(0)
      if (wc) thumb = (await naarWebp(wc.canvas, 480, 0.7)).blob
    } catch { /* geen miniatuur */ }
    if (!thumb) throw new Error('Je browser kan deze video niet openen.')

    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() })
    const conv = await mb.Conversion.init({
      input, output, tracks: 'primary', showWarnings: false,
      video: { codec: 'avc', width: even(dw * s), height: even(dh * s), fit: 'contain', quality: new mb.Quality({ bitrate: br }),
        frameRate: fps && fps > 31 ? 30 : undefined, forceTranscode: true },
      audio: { codec: 'aac', numberOfChannels: 2, quality: new mb.Quality({ bitrate: audioBr }), forceTranscode: true },
    })
    if (!conv.isValid || conv.discardedTracks.some(d => d.track.isVideoTrack())) {
      throw new Error('Je browser kan deze video niet omzetten. Probeer het in een recente versie van Safari, Chrome of Edge.')
    }
    const zonderGeluid = conv.discardedTracks.some(d => d.track.isAudioTrack())
    conv.onProgress = p => onProgress?.(p)
    await conv.execute()
    const blob = new Blob([output.target.buffer], { type: 'video/mp4' })
    if (blob.size > 50 * 1024 * 1024) throw new Error('De omgezette video is groter dan 50 MB. Knip hem op in kortere delen.')
    return { soort: 'video', blob, thumb, breedte: even(dw * s), hoogte: even(dh * s), duur, datum, zonderGeluid }
  } finally { input.dispose() }
}

/* ---------- opslaan ---------- */
export async function uploadMedia(res, { jaar, naam, uid }) {
  const id = crypto.randomUUID()
  const ext = res.soort === 'foto' ? 'webp' : 'mp4'
  const pad = `${uid}/${id}.${ext}`, thumb_pad = `${uid}/${id}_t.webp`
  const st = sb.storage.from(BUCKET)
  const a = await st.upload(pad, res.blob, { contentType: res.blob.type, cacheControl: '31536000', upsert: false })
  if (a.error) throw a.error
  const b = await st.upload(thumb_pad, res.thumb, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
  if (b.error) { await st.remove([pad]); throw b.error }
  const row = {
    id, jaar, soort: res.soort, pad, thumb_pad, breedte: res.breedte, hoogte: res.hoogte,
    duur: res.duur ? Math.round(res.duur * 100) / 100 : null, grootte: res.blob.size + res.thumb.size,
    genomen_op: res.datum.toISOString(), naam: naam || '',
  }
  const c = await sb.from('media').insert(row).select().single()
  if (c.error) { await st.remove([pad, thumb_pad]); throw c.error }
  return c.data
}

export async function verwijderMedia(m) {
  const r = await sb.storage.from(BUCKET).remove([m.pad, m.thumb_pad])
  if (r.error) throw r.error
  const d = await sb.from('media').delete().eq('id', m.id)
  if (d.error) throw d.error
  vergeetUrls([m.pad, m.thumb_pad])
}

export const tijd = s => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
export const mbTxt = b => (b / 1024 / 1024).toLocaleString('nl-NL', { maximumFractionDigits: b < 10 * 1024 * 1024 ? 1 : 0 }) + ' MB'
