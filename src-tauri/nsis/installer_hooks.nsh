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

!macro NSIS_HOOK_POSTUNINSTALL
  ; "Delete the application data" only knows the WebView folder, so remove Whichcraft's own
  ; records here too. installs and mise stay: they hold tools that PATH or a project may still use.
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    SetShellVarContext current
    RMDir /r "$LOCALAPPDATA\${PRODUCTNAME}\journal"
    RMDir /r "$LOCALAPPDATA\${PRODUCTNAME}\snapshots"
    Delete "$LOCALAPPDATA\${PRODUCTNAME}\selection.json"
    Delete "$LOCALAPPDATA\${PRODUCTNAME}\settings.json"
    Delete "$LOCALAPPDATA\${PRODUCTNAME}\profiles.json"
    Delete "$LOCALAPPDATA\${PRODUCTNAME}\elevation-*.json"
    RMDir "$LOCALAPPDATA\${PRODUCTNAME}"
  ${EndIf}
!macroend
