@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Familiedag publiceren

echo.
echo  Familiedag - wijzigingen publiceren
echo  ===================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo  Git is niet gevonden. Installeer Git voor Windows en probeer opnieuw.
  goto einde
)
if not exist "package.json" (
  echo  Zet dit bestand in de map van de app, naast package.json.
  goto einde
)

rem ---- Eerste keer: deze map koppelen aan de bestaande GitHub-repository ----
if not exist ".git" (
  echo  Deze map wordt gekoppeld aan github.com/Chrisschoneveld/familiedag ...
  git init -b main >nul || goto fout
  git remote add origin https://Chrisschoneveld@github.com/Chrisschoneveld/familiedag.git || goto fout
  git fetch origin || goto fout
  git reset --soft origin/main || goto fout
  echo  Gekoppeld.
  echo.
)

rem ---- Naam en e-mail voor git instellen als die nog ontbreken ----
git config user.name >nul 2>nul || git config user.name "Chris Schoneveld"
git config user.email >nul 2>nul || git config user.email "Chrisschoneveld@users.noreply.github.com"

git add -A || goto fout
git diff --cached --quiet
if not errorlevel 1 (
  echo  Er zijn geen wijzigingen om te publiceren.
  goto einde
)

echo  Deze wijzigingen gaan mee:
echo.
git status --short
echo.
set "BERICHT="
set /p "BERICHT= Korte omschrijving (Enter = Update): "
if "%BERICHT%"=="" set "BERICHT=Update"

git commit -m "%BERICHT%" >nul || goto fout
echo.
echo  Versturen naar GitHub ... (log zo nodig in als Chrisschoneveld)
git push -u origin main || goto fout

echo.
echo  Klaar. Vercel zet de nieuwe versie binnen een minuut online.
goto einde

:fout
echo.
echo  Er ging iets mis. Lees de melding hierboven of stuur hem door.

:einde
echo.
pause
