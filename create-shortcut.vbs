' Create BondLink Shortcut on Desktop (PowerShell version)
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

Dim scriptPath
scriptPath = FSO.GetParentFolderName(WScript.ScriptFullName)

Dim psPath
psPath = scriptPath & "\START-BONDLINK.ps1"

Dim desktopPath
desktopPath = WshShell.SpecialFolders("Desktop")

' Delete old shortcut if exists
Dim oldShortcut
oldShortcut = desktopPath & "\BondLink.lnk"
If FSO.FileExists(oldShortcut) Then
    FSO.DeleteFile oldShortcut
End If

Dim shortcutPath
shortcutPath = desktopPath & "\BondLink.lnk"

Set shortcut = WshShell.CreateShortcut(shortcutPath)
shortcut.TargetPath = "powershell.exe"
shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File """ & psPath & """"
shortcut.WorkingDirectory = scriptPath
shortcut.WindowStyle = 1
shortcut.IconLocation = "powershell.exe,0"
shortcut.Description = "BondLink v1.0 - Multi-WAN Speed Bonding"
shortcut.Save

WScript.Echo "Shortcut updated: " & shortcutPath
WScript.Echo "Double-click the BondLink icon on your Desktop to start."
