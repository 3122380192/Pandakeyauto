Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronPath = currentDir & "\node_modules\electron\dist\electron.exe"

If fso.FileExists(electronPath) Then
    WshShell.Run """" & electronPath & """ """ & currentDir & """", 1, False
Else
    ' Kiểm tra xem có node hay không
    On Error Resume Next
    WshShell.Run "node -v", 0, True
    If Err.Number = 0 Then
        WshShell.Run "npm start", 0, False
    Else
        WshShell.Run "bin\scrcpy.exe -K -M --no-video-playback --stay-awake", 0, False
    End If
End If
