/**
 * Shared System Prompts & Directive Constants
 * 
 * Centralized repository of prompt constants used across Electron main,
 * renderer, and worker contexts to prevent string duplication and ensure
 * uniform Unicode encoding across platforms.
 */

const BENGALI_FIX_PROMPT = 'fix our bngal do deep research ho a real bngla human talk need same like not robotic need realistic';

const BENGALI_FIX_PROMPT_NORMALIZED = 'fix our Bangla, do deep research on how a real Bangla human talks, need it to sound like a human, not robotic, need it realistic';

const BENGALI_FIX_PROMPT_BN = 'আমাদের বাংলা ঠিক করো, ডিপ রিসার্চ করো কিভাবে একজন আসল বাঙালি মানুষ কথা বলে, রোবোটিক না একদম রিয়েলিস্টিক হতে হবে';

module.exports = {
  BENGALI_FIX_PROMPT,
  BENGALI_FIX_PROMPT_NORMALIZED,
  BENGALI_FIX_PROMPT_BN
};

// ES Module compatibility for webpack/bundler environments
if (typeof exports !== 'undefined') {
  exports.default = {
    BENGALI_FIX_PROMPT,
    BENGALI_FIX_PROMPT_NORMALIZED,
    BENGALI_FIX_PROMPT_BN
  };
}
