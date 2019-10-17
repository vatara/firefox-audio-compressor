Push-Location $PSScriptRoot

New-Item -Path "../publish" -ItemType Directory -Force

# compress-archive makes zips that don't work many places because it uses \ instead of / for folders
#Compress-Archive -Path "../src/*" -DestinationPath "../publish/audio-compressor.zip" -Force
.\7z u ../publish/audio-compressor.zip ../src/*

Pop-Location