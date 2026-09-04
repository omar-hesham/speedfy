' Create BondLink Shortcut on Desktop
' Run this once to create the shortcut
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

Dim scriptPath
scriptPath = FSO.GetParentFolderName(WScript.ScriptFullName)

Dim vbsPath
vbsPath = scriptPath & "\START-BONDLINK.vbs"

Dim desktopPath
desktopPath = WshShell.SpecialFolders("Desktop")

Dim shortcutPath
shortcutPath = desktopPath & "\BondLink.lnk"

Set shortcut = WshShell.CreateShortcut(shortcutPath)
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & vbsPath & """"
shortcut.WorkingDirectory = scriptPath
shortcut.WindowStyle = 7 ' Minimized
shortcut.IconLocation = "shell32.dll,13"
shortcut.Description = "BondLink v1.0 - Multi-WAN Speed Bonding"
shortcut.Save

WScript.Echo "Shortcut created: " & shortcutPath
WScript.Echo "Double-click the BondLink icon on your Desktop to start."
