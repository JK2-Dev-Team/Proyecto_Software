@echo off
REM Atajo para correr las pruebas del backend por nivel.
REM Uso: run-tests.bat [unit ^| integration ^| cov ^| all]
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
echo Nivel desconocido: %NIVEL%. Usa unit, integration, cov o all.
exit /b 1
:abrir
if exist coverage\index.html start "" coverage\index.html
:fin
endlocal
