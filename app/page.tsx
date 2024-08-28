"use client";

import { useState, useRef, useEffect, useCallback } from 'react'
import React from 'react'

enum GuitarString {
  E = 0,
  A = 1,
  D = 2,
  G = 3,
  B = 4,
  e = 5
}

interface StringSelectorProps {
  selectedString: GuitarString;
  setSelectedString: (gs: GuitarString) => void;
}

const StringSelector: React.FC<StringSelectorProps> = React.memo(({ selectedString, setSelectedString }) => {
  const classNames = "bg-muted rounded-full w-12 h-12 flex items-center justify-center text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer";

  interface StringSelectorButtonProps {
    gs: GuitarString;
  }

  const StringSelectorButton: React.FC<StringSelectorButtonProps> = React.memo(({ gs }) => {
    const isSelected = selectedString === gs;
    return (
      <label className={isSelected ? (classNames + " bg-accent") : classNames}>
        <input
          type="radio"
          name="selectedString"
          value={GuitarString[gs]}
          className="peer sr-only"
          checked={isSelected}
          onChange={() => setSelectedString(gs)}
        />
        {GuitarString[gs]}
      </label>
    );
  });

  return (
    <div className="grid grid-cols-6 gap-2">
      <StringSelectorButton gs={GuitarString.E} />
      <StringSelectorButton gs={GuitarString.A} />
      <StringSelectorButton gs={GuitarString.D} />
      <StringSelectorButton gs={GuitarString.G} />
      <StringSelectorButton gs={GuitarString.B} />
      <StringSelectorButton gs={GuitarString.e} />
    </div>
  );
});

