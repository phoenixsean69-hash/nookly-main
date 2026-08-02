$ErrorActionPreference = "Stop"

$servicePath = Join-Path $PWD "services\push-function.service.ts"
$rootLayoutPath = Join-Path $PWD "app\_layout.tsx"

function Assert-FileExists {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path`nRun this script from the Nookly project root."
    }
}

function Normalize-Newlines {
    param([string]$Text)
    return $Text.Replace("`r`n", "`n")
}

function Replace-ExactBlock {
    param(
        [string]$Text,
        [string]$OldBlock,
        [string]$NewBlock,
        [string]$Label
    )

    if (-not $Text.Contains($OldBlock)) {
        throw "Could not locate expected block: $Label`nNo changes were written."
    }

    return $Text.Replace($OldBlock, $NewBlock)
}

Assert-FileExists -Path $servicePath
Assert-FileExists -Path $rootLayoutPath

$serviceOriginalRaw = Get-Content -LiteralPath $servicePath -Raw
$rootOriginalRaw = Get-Content -LiteralPath $rootLayoutPath -Raw

$serviceOriginal = Normalize-Newlines $serviceOriginalRaw
$rootOriginal = Normalize-Newlines $rootOriginalRaw

$serviceUpdated = $serviceOriginal
$rootUpdated = $rootOriginal

# ---------------------------------------------------------------------------
# services/push-function.service.ts
# ---------------------------------------------------------------------------

$serviceUpdated = Replace-ExactBlock `
    -Text $serviceUpdated `
    -OldBlock @'
export interface RegisterDeviceResult {
  created: boolean;
  tokenRowId: string;
  isActive: boolean;
  duplicatesDeactivated?: number;
}

export interface DeactivateDeviceResult {
'@ `
    -NewBlock @'
export interface RegisterDeviceResult {
  created: boolean;
  tokenRowId: string;
  isActive: boolean;
  duplicatesDeactivated?: number;
}

export interface QueuedPushExecutionResult {
  queued: true;
  executionId: string;
  status: string;
  route: string;
}

export interface DeactivateDeviceResult {
'@ `
    -Label "Queued registration result interface"

$serviceUpdated = Replace-ExactBlock `
    -Text $serviceUpdated `
    -OldBlock @'
  async registerDevice(
    token: string,
    deviceType: string,
  ): Promise<RegisterDeviceResult> {
    return executePushRoute<RegisterDeviceResult>("/register-device", {
      token,
      deviceType,
    });
  }
'@ `
    -NewBlock @'
  async registerDevice(
    token: string,
    deviceType: string,
  ): Promise<QueuedPushExecutionResult> {
    const route = "/register-device";

    const execution = await getFunctions().createExecution({
      functionId: requireFunctionId(),
      body: JSON.stringify({
        token,
        deviceType,
      }),
      async: true,
      xpath: route,
      method: ExecutionMethod.POST,
      headers: {
        "content-type": "application/json",
      },
    });

    return {
      queued: true,
      executionId: execution.$id,
      status: String(execution.status ?? "waiting"),
      route,
    };
  }
'@ `
    -Label "Asynchronous registerDevice execution"

# ---------------------------------------------------------------------------
# app/_layout.tsx
# ---------------------------------------------------------------------------

$rootUpdated = Replace-ExactBlock `
    -Text $rootUpdated `
    -OldBlock @'
        const result = await pushFunctionService.registerDevice(
          token,
          Platform.OS,
        );

        if (cancelled) return;

        await AsyncStorage.setItem(EXPO_PUSH_TOKEN_STORAGE_KEY, token);

        console.log(
          result.created
            ? "✅ Push device registered through Nookly Push API"
            : "✅ Push device reactivated through Nookly Push API",
        );
'@ `
    -NewBlock @'
        const result = await pushFunctionService.registerDevice(
          token,
          Platform.OS,
        );

        if (cancelled) return;

        await AsyncStorage.setItem(EXPO_PUSH_TOKEN_STORAGE_KEY, token);

        console.log(
          `✅ Push device registration queued through Nookly Push API (${result.executionId}, ${result.status})`,
        );
'@ `
    -Label "Root push registration logging"

# ---------------------------------------------------------------------------
# VALIDATE BEFORE WRITING
# ---------------------------------------------------------------------------

if ($serviceUpdated -eq $serviceOriginal) {
    throw "Push function service was not changed."
}

if ($rootUpdated -eq $rootOriginal) {
    throw "Root layout was not changed."
}

if (-not $serviceUpdated.Contains('async: true')) {
    throw "Validation failed: registration is not asynchronous."
}

if ($serviceUpdated.Contains('return executePushRoute<RegisterDeviceResult>("/register-device"')) {
    throw "Validation failed: synchronous registration call still exists."
}

if (-not $serviceUpdated.Contains('executionId: execution.$id')) {
    throw "Validation failed: queued execution ID is not returned."
}

if ($rootUpdated.Contains("result.created")) {
    throw "Validation failed: root layout still expects a synchronous result."
}

if (-not $rootUpdated.Contains("Push device registration queued through Nookly Push API")) {
    throw "Validation failed: queued-registration log is missing."
}

# Back up only after all replacements and validations succeed.
Copy-Item -LiteralPath $servicePath -Destination "$servicePath.async-register.bak" -Force
Copy-Item -LiteralPath $rootLayoutPath -Destination "$rootLayoutPath.async-register.bak" -Force

Set-Content -LiteralPath $servicePath -Value $serviceUpdated -Encoding utf8
Set-Content -LiteralPath $rootLayoutPath -Value $rootUpdated -Encoding utf8

Write-Host ""
Write-Host "Push registration async fix applied successfully." -ForegroundColor Green
Write-Host "Updated:"
Write-Host "- services/push-function.service.ts"
Write-Host "- app/_layout.tsx"
Write-Host ""
Write-Host "Backups:"
Write-Host "- push-function.service.ts.async-register.bak"
Write-Host "- _layout.tsx.async-register.bak"
Write-Host ""
Write-Host "Now run: npx tsc --noEmit"
