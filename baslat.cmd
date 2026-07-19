@echo off
chcp 65001 >nul
title CopyPilot AI - Dev (KAPATMAYIN)
cd /d "%~dp0"

echo.
echo  ============================================
echo   COPYPILOT AI - Bagimsiz Uygulama
echo  ============================================
echo.
echo  Bu pencereyi KAPATMAYIN.
echo  Terminalde [3] Satirinda Onizleme linkini kullanin.
echo.

set NODE_OPTIONS=--dns-result-order=ipv4first
REM graphiql-port vermiyoruz: doluysa CLI kendisi baska port secer
shopify app dev -s size-wizard-test.myshopify.com --theme-app-extension-port 9310

echo.
echo  Sunucu durdu.
pause
