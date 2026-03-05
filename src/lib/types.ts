export type Prize =
  | 'Classic Cold Coffee'
  | 'Virgin Mojito'
  | 'Peach Iced Tea'
  | 'Masala Lemonade'

export const PRIZES: Prize[] = [
  'Classic Cold Coffee',
  'Virgin Mojito',
  'Peach Iced Tea',
  'Masala Lemonade',
]

export type AppStep = 'details' | 'otp' | 'spin' | 'result' | 'redeemed'

export type ParticipantDoc = {
  name: string
  phoneE164: string
  createdAt?: unknown

  otpFirstSentAt?: unknown
  otpLastSentAt?: unknown
  otpSendCount?: number

  verifiedAt?: unknown

  lastSpinAt?: unknown
  prize?: Prize

  redeemed?: boolean
  redeemedAt?: unknown
}
