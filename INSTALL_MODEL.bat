@echo off
setlocal
cd /d "%~dp0"
if not exist assets\models mkdir assets\models
set "SRC=%~dp0iron-warlord.glb"
if not exist "%SRC%" set "SRC=%USERPROFILE%\Downloads\iron-warlord.glb"
if not exist "%SRC%" (
  echo Could not find iron-warlord.glb next to this BAT or in Downloads.
  echo Download the attached model and place it beside this BAT, then run again.
  pause
  exit /b 1
)
copy /Y "%SRC%" "assets\models\iron-warlord.glb"
if errorlevel 1 ( echo Copy failed. & pause & exit /b 1 )
echo Model installed: assets\models\iron-warlord.glb
pause
