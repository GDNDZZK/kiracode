---
"kilo-code": patch
---

Fixed OpenAI Compatible provider not sending reasoning effort parameter. The reasoning effort setting is now properly passed to the API using the nested `reasoning: { effort, summary }` format, supporting xhigh, high, medium, and low effort levels.
