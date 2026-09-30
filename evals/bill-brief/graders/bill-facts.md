---
type: regex
target: trace
flags: m
# Claude's own text in any message, not tool output: the answer comes before the bill card, and the
# final message may be only a note after it.
pattern: '^\{"type":"assistant"[^\n]*"type":"text","text":"[^\n]*Sweet Grown Alabama'
---
