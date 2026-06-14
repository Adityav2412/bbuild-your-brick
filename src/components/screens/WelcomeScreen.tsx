'use client'

import { useState } from 'react'
import { ArrowRight, BookOpen, Zap, Leaf } from 'lucide-react'
import { useStore } from '@/lib/store'

const slides = [
  {
    illustration: (
      <div className="relative w-56 h-56 flex items-center justify-center">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full bg-primary/8 animate-pulse" />
        <div className="absolute inset-4 rounded-full bg-primary/12" />
        {/* Center icon */}
        <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center shadow-xl shadow-primary/25">
          <BookOpen size={44} className="text-primary-foreground" strokeWidth={1.5} />
        </div>
        {/* Floating dots */}
        <div className="absolute top-6 right-10 w-3 h-3 rounded-full bg-primary/40" />
        <div className="absolute bottom-10 left-8 w-2 h-2 rounded-full bg-primary/30" />
        <div className="absolute top-14 left-4 w-2 h-2 rounded-full bg-accent/50" />
      </div>
    ),
    heading: 'Study smarter,\nnot harder.',
    body: 'StudyCoach is a recovery-first system built around your energy — not a rigid schedule.',
  },
  {
    illustration: (
      <div className="relative w-56 h-56 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#E2F5EC]" />
        {/* Cards stacked */}
        <div className="absolute top-8 left-10 w-36 h-20 bg-card rounded-2xl shadow-md flex items-center gap-3 px-4">
          <div className="w-9 h-9 rounded-xl bg-[#EEE8FF] flex items-center justify-center">
            <Zap size={16} className="text-[#7C5CC4]" />
          </div>
          <div>
            <div className="w-16 h-2 bg-foreground/15 rounded-full mb-1" />
            <div className="w-10 h-2 bg-foreground/10 rounded-full" />
          </div>
        </div>
        <div className="absolute bottom-10 right-8 w-36 h-20 bg-primary rounded-2xl shadow-md flex items-center gap-3 px-4">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Leaf size={16} className="text-primary-foreground" />
          </div>
          <div>
            <div className="w-14 h-2 bg-white/40 rounded-full mb-1" />
            <div className="w-10 h-2 bg-white/25 rounded-full" />
          </div>
        </div>
      </div>
    ),
    heading: 'Built for recovery,\nnot perfection.',
    body: 'No guilt. No streaks to maintain. Just gentle, consistent progress that fits your life.',
  },
  {
    illustration: (
      <div className="relative w-56 h-56 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#FFF3E0]" />
        <div className="w-40 h-40 relative">
          {/* Progress circle mock */}
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#E8E4DC" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#2B4A3A"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="263.9"
              strokeDashoffset="92.4"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-heading font-bold text-foreground">65%</span>
            <span className="text-xs text-muted-foreground font-medium">Today</span>
          </div>
        </div>
      </div>
    ),
    heading: 'Your plan,\nautomatically built.',
    body: 'Import your lectures once. The system decides what to study, how long, and in what order.',
  },
]

export default function WelcomeScreen() {
  const { dispatch } = useStore()
  const [slide, setSlide] = useState(0)
  const isLast = slide === slides.length - 1
  const current = slides[slide]

  return (
    <div className="min-h-screen flex flex-col bg-background px-6 py-10">
      {/* Skip */}
      <div className="flex justify-end">
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'onboarding' })}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1 px-2"
        >
          Skip
        </button>
      </div>

      {/* Illustration */}
      <div className="flex-1 flex items-center justify-center py-8">
        {current.illustration}
      </div>

      {/* Text */}
      <div className="pb-10">
        <h1 className="font-heading font-bold text-3xl text-foreground leading-tight mb-3 whitespace-pre-line text-balance">
          {current.heading}
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed mb-8">
          {current.body}
        </p>

        {/* Dots */}
        <div className="flex items-center gap-1.5 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === slide ? 'w-6 bg-primary' : 'w-1.5 bg-border'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            if (isLast) {
              dispatch({ type: 'NAVIGATE', screen: 'onboarding' })
            } else {
              setSlide((s) => s + 1)
            }
          }}
          className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-heading font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
        >
          {isLast ? (
            <>
              Get Started
              <ArrowRight size={18} />
            </>
          ) : (
            'Next'
          )}
        </button>
      </div>
    </div>
  )
}
