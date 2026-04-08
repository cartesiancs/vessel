# Flow

Flow is Vessel's visual automation system. It lets you design logic as a graph of nodes and connections, save that graph as a reusable flow, and run it on the server.

## What Flow Is For

Use Flow when you need to:

- connect sensor or system inputs to downstream actions
- express logic visually instead of writing backend code
- run long-lived or event-driven automations
- monitor execution through logs and UI feedback

## Core Concepts

### Flow

A flow is a saved automation document. In practice, it is a graph made of nodes and edges.

### Node

A node performs one job. Depending on the node type, that job may be:

- receiving an input
- transforming or routing data
- calling an external system
- triggering an action

### Edge

An edge connects outputs from one node to inputs on another node. Edges define how data moves through the graph.

### Trigger node

Some nodes act as event sources. They wait for an external signal such as a timer, a message, or a UI event and then push data into the flow.

### Run context

When a flow starts, Vessel attaches runtime context to that execution. This is how logs, targeted UI events, and session-scoped behavior are coordinated.

## User Flow

The current product flow is:

1. Create or select a flow from the sidebar.
2. Build the graph in the canvas by adding and connecting nodes.
3. Save the graph.
4. Run the flow.
5. Watch logs and UI feedback while it executes.
6. Stop the flow or iterate on the graph and save again.

## How To Use Flow

### 1. Create a flow

Open the Flow page and create a new flow from the sidebar. Each flow is a separate saved automation.

### 2. Build the graph

Add the nodes you need and connect them into a data path. A common mental model is:

`input -> logic -> action`

### 3. Save before running

The server runs the latest saved graph, not unsaved local edits. Saving is part of the normal run workflow and should be treated as the source of truth.

### 4. Run and observe

Start the flow from the header controls. Execution logs are shown in the flow UI, and flow-driven UI events can be sent back to the client.

### 5. Refine and repeat

Adjust nodes, connectors, or values, save again, and rerun until the behavior matches your intended automation.

## Core Design

Flow is intentionally split into two layers:

- **Client editor** for creating and editing the graph
- **Server runtime** for executing the latest saved graph

This separation supports a clear operating model:

- REST is used for flow CRUD and persistence.
- WebSocket is used for run control, logs, and runtime UI events.
- The server treats a saved graph snapshot as the executable version.

## Flow and Dashboard Integration

Flows can also react to dashboard interactions. A dashboard button can emit a UI event, and a matching flow listener can consume that event as a trigger.

This makes Flow the automation backbone behind operational dashboards.

## Practical Notes

- Unsaved graph changes are not part of a run until they are saved.
- The system currently assumes one active run per flow id.
- The flow page guards against accidental navigation when there are unsaved changes.
- Flow execution is real-time oriented, so logs are part of the normal operating experience, not just debugging.
