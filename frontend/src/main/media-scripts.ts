/**
 * Pure builders for the platform scripts used by media-controls.
 *
 * These functions have no side effects — they take data and return script
 * text or parse command output. Keeping them pure makes the playback-state
 * logic unit-testable without spawning a shell.
 *
 * Tokens: a "media id" identifies one paused source so it can be resumed
 * later. On Windows it is the SMTC `SourceAppUserModelId` (e.g. "Spotify.exe",
 * "chrome.exe"); on macOS it is the application name ("Spotify" or "Music").
 */

/** Apps controllable on macOS via AppleScript, mapped token → app name. */
const MAC_APPS = ["Spotify", "Music"] as const;

/**
 * Extracts the ids of paused sources from script stdout.
 *
 * Both platform pause scripts emit one `PAUSED:<id>` line per source they
 * actually paused. Any other output (status, errors) is ignored.
 */
export function parsePausedIds(stdout: string): string[] {
  const ids: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^PAUSED:(.+)$/.exec(line.trim());
    if (match) {
      const id = match[1]!.trim();
      if (id) ids.push(id);
    }
  }
  return ids;
}

/**
 * Renders ids as a PowerShell single-quoted array body, e.g.
 * `'Spotify.exe','chrome.exe'`. Single quotes inside an id are doubled,
 * which is PowerShell's escape for a literal quote in a single-quoted string.
 */
export function psStringArray(ids: string[]): string {
  return ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
}

// ── Windows: System Media Transport Controls (SMTC) via WinRT ────────────────

/**
 * Shared preamble: loads the WinRT async helper and acquires the session
 * manager into `$mgr`. The backtick in the generic name `IAsyncOperation`1`
 * is built with `[char]0x60` so this text is safe inside a JS template literal.
 */
const WIN_SMTC_HEADER = `$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$ioName='IAsyncOperation'+[char]0x60+'1'
$asTaskGeneric=([System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq $ioName})[0]
function Await($op,$t){$m=$asTaskGeneric.MakeGenericMethod($t);$task=$m.Invoke($null,@($op));$task.Wait(-1)|Out-Null;$task.Result}
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]|Out-Null
$mgr=Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])`;

const WIN_PLAYING = "[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing";

/** Pauses every session that is currently Playing; emits `PAUSED:<appId>`. */
export function windowsPauseScript(): string {
  return `${WIN_SMTC_HEADER}
foreach($sess in $mgr.GetSessions()){
  try{
    $info=$sess.GetPlaybackInfo()
    if($info.PlaybackStatus -eq ${WIN_PLAYING} -and $info.Controls.IsPauseEnabled){
      if((Await ($sess.TryPauseAsync()) ([bool]))){Write-Output ('PAUSED:'+$sess.SourceAppUserModelId)}
    }
  }catch{}
}`;
}

/** Resumes only the sessions whose app id is in `ids`. */
export function windowsResumeScript(ids: string[]): string {
  return `${WIN_SMTC_HEADER}
$targets=@(${psStringArray(ids)})
foreach($sess in $mgr.GetSessions()){
  try{
    if($targets -contains $sess.SourceAppUserModelId){
      $info=$sess.GetPlaybackInfo()
      if($info.Controls.IsPlayEnabled){Await ($sess.TryPlayAsync()) ([bool])|Out-Null}
    }
  }catch{}
}`;
}

// ── macOS: AppleScript control of Spotify and Apple Music ────────────────────

/** Pauses Spotify/Music if running and playing; emits `PAUSED:<app>`. */
export function macPauseScript(): string {
  const blocks = MAC_APPS.map(
    (app) => `if ${app.toLowerCase()}Running then
  tell application "${app}"
    if player state is playing then
      pause
      set output to output & "PAUSED:${app}" & linefeed
    end if
  end tell
end if`,
  ).join("\n");

  return `set output to ""
tell application "System Events"
  set spotifyRunning to (exists (processes where name is "Spotify"))
  set musicRunning to (exists (processes where name is "Music"))
end tell
${blocks}
return output`;
}

/** Resumes only the targeted macOS apps (subset of Spotify/Music). */
export function macResumeScript(ids: string[]): string {
  const targets = MAC_APPS.filter((app) => ids.includes(app));
  const blocks = targets.map(
    (app) => `if ${app.toLowerCase()}Running then tell application "${app}" to play`,
  ).join("\n");

  return `tell application "System Events"
  set spotifyRunning to (exists (processes where name is "Spotify"))
  set musicRunning to (exists (processes where name is "Music"))
end tell
${blocks}`;
}
