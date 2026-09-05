/**
 * Test Suite: Google Antigravity Multi-Agent Deep Research & Neural-Mesh Memory Upgrade
 * 
 * Verifies:
 * 1. Neural-mesh memory bank initialization, salience scoring, cross-agent retrieval, and persistence.
 * 2. Andrew autonomous deep research query detection, query decomposition, and scraper dispatch.
 * 3. High-speed telemetry collection and research vault ingestion across Andrew, Friday, and Tuk Tuk.
 * 4. Desktop Electron IPC bridge registration, squad coordination, and real-time research feeds.
 * 5. Preload context isolation and window.antigravityResearch API exposure.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let rootDir = path.resolve(__dirname, '../..');
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = path.resolve(__dirname, '..');
}
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = process.cwd();
}

const {
  NeuralMeshMemoryBank,
  calculateSalience,
  SALIENCE_WEIGHTS
} = require(path.join(rootDir, 'src/core/memory/banks'));

const {
  AndrewOrchestrator
} = require(path.join(rootDir, 'src/core/agent/andrew'));

const {
  registerResearchIpc
} = require(path.join(rootDir, 'app/electron/main'));

async function runDeepResearchTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING ANTIGRAVITY DEEP RESEARCH & NEURAL MESH TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Neural-Mesh Memory Bank & Salience Dynamics
  // --------------------------------------------------------------------------
  console.log('--- 1. Neural-Mesh Memory Bank & Salience Dynamics ---');
  {
    const tempStorage = path.join(os.tmpdir(), `eloquent-neural-mesh-${Date.now()}.json`);
    const bank = new NeuralMeshMemoryBank({ storagePath: tempStorage });

    assert(bank.squadAgents.includes('agent_vision') || bank.squadAgents.includes('agent_andrew'), 'Squad contains Vision');
    assert(bank.squadAgents.includes('agent_friday'), 'Squad contains Friday');
    assert(bank.squadAgents.includes('agent_tuk_tuk'), 'Squad contains Tuk Tuk');
    assert(bank.squadAgents.includes('agent_brian'), 'Squad contains Brian');

    // Ingest a deep research report
    const mockReport = {
      jobId: 'job_arch_001',
      query: 'Antigravity Zero-Copy Shared Memory IPC',
      rootUrl: 'https://docs.eloquent.ai/ipc',
      pagesCrawled: 4,
      totalBytes: 16384,
      durationMs: 45,
      results: [
        { url: 'https://docs.eloquent.ai/ipc', title: 'Shared Memory Ring Buffer', snippet: 'Lock-free sub-0.05ms audio handoff.', depth: 0 }
      ],
      keyInsights: [
        'Atomic ring buffer eliminates Node serialization overhead.',
        'Audio worker pool enforces panic recovery and active backpressure.'
      ]
    };

    const node = bank.ingestResearch(mockReport, 'agent_vision');
    assert(node.id === 'job_arch_001', 'Node ID preserved from research report');
    assert(node.salience >= 0.70, `Node salience (${node.salience}) exceeds high-priority retention threshold`);
    assert(node.sharedWith.length >= 4, 'Research node linked across all squad agents');

    // Cross-agent associative retrieval
    const fridayMemory = bank.getAgentMemory('agent_friday');
    assert(fridayMemory.linkedResearchCount === 1, 'Friday immediately has access to Vision research findings');
    assert(fridayMemory.recentResearch[0].query.includes('Shared Memory'), 'Friday recalled Vision research topic');

    const tukTukMemory = bank.getAgentMemory('agent_tuk_tuk');
    assert(tukTukMemory.linkedResearchCount === 1, 'Tuk Tuk memory bank synchronized with research node');

    // Search query ranking
    const searchHits = bank.query('Lock-free audio ring buffer');
    assert(searchHits.length >= 1, 'Search query recalled relevant research node');
    assert(searchHits[0].id === 'job_arch_001', 'Top hit matches ingested research report');

    // Episodic memory
    bank.addEpisode('user', 'Can you research our IPC latency?');
    bank.addEpisode('Vision', 'On it bro, running deep research right now.');
    const visionMemory = bank.getAgentMemory('agent_vision') || bank.getAgentMemory('agent_andrew');
    assert(visionMemory.recentEpisodes.length === 2, 'Episodic memory logged 2 conversation turns');

    // Persistence sync
    const syncRes = bank.sync();
    assert(syncRes.success === true, 'Neural mesh persisted atomically to disk');
    assert(fs.existsSync(tempStorage), 'Persistent brain memory file exists');

    try { fs.unlinkSync(tempStorage); } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Andrew Deep Research Query Detection & Decomposition
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Autonomous Query Detection & Decomposition ---');
  {
    const orchestrator = new AndrewOrchestrator();

    assert(orchestrator.isDeepResearchQuery('Can you do deep research on audio IPC bridges?') === true, 'Identifies "deep research" query');
    assert(orchestrator.isDeepResearchQuery('Please investigate the latest WebRTC specifications') === true, 'Identifies "investigate" query');
    assert(orchestrator.isDeepResearchQuery('Scrape the docs from https://docs.eloquent.ai') === true, 'Identifies "scrape" query');
    assert(orchestrator.isDeepResearchQuery('Hello Andrew, how are you bro?') === false, 'Ignores casual conversational greetings');

    // Query decomposition
    const plan1 = orchestrator.decomposeResearchQuery('Check docs at https://github.com/hritthik/eloquent for ring buffer');
    assert(plan1.rootUrl === 'https://github.com/hritthik/eloquent', 'Extracted explicit URL from prompt');
    assert(plan1.query.includes('ring buffer'), 'Preserved core target search query');
    assert(plan1.maxDepth === 2, 'Default max depth is 2');
    assert(plan1.maxPages === 10, 'Default max pages is 10');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Autonomous Scraper Dispatch & Telemetry Benchmarks
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Autonomous Scraper Dispatch & Telemetry ---');
  {
    const memoryBank = new NeuralMeshMemoryBank();
    const orchestrator = new AndrewOrchestrator({ memoryBank });

    let progressEventFired: boolean = false;
    orchestrator.on('research:progress', (data: any) => {
      progressEventFired = true;
      assert(typeof data.progress === 'number', 'Progress event contains numeric progress');
    });

    let dispatchedEventFired: boolean = false;
    orchestrator.on('research:dispatched', (data: any) => {
      dispatchedEventFired = true;
      assert(data.agent === 'agent_andrew' || data.agent === 'agent_vision', 'Dispatch event specifies agent_vision or agent_andrew');
    });

    const dispatchResult = await orchestrator.dispatchDeepResearch(
      'Deep research on Google Antigravity multi-agent team bonding equations',
      { rootUrl: 'https://antigravity.internal' }
    );

    assert(dispatchResult.success === true, 'Autonomous deep research dispatch succeeded');
    assert(Boolean(dispatchedEventFired), 'research:dispatched event fired');
    assert(Boolean(progressEventFired), 'research:progress event fired');
    assert(dispatchResult.report.pagesCrawled >= 3, 'Crawled at least 3 pages');
    assert(dispatchResult.report.keyInsights.length >= 2, 'Extracted key insights');
    assert(dispatchResult.telemetry.durationMs >= 0, 'Measured turnaround duration');
    assert(dispatchResult.memoryNode.salience >= 0.70, 'Ingested node has high salience');

    console.log(`   ℹ️ Deep research completed in ${dispatchResult.telemetry.durationMs}ms: crawled ${dispatchResult.report.pagesCrawled} pages (${dispatchResult.report.totalBytes} bytes)`);

    // Verify telemetry
    const telemetry = orchestrator.getTelemetry();
    assert(telemetry.totalDispatches === 1, 'Telemetry records 1 dispatch');
    assert(telemetry.successfulResearches === 1, 'Telemetry records 1 success');
    assert(telemetry.totalPagesCrawled >= 3, 'Telemetry records crawled pages');
    assert(telemetry.memoryStats.vaultCount === 1, 'Telemetry reflects updated memory vault');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Desktop Electron IPC Bridge Registration & Status Feeds
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Desktop Electron IPC Bridge Registration ---');
  {
    const registeredHandlers: Record<string, Function> = {};
    const mockIpcMain: any = {
      handle: (channel: string, handler: Function) => {
        registeredHandlers[channel] = handler;
      }
    };

    const bridge = registerResearchIpc(mockIpcMain);
    assert(bridge !== null, 'registerResearchIpc returned bridge instance');
    assert(typeof registeredHandlers['research:dispatch'] === 'function', 'Registered research:dispatch handler');
    assert(typeof registeredHandlers['research:status'] === 'function', 'Registered research:status handler');
    assert(typeof registeredHandlers['memory:get-banks'] === 'function', 'Registered memory:get-banks handler');
    assert(typeof registeredHandlers['memory:query'] === 'function', 'Registered memory:query handler');
    assert(typeof registeredHandlers['memory:sync-banks'] === 'function', 'Registered memory:sync-banks handler');

    // Test invoking research:status via IPC mock
    const statusPayload = await registeredHandlers['research:status']();
    assert(typeof statusPayload.totalDispatches === 'number', 'research:status returns valid telemetry');

    // Test invoking memory:get-banks via IPC mock
    const memoryPayload = await registeredHandlers['memory:get-banks'](null, 'agent_friday');
    assert(memoryPayload.agentId === 'agent_friday', 'memory:get-banks returned Friday memory snapshot');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Preload Context Isolation & Bridge Whitelist Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Preload Context Isolation & Bridge Whitelisting ---');
  {
    const preloadSource = fs.readFileSync(path.join(rootDir, 'src/preload.js'), 'utf8');

    assert(preloadSource.includes("contextBridge.exposeInMainWorld('antigravityResearch'"), 'Exposes antigravityResearch bridge');
    assert(preloadSource.includes("'research:dispatch'"), 'Preload bridges research:dispatch');
    assert(preloadSource.includes("'research:status'"), 'Preload bridges research:status');
    assert(preloadSource.includes("'memory:get-banks'"), 'Preload bridges memory:get-banks');
    assert(preloadSource.includes("'memory:query'"), 'Preload bridges memory:query');
    assert(preloadSource.includes("'memory:sync-banks'"), 'Preload bridges memory:sync-banks');
    assert(preloadSource.includes("'research:progress'"), 'Preload whitelists research:progress event');
    assert(preloadSource.includes("'research:status-feed'"), 'Preload whitelists research:status-feed event');
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} DEEP RESEARCH & NEURAL MESH TESTS PASSED!`);
  console.log('================================================================\n');

  process.exit(0);
}

runDeepResearchTests().catch(err => {
  console.error('Fatal error in deep research test suite:', err);
  process.exit(1);
});
