$envPath = "c:\Users\divk2\Desktop\opsmind-ai\server\.env"
$content = Get-Content $envPath -Raw

# Remove all OPENAI_API_KEY lines and add new one
$lines = $content -split "`n" | Where-Object { $_ -notmatch "OPENAI_API_KEY=" }
$newContent = $lines -join "`n"
$newContent = $newContent.TrimEnd()

$openaiKey = "OPENAI_API_KEY=your-openai-key-here"

if ($newContent -notmatch "OPENAI_API_KEY=") {
    $newContent = $newContent + "`n" + $openaiKey
}

Set-Content -Path $envPath -Value $newContent -NoNewline
Write-Host "Done"
