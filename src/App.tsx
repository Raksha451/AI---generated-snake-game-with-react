/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getTrackInfo } from './services/geminiService';

// --- Constants ---
const GRID_SIZE = 20;
const TILE_SIZE = 20; // Base tile size, will scale
const GAME_SPEED = 80;

const TRACKS = [
  { id: 1, title: "ERR_01: PULSE", artist: "SYS.OP", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: 2, title: "ERR_02: DRIFT", artist: "NULL_PTR", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: 3, title: "ERR_03: VOID", artist: "KERNEL_PANIC", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];

type Point = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export default function App() {
  // --- Refs for Game Loop ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
  // --- Game State Refs (Mutable for loop) ---
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]);
  const dirRef = useRef<Point>({ x: 0, y: -1 });
  const nextDirRef = useRef<Point>({ x: 0, y: -1 });
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef<number>(0);
  
  // --- React State ---
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'CRASHED'>('IDLE');
  
  // --- Music State ---
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackDescription, setTrackDescription] = useState("AWAITING_DATA...");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = TRACKS[currentTrackIndex];

  // --- Initialization ---
  useEffect(() => {
    const savedHighScore = localStorage.getItem('sys_highscore');
    if (savedHighScore) setHighScore(parseInt(savedHighScore));
    fetchTrackDescription(TRACKS[0].title);
  }, []);

  const fetchTrackDescription = async (title: string) => {
    setTrackDescription("FETCHING_NEURAL_DATA...");
    const desc = await getTrackInfo(title);
    setTrackDescription(desc.toUpperCase());
  };

  // --- Audio Controls ---
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(() => {});
      setIsPlaying(!isPlaying);
    }
  };

  const skipTrack = (dir: 'next' | 'prev') => {
    let nextIndex = dir === 'next' ? (currentTrackIndex + 1) % TRACKS.length : (currentTrackIndex - 1 + TRACKS.length) % TRACKS.length;
    setCurrentTrackIndex(nextIndex);
    setIsPlaying(true);
    fetchTrackDescription(TRACKS[nextIndex].title);
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = currentTrack.url;
      if (isPlaying) audioRef.current.play().catch(() => {});
    }
  }, [currentTrackIndex]);

  // --- Game Mechanics ---
  const spawnFood = useCallback(() => {
    let newFood: Point;
    while (true) {
      newFood = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
      if (!snakeRef.current.some(s => s.x === newFood.x && s.y === newFood.y)) break;
    }
    foodRef.current = newFood;
  }, []);

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: x * TILE_SIZE + TILE_SIZE / 2,
        y: y * TILE_SIZE + TILE_SIZE / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color
      });
    }
  };

  const resetGame = () => {
    snakeRef.current = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
    dirRef.current = { x: 0, y: -1 };
    nextDirRef.current = { x: 0, y: -1 };
    particlesRef.current = [];
    shakeRef.current = 0;
    setScore(0);
    spawnFood();
    setGameState('PLAYING');
  };

  // --- Game Loop ---
  const update = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;

    if (gameState === 'PLAYING' && deltaTime >= GAME_SPEED) {
      dirRef.current = nextDirRef.current;
      const head = snakeRef.current[0];
      const newHead = {
        x: (head.x + dirRef.current.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + dirRef.current.y + GRID_SIZE) % GRID_SIZE
      };

      // Collision
      if (snakeRef.current.some(s => s.x === newHead.x && s.y === newHead.y)) {
        setGameState('CRASHED');
        shakeRef.current = 20; // Screen shake
        spawnParticles(head.x, head.y, '#FF00FF', 30);
      } else {
        snakeRef.current.unshift(newHead);
        
        // Eat food
        if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
          setScore(s => {
            const ns = s + 10;
            if (ns > highScore) {
              setHighScore(ns);
              localStorage.setItem('sys_highscore', ns.toString());
            }
            return ns;
          });
          shakeRef.current = 5;
          spawnParticles(newHead.x, newHead.y, '#00FFFF', 15);
          spawnFood();
        } else {
          snakeRef.current.pop();
        }
      }
      lastTimeRef.current = time;
    }

    // Update Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Update Shake
    if (shakeRef.current > 0) shakeRef.current -= 1;

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [gameState, highScore, spawnFood]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear & Shake
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    if (shakeRef.current > 0) {
      const dx = (Math.random() - 0.5) * shakeRef.current;
      const dy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(dx, dy);
    }

    const scaleX = canvas.width / (GRID_SIZE * TILE_SIZE);
    const scaleY = canvas.height / (GRID_SIZE * TILE_SIZE);
    ctx.scale(scaleX, scaleY);

    // Draw Grid (Glitchy)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (Math.random() > 0.99) {
          ctx.fillStyle = 'rgba(255, 0, 255, 0.2)';
          ctx.fillRect(i * TILE_SIZE, j * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
        ctx.strokeRect(i * TILE_SIZE, j * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Draw Food
    ctx.fillStyle = '#FF00FF';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FF00FF';
    ctx.fillRect(foodRef.current.x * TILE_SIZE + 2, foodRef.current.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.shadowBlur = 0;

    // Draw Snake
    snakeRef.current.forEach((segment, i) => {
      ctx.fillStyle = i === 0 ? '#FFFFFF' : '#00FFFF';
      if (i === 0) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00FFFF';
      } else {
        ctx.shadowBlur = 0;
      }
      
      // Glitch effect on snake body randomly
      let xOffset = 0;
      if (Math.random() > 0.95) xOffset = (Math.random() - 0.5) * 4;
      
      ctx.fillRect(segment.x * TILE_SIZE + 1 + xOffset, segment.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    });
    ctx.shadowBlur = 0;

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [update]);

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': if (dirRef.current.y === 0) nextDirRef.current = { x: 0, y: -1 }; break;
        case 'ArrowDown': case 's': if (dirRef.current.y === 0) nextDirRef.current = { x: 0, y: 1 }; break;
        case 'ArrowLeft': case 'a': if (dirRef.current.x === 0) nextDirRef.current = { x: -1, y: 0 }; break;
        case 'ArrowRight': case 'd': if (dirRef.current.x === 0) nextDirRef.current = { x: 1, y: 0 }; break;
        case 'Enter': 
        case ' ':
          if (gameState !== 'PLAYING') resetGame();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // --- Resize Canvas ---
  useEffect(() => {
    const resize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
        }
      }
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col p-4 md:p-8 ${gameState === 'CRASHED' ? 'shake' : ''}`}>
      <audio ref={audioRef} onEnded={() => skipTrack('next')} />
      
      {/* Global Effects */}
      <div className="scanlines" />
      <div className="static-noise" />

      <header className="mb-8 border-b-2 border-[#00FFFF] pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-4xl font-mono text-glitch" data-text="SYS.CORE_OVERRIDE">
            SYS.CORE_OVERRIDE
          </h1>
          <p className="text-[#FF00FF] text-sm mt-2">STATUS: {gameState}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">MEM_ALLOC: OK</p>
          <p className="text-xs text-gray-500">NET_LINK: ESTABLISHED</p>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Panel: Stats & Audio */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          
          {/* Score Block */}
          <div className="border-glitch p-4 bg-black">
            <h2 className="text-[#FF00FF] border-b border-[#FF00FF] pb-2 mb-4">DATA_HARVEST</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">CURRENT_YIELD</p>
                <p className="text-4xl text-[#00FFFF]">{score.toString().padStart(5, '0')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">MAX_YIELD</p>
                <p className="text-2xl text-white">{highScore.toString().padStart(5, '0')}</p>
              </div>
            </div>
          </div>

          {/* Audio Core */}
          <div className="border-glitch p-4 bg-black flex-1">
            <h2 className="text-[#00FFFF] border-b border-[#00FFFF] pb-2 mb-4">AUDIO_SUBSYSTEM</h2>
            
            <div className="mb-6">
              <p className="text-xs text-gray-500">TRK_ID: {currentTrack.id}</p>
              <h3 className="text-lg text-[#FF00FF] truncate mt-1">{currentTrack.title}</h3>
              <p className="text-sm text-white truncate">BY: {currentTrack.artist}</p>
            </div>

            <div className="border border-gray-800 p-2 mb-6 min-h-[80px] bg-gray-900/50">
              <p className="text-xs text-[#00FFFF] leading-relaxed">
                &gt; {trackDescription}
                <span className="animate-pulse">_</span>
              </p>
            </div>

            <div className="flex gap-4 justify-center">
              <button onClick={() => skipTrack('prev')} className="btn-glitch">&lt;&lt;</button>
              <button onClick={togglePlay} className="btn-glitch px-6">
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </button>
              <button onClick={() => skipTrack('next')} className="btn-glitch">&gt;&gt;</button>
            </div>
            
            <div className="mt-8 space-y-2">
              <p className="text-xs text-gray-500 mb-2">AVAILABLE_FREQUENCIES:</p>
              {TRACKS.map((track, idx) => (
                <div 
                  key={track.id}
                  onClick={() => {
                    setCurrentTrackIndex(idx);
                    setIsPlaying(true);
                    fetchTrackDescription(track.title);
                  }}
                  className={`text-xs cursor-pointer p-1 border-l-2 ${currentTrackIndex === idx ? 'border-[#FF00FF] text-[#FF00FF] bg-gray-900' : 'border-gray-800 text-gray-500 hover:text-white'}`}
                >
                  [{idx + 1}] {track.title}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Panel: Canvas Game */}
        <div className="lg:col-span-9 flex flex-col">
          <div className="border-glitch flex-1 bg-black relative flex items-center justify-center p-2 min-h-[400px]">
            <div className="w-full h-full relative" style={{ maxWidth: '800px', maxHeight: '800px', aspectRatio: '1/1' }}>
              <canvas 
                ref={canvasRef} 
                className="w-full h-full block"
              />
              
              {/* Overlays */}
              {gameState !== 'PLAYING' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center">
                  {gameState === 'CRASHED' ? (
                    <>
                      <h2 className="text-4xl md:text-6xl text-glitch text-[#FF00FF] mb-4" data-text="FATAL_ERROR">FATAL_ERROR</h2>
                      <p className="text-[#00FFFF] mb-8">CONNECTION LOST. YIELD: {score}</p>
                      <button onClick={resetGame} className="btn-glitch text-xl px-8 py-4">REBOOT_SEQUENCE</button>
                    </>
                  ) : (
                    <>
                      <h2 className="text-4xl md:text-6xl text-glitch text-[#00FFFF] mb-4" data-text="SYSTEM_READY">SYSTEM_READY</h2>
                      <p className="text-gray-400 mb-8">PRESS [ENTER] OR [SPACE] TO INITIATE</p>
                      <button onClick={resetGame} className="btn-glitch text-xl px-8 py-4">INITIATE</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 flex justify-between text-xs text-gray-500">
            <p>INPUT: W/A/S/D OR ARROWS</p>
            <p>V 1.0.4 // GLITCH_ART_PROTOCOL</p>
          </div>
        </div>

      </main>
    </div>
  );
}

