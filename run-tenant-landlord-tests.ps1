$ErrorActionPreference = "Stop"

$defaultEmail = "beefspook22@gmail.com"
$defaultPropertyId = "69c50097001babcc3e7c"

Write-Host ""
Write-Host "Nookly tenant -> landlord notification tests" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tenant: Beef Spook"
Write-Host "Property: Yellow House"
Write-Host "Landlord: Lucan Muchayi"
Write-Host ""

if (-not (Test-Path ".\scripts\tenant-landlord-notification-test.mjs")) {
    throw "Run this command from the Nookly project root."
}

$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])

if ($nodeMajor -lt 20) {
    throw "Node 20 or newer is required. Current: $(node --version)"
}

$emailInput = Read-Host "Beef email [$defaultEmail]"

$email = if ([string]::IsNullOrWhiteSpace($emailInput)) {
    $defaultEmail
}
else {
    $emailInput.Trim()
}

$propertyInput = Read-Host "Property ID [$defaultPropertyId]"

$propertyId = if ([string]::IsNullOrWhiteSpace($propertyInput)) {
    $defaultPropertyId
}
else {
    $propertyInput.Trim()
}

$securePassword = Read-Host "Beef Spook password" -AsSecureString

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
    $securePassword
)

try {
    $plainPassword =
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    $env:NOOKIE_TEST_EMAIL = $email
    $env:NOOKIE_TEST_PASSWORD = $plainPassword
    $env:NOOKIE_TEST_PROPERTY_ID = $propertyId

    node .\scripts\tenant-landlord-notification-test.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "The tenant -> landlord notification test failed."
    }
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    Remove-Item Env:NOOKIE_TEST_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:NOOKIE_TEST_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:NOOKIE_TEST_PROPERTY_ID -ErrorAction SilentlyContinue

    $plainPassword = $null
    $securePassword = $null
}
