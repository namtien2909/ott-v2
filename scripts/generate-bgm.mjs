import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sampleRate = 22_050;
const seconds = 8;
const channels = 1;
const bitsPerSample = 16;

function writeWav(file, seed) {
  const sampleCount = sampleRate * seconds;
  const data = Buffer.alloc(sampleCount * 2);
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const beat = Math.sin((2 * Math.PI * (seed ? 110 : 98) * t) + Math.sin(t * 0.8) * 0.35);
    const pulse = Math.max(0, Math.sin(2 * Math.PI * 2 * t)) ** 3;
    const lead = Math.sin(2 * Math.PI * (seed ? 330 : 262) * t) * (0.16 + pulse * 0.08);
    const pad = Math.sin(2 * Math.PI * (seed ? 165 : 131) * t) * 0.14;
    const loopFade = Math.min(1, t * 8, (seconds - t) * 8);
    const value = Math.max(-1, Math.min(1, (beat * 0.08 + lead + pad) * loopFade));
    data.writeInt16LE(Math.round(value * 0x3fff), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
  header.writeUInt16LE(channels * bitsPerSample / 8, 32); header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const outputDir = resolve("apps/web/public/audio/bgm");
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "lobby_loop.wav"), writeWav(false));
await writeFile(resolve(outputDir, "match_loop.wav"), writeWav(true));
console.log(`Generated two original ${seconds}s WAV loops in ${dirname(resolve(outputDir, "lobby_loop.wav"))}.`);
