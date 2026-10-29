# Familiedag

Webapp voor de familiedag: aanmelden, kassa, teams, gezinnen, organisatie, tarieven en budget.
React + Vite, gehost op GitHub Pages, met Supabase als database.

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

## 2. GitHub Pages

1. Maak een **openbare** repository `familiedag` aan op GitHub.
2. Zet de bestanden erin:
   ```bash
   git init -b main
   git add .
   git commit -m "Familiedag app"
   git remote add origin https://github.com/<jouw-github-naam>/familiedag.git
   git push -u origin main
   ```
3. In de repository: **Settings → Secrets and variables → Actions → tabblad Variables**, voeg toe:
   - `VITE_SUPABASE_URL` = de Project URL
   - `VITE_SUPABASE_ANON_KEY` = de anon public key
4. **Settings → Pages → Source**: kies **GitHub Actions**.
5. Ga naar **Actions** en start **Publiceren op GitHub Pages** (of push een wijziging).
   Na een minuut staat de app op `https://<jouw-github-naam>.github.io/familiedag/`.

Elke push naar `main` zet automatisch een nieuwe versie online.

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

- Een gratis Supabase-project wordt na een week zonder gebruik **gepauzeerd**. Je gegevens blijven bewaard;
  zet het project een paar weken voor de aanmeldingen weer aan via het Supabase-dashboard.
- De ingebouwde e-mail van Supabase verstuurt maar een beperkt aantal inloglinks per uur. Voor een handvol
  organisatoren is dat genoeg; anders kun je onder **Authentication → SMTP** een eigen mailprovider koppelen.
- Controleer de actuele voorwaarden van Supabase en GitHub, die kunnen veranderen.
