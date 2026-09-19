/**
 * ============================================================
 * Print To Frame ERP — Audio Processing & Downsampling Utility
 * ============================================================
 * Downsamples recorded speech audio to 8000Hz PCM WAV to preserve
 * telecom-quality clarity while minimizing upload payloads for AI analysis.
 */

/**
 * Downsamples an input audio file/blob to an 8kHz mono WAV file.
 * @param {File|Blob} file - Original audio file
 * @returns {Promise<File>} Compressed/downsampled WAV file
 */
export async function downsampleAudio(file) {
  try {
    if (typeof window === 'undefined') return file;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('AudioContext is not supported in this environment.');
      return file;
    }
    const audioCtx = new AudioContextClass();
    const arrayBuffer = await file.arrayBuffer();
    
    // Decode audio data
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    // Target 8000Hz (telecom speech standard, 16KB/sec)
    const targetSampleRate = 8000;
    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtxClass) return file;

    const offlineCtx = new OfflineCtxClass(
      1, // 1 channel (mono)
      Math.round(decodedBuffer.duration * targetSampleRate),
      targetSampleRate
    );
    
    // Create source node
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    
    // Render offline
    const renderedBuffer = await offlineCtx.startRendering();
    
    // Convert renderedBuffer to WAV Blob
    const wavBlob = audioBufferToWav(renderedBuffer);
    return new File([wavBlob], 'compressed_recording.wav', { type: 'audio/wav' });
  } catch (err) {
    console.warn('Audio downsampling failed, falling back to original file:', err);
    return file;
  }
}

/**
 * Encodes an AudioBuffer into a binary PCM 16-bit WAV Blob.
 * @param {AudioBuffer} buffer 
 * @returns {Blob}
 */
export function audioBufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // raw PCM
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 1) {
    result = buffer.getChannelData(0);
  } else {
    const c0 = buffer.getChannelData(0);
    const c1 = buffer.getChannelData(1);
    result = new Float32Array(c0.length);
    for (let i = 0; i < c0.length; i++) {
      result[i] = (c0[i] + c1[i]) / 2;
    }
  }
  
  const bufferLength = result.length;
  const wavBuffer = new ArrayBuffer(44 + bufferLength * 2);
  const view = new DataView(wavBuffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + bufferLength * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, bufferLength * 2, true);
  
  let offset = 44;
  for (let i = 0; i < bufferLength; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
