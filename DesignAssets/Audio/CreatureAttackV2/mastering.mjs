import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../../..');
const config = JSON.parse(fs.readFileSync(path.join(folder, 'mastering.json'), 'utf8'));
const executable = process.argv[2];
const selected = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
if (!executable) throw new Error('FFmpeg executable path is required');
const work = path.join(root, '$Trash/creature-attack-mastering-20261030/render');
fs.mkdirSync(work, { recursive: true });

function execute(args) {
  const result = spawnSync(executable, args, { encoding: 'buffer', maxBuffer: 16777216, windowsHide: true });
  if (result.status !== 0) throw new Error(String(result.stderr));
  return result;
}

function measure(file) {
  const result = execute(['-hide_banner', '-v', 'error', '-i', file, '-ar', '22050', '-ac', '2', '-f', 'f32le', 'pipe:1']);
  const data = result.stdout;
  const samples = Math.floor(data.length / 8);
  const window = 2205;
  const hop = 110;
  const energy = new Float64Array(samples + 1);
  let peak = 0;
  let peakAt = 0;
  for (let index = 0; index < samples; index++) {
    const left = data.readFloatLE(index * 8);
    const right = data.readFloatLE(index * 8 + 4);
    energy[index + 1] = energy[index] + (left * left + right * right) / 2;
    const amplitude = Math.max(Math.abs(left), Math.abs(right));
    if (amplitude > peak) { peak = amplitude; peakAt = index; }
  }
  let maximum = 0;
  let at = 0;
  for (let index = 0; index + window <= samples; index += hop) {
    const value = (energy[index + window] - energy[index]) / window;
    if (value > maximum) { maximum = value; at = index; }
  }
  return { durationSeconds: samples / 22050, eventRmsDbfs: 10 * Math.log10(Math.max(maximum, 1e-20)),
    eventAtMs: at / 22050 * 1000, samplePeakDbfs: 20 * Math.log10(Math.max(peak, 1e-10)), samplePeakAtMs: peakAt / 22050 * 1000 };
}

function meter(file) {
  const result = execute(['-hide_banner', '-nostats', '-i', file, '-af', 'loudnorm=I=-18:TP=-2.5:LRA=11:print_format=json', '-f', 'null', '-']);
  const match = result.stderr.toString('utf8').match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!match) throw new Error('Loudness meter result missing');
  const values = JSON.parse(match[0]);
  return { integratedLufs: Number(values.input_i), truePeakDbtp: Number(values.input_tp) };
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2).replace(/\n/g, '\r\n') + '\r\n', 'utf8');
}

const results = [];
for (const item of config.assets) {
  if (selected && !selected.has(item.key)) continue;
  const input = path.resolve(folder, item.input);
  const preprocessed = path.join(work, item.key + '-equalized.wav');
  const output = path.resolve(root, item.output);
  const temporary = path.join(work, item.key + '-master.mp3');
  const processing = item.filters.slice();
  execute(['-hide_banner', '-v', 'error', '-y', '-i', input, '-af', processing.join(','), '-c:a', 'pcm_f32le', preprocessed]);
  let before = measure(preprocessed);
  if (!item.lockedTransientProcessing && before.samplePeakDbfs + item.eventTargetDbfs - before.eventRmsDbfs > config.limiterCeilingDbfs + 1.5) {
    const threshold = Math.pow(10, (before.eventRmsDbfs + 3) / 20);
    processing.push('acompressor=threshold=' + threshold.toFixed(10) + ':ratio=4:attack=0.01:release=10:knee=2.828427:makeup=1:detection=peak');
    execute(['-hide_banner', '-v', 'error', '-y', '-i', input, '-af', processing.join(','), '-c:a', 'pcm_f32le', preprocessed]);
    before = measure(preprocessed);
  }
  const gainDb = item.eventTargetDbfs - before.eventRmsDbfs;
  const ceiling = Math.pow(10, config.limiterCeilingDbfs / 20);
  const filters = ['volume=' + gainDb.toFixed(8) + 'dB', 'aresample=176400',
    'alimiter=limit=' + ceiling.toFixed(10) + ':attack=1:release=60:level=false:latency=true', 'aresample=44100'];
  execute(['-hide_banner', '-v', 'error', '-y', '-i', preprocessed, '-af', filters.join(','), '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', temporary]);
  const after = { ...measure(temporary), ...meter(temporary) };
  const bytes = fs.readFileSync(temporary);
  const sourceBytes = fs.readFileSync(input);
  fs.writeFileSync(output, bytes);
  const record = { key: item.key, input: item.input, output: item.output, filters: processing,
    gainDb, eventTargetDbfs: item.eventTargetDbfs, limiterCeilingDbfs: config.limiterCeilingDbfs,
    before, after, sourceSha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  const metadataPath = output.replace(/\.mp3$/, '.json');
  const metadata = JSON.parse(fs.readFileSync(path.resolve(folder, item.provenance), 'utf8'));
  metadata.asset = item.output;
  metadata.processing = 'Mastered from the preserved original with high-pass/EQ, event-window gain calibration, oversampled peak limiting and MP3 encoding.';
  metadata.original_sha256 = record.sourceSha256;
  metadata.sha256 = record.sha256;
  metadata.audioLeadMs = item.cueLeadMs;
  metadata.mastering = { source: path.posix.join('DesignAssets/Audio/CreatureAttackV2', item.input),
    renderer: 'DesignAssets/Audio/CreatureAttackV2/mastering.mjs', filters: processing, gainDb,
    eventTargetDbfs: item.eventTargetDbfs, limiterCeilingDbfs: config.limiterCeilingDbfs,
    measured: after, referenceAssets: config.references, musicReferenceVolume: config.runtimeMusicVolume };
  if (item.referenceSource) metadata.referenceSource = item.referenceSource;
  writeJson(metadataPath, metadata);
  results.push(record);
  process.stdout.write(JSON.stringify({ key: item.key, gainDb, ...after }) + '\n');
}
const beetle = results.find(item => item.key === 'beetle-attack');
const leader = config.aliases.find(item => item.key === 'spiny-back-leader');
if (beetle && leader) {
  fs.copyFileSync(path.resolve(root, beetle.output), path.resolve(root, leader.output));
  const metadata = JSON.parse(fs.readFileSync(path.resolve(root, beetle.output.replace(/\.mp3$/, '.json')), 'utf8'));
  metadata.asset = leader.output;
  metadata.referenceSource = beetle.output;
  writeJson(path.resolve(root, leader.output.replace(/\.mp3$/, '.json')), metadata);
  results.push({ ...beetle, key: leader.key, output: leader.output, identicalMaster: beetle.output });
}
const reportPath = path.join(work, 'mastering-results.json');
const previous = selected && fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')).results : [];
const combined = new Map(previous.map(item => [item.key, item]));
for (const item of results) combined.set(item.key, item);
writeJson(reportPath, { config: 'DesignAssets/Audio/CreatureAttackV2/mastering.json', results: [...combined.values()] });
