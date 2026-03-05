import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { ParticipantDoc, Prize } from './types'

const OTP_WINDOW_MS = 5 * 60 * 1000
const SPIN_LOCK_MS = 24 * 60 * 60 * 1000

function requireDb() {
  if (!db) {
    throw new Error('FIREBASE_NOT_CONFIGURED')
  }
  return db
}

export function participantRef(phoneE164: string) {
  const database = requireDb()
  return doc(database, 'participants', phoneE164)
}

export async function loadParticipant(phoneE164: string) {
  const snap = await getDoc(participantRef(phoneE164))
  return snap.exists() ? (snap.data() as ParticipantDoc) : null
}

export async function incrementOtpSendOrThrow(phoneE164: string, name: string) {
  const database = requireDb()
  await runTransaction(database, async (tx) => {
    const ref = participantRef(phoneE164)
    const snap = await tx.get(ref)

    const now = Date.now()

    if (!snap.exists()) {
      const docData: ParticipantDoc = {
        name,
        phoneE164,
        createdAt: serverTimestamp(),
        otpFirstSentAt: serverTimestamp(),
        otpLastSentAt: serverTimestamp(),
        otpSendCount: 1,
      }
      tx.set(ref, docData)
      return
    }

    const data = snap.data() as ParticipantDoc
    const firstTs = data.otpFirstSentAt as Timestamp | undefined
    const sendCount = data.otpSendCount ?? 0

    const firstMs = firstTs ? firstTs.toMillis() : 0
    const inWindow = firstMs > 0 && now - firstMs <= OTP_WINDOW_MS

    const nextCount = inWindow ? sendCount + 1 : 1
    if (nextCount > 3) {
      throw new Error('OTP_SEND_LIMIT')
    }

    tx.set(
      ref,
      {
        name,
        phoneE164,
        otpSendCount: nextCount,
        otpLastSentAt: serverTimestamp(),
        otpFirstSentAt: inWindow ? data.otpFirstSentAt : serverTimestamp(),
      } satisfies ParticipantDoc,
      { merge: true },
    )
  })
}

export async function markVerified(phoneE164: string) {
  const database = requireDb()
  await runTransaction(database, async (tx) => {
    const ref = participantRef(phoneE164)
    const snap = await tx.get(ref)
    if (!snap.exists()) {
      throw new Error('MISSING_PARTICIPANT')
    }
    tx.set(ref, { verifiedAt: serverTimestamp() } satisfies Partial<ParticipantDoc>, {
      merge: true,
    })
  })
}

export async function spinOrThrow(phoneE164: string, name: string, prize: Prize) {
  const database = requireDb()
  await runTransaction(database, async (tx) => {
    const ref = participantRef(phoneE164)
    const snap = await tx.get(ref)
    const now = Date.now()

    if (!snap.exists()) {
      throw new Error('MISSING_PARTICIPANT')
    }

    const data = snap.data() as ParticipantDoc
    const lastSpinTs = data.lastSpinAt as Timestamp | undefined
    const lastSpinMs = lastSpinTs ? lastSpinTs.toMillis() : 0

    if (lastSpinMs > 0 && now - lastSpinMs < SPIN_LOCK_MS) {
      throw new Error('SPIN_LOCKED')
    }

    tx.set(
      ref,
      {
        name,
        phoneE164,
        lastSpinAt: serverTimestamp(),
        prize,
      } satisfies ParticipantDoc,
      { merge: true },
    )
  })
}

export async function redeemOrThrow(phoneE164: string) {
  const database = requireDb()
  await runTransaction(database, async (tx) => {
    const ref = participantRef(phoneE164)
    const snap = await tx.get(ref)
    if (!snap.exists()) {
      throw new Error('MISSING_PARTICIPANT')
    }

    const data = snap.data() as ParticipantDoc
    if (data.redeemed) {
      throw new Error('ALREADY_REDEEMED')
    }

    tx.set(
      ref,
      {
        redeemed: true,
        redeemedAt: serverTimestamp(),
      } satisfies Partial<ParticipantDoc>,
      { merge: true },
    )
  })
}
