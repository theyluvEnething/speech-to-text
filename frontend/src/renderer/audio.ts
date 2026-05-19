let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let levelTimer: ReturnType<typeof setInterval> | null = null;
let sampleCount = 0;
let startTime = 0;
let stopTimeout: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

const POST_RELEASE_MS = 310;

function computeLevels(): { rms: number; peak: number } {
  if (!analyser) return { rms: 0, peak: 0 };

  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);

  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < data.length; i++) {
    const normalized = ((data[i] ?? 0) - 128) / 128;
    sumSquares += normalized * normalized;
    const abs = Math.abs(normalized);
    if (abs > peak) peak = abs;
  }

  const rms = Math.sqrt(sumSquares / data.length);
  return { rms, peak };
}

function toDb(value: number): number {
  if (value <= 0) return -60;
  const db = 20 * Math.log10(value);
  return Math.max(db, -60);
}

function startLevelUpdates(): void {
  startTime = Date.now();
  sampleCount = 0;

  levelTimer = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    sampleCount += 16000 / 10;
    const { rms, peak } = computeLevels();
    const rmsDb = toDb(rms);
    const peakDb = toDb(peak);

    window.audio.sendLevels({ rms: rmsDb, peak: peakDb, elapsed, samples: sampleCount });
  }, 100);
}

function stopLevelUpdates(): void {
  if (levelTimer) {
    clearInterval(levelTimer);
    levelTimer = null;
  }
}

async function startRecording(): Promise<void> {
  generation++;
  const currentGen = generation;

  // Cancel any pending delayed stop from a previous recording
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }

  // Detach and stop any previous MediaRecorder
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.ondataavailable = null;
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  stopLevelUpdates();
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    analyser = null;
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  chunks = [];

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (currentGen !== generation) return; // Stale — a newer recording replaced this one
      stopLevelUpdates();

      const { rms, peak } = computeLevels();
      const rmsDb = toDb(rms);
      const peakDb = toDb(peak);
      const duration = (Date.now() - startTime) / 1000;

      window.audio.sendLevels({ rms: rmsDb, peak: peakDb, elapsed: duration, samples: sampleCount, final: true });

      const blob = new Blob(chunks, { type: mimeType });
      const buffer = await blob.arrayBuffer();
      window.audio.sendBuffer(buffer);

      if (audioContext) {
        await audioContext.close();
        audioContext = null;
        analyser = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
    };

    mediaRecorder.start(250);
    startLevelUpdates();
  } catch (err) {
    console.error("Failed to start recording:", err);
    stopLevelUpdates();
    window.audio.sendBuffer(new ArrayBuffer(0));
  }
}

function stopRecording(): void {
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }

  if (!mediaRecorder || mediaRecorder.state === "inactive") return;

  // Keep recording for POST_RELEASE_MS to capture trailing speech
  stopTimeout = setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      mediaRecorder = null;
    }
    stopTimeout = null;
  }, POST_RELEASE_MS);
}

window.audio.onStart(() => {
  startRecording();
});

window.audio.onStop(() => {
  stopRecording();
});
