' BondLink v1.0 - One-Click Launcher
' Double-click to start everything
Option Explicit

Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "wscript.exe", """" & WScript.ScriptFullName & """ //E:VBS", "", "runas", 1
WScript.Quit

' After elevation, this part runs as Admin
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

Dim scriptPath
scriptPath = FSO.GetParentFolderName(WScript.ScriptFullName)

Dim bondlinkDir
bondlinkDir = FSO.GetParentFolderName(FSO.GetParentFolderName(scriptPath))

WScript.Echo "BondLink v1.0 Launcher"
WScript.Echo "====================="
WScript.Echo ""

' Step 1: Start BondLink Client
WScript.Echo "[1/4] Starting BondLink Client (requires Admin)..."
Dim clientExe
clientExe = bondlinkDir & "\native\target\release\bondlink-client.exe"

If Not FSO.FileExists(clientExe) Then
    WScript.Echo "ERROR: bondlink-client.exe not found!"
    WScript.Echo "Run: cd native && cargo build --release"
    WScript.Sleep 5000
    WScript.Quit 1
End If

Dim wintunDll
wintunDll = bondlinkDir & "\native\target\release\wintun.dll"
If Not FSO.FileExists(wintunDll) Then
    WScript.Echo "WARNING: wintun.dll not found, copying from crate..."
    Dim srcDll
    srcDll = bondlinkDir & "\native\crates\bondlink-wintun\lib\amd64\wintun.dll"
    If FSO.FileExists(srcDll) Then
        FSO.CopyFile srcDll, wintunDll
    End If
End If

' Start client in minimized window
WshShell.Run """" & clientExe & """", 2, False
WScript.Sleep 3000

' Step 2: Check if client is running
Dim clientRunning
clientRunning = False
Dim tries
tries = 0
Do While tries < 10 And Not clientRunning
    Dim http
    Set http = CreateObject("MSXML2.XMLHTTP")
    On Error Resume Next
    http.Open "GET", "http://127.0.0.1:8080/api/status", False
    http.setRequestHeader "Content-Type", "application/json"
    http.send
    If Err.Number = 0 Then
        clientRunning = True
    Else
        Err.Clear
        WScript.Sleep 1000
        tries = tries + 1
    End If
    On Error GoTo 0
Loop

If Not clientRunning Then
    WScript.Echo "WARNING: Client not responding on port 8080"
    WScript.Echo "Check that bondlink-client.exe started successfully"
Else
    WScript.Echo "[2/4] BondLink Client is running (http://127.0.0.1:8080)"
End If

' Step 3: Start Dashboard server
WScript.Echo "[3/4] Starting Dashboard Server..."
Dim packageJson
packageJson = bondlinkDir & "\package.json"
If Not FSO.FileExists(packageJson) Then
    WScript.Echo "ERROR: package.json not found at " & bondlinkDir
    WScript.Sleep 5000
    WScript.Quit 1
End If

' Check if node_modules exists
Dim nodeModules
nodeModules = bondlinkDir & "\node_modules"
If Not FSO.FolderExists(nodeModules) Then
    WScript.Echo "Installing npm dependencies (first run may take a few minutes)..."
    WshShell.Run "cmd /c cd /d """ & bondlinkDir & """ && npm install", 1, True
    WScript.Echo "npm install complete"
End If

' Check if dist exists, build if not
Dim distDir
distDir = bondlinkDir & "\dist"
If Not FSO.FolderExists(distDir) Then
    WScript.Echo "Building React app (first run may take a minute)..."
    WshShell.Run "cmd /c cd /d """ & bondlinkDir & """ && npm run build", 1, True
    WScript.Echo "Build complete"
End If

' Start server in background (not minimized so you can see logs)
WshShell.Run "cmd /c cd /d """ & bondlinkDir & """ && npm start", 2, False
WScript.Sleep 4000

' Step 4: Open browser
WScript.Echo "[4/4] Opening Dashboard in browser..."
WshShell.Run "http://localhost:3000"

WScript.Echo ""
WScript.Echo "========================================="
WScript.Echo "BondLink is now running!"
WScript.Echo "  Dashboard:   http://localhost:3000"
WScript.Echo "  Client API:  http://127.0.0.1:8080"
WScript.Echo "  VPS Relay:   84.8.105.228:8443"
WScript.Echo ""
WScript.Echo "Click the START button to activate bonding"
WScript.Echo "========================================="
