<#
.SYNOPSIS
  Claude Code task notification toast for Windows (Diana mascot).
.DESCRIPTION
  Called from Claude Code hooks (Stop = done / Notification = decision).
  Uses native WinRT toast - no extra module required.

  NOTE: This script is intentionally ASCII-only. All Korean strings live in
  notify-strings.json and are read as UTF-8, because Windows PowerShell 5.1
  decodes .ps1 files as ANSI and would corrupt inline non-ASCII literals.
.EXAMPLE
  powershell -File scripts/notify-toast.ps1 -Kind done
  powershell -File scripts/notify-toast.ps1 -Kind decision -Message "..."
#>
param(
  [ValidateSet('done', 'decision')]
  [string]$Kind = 'done',
  [string]$Title = '',
  [string]$Message = '',
  [string]$Image = "$PSScriptRoot/assets/diana.png"
)

$ErrorActionPreference = 'Stop'

function XmlEsc([string]$s) {
  return $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
}

# Load Korean strings from UTF-8 JSON (avoids PS 5.1 ANSI .ps1 corruption)
$strPath = Join-Path $PSScriptRoot 'notify-strings.json'
$raw = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($strPath))
$raw = $raw.TrimStart([char]0xFEFF)  # strip BOM if present
$S = $raw | ConvertFrom-Json

if (-not $Title) { $Title = $S.$Kind.title }
if (-not $Message) { $Message = $S.$Kind.message }

[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null

$imgXml = ''
if ($Image -and (Test-Path $Image)) {
  $full = (Resolve-Path $Image).Path
  $imgXml = "<image placement='appLogoOverride' hint-crop='circle' src='$(XmlEsc $full)'/>"
}

$xml = @"
<toast scenario='reminder'>
  <visual>
    <binding template='ToastGeneric'>
      <text>$(XmlEsc $Title)</text>
      <text>$(XmlEsc $Message)</text>
      $imgXml
    </binding>
  </visual>
  <audio src='ms-winsoundevent:Notification.Default'/>
</toast>
"@

$doc = New-Object Windows.Data.Xml.Dom.XmlDocument
$doc.LoadXml($xml)
$toast = New-Object Windows.UI.Notifications.ToastNotification($doc)

# Register a dedicated AppID in HKCU once (no admin / no internet) so the toast
# is attributed to "Diana". DisplayName comes from the UTF-8 JSON -> correct Korean.
$appId = 'MakeCC.Diana'
$regPath = "HKCU:\Software\Classes\AppUserModelId\$appId"
New-Item -Path $regPath -Force | Out-Null
New-ItemProperty -Path $regPath -Name 'DisplayName' -Value $S.displayName -PropertyType String -Force | Out-Null
if ($Image -and (Test-Path $Image)) {
  New-ItemProperty -Path $regPath -Name 'IconUri' -Value (Resolve-Path $Image).Path -PropertyType String -Force | Out-Null
}

[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
