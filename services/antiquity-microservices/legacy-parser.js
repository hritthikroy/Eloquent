/**
 * Antiquity Stateless Microservice: Legacy Parser
 * Pure function endpoint handling legacy data transformation without side effects.
 */

'use strict';

/**
 * Parses XML strings into a plain JavaScript dictionary.
 * Deterministic, pure-function parsing without external library dependencies.
 * @param {string} xml
 * @returns {object}
 */
function parseSimpleXml(xml) {
  const result = {};
  const tagRegex = /<([a-zA-Z0-9_-]+)(?:\s+[^>]*)*>([^<]*)<\/\1>|<([a-zA-Z0-9_-]+)(?:\s+[^>]*)*\/>/g;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] !== undefined ? match[2].trim() : true;
    if (result[key] !== undefined) {
      if (Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Parses CSV string into structured record list.
 * @param {string} csv
 * @param {string} delimiter
 * @returns {Array<object>}
 */
function parseCsv(csv, delimiter = ',') {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] !== undefined ? values[idx] : null;
    });
    records.push(record);
  }
  return records;
}

/**
 * Parses legacy v1 key=value or bracket notation: [KEY: VAL] or KEY=VAL.
 * @param {string} text
 * @returns {object}
 */
function parseV1Format(text) {
  const records = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check [KEY: VALUE]
    const bracketMatch = trimmed.match(/^\[([^\]:]+):\s*([^\]]*)\]/);
    if (bracketMatch) {
      records[bracketMatch[1].trim()] = bracketMatch[2].trim();
      continue;
    }

    // Check KEY=VALUE or KEY: VALUE
    const delimiterMatch = trimmed.match(/^([^=:]+)[=:](.*)$/);
    if (delimiterMatch) {
      records[delimiterMatch[1].trim()] = delimiterMatch[2].trim();
    }
  }
  return records;
}

/**
 * Pure function endpoint for legacy-parser microservice.
 *
 * @param {object} payload
 * @param {string} payload.rawContent Raw string data to parse.
 * @param {string} payload.format One of ["v1", "xml", "csv", "json-legacy", "custom"].
 * @param {object} [payload.options] Parser options.
 * @param {object} [context] Request context (requestId, timestamp, caller).
 * @returns {Promise<object>} Parsed structured output.
 */
async function execute(payload, context = {}) {
  const startTime = Date.now();
  const { rawContent, format, options = {} } = payload;

  if (typeof rawContent !== 'string' || rawContent.length === 0) {
    throw new Error('Invalid legacy-parser input: rawContent must be a non-empty string');
  }

  let parsedData;

  switch (format) {
    case 'v1':
      parsedData = parseV1Format(rawContent);
      break;

    case 'xml':
      parsedData = parseSimpleXml(rawContent);
      break;

    case 'csv': {
      const delimiter = options.delimiter || ',';
      parsedData = parseCsv(rawContent, delimiter);
      break;
    }

    case 'json-legacy': {
      try {
        parsedData = JSON.parse(rawContent);
      } catch (err) {
        // Attempt unescape fallback for doubly encoded legacy strings
        const unescaped = rawContent.replace(/\\"/g, '"').replace(/^"|"$/g, '');
        parsedData = JSON.parse(unescaped);
      }
      break;
    }

    case 'custom':
    default: {
      parsedData = {
        tokens: rawContent.split(/\s+/).filter(Boolean),
        rawLength: rawContent.length,
        linesCount: rawContent.split('\n').length,
      };
      break;
    }
  }

  return {
    parsed: true,
    format,
    recordCount: Array.isArray(parsedData) ? parsedData.length : Object.keys(parsedData).length,
    output: parsedData,
    metadata: {
      inputBytes: Buffer.byteLength(rawContent, 'utf8'),
      processingDurationMs: Date.now() - startTime,
      requestId: context.requestId || null,
      timestamp: Date.now(),
    },
  };
}

module.exports = {
  name: 'legacy-parser',
  version: '1.0.0',
  execute,
};
