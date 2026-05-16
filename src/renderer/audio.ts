let stream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let ws: WebSocket | null = null;
let levelTimer: ReturnType<typeof setInterval> | null = null;
let sampleCount = 0;
let startTime = 0;
let apiKey: string | null = null;

window.audio.onApiKey((key: string) => {
  apiKey = key;
});

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

function sendFinalLevels(): void {
  const { rms, peak } = computeLevels();
  const rmsDb = toDb(rms);
  const peakDb = toDb(peak);
  const duration = (Date.now() - startTime) / 1000;

  window.audio.sendLevels({ rms: rmsDb, peak: peakDb, elapsed: duration, samples: sampleCount, final: true });
}

function cleanup(): void {
  stopLevelUpdates();

  if (ws) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CloseStream" }));
      }
      ws.close();
    } catch {
      // ignore
    }
    ws = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  analyser = null;

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

async function startRecording(): Promise<void> {
  if (!apiKey) {
    window.audio.sendTranscript("");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch {
    window.audio.sendTranscript("");
    return;
  }

  try {
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const processor = audioContext.createScriptProcessor(2048, 1, 1);
    source.connect(processor);
    processor.connect(audioContext.destination);

    startLevelUpdates();

    ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?token=${encodeURIComponent(apiKey)}`,
    );

    ws.onopen = () => {
      ws!.send(JSON.stringify({
        type: "Configure",
        features: {
          model: "nova-2",
          smart_format: true,
          punctuate: true,
          interim_results: false,
          utterances: true,
          encoding: "linear16",
          sample_rate: 16000,
          channels: 1,
        },
      }));
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === "Results") {
          const transcript: string | undefined =
            data.channel?.alternatives?.[0]?.transcript;
          if (transcript && data.is_final) {
            window.audio.sendTranscript(transcript.trim());
          }
        }
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onerror = () => {
      window.audio.sendTranscript("");
      cleanup();
    };

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i] ?? 0));
          pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        ws.send(pcm.buffer);
      }
    };
  } catch {
    window.audio.sendTranscript("");
    cleanup();
  }
}

function stopRecording(): void {
  sendFinalLevels();
  cleanup();
}

window.audio.onStart(() => {
  startRecording();
});

window.audio.onStop(() => {
  stopRecording();
});
