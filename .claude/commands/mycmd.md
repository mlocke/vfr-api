---
name: read-markdown
description: Reads a specified markdown file and performs an action based on the given instructions.
arguments:
  - name: file_path
    description: The path of the markdown file to read.
    required: false
  - name: task
    description: The task or instruction to perform using the file’s content.
    required: false
---

## Context
Read the content of /code-rules.md.

## Instructions
1. **Analyze** the content of the file: code-rules.md.
2. **Perform** the following task using the file content as a reference: `{{task}}`.
3. **If no second argument was provided**, then analyze the file and provide a summary of the key points.


