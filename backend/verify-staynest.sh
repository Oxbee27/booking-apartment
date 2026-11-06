#!/usr/bin/env bash

echo "========== 1. PROJECT CONFIGURATION =========="
cat package.json

echo
echo "========== 2. SERVER IMPORTS =========="
sed -n '1,45p' src/server.js

echo
echo "========== 3. EMAIL SERVICE =========="
if [ -f src/services/email.service.js ]; then
  cat src/services/email.service.js
else
  echo "EMAIL SERVICE NOT CREATED"
fi

echo
echo "========== 4. ENVIRONMENT VARIABLES =========="
if [ -f .env ]; then
  grep -nE '^(RESEND_API_KEY|EMAIL_FROM|CLIENT_URL|API_URL)=' .env | sed 's/=.*/=[CONFIGURED - VALUE HIDDEN]/'
else
  echo ".env NOT FOUND"
fi

echo
echo "========== 5. DATABASE TABLE DEFINITIONS =========="
grep -RniE 'CREATE TABLE.*(users|bookings)' src

echo
echo "========== 6. BOOKING DATABASE QUERIES =========="
grep -nE 'INSERT INTO bookings|UPDATE bookings|SELECT .*bookings|FROM bookings|JOIN users' src/server.js

echo
echo "========== 7. PAYMENT VERIFICATION =========="
sed -n '330,375p' src/server.js

echo
echo "========== 8. PAYMENT CALLBACK =========="
sed -n '510,558p' src/server.js

echo
echo "========== 9. RESEND PACKAGE =========="
npm ls resend --depth=0

echo
echo "========== 10. BACKEND HEALTH =========="
curl -sS http://localhost:5000/api/health

echo
echo "========== VERIFICATION COMPLETE =========="
