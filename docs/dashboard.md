# Dashboard

Dashboard is Vessel's operator-facing workspace. It combines fixed overview panels with customizable dynamic dashboards that can host maps, flow controls, entity cards, and action buttons.

## What Dashboard Is For

Use Dashboard when you need to:

- assemble a task-focused operational screen
- monitor entities and system state in one place
- expose the most important map and flow controls to users
- trigger running automations from a UI button

## Core Concepts

### Main dashboard

The dashboard area includes a main overview surface for system and entity visibility.

### Dynamic dashboard

A dynamic dashboard is a saved, user-configurable canvas. It is arranged as a grid and persisted on the server.

### Widget

Widgets are the building blocks placed on the grid. Current dashboard widgets include:

- entity cards
- buttons
- map panels
- flow panels

### Edit mode

Edit mode is where users add, move, resize, and configure widgets. It separates layout work from operational use.

### Listener id

A listener id connects dashboard button clicks to a matching flow listener. This is the bridge between the operator UI and the automation runtime.

## User Flow

The current workflow is:

1. Open the dashboard area.
2. Move between views using the swipe layout.
3. Create a dynamic dashboard.
4. Enter edit mode.
5. Add widgets and arrange them on the grid.
6. Configure widget-specific settings such as a map layer, a flow, or a button listener id.
7. Leave edit mode and use the dashboard operationally.

## How To Use Dashboard

### 1. Create a dynamic dashboard

Add a new dashboard from the dashboard area. Each dashboard is stored as a reusable layout.

### 2. Enter edit mode

Edit mode unlocks layout controls so you can drag, resize, and delete items without triggering operational actions.

### 3. Add widgets

Use the add-item menu to place widgets on the canvas. Common combinations are:

- entity cards for live monitoring
- map panels for location context
- flow panels for run controls
- buttons for manual triggers

### 4. Configure buttons for automation

To make a button trigger a flow:

1. assign a listener id to the button
2. run a flow that includes a matching dashboard event listener
3. click the button outside edit mode

### 5. Let autosave persist layout changes

Dashboard layout changes are saved automatically after edits. This keeps the experience fast and reduces manual save steps.

## Core Design

Dashboard is designed as an operations layer on top of Vessel's existing systems:

- routing and swipe navigation control which dashboard is visible
- dashboard layout is stored as structured JSON on the server
- map and flow widgets reuse the corresponding product features instead of duplicating them
- button events are published over WebSocket and can be consumed by running flows

This gives Dashboard a clear role: it is the place where monitoring, control, and automation meet.

## Dashboard and Flow Integration

Dashboard buttons do not execute automation by themselves. Instead, they emit validated UI events that a running flow can listen for.

This makes the integration explicit:

- Dashboard provides the operator action
- Flow provides the automation logic

## Practical Notes

- Button actions are intentionally disabled while edit mode is active.
- Button-triggered automation depends on an active WebSocket connection and a running matching flow listener.
- Layout changes are autosaved.
- The current UI focuses on a single visible canvas per dynamic dashboard.
