@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
call "C:\Users\ksonu\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat" sign --ks "C:\Users\ksonu\OneDrive\Documents\New project\savyasachi-temp\debug.keystore" --ks-key-alias savyasachi --ks-pass pass:android --key-pass pass:android --out "C:\Users\ksonu\Downloads\Savyasachi-signed.apk" "C:\Users\ksonu\Downloads\Savyasachi - Google Play package\Savyasachi-aligned.apk"
echo DONE
