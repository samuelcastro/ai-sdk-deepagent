# Checkpointers (Session Persistence)

Enable conversation persistence and pause/resume functionality with checkpointers.

## Overview

Checkpointers allow agents to save and restore conversation state across sessions. They provide:

- ✅ Automatic checkpoint saving after each step
- ✅ Thread isolation - different threads don't interfere
- ✅ State preservation (todos, files, messages)
- ✅ Pluggable storage backends
- ✅ Namespace support for multi-tenancy

## Built-in Checkpoint Savers

### MemorySaver

In-memory storage (ephemeral, lost on process exit).

**Use for:** Testing, single-session applications

**Features:** Fast, simple, namespace support

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent, MemorySaver } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  checkpointer: new MemorySaver(),
});
```

### FileSaver

JSON file storage (persists to disk).

**Use for:** Local development, simple persistence needs

**Features:** Human-readable, easy debugging, survives restarts

```typescript
import { FileSaver } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  checkpointer: new FileSaver({ dir: './.checkpoints' }),
});
```

### KeyValueStoreSaver

Adapter for `KeyValueStore` interface.

**Use for:** Production deployments with Redis, databases, cloud storage

**Features:** Scalable, distributed, custom storage backends

```typescript
import { KeyValueStoreSaver, InMemoryStore } from 'ai-sdk-deep-agent';

const store = new InMemoryStore(); // Replace with RedisStore, DatabaseStore, etc.
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  checkpointer: new KeyValueStoreSaver({ store, namespace: 'my-app' }),
});
```

## Basic Usage

### Saving and Loading Sessions

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent, FileSaver } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  checkpointer: new FileSaver({ dir: './.checkpoints' }),
});

const threadId = 'user-session-123';

// First interaction - checkpoint is automatically saved
for await (const event of agent.streamWithEvents({
  prompt: "Create a project plan",
  threadId,
})) {
  if (event.type === 'checkpoint-saved') {
    console.log(`Checkpoint saved at step ${event.step}`);
  }
}

// Later: Resume same thread - checkpoint is automatically loaded
for await (const event of agent.streamWithEvents({
  prompt: "Now implement the first task",
  threadId, // Same threadId loads the checkpoint
})) {
  if (event.type === 'checkpoint-loaded') {
    console.log(`Loaded ${event.messagesCount} messages from checkpoint`);
  }
  // Agent has full context from previous interaction
}
```

## Resume from Interrupts (HITL)

When using Human-in-the-Loop (HITL) tool approval, you can resume from interrupts:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  checkpointer: new FileSaver({ dir: './.checkpoints' }),
  interruptOn: {
    write_file: true, // Require approval for file writes
  },
});

let pendingApproval: any = null;

// First invocation - will interrupt on file write
for await (const event of agent.streamWithEvents({
  prompt: "Write a config file",
  threadId: 'session-123',
  onApprovalRequest: async (request) => {
    pendingApproval = request;
    return false; // Deny for now
  },
})) {
  // Checkpoint is saved with interrupt data
}

// Later: Resume with approval decision
for await (const event of agent.streamWithEvents({
  threadId: 'session-123',
  resume: {
    decisions: [{ type: 'approve', toolCallId: pendingApproval.toolCallId }],
  },
  onApprovalRequest: async () => true, // Approve this time
})) {
  // Agent continues from where it left off
}
```

## Custom Checkpoint Saver

Implement `BaseCheckpointSaver` interface for custom storage:

```typescript
import type { BaseCheckpointSaver, Checkpoint } from 'ai-sdk-deep-agent';

class RedisCheckpointSaver implements BaseCheckpointSaver {
  constructor(private redis: RedisClient) {}

  async save(checkpoint: Checkpoint): Promise<void> {
    await this.redis.set(
      `checkpoint:${checkpoint.threadId}`,
      JSON.stringify(checkpoint)
    );
  }

  async load(threadId: string): Promise<Checkpoint | undefined> {
    const data = await this.redis.get(`checkpoint:${threadId}`);
    return data ? JSON.parse(data) : undefined;
  }

  async list(): Promise<string[]> {
    const keys = await this.redis.keys('checkpoint:*');
    return keys.map(k => k.replace('checkpoint:', ''));
  }

  async delete(threadId: string): Promise<void> {
    await this.redis.del(`checkpoint:${threadId}`);
  }

  async exists(threadId: string): Promise<boolean> {
    return await this.redis.exists(`checkpoint:${threadId}`) === 1;
  }
}
```

## CLI Session Management

The CLI supports session persistence via the `--session` flag:

```bash
# Start CLI with session
$ bun run cli --session my-project

# Session is auto-saved after each response
# Session is auto-restored on restart

# List all sessions
> /sessions

# Clear current session
> /session clear
```

## Known Limitations

- ⚠️ **HITL Resume from Interrupts**: The `resume` option and `InterruptData` are defined but not fully implemented. Tools requiring approval cannot currently be paused and resumed across sessions. This feature is planned for a future release.
- ⚠️ **Approval Events**: `ApprovalRequestedEvent` and `ApprovalResponseEvent` types exist but are not emitted by the agent's event stream. The CLI emits these as UI-level events. Track approvals via the `onApprovalRequest` callback instead.
- ℹ️ **Auto-Deny Behavior**: Tools configured with `interruptOn` but no `onApprovalRequest` callback will be automatically denied (not executed).

## Examples

See `examples/checkpointer-demo.ts` for comprehensive examples.

## See Also

- [Architecture Documentation](./architecture.md) - Core components
- [Common Patterns](./patterns.md) - Usage patterns
