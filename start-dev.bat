@echo off
cd /d "%~dp0"
rem Optional: SMTP settings for Zoho (edit values or remove these lines)
set "SELLER_EMAIL=billing@privetserver.com"
set "ZOHO_USER=emailapikey"
set "ZOHO_PASS=wSsVR61y+0b5XK55n2auJudqn1VQBlzwRhh1iQbwuH+pG6/K/Mdpw0TKBFKgSvEdEmZqEDIT8r4vkUoB1jMJh455w11TDyiF9mqRe1U4J3x17qnvhDzJWWtYkRCJLY0KwwxtnmBiFsgh+g=="
set "ZOHO_HOST=smtp.zeptomail.com"
set "ZOHO_PORT=465"
set "ZOHO_SECURE=true"

set "VITE_SELLER_SECRET=W1IcMo9/5Kw7Mu+kFsXgoep4bcKzfvofElTnvra7PD8="
set "SELLER_SECRET=W1IcMo9/5Kw7Mu+kFsXgoep4bcKzfvofElTnvra7PD8="

echo Starting Vite dev server...
start cmd /k "npx vite --port 5173 --strictPort"
timeout /t 5
echo Starting Electron...
npx electron .
