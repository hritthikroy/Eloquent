// OPTIMIZED: Performance monitoring and optimization utilities
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      recordingLatency: [],
      transcriptionTime: [],
      processingTime: [],
      voiceDetectionAccuracy: [],
      audioQuality: []
    };
    this.startTime = null;
    this.recordingStartTime = null;
  }

  // Start recording performance measurement
  startRecording() {
    this.recordingStartTime = performance.now();
    this.startTime = performance.now();
  }

  // Measure recording latency (time from trigger to actual recording start)
  measureRecordingLatency() {
    if (this.startTime) {
      const latency = performance.now() - this.startTime;
      this.metrics.recordingLatency.push(latency);
      console.log(`🚀 Recording latency: ${latency.toFixed(2)}ms`);
      return latency;
    }
    return 0;
  }

  // Measure transcription performance
  measureTranscription(startTime, endTime, textLength) {
    const duration = endTime - startTime;
    const wordsPerSecond = (textLength / 5) / (duration / 1000); // Approximate words (5 chars per word)
    
    this.metrics.transcriptionTime.push(duration);
    console.log(`📝 Transcription: ${duration.toFixed(2)}ms, ${wordsPerSecond.toFixed(1)} words/sec`);
    
    return { duration, wordsPerSecond };
  }

  // Measure total processing time
  measureProcessing() {
    if (this.recordingStartTime) {
      const totalTime = performance.now() - this.recordingStartTime;
      this.metrics.processingTime.push(totalTime);
      console.log(`⚡ Total processing: ${totalTime.toFixed(2)}ms`);
      return totalTime;
    }
    return 0;
  }

  // Get performance statistics
  getStats() {
    const calculateStats = (arr) => {
      if (arr.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      return { avg: avg.toFixed(2), min: min.toFixed(2), max: max.toFixed(2), count: arr.length };
    };

    return {
      recordingLatency: calculateStats(this.metrics.recordingLatency),
      transcriptionTime: calculateStats(this.metrics.transcriptionTime),
      processingTime: calculateStats(this.metrics.processingTime),
      voiceDetectionAccuracy: calculateStats(this.metrics.voiceDetectionAccuracy),
      audioQuality: calculateStats(this.metrics.audioQuality)
    };
  }

  // Log performance summary
  logSummary() {
    const stats = this.getStats();
    console.log('📊 PERFORMANCE SUMMARY:');
    console.log(`   🚀 Recording Latency: ${stats.recordingLatency.avg}ms avg (${stats.recordingLatency.count} samples)`);
    console.log(`   📝 Transcription Time: ${stats.transcriptionTime.avg}ms avg (${stats.transcriptionTime.count} samples)`);
    console.log(`   ⚡ Total Processing: ${stats.processingTime.avg}ms avg (${stats.processingTime.count} samples)`);
    
    // Performance recommendations
    if (parseFloat(stats.recordingLatency.avg) > 200) {
      console.log('⚠️  High recording latency detected. Consider optimizing audio buffer settings.');
    }
    if (parseFloat(stats.transcriptionTime.avg) > 5000) {
      console.log('⚠️  Slow transcription detected. Check API performance or network connection.');
    }
    if (parseFloat(stats.processingTime.avg) > 8000) {
      console.log('⚠️  High total processing time. Consider enabling low-latency mode.');
    }
  }

  // Reset metrics
  reset() {
    this.metrics = {
      recordingLatency: [],
      transcriptionTime: [],
      processingTime: [],
      voiceDetectionAccuracy: [],
      audioQuality: []
    };
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();
module.exports = performanceMonitor;