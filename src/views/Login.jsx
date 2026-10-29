import { useState } from 'react'
import { useApp } from '../ctx'
import { sb } from '../supabase'

export default function Login() {
  const { session, role, toast } = useApp()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (session && role.staff) return <div className="card empty"><h3>Je bent ingelogd</h3><p>Ga naar de <a href="#kassa">kassa</a> of een ander scherm bovenin.</p></div>
  if (session) return (
    <div className="card empty"><h3>Geen toegang</h3>
      <p>Je bent ingelogd als {session.user.email}, maar dit adres hoort niet bij de organisatie van dit jaar. Vraag de organisatie of beheerder om dit e-mailadres bij jouw naam in te vullen.</p>
      <p><button className="btn" onClick={() => sb.auth.signOut()}>Uitloggen</button></p></div>
  )

  const send = async ev => {
    ev.preventDefault()
    const adres = email.trim().toLowerCase(); if (!adres) return
    setBusy(true)
    const { error } = await sb.auth.signInWithOtp({ email: adres, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
    setBusy(false)
    if (error) { toast('Versturen mislukt: ' + error.message); return }
    setSent(true)
  }

  return (
    <section className="hero codebox">
      <h2>Inloggen voor de organisatie</h2>
      {sent ? <p>Er is een inloglink gestuurd naar <b>{email}</b>. Open die link op dit apparaat om verder te gaan.</p> : (
        <>
          <p>Vul je e-mailadres in. Je krijgt een link waarmee je zonder wachtwoord inlogt.</p>
          <form className="row" onSubmit={send} style={{ flexWrap: 'nowrap' }}>
            <input className="field" type="email" required value={email} onChange={ev => setEmail(ev.target.value)} placeholder="naam@voorbeeld.nl" autoComplete="email" aria-label="E-mailadres" />
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Bezig…' : 'Stuur link'}</button>
          </form>
        </>
      )}
    </section>
  )
}
