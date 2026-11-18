'use client';

import React, { useState, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { getAudioUrl } from '@/lib/api';

interface AudioPlayerProps {
  callId: string;
  durationSec: number;
  durationFormatted: string;
}

export default function AudioPlayer({ callId, durationSec, durationFormatted }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec || 0);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Use getAudioUrl which includes the JWT token as query param (required for native <audio> src)
  const audioUrl = getAudioUrl(callId);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      }).catch((err) => {
        console.error('Audio play error:', err);
        setIsLoading(false);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || durationSec);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-full px-3 py-1 shadow-sm transition hover:bg-slate-100">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
        {isPlaying ? formatTime(currentTime) : durationFormatted}
      </span>

      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading}
        aria-label={isPlaying ? 'Pause call recording' : 'Play call recording'}
        className={`flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition ${
          isPlaying
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
        }`}
      >
        {isPlaying ? (
          <>
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Pause</span>
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play</span>
          </>
        )}
      </button>

      {isPlaying && (
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-20 h-1.5 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      )}
    </div>
  );
}

