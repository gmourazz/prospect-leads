// Everything in this file exists to make one message look like a person sent
// it rather than a script.
//
// The backend already decides WHEN a message may go out (minutes apart, with
// a daily ceiling and long pauses between bursts). What is left is the shape
// of the seconds around a single send: WhatsApp's own client announces that
// you opened a chat and that you are typing before any text arrives, and a
// sender that never does either — but delivers a 400-character message in
// 40 milliseconds — stands out precisely because it is too efficient.

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const randomBetween = (min, max) => min + Math.floor(Math.random() * (max - min + 1))

// How long to "type" a message. Anchored on a fast-but-human ~7 characters a
// second, then clamped: below three seconds it reads as automated, and past
// fifteen the presence update expires before the text lands anyway.
export function typingDuration(text) {
  const estimate = (text.length / 7) * 1000
  return Math.min(Math.max(estimate, 3000), 15000) + randomBetween(0, 1200)
}

// A pause before typing starts, standing in for the moment a person spends
// looking at the conversation they just opened.
export const readingPause = () => randomBetween(800, 2600)
