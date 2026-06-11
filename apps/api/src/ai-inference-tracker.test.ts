import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  beginAiInference,
  endAiInference,
  getAiInferenceStatus
} from './services/ai-inference-tracker.js'

test('ai inference tracker counts active chat streams', () => {
  assert.equal(getAiInferenceStatus().active, false)

  beginAiInference('llama3.2:latest')
  assert.equal(getAiInferenceStatus().active, true)
  assert.deepEqual(getAiInferenceStatus().models, ['llama3.2:latest'])

  beginAiInference('llama3.2:latest')
  endAiInference('llama3.2:latest')
  assert.equal(getAiInferenceStatus().active, true)

  endAiInference('llama3.2:latest')
  assert.equal(getAiInferenceStatus().active, false)
})
