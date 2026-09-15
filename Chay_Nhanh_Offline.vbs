Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Kiểm tra xem có node hay không
On Error Resume Next
WshShell.Run "node -v", 0, True
If Err.Number = 0 Then
    ' Nếu có node.js -> mở giao diện Electron đầy đủ
    WshShell.Run "npm start", 0, False
Else
    ' Nếu là máy đích chưa có node.js -> chạy trực tiếp core scrcpy điều khiển chuột phím không video
    WshShell.Run "bin\scrcpy.exe -K -M --no-video-playback --stay-awake", 0, False
End If
