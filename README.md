# Familiedag

Webapp voor de familiedag: aanmelden, foto’s, kassa, teams, gezinnen, organisatie, tarieven en budget.
React + Vite, gehost op Vercel, met Supabase als database en opslag.

## 1. Supabase inrichten

1. Maak een gratis project aan op [supabase.com](https://supabase.com). Kies regio **Frankfurt (eu-central-1)**.
2. Open `familiedag-supabase.sql` (zit **niet** in deze repository, want er staan familiegegevens in).
   Pas helemaal onderaan aan:
   - je eigen e-mailadres in `insert into public.beheerders …`
   - de familiecode in `insert into public.instellingen …` (standaard `lohuis27`)
3. Plak het hele bestand in **SQL Editor** en klik op **Run**.
4. Ga naar **Authentication → URL Configuration**:
   - **Site URL**: `https://<jouw-github-naam>.github.io/familiedag/`
   - **Redirect URLs**: hetzelfde adres, en voor lokaal testen ook `http://localhost:5173/`
5. Noteer bij **Project Settings → API** de **Project URL** en de **anon public** key.
   De `service_role` key heb je nergens voor nodig. Deel die met niemand.

## 2. Vercel

1. Importeer de GitHub-repository in Vercel (Add New → Project), framework **Vite**.
2. Voeg bij **Environment Variables** toe, type **Config** (deze waarden zijn openbaar):
   - `VITE_SUPABASE_URL` = de Project URL, zonder `/rest/v1`
   - `VITE_SUPABASE_ANON_KEY` = de anon key (begint met `eyJ`)
3. Zet het Vercel-adres in Supabase bij **Authentication → URL Configuration** (Site URL én Redirect URLs).

Elke push naar `main` zet automatisch een nieuwe versie online.

## Fotogalerij

1. Voer `familiedag-fotos.sql` uit in de SQL Editor (na het eerste script).
2. Zet in Supabase **Authentication → Sign In / Providers → Allow anonymous sign-ins** aan.
   Familieleden krijgen zo op de achtergrond een anonieme sessie die na het invullen van de familiecode toegang geeft.

Foto’s worden in de browser verkleind tot maximaal 2048 pixels en omgezet naar WebP. Video’s worden omgezet naar
MP4 (H.264 + AAC, maximaal 720p, 30 beelden per seconde). Lange video’s krijgen automatisch een lagere kwaliteit,
zodat ze onder de 50 MB per bestand van Supabase Free blijven. Het jaar wordt gelezen uit de opnamedatum.

Verwijderen kan door wie het heeft toegevoegd (op hetzelfde toestel) en door de beheerder.

## 3. Lokaal testen

```bash
cp .env.example .env.local   # vul URL en anon key in
npm install
npm run dev
```

## Hoe de toegang werkt

- **Familie**: opent de link, vult één keer de familiecode in en meldt het eigen gezin aan.
  De code wordt in de database gecontroleerd, niet in de browser.
- **Organisatie**: logt in met een e-maillink. Toegang heeft iedereen die bij de organisatie van het
  **actieve jaar** staat én bij wie dat e-mailadres op de persoon is ingevuld (Gezinnen of Organisatie → potloodje).
- **Beheerder** (jij): heeft altijd toegang, kan het actieve jaar wisselen en de familiecode wijzigen (scherm Tarieven).

## Goed om te weten

- Gratis Supabase heeft ongeveer 1 GB opslag. De beheerder ziet onderaan de fotopagina hoeveel er gebruikt is.
- Een gratis Supabase-project wordt na een week zonder gebruik **gepauzeerd**. Je gegevens blijven bewaard;
  zet het project een paar weken voor de aanmeldingen weer aan via het Supabase-dashboard.
- De ingebouwde e-mail van Supabase verstuurt maar een beperkt aantal inloglinks per uur. Voor een handvol
  organisatoren is dat genoeg; anders kun je onder **Authentication → SMTP** een eigen mailprovider koppelen.
- Controleer de actuele voorwaarden van Supabase en GitHub, die kunnen veranderen.
