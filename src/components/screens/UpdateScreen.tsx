'use client'

import { useRef, useState } from 'react'
import { Sparkles, Upload, ArrowRight, ShieldCheck } from 'lucide-react'
import { useStore, importBackup, acknowledgeAppVersion, getAppVersion } from '@/lib/store'

export default function UpdateScreen() {
  const { dispatch } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)

  const onContinue = () => {
    acknowledgeAppVersion()
    dispatch({ type: 'NAVIGATE', screen: 'home' })
  }

  const onRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text !== 'string') return
      const result = importBackup(text)
      if (result.ok) {
        acknowledgeAppVersion()
        setStatus({ kind: 'ok', message: 'Backup restored. Reloading…' })
        setTimeout(() => window.location.reload(), 600)
      } else {
        setStatus({ kind: 'err', message: result.error })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-12">
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/8" />
          <div className="absolute inset-5 rounded-full bg-primary/12" />
          <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center shadow-hearth">
            <Sparkles size={40} className="text-primary-foreground" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="pb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary mb-2">
          Brick · v{getAppVersion()}
        </p>
        <h1 className="font-heading font-extrabold text-3xl text-foreground leading-tight mb-3 tracking-tight">
          Brick just updated.
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed mb-2">
          Your progress is safe on this device. If you saved a backup before this
          update, you can restore it now.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-success" />
          Nothing on your device has been changed.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onContinue}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-heading font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-hearth"
          >
            Continue with current data
            <ArrowRight size={18} />
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-14 bg-card text-foreground rounded-2xl font-heading font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform border border-border"
          >
            <Upload size={18} />
            Restore from backup
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onRestore}
          />
        </div>

        {status && (
          <p
            className={`text-center text-xs mt-4 leading-relaxed ${
              status.kind === 'ok' ? 'text-success' : 'text-destructive'
            }`}
          >
            {status.message}
          </p>
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-4 leading-relaxed">
          You can always export a fresh backup from Settings → Backup & Restore.
        </p>
      </div>
    </div>
  )
}
