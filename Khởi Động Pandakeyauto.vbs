Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronPath = currentDir & "\node_modules\electron\dist\electron.exe"

WshShell.CurrentDirectory = currentDir
' Chay Electron truc tiep khong qua CMD (Style 1 = Hien thi cua so giao dien binh thuong, khong cua so đen)
If fso.FileExists(electronPath) Then
    WshShell.Run """" & electronPath & """ """ & currentDir & """", 1, False
Else
    WshShell.Run "npm start", 0, False
End If
