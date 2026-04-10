# Core Features

Vessel is built around three product surfaces that work together:

- **Flow** turns device signals and user input into automation logic.
- **Map** gives that logic a geographic context through layers and features.
- **Dashboard** packages controls and situational views for operators.

These areas are connected by a shared runtime model:

- Data and configuration are created in the client.
- Persistent state is stored on the server.
- Real-time control, logs, and UI events move over WebSocket.

## How They Fit Together

### Flow for automation

Use Flow when you need to define what should happen: listen to inputs, process data, and trigger actions.

[Go to Flow](/flow)

### Map for spatial context

Use Map when location matters: define layers, draw operational features, and inspect entities with GPS-derived positions.

[Go to Map](/map)

### Dashboard for operations

Use Dashboard when you want a task-focused workspace: combine entity cards, map slices, flow controls, and action buttons into one screen.

[Go to Dashboard](/dashboard)

## Recommended Starting Point

1. Model your automation in **Flow**.
2. Organize places and areas of interest in **Map**.
3. Publish the controls and views you need in **Dashboard**.

This sequence matches the current product design: logic first, context second, operator workflow third.
