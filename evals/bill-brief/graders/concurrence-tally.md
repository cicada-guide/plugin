---
type: regex
target: trace
flags: m
# Claude's own text in any message, not tool output (see bill-facts.md).
pattern: '^\{"type":"assistant"[^\n]*"type":"text","text":"[^\n]*\b102\b'
---
