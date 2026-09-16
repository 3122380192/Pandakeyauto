Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronPath = currentDir & "\node_modules\electron\dist\electron.exe"

WshShell.CurrentDirectory = currentDir
WshShell.Run """" & electronPath & """ """ & currentDir & """", 0, False
