import { describe, it, expect } from "vitest";
import {
  parsePausedIds,
  psStringArray,
  windowsPauseScript,
  windowsResumeScript,
  macPauseScript,
  macResumeScript,
} from "./media-scripts";

describe("parsePausedIds", () => {
  it("extracts ids from PAUSED lines and ignores everything else", () => {
    const out = "starting\nPAUSED:Spotify.exe\nPAUSED:chrome.exe\nDONE\n";
    expect(parsePausedIds(out)).toEqual(["Spotify.exe", "chrome.exe"]);
  });

  it("returns empty when nothing was paused (the no-op bug-fix case)", () => {
    expect(parsePausedIds("DONE")).toEqual([]);
    expect(parsePausedIds("")).toEqual([]);
  });

  it("handles CRLF line endings and surrounding whitespace", () => {
    expect(parsePausedIds("  PAUSED:Music \r\nnoise\r\n")).toEqual(["Music"]);
  });

  it("ignores a PAUSED line with an empty id", () => {
    expect(parsePausedIds("PAUSED:\nPAUSED:Music")).toEqual(["Music"]);
  });
});

describe("psStringArray", () => {
  it("renders a quoted, comma-separated PowerShell array body", () => {
    expect(psStringArray(["Spotify.exe", "chrome.exe"])).toBe(
      "'Spotify.exe','chrome.exe'",
    );
  });

  it("doubles single quotes to escape them for PowerShell", () => {
    expect(psStringArray(["a'b"])).toBe("'a''b'");
  });

  it("returns an empty body for no ids", () => {
    expect(psStringArray([])).toBe("");
  });
});

describe("windowsPauseScript", () => {
  const script = windowsPauseScript();

  it("pauses only sessions that are Playing and support pause", () => {
    expect(script).toContain("PlaybackStatus -eq");
    expect(script).toContain("Playing");
    expect(script).toContain("IsPauseEnabled");
    expect(script).toContain("TryPauseAsync");
    expect(script).toContain("PAUSED:");
  });

  it("never embeds a literal backtick (template-literal safety)", () => {
    expect(script).not.toContain("`");
    expect(script).toContain("[char]0x60");
  });
});

describe("windowsResumeScript", () => {
  it("embeds the target ids and resumes only matching sessions", () => {
    const script = windowsResumeScript(["Spotify.exe"]);
    expect(script).toContain("$targets=@('Spotify.exe')");
    expect(script).toContain("-contains $sess.SourceAppUserModelId");
    expect(script).toContain("IsPlayEnabled");
    expect(script).toContain("TryPlayAsync");
  });
});

describe("macPauseScript", () => {
  const script = macPauseScript();

  it("guards on running apps and only pauses while playing", () => {
    expect(script).toContain('exists (processes where name is "Spotify")');
    expect(script).toContain('exists (processes where name is "Music")');
    expect(script).toContain("if player state is playing then");
    expect(script).toContain("pause");
    expect(script).toContain('"PAUSED:Spotify"');
    expect(script).toContain('"PAUSED:Music"');
  });
});

describe("macResumeScript", () => {
  it("resumes only the targeted apps", () => {
    const script = macResumeScript(["Spotify"]);
    expect(script).toContain('tell application "Spotify" to play');
    expect(script).not.toContain('tell application "Music" to play');
  });

  it("ignores unknown ids", () => {
    const script = macResumeScript(["chrome.exe"]);
    expect(script).not.toContain("to play");
  });
});
