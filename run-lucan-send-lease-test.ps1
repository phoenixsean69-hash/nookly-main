param(
    [string]$LucanEmail = "",
    [string]$RequestId = "6a6f65fc0001a95c5bc7",
    [string]$PdfPath = "C:\Users\work2\Downloads\form4.pdf"
)

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path (Get-Location) ("lease-test-output-" + $timestamp + ".txt")
$latestLogPath = Join-Path (Get-Location) "lease-test-output.txt"

"NOOKLY LEASE TEST LOG" | Out-File -FilePath $logPath -Encoding utf8
("Started: " + (Get-Date -Format o)) | Out-File -FilePath $logPath -Append -Encoding utf8
"" | Out-File -FilePath $logPath -Append -Encoding utf8

function Write-Log {
    param(
        [Parameter(Mandatory = $false)]
        [AllowEmptyString()]
        [string]$Message = ""
    )

    Write-Host $Message
    $Message | Out-File -FilePath $logPath -Append -Encoding utf8
}

function Read-PasteableValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,

        [string]$DefaultValue = ""
    )

    if ([string]::IsNullOrWhiteSpace($DefaultValue)) {
        $prompt = $Label
    }
    else {
        $prompt = $Label + " [" + $DefaultValue + "]"
    }

    $entered = Read-Host $prompt

    if ([string]::IsNullOrWhiteSpace($entered)) {
        return $DefaultValue
    }

    return $entered.Trim().Trim('"').TrimStart('[').TrimEnd(']')
}

function Read-PasteablePassword {
    Write-Host ""
    Write-Host "Paste Lucan's password, then press Enter." -ForegroundColor Yellow
    Write-Host "The password is not written to the log." -ForegroundColor DarkYellow

    $value = Read-Host "Lucan password"

    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Lucan's password is required."
    }

    return $value
}

$plainPassword = $null
$exitCode = 1

try {
    Write-Log
    Write-Log "Nookly Lucan -> Beef lease test"
    Write-Log "Windows PowerShell compatible runner v5"
    Write-Log
    Write-Log ("Log file: " + $logPath)
    Write-Log

    $nodeScript = ".\scripts\lucan-send-lease-test.mjs"

    if (-not (Test-Path -LiteralPath $nodeScript)) {
        throw "Missing .\scripts\lucan-send-lease-test.mjs. Run this command from the Nookly project root."
    }

    $nodeVersion = (node --version).Trim()

    if ([string]::IsNullOrWhiteSpace($nodeVersion)) {
        throw "Node.js is not available in this terminal."
    }

    $nodeVersionWithoutPrefix = $nodeVersion.TrimStart("v")
    $nodeVersionParts = $nodeVersionWithoutPrefix.Split(".")
    $nodeMajor = [int]$nodeVersionParts[0]

    if ($nodeMajor -lt 20) {
        throw ("Node 20 or newer is required. Current: " + $nodeVersion)
    }

    Write-Log ("Node version: " + $nodeVersion)

    $email = Read-PasteableValue `
        -Label "Lucan email" `
        -DefaultValue $LucanEmail

    if ([string]::IsNullOrWhiteSpace($email)) {
        throw "Lucan's email is required."
    }

    $request = Read-PasteableValue `
        -Label "Request ID" `
        -DefaultValue $RequestId

    if ([string]::IsNullOrWhiteSpace($request)) {
        throw "Request ID is required."
    }

    $pdf = Read-PasteableValue `
        -Label "PDF path" `
        -DefaultValue $PdfPath

    if (-not (Test-Path -LiteralPath $pdf)) {
        throw ("PDF not found: " + $pdf)
    }

    $resolvedPdf = (Resolve-Path -LiteralPath $pdf).Path
    $extension = [System.IO.Path]::GetExtension($resolvedPdf).ToLowerInvariant()

    if ($extension -ne ".pdf") {
        throw "The selected lease document must be a PDF."
    }

    $pdfInfo = Get-Item -LiteralPath $resolvedPdf

    if ($pdfInfo.Length -le 0) {
        throw "The selected PDF is empty."
    }

    if ($pdfInfo.Length -gt 10MB) {
        throw "The selected PDF is larger than 10 MB."
    }

    Write-Log ("Request ID: " + $request)
    Write-Log ("PDF path: " + $resolvedPdf)
    Write-Log ("PDF size: " + $pdfInfo.Length + " bytes")
    Write-Log

    $plainPassword = Read-PasteablePassword

    $env:NOOKLY_LUCAN_EMAIL = $email.Trim()
    $env:NOOKLY_LUCAN_PASSWORD = $plainPassword
    $env:NOOKLY_LEASE_REQUEST_ID = $request.Trim()
    $env:NOOKLY_LEASE_PDF_PATH = $resolvedPdf

    Write-Log
    Write-Log "Starting Node lease simulation..."
    Write-Log

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        & node $nodeScript 2>&1 | ForEach-Object {
            $line = $_.ToString()
            Write-Host $line
            $line | Out-File -FilePath $logPath -Append -Encoding utf8
        }

        $nodeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($nodeExitCode -ne 0) {
        throw ("Node lease simulation exited with code " + $nodeExitCode + ".")
    }

    Write-Log
    Write-Log "Lease test completed successfully."
    $exitCode = 0
}
catch {
    $message = $_.Exception.Message

    Write-Host ""
    Write-Host "LEASE TEST FAILED" -ForegroundColor Red
    Write-Host "-----------------" -ForegroundColor Red
    Write-Host $message -ForegroundColor Red

    "" | Out-File -FilePath $logPath -Append -Encoding utf8
    "LEASE TEST FAILED" | Out-File -FilePath $logPath -Append -Encoding utf8
    "-----------------" | Out-File -FilePath $logPath -Append -Encoding utf8
    $message | Out-File -FilePath $logPath -Append -Encoding utf8

    $exitCode = 1
}
finally {
    Remove-Item Env:NOOKLY_LUCAN_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:NOOKLY_LUCAN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:NOOKLY_LEASE_REQUEST_ID -ErrorAction SilentlyContinue
    Remove-Item Env:NOOKLY_LEASE_PDF_PATH -ErrorAction SilentlyContinue

    $plainPassword = $null

    try {
        Copy-Item -LiteralPath $logPath -Destination $latestLogPath -Force
    }
    catch {
        Write-Host "Could not copy the timestamped log to lease-test-output.txt." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Full output saved to:" -ForegroundColor Cyan
    Write-Host $logPath -ForegroundColor Cyan
    Write-Host ""
}

exit $exitCode
