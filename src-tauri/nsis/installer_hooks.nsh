; Whichcraft NSIS installer hooks
; Called by the Tauri-generated installer at specific lifecycle points.

!macro NSIS_HOOK_POSTINSTALL
  ; The console launcher (scripts/build-cli-launcher.mjs puts it in target/release/bin).
  ; Only bin goes on PATH, so "whichcraft <command>" in a terminal runs it and the shell waits,
  ; while Explorer and the Start menu run the GUI whichcraft.exe above it.
  ; The path is relative to target/release/nsis/x64, where the bundler runs makensis.
  SetOutPath "$INSTDIR\bin"
  File "/oname=whichcraft.exe" "..\..\bin\whichcraft.exe"
  SetOutPath "$INSTDIR"
  ; The bundler also installs every cargo binary here. bin\whichcraft.exe replaces this one.
  Delete "$INSTDIR\whichcraft-cli.exe"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Remove Whichcraft from PATH before files are deleted.
  ; Return code is ignored — a failure leaves a harmless dead PATH entry.
  ExecWait '"$INSTDIR\whichcraft.exe" path-cleanup'
  Delete "$INSTDIR\bin\whichcraft.exe"
  RMDir "$INSTDIR\bin"
!macroend
