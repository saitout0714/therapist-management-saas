$file = 'app\(admin)\sync\page.tsx'
$lines = Get-Content $file

# Lines 370 to 409 are the new card
$newCard = $lines[369..408]

# Remove the new card from its current position
$lines = $lines[0..368] + $lines[409..($lines.Length - 1)]

# Find where to insert it (after the first card closes, before {/* アカウント設定カード */})
$insertIdx = $lines.IndexOf('          {/* アカウント設定カード */}')

# Insert it
$lines = $lines[0..($insertIdx - 1)] + $newCard + $lines[$insertIdx..($lines.Length - 1)]

Set-Content -Path $file -Value $lines
