import React from "react";
import { useFadeInOnScroll } from "@/lib/useFadeInOnScroll";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MapPlaneIllustration() {
  return (
    <svg
      viewBox='0 0 900 360'
      className='h-full w-full'
      role='img'
      aria-label='Map with a plane flying along a route'
    >
      <defs>
        <pattern id='grid' width='36' height='36' patternUnits='userSpaceOnUse'>
          <path
            d='M 36 0 L 0 0 0 36'
            fill='none'
            stroke='rgba(255,255,255,0.08)'
            strokeWidth='1'
          />
        </pattern>

        <linearGradient id='fade' x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0.55' stopColor='rgba(255,255,255,0.0)' />
          <stop offset='0.55' stopColor='rgba(255,255,255,0.64)' />
          <stop offset='0.55' stopColor='rgba(255,255,255,0.64)' />
          <stop offset='0.55' stopColor='rgba(255,255,255,0.0)' />
        </linearGradient>

        <style>
          {`
            .stroke { stroke: rgba(255,255,255,0.65); }
            .muted { stroke: rgba(255,255,255,0.28); }
            .dash  { stroke: rgba(255,255,255,0.55); stroke-dasharray: 8 10; }
            .thin  { stroke-width: 2; fill: none; }
            .thick { stroke-width: 3; fill: none; }
          `}
        </style>

        <path
          id='route'
          d='M120,250
             C190,170 250,165 305,205
             C360,250 410,255 465,220
             C520,185 570,170 625,205
             C680,240 725,245 790,190'
        />
      </defs>

      <rect x='0' y='0' width='900' height='360' fill='url(#grid)' />
      <rect
        x='0'
        y='0'
        width='900'
        height='360'
        fill='url(#fade)'
        opacity='0.9'
      />

      <use href='#route' className='dash thick' />
      <use href='#route' className='stroke thick' opacity='0.15' />

      <g>
        <circle r='10' fill='rgba(255,255,255,0.10)'>
          <animateMotion dur='6.5s' repeatCount='indefinite' rotate='auto'>
            <mpath href='#route' />
          </animateMotion>
        </circle>

        <g>
          <path d='M0,-10 L22,0 L0,10 L4,0 Z' fill='rgba(255,255,255,0.9)' />
          <path d='M5,-2 L12,-2' stroke='rgba(0,0,0,0.35)' strokeWidth='2' />
          <animateMotion dur='6.5s' repeatCount='indefinite' rotate='auto'>
            <mpath href='#route' />
          </animateMotion>
        </g>
      </g>
    </svg>
  );
}

export function MidCTASection() {
  const { ref: sectionRef, isVisible } = useFadeInOnScroll<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      className='h-full w-full bg-neutral-950 text-white'
    >
      <div
        className={cx(
          "container mx-auto flex h-full max-w-7xl flex-col gap-12 px-8 md:px-10 py-16 md:flex-row md:items-center md:justify-between",
          "transition-all duration-700 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className='w-full md:w-[46%]'>
          <h2 className='text-4xl font-semibold tracking-tight md:text-5xl'>
            Start with a demo
            <br />
            <span className='font-serif font-medium'>See it in action.</span>
          </h2>

          <div className='mt-8 flex flex-wrap items-center gap-4'>
            <button
              type='button'
              className='inline-flex h-11 items-center justify-center bg-white px-5 text-sm font-medium text-black transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 cursor-pointer'
              onClick={() =>
                window.open("https://github.com/cartesiancs/vessel")
              }
            >
              Start for free
            </button>

            <button
              type='button'
              className='inline-flex h-11 items-center justify-center border border-white/30 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:border-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 cursor-pointer'
              onClick={() => (location.href = "/roadmap")}
            >
              See our roadmap
            </button>
          </div>
        </div>

        <div className='w-full md:w-[54%]'>
          <div className='relative h-[260px] w-full md:h-[320px]'>
            <MapPlaneIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
