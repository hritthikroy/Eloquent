/**
 * Antiquity Microservices Layer Registry & Dispatcher
 * Provides clean access to stateless, isolated microservice modules.
 */

'use strict';

const legacyParser = require('./legacy-parser');
const audioBridge = require('./audio-bridge');

/**
 * Registry of available microservice endpoints.
 */
const registry = new Map();

// Register built-in pure microservices
registry.set('legacy-parser', legacyParser);
registry.set('audio-bridge', audioBridge);

/**
 * Returns list of registered antiquity microservice names.
 * @returns {string[]}
 */
function getRegisteredServices() {
  return Array.from(registry.keys());
}

/**
 * Retrieves a microservice module by name.
 * @param {string} serviceName
 * @returns {object|null}
 */
function getService(serviceName) {
  return registry.get(serviceName) || null;
}

/**
 * Directly executes a microservice by name with the given payload.
 *
 * @param {string} serviceName
 * @param {object} payload
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function dispatch(serviceName, payload, context = {}) {
  const service = registry.get(serviceName);
  if (!service) {
    throw new Error(`Antiquity microservice not found: "${serviceName}"`);
  }
  if (typeof service.execute !== 'function') {
    throw new Error(`Microservice "${serviceName}" does not expose an executable endpoint`);
  }
  return service.execute(payload, context);
}

module.exports = {
  registry,
  getRegisteredServices,
  getService,
  dispatch,
  legacyParser,
  audioBridge,
};
