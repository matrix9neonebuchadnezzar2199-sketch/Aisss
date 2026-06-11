import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inferModelCapabilityTags } from './services/model-capability-tags.js'

test('inferModelCapabilityTags classifies common Ollama models', () => {
  assert.deepEqual(
    inferModelCapabilityTags('nomic-embed-text:latest', { family: 'nomic-bert' }).map((t) => t.id),
    ['embed']
  )
  assert.deepEqual(
    inferModelCapabilityTags('qwen3-vl:8b', { family: 'qwen3vl' }).map((t) => t.id),
    ['text', 'vision']
  )
  assert.deepEqual(
    inferModelCapabilityTags('glm-4.6:cloud', null).map((t) => t.id),
    ['text', 'cloud']
  )
  assert.deepEqual(
    inferModelCapabilityTags('hf.co/professorf/gemma-4-12B-it-gguf:Q8_0', { family: 'gemma' }).map((t) => t.id),
    ['text']
  )
  assert.deepEqual(
    inferModelCapabilityTags('bge-m3:latest', { family: 'bert' }).map((t) => t.id),
    ['embed']
  )
})
