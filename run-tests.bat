@echo off
REM Atajo para correr las pruebas del backend por nivel.
REM Uso: run-tests.bat [unit ^| integration ^| cov ^| e2e ^| all]
setlocal
set NIVEL=%1
if "%NIVEL%"=="" set NIVEL=all
cd /d "%~dp0backend"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
if /I "%NIVEL%"=="unit"        call npm run test:unit & goto fin
if /I "%NIVEL%"=="integration" call npm run test:integration & goto fin
if /I "%NIVEL%"=="cov"         call npm run test:cov & goto abrir
if /I "%NIVEL%"=="all"         call npm test & goto fin
if /I "%NIVEL%"=="e2e"         goto e2e
echo Nivel desconocido: %NIVEL%. Usa unit, integration, cov, e2e o all.
exit /b 1
:e2e
cd /d "%~dp0frontend"
if not exist node_modules call npm install
call npx playwright install chromium
call npm run test:e2e
goto fin
:abrir
if exist coverage\index.html start "" coverage\index.html
:fin
endlocal