export default function Main() {
  const fftSize = 16384;

  const canvas = useRef<HTMLCanvasElement>(null);

  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [selectedString, setSelectedString] = useState<GuitarString>(GuitarString.E);
  const [analyser, setAnalyser] = useState<AnalyserNode>();
  const [dataArray, setDataArray] = useState<Uint8Array>();
  const [sampleRate, setSampleRate] = useState<number>(0);
  const [currentFreq, setCurrentFreq] = useState<number>(0);
  const currentFreqRef = useRef<number>(0);
  const [closestFreq, setClosestFreq] = useState<number>(0);
  const closestFreqRef = useRef<number>(0);

  const drawBarChart = useCallback(() => {
    if (analyser == null || !dataArray || !audioStream) return;

    const currentCanvas = canvas.current as HTMLCanvasElement;
    if (!currentCanvas) return;
    const ctx = currentCanvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return;

    analyser.getByteFrequencyData(dataArray);

    // Use memoized values
    const { width, height } = currentCanvas;
    ctx.clearRect(0, 0, width, height);

    // Use a ref to get the latest selectedString value
    const hzForSelectedString = getHzForString(selectedStringRef.current);
    const minFreqInterested = hzForSelectedString * 0.5;
    const maxFreqInterested = hzForSelectedString * 1.5;
    const minIndex = Math.floor(analyser.frequencyBinCount * minFreqInterested / sampleRate);
    const maxIndex = Math.floor(analyser.frequencyBinCount * maxFreqInterested / sampleRate);

    const barWidth = (currentCanvas.clientWidth / maxIndex) * 2.5;
    let x = 0;


    let maxBarHeight = 0;
    let maxFreqIndex = 0;
    for (let i = minIndex; i < maxIndex; i++) {
      const barHeight = dataArray[i];

      if (barHeight > maxBarHeight) {
        maxBarHeight = barHeight;
        maxFreqIndex = i;
      }

      //ctx.fillStyle = 'rgb(' + (barHeight + 100) + ', 50 ,50)';
      //ctx.fillRect(x, currentCanvas.height - barHeight / 2, barWidth, barHeight / 2);

      const hue = (i / dataArray.length) * 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(x, currentCanvas.height - barHeight / 2, barWidth, barHeight);

      x += barWidth;
    }

    const meanValue = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

    if (meanValue > 2) {
      const smoothingTimeConstant = 0.9;
      const peakFrequency = (maxFreqIndex + minIndex) * sampleRate / fftSize;
      const smoothedFreq = currentFreqRef.current * smoothingTimeConstant
        + peakFrequency * (1 - smoothingTimeConstant);
      
      currentFreqRef.current = smoothedFreq;
      setCurrentFreq(smoothedFreq);
      if (Math.abs(smoothedFreq - hzForSelectedString) < Math.abs(closestFreqRef.current - hzForSelectedString)) {
        closestFreqRef.current = smoothedFreq;
        setClosestFreq(closestFreqRef.current);
      }
    } else {
      currentFreqRef.current = 0;
      closestFreqRef.current = 0;
      setCurrentFreq(0);
      setClosestFreq(0);
    }

    if (audioStream != null && audioStream.active) {
      requestAnimationFrame(drawBarChart);
    }
  }, [analyser, dataArray, sampleRate, audioStream]);

  // Add this useRef and useEffect to keep track of the latest selectedString
  const selectedStringRef = useRef(selectedString);
  useEffect(() => {
    selectedStringRef.current = selectedString;
  }, [selectedString]);

  useEffect(() => {
    currentFreqRef.current = currentFreq;
  }, [currentFreq]);

  useEffect(() => {
    if (analyser && dataArray && audioStream) {
      drawBarChart();
    }
  }, [analyser, dataArray, drawBarChart, audioStream, selectedString]);

  const toggleAudio = () => {
    if (audioStream != null) {
      stopMediaStream();
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(
          stream => {
            setAudioStream(stream);

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            const newSampleRate = audioContext.sampleRate;
            setSampleRate(newSampleRate);

            console.log("Streaming started");
            console.log('Sample Rate:', newSampleRate, 'Hz');

            const newAnalyser = audioContext.createAnalyser()
            newAnalyser.smoothingTimeConstant = 0.85;
            newAnalyser.fftSize = fftSize;

            const newBufferLength = newAnalyser.frequencyBinCount;
            setDataArray(new Uint8Array(newBufferLength));

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(newAnalyser);

            setAnalyser(newAnalyser);
          })
        .catch(err => {
          console.error('Error accessing the microphone: ', err);
        })
    }
  }

  let micClasses = "rounded-full w-20 h-20 flex items-center justify-center text-primary-foreground hover:bg-primary/90";
  if (audioStream != null) {
    micClasses += " bg-accent";
  } else {
    micClasses += " bg-primary";
  }
  
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">Guitar Tuner</h1>
        </div>
      </header>
      <main className="flex-1 flex flex-col px-4 py-8 items-center">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Select String</h2>
            <StringSelector selectedString={selectedString} setSelectedString={setSelectedString} />
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">Tune String</h2>
              <div className="relative w-full h-64 bg-muted rounded-lg overflow-hidden">
                <canvas ref={canvas} className="w-full h-full"></canvas>
                <div className="absolute inset-0 flex items-center justify-center">
                  <button className={micClasses} onClick={toggleAudio}>
                    <MicIcon className="w-8 h-8" />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-background to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-sm font-medium text-muted-foreground flex flex-row justify-between">
                  <span>{getHzFromString(selectedString)}</span>
                  <span className="ml-auto">{closestFreq.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="bg-muted py-4">
        <div className="container mx-auto flex justify-center" />
      </footer>
    </div>
  );

  

  function getHzFromString(gs: GuitarString): string {
    return GuitarString[gs] + " " + getHzForString(gs) + " Hz";
  }

  function getHzForString(gs: GuitarString): number {
    switch (gs) {
      case GuitarString.E: return 82.41;
      case GuitarString.A: return 110.00;
      case GuitarString.D: return 146.83;
      case GuitarString.G: return 196.00;
      case GuitarString.B: return 246.94;
      case GuitarString.e: return 329.63;
      default: return 0;
    }
  }

  function stopMediaStream() {
    if (audioStream != null) {
      audioStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    setAudioStream(null);
  }

  function MicIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    )
  }
}

