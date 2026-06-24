/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";

export default function TickrrLogo() {
  // Animate the path of the telemetry sports wave
  const pathVariants = {
    hidden: { pathLength: 0, opacity: 0.2 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        duration: 3,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "reverse" as const,
      },
    },
  };

  // Pulse effect for the active tracking node
  const pulseVariants = {
    animate: {
      scale: [1, 1.4, 1],
      opacity: [0.8, 1, 0.8],
      filter: [
        "drop-shadow(0 0 2px rgba(0,255,102,0.6))",
        "drop-shadow(0 0 8px rgba(0,255,102,0.9))",
        "drop-shadow(0 0 2px rgba(0,255,102,0.6))",
      ],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="flex items-center gap-3 select-none" id="tickrr-brand-container">
      {/* Animated SVG Graphic */}
      <div className="relative w-11 h-11 flex items-center justify-center bg-[#0B0E11]/80 backdrop-blur-md border border-[#2D333B] rounded p-1 shadow-inner shadow-black">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full overflow-visible"
          id="tickrr-logo-svg"
        >
          {/* Grid Background Lines inside Logo */}
          <line x1="10" y1="50" x2="90" y2="50" stroke="#2D333B" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#2D333B" strokeWidth="0.5" strokeDasharray="2 2" />

          {/* Telemetry Waveform Path */}
          {/* Representing athletic spike (heartrate/acceleration) and upward trend */}
          <motion.path
            d="M 5,65 L 25,65 L 35,35 L 45,85 L 55,15 L 65,55 L 75,55 L 95,25"
            fill="none"
            stroke="#00FF66" // Bright matrix green
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={pathVariants}
            initial="hidden"
            animate="visible"
          />

          {/* Underlay glow path */}
          <motion.path
            d="M 5,65 L 25,65 L 35,35 L 45,85 L 55,15 L 65,55 L 75,55 L 95,25"
            fill="none"
            stroke="#00FF66"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.15"
            variants={pathVariants}
            initial="hidden"
            animate="visible"
            style={{ filter: "blur(4px)" }}
          />

          {/* Active node dot at the final peak */}
          <motion.circle
            cx="95"
            cy="25"
            r="5"
            fill="#00FF66"
            variants={pulseVariants}
            animate="animate"
          />
        </svg>

        {/* Tiny retro horizontal accent lines */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-[#00FF66]/30" />
        <div className="absolute bottom-0 left-1/4 right-1/4 h-[1px] bg-[#00FF66]/30" />
      </div>

      {/* Terminal Branding Typography */}
      <div className="flex flex-col justify-center">
        <div className="flex items-baseline gap-1 leading-none">
          <span className="font-sans text-xl font-black tracking-tighter text-white uppercase">
            TICKRR<span className="text-[#FF9900]">.</span>
          </span>
          <span className="font-mono text-[8px] font-semibold text-[#00FF66] bg-[#00FF66]/10 border border-[#00FF66]/30 px-1 py-0.5 rounded uppercase select-none tracking-wider led-blink">
            LIVE
          </span>
        </div>
        <span className="text-[8px] font-mono tracking-widest text-[#D1D4DC]/40 mt-1 uppercase font-bold">
          BY TICKER LABS
        </span>
      </div>
    </div>
  );
}
