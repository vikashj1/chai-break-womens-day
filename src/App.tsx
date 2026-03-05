import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RecaptchaVerifier,
  signInAnonymously,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth'
import type { FirebaseError } from 'firebase/app'
import confetti from 'canvas-confetti'

import './App.css'
import { Header } from './components/Header'
import { Wheel } from './components/Wheel'
import { auth, firebaseReady } from './lib/firebase'
import { isCampaignEnded } from './lib/campaign'
import type { AppStep, Prize } from './lib/types'
import { PRIZES } from './lib/types'
import {
  incrementOtpSendOrThrow,
  loadParticipant,
  markVerified,
  redeemOrThrow,
  spinOrThrow,
} from './lib/participant'

function normalizeIndianPhoneToE164(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+91${digits.slice(1)}`
  if (input.trim().startsWith('+') && digits.length >= 10) return `+${digits}`
  return ''
}

function pickPrize(): Prize {
  const idx = Math.floor(Math.random() * PRIZES.length)
  return PRIZES[idx]
}

export default function App() {
  const previewMode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('preview') === '1'
    } catch {
      return false
    }
  }, [])

  const [step, setStep] = useState<AppStep>('details')
  const [ended, setEnded] = useState<boolean>(() => isCampaignEnded())

  const [name, setName] = useState('')
  const [phoneRaw, setPhoneRaw] = useState('')
  const phoneE164 = useMemo(() => normalizeIndianPhoneToE164(phoneRaw), [phoneRaw])

  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [otp, setOtp] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [spinning, setSpinning] = useState(false)
  const [prize, setPrize] = useState<Prize | null>(null)

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)

  async function ensureAnonymousAuth() {
    if (!firebaseReady || !auth) {
      throw new Error('FIREBASE_NOT_CONFIGURED')
    }
    if (auth.currentUser) return
    await signInAnonymously(auth)
  }

  useEffect(() => {
    const t = window.setInterval(() => setEnded(isCampaignEnded()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!phoneE164) return

    ;(async () => {
      const doc = await loadParticipant(phoneE164)
      if (!doc) return

      if (doc.redeemed) {
        setStep('redeemed')
        setPrize(doc.prize ?? null)
        return
      }

      if (doc.prize) {
        setPrize(doc.prize)
        setStep('result')
        return
      }

      if (doc.verifiedAt) {
        setStep('spin')
      }
    })().catch(() => {
      // ignore prefill errors
    })
  }, [phoneE164])

  async function ensureRecaptcha() {
    if (!firebaseReady || !auth) {
      throw new Error('FIREBASE_NOT_CONFIGURED')
    }
    if (recaptchaRef.current) return recaptchaRef.current
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    })
    recaptchaRef.current = verifier
    return verifier
  }

  async function onGetOtp() {
    setError(null)

    if (!firebaseReady) {
      setError('Setup required to continue.')
      return
    }

    if (ended) {
      setError('This campaign has ended.')
      return
    }

    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }

    if (!phoneE164) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }

    setLoading(true)
    try {
      await ensureAnonymousAuth()
      await incrementOtpSendOrThrow(phoneE164, name.trim())
      const verifier = await ensureRecaptcha()
      const result = await signInWithPhoneNumber(auth, phoneE164, verifier)
      setConfirmation(result)
      setStep('otp')
    } catch (e) {
      const maybeFirebase = e as Partial<FirebaseError> | undefined
      const code = typeof maybeFirebase?.code === 'string' ? maybeFirebase.code : ''
      const msg = e instanceof Error ? e.message : 'Something went wrong.'
      if (msg === 'OTP_SEND_LIMIT') {
        setError(
          'You have reached the maximum number of OTP requests. Please try again in 5 minutes.',
        )
      } else if (code) {
        setError(`Unable to send OTP right now. (${code})`)
      } else {
        setError('Unable to send OTP right now. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function onVerifyOtp() {
    setError(null)

    if (!firebaseReady) {
      setError('Setup required to continue.')
      return
    }
    if (!confirmation) {
      setError('Please request an OTP first.')
      return
    }
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP.')
      return
    }

    setLoading(true)
    try {
      await confirmation.confirm(otp.trim())
      if (!phoneE164) throw new Error('Missing phone')
      await markVerified(phoneE164)
      setStep('spin')
    } catch {
      setError('Incorrect OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function onSpin() {
    setError(null)

    if (!firebaseReady) {
      setError('Setup required to continue.')
      return
    }
    if (ended) {
      setError('This campaign has ended.')
      return
    }
    if (!phoneE164) {
      setError('Missing phone number.')
      return
    }
    if (!name.trim()) {
      setError('Missing name.')
      return
    }

    setSpinning(true)

    const chosen = pickPrize()
    try {
      await ensureAnonymousAuth()
      await spinOrThrow(phoneE164, name.trim(), chosen)
      setPrize(chosen)

      window.setTimeout(() => {
        confetti({
          particleCount: 140,
          spread: 70,
          origin: { y: 0.6 },
        })
      }, 250)

      window.setTimeout(() => {
        setStep('result')
        setSpinning(false)
      }, 2200)
    } catch (e) {
      setSpinning(false)
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'SPIN_LOCKED') {
        const existing = await loadParticipant(phoneE164)
        if (existing?.prize) {
          setPrize(existing.prize)
          setStep('result')
          return
        }
        setError('You can spin only once in 24 hours.')
      } else {
        setError('Unable to spin right now. Please try again.')
      }
    }
  }

  async function onRedeemNow() {
    setError(null)

    if (!firebaseReady) {
      setError('Setup required to continue.')
      return
    }
    if (!phoneE164) {
      setError('Missing phone number.')
      return
    }

    setLoading(true)
    try {
      await ensureAnonymousAuth()
      await redeemOrThrow(phoneE164)
      setStep('redeemed')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'ALREADY_REDEEMED') {
        setStep('redeemed')
      } else {
        setError('Unable to redeem right now. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <Header />

      <main className="main">
        {!firebaseReady ? (
          <section className="card">
            <h2 className="h2">Setup required</h2>
            <p className="subtitle">
              Firebase is not configured yet. Add a <code>.env.local</code> (see{' '}
              <code>.env.example</code>) and restart the dev server.
            </p>
            {previewMode ? (
              <button className="button" onClick={() => setStep('spin')}>
                Preview Spin Wheel
              </button>
            ) : (
              <button
                className="button"
                onClick={() => {
                  const url = new URL(window.location.href)
                  url.searchParams.set('preview', '1')
                  window.location.href = url.toString()
                }}
              >
                Preview UI
              </button>
            )}
          </section>
        ) : null}

        {ended ? (
          <section className="card">
            <h2 className="h2">
              This campaign has ended. Thank you for celebrating with us.
            </h2>
          </section>
        ) : null}

        {!ended && (firebaseReady || previewMode) ? (
          <>
            {step === 'details' ? (
              <section className="card">
                <div className="field">
                  <label className="label" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="phone">
                    Phone Number
                  </label>
                  <div className="phoneRow">
                    <span className="phonePrefix">+91</span>
                    <input
                      id="phone"
                      className="input"
                      value={phoneRaw}
                      onChange={(e) => setPhoneRaw(e.target.value)}
                      placeholder="10-digit number"
                      inputMode="numeric"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                {error ? <p className="error">{error}</p> : null}

                <button className="button" onClick={onGetOtp} disabled={loading}>
                  {loading ? 'Sending...' : 'Get OTP'}
                </button>

                <div id="recaptcha-container" />
              </section>
            ) : null}

            {step === 'otp' ? (
              <section className="card">
                <div className="field">
                  <label className="label" htmlFor="otp">
                    Enter OTP
                  </label>
                  <input
                    id="otp"
                    className="input"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit OTP"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>

                {error ? <p className="error">{error}</p> : null}

                <button className="button" onClick={onVerifyOtp} disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </section>
            ) : null}

            {step === 'spin' ? (
              <section className="card">
                <Wheel spinning={spinning} />

                {error ? <p className="error">{error}</p> : null}

                <button className="button" onClick={onSpin} disabled={spinning || !firebaseReady}>
                  {spinning ? 'Spinning...' : 'Spin Now'}
                </button>

                <p className="hint">You can spin only once in 24 hours.</p>
              </section>
            ) : null}

            {step === 'result' ? (
              <section className="card">
                <h2 className="h2">You’ve unlocked your refreshment!</h2>
                <p className="prize">{prize ?? ''}</p>

                <p className="redeemLine">
                  {prize ? `Enjoy your ${prize} on us.` : null}
                </p>

                {error ? <p className="error">{error}</p> : null}

                <button className="button" onClick={onRedeemNow} disabled={loading || !firebaseReady}>
                  {loading ? 'Redeeming...' : 'Redeem Now'}
                </button>
              </section>
            ) : null}

            {step === 'redeemed' ? (
              <section className="card">
                <h2 className="h2">Redeemed Successfully.</h2>
                <p className="subtitle">Happy Women’s Day.</p>
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  )
}
