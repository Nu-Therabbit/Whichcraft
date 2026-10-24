; Envarly NSIS installer hooks
; Called by the Tauri-generated installer at specific lifecycle points.

!macro NSIS_HOOK_POSTINSTALL
  ; The console launcher (scripts/build-cli-launcher.mjs puts it beside the main binary).
  ; PATHEXT tries .COM before .EXE, so "whichcraft <command>" in a terminal runs it and the
  ; shell waits, while Explorer and the Start menu run the GUI whichcraft.exe.
  ; The path is relative to target/release/nsis/x64, where the bundler runs makensis.
  SetOutPath "$INSTDIR"
  File "/oname=whichcraft.com" "..\..\whichcraft.com"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Remove Envarly from PATH before files are deleted.
  ; Return code is ignored — a failure leaves a harmless dead PATH entry.
  ExecWait '"$INSTDIR\whichcraft.exe" path-cleanup'
  Delete "$INSTDIR\whichcraft.com"
!macroend
