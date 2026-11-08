/**
 * Generate the narration with ElevenLabs (professional TTS).
 *
 *   ELEVENLABS_API_KEY=xxx ELEVENLABS_VOICE_ID=yyy node scripts/voiceover_elevenlabs.mjs
 *
 * Pick a warm, deep, calm male narrator in the ElevenLabs Voice Library and use its voice id.
 * Writes public/voiceover/*.mp3 (same names as the Kokoro fallback). The site measures the real
 * clip lengths at load, so no code changes are needed after regenerating.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const manPath = path.join(root, 'public/voiceover/manifest.json')
const key = process.env.ELEVENLABS_API_KEY
const voice = process.env.ELEVENLABS_VOICE_ID
if (!key || !voice) {
  console.error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID')
  process.exit(1)
}
const man = JSON.parse(fs.readFileSync(manPath, 'utf8'))

for (const seg of man.segments) {
  // ElevenLabs reads pauses from SSML-style break tags
  const text = seg.parts.map((p) => (typeof p === 'string' ? p : `<break time="${p.pause}s" />`)).join(' ')
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_192`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.62, similarity_boost: 0.8, style: 0.18, use_speaker_boost: true, speed: 0.94 },
    }),
  })
  if (!res.ok) {
    console.error(seg.id, res.status, await res.text())
    process.exit(1)
  }
  fs.writeFileSync(path.join(root, 'public', seg.file), Buffer.from(await res.arrayBuffer()))
  delete seg.duration // measured by the site at load
  console.log('✓', seg.id)
}
man.voice = `ElevenLabs voice ${voice}`
fs.writeFileSync(manPath, JSON.stringify(man, null, 2))
