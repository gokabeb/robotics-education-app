# Curriculum Content Model

This document describes the `content_json` block schema stored in the `lesson_content` table. Each row in `lesson_content` has a `content_json` column that is one of three block types: **text**, **quiz**, or **activity**.

---

## Block Types

### 1. Text Block

Renders a markdown string as formatted lesson content.

```json
{
  "type": "text",
  "content": "## What is a Robot?\n\nA robot is a machine that can sense its environment, make decisions, and take actions...",
  "order": 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"text"` | Block type identifier |
| `content` | `string` | Markdown-formatted content |
| `order` | `number` | Display order within the lesson (ascending) |

---

### 2. Quiz Block

Renders an interactive multiple-choice quiz.

```json
{
  "type": "quiz",
  "questions": [
    {
      "text": "Which part of a robot reads information from the environment?",
      "options": ["Motor", "Sensor", "Controller", "Chassis"],
      "correct": 1
    },
    {
      "text": "What does PWM stand for?",
      "options": ["Pulse Width Modulation", "Power Wire Management", "Pin Write Mode"],
      "correct": 0
    }
  ],
  "order": 2
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"quiz"` | Block type identifier |
| `questions` | `array` | One or more question objects |
| `questions[].text` | `string` | The question text |
| `questions[].options` | `string[]` | Answer choices (2–5 options) |
| `questions[].correct` | `number` | Zero-based index of the correct answer |
| `order` | `number` | Display order within the lesson |

---

### 3. Activity Block

Links to an interactive tool (simulator, block editor, robot builder) with instructions.

```json
{
  "type": "activity",
  "activityType": "simulator",
  "instructions": "Drive the robot forward 1 meter, then turn 90 degrees and stop.",
  "config": {
    "arena": "open-arena"
  },
  "order": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"activity"` | Block type identifier |
| `activityType` | `"simulator" \| "blockly" \| "builder"` | Which tool to link to |
| `instructions` | `string` | Plain-text instructions for the student |
| `config` | `object` | Tool-specific config (see below) |
| `order` | `number` | Display order within the lesson |

**Config options by activityType:**

| activityType | Config fields |
|---|---|
| `simulator` | `{ arena: string }` — which arena to open (e.g. `"open-arena"`, `"maze"`, `"obstacle-course"`) |
| `blockly` | `{}` — opens the block editor at `/playground` |
| `builder` | `{}` — opens the robot builder at `/builder` |

---

## Database Schema (reference)

```sql
-- lesson_content table
id          UUID PRIMARY KEY
lesson_id   UUID REFERENCES lessons(id)
content_json JSONB  -- one of the block shapes above
order_index INTEGER
```

The API at `/api/curriculum/lessons/[id]` returns blocks sorted by `order_index` ascending.

---

## Adding a New Lesson

1. Insert a row into `lessons` with your module ID, title, duration, etc.
2. For each content block, insert a row into `lesson_content` with the appropriate `content_json` shape.
3. Use `order_index` to control display order (start at 1, increment by 1).

See `scripts/seed-curriculum.ts` for a complete working example.
