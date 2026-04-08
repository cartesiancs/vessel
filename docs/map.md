# Map

Map is Vessel's geographic workspace. It combines editable map layers, vector features, and live entity positions into one operational view.

## What Map Is For

Use Map when you need to:

- organize places, routes, and areas of interest
- draw operational geometry directly on a map
- inspect GPS-backed entities in geographic context
- reuse saved layers inside dashboards

## Core Concepts

### Layer

A layer is a named collection of map features. It is the main container users work with when editing spatial data.

### Feature

A feature is a spatial object that belongs to a layer. The current feature types are:

- point
- line
- polygon

### Vertex

Vertices define the shape of a line or polygon and the position of a point.

### Active layer

The main editing experience works against one selected layer at a time. Drawing and feature editing apply to the currently active layer.

### Entity overlay

The map also displays entity positions separately from drawn features. This is useful when you want to see operational objects on top of user-defined geometry.

## User Flow

The typical workflow is:

1. Open the Map page.
2. Create a layer or select an existing layer.
3. Choose a drawing mode.
4. Add points on the map to create a point, line, or polygon.
5. Confirm the shape.
6. Inspect or edit the resulting feature.
7. Switch layers or reuse the layer in a dashboard panel.

## How To Use Map

### 1. Select a layer

Layers are the starting point for map editing. If no layer is selected, drawing tools stay unavailable.

### 2. Choose a drawing mode

The toolbar lets you switch between:

- point drawing
- line drawing
- polygon drawing

### 3. Draw and confirm

For lines and polygons, add vertices on the map and confirm the result from the toolbar. You can also cancel an in-progress shape.

### 4. Inspect details

Click a feature to open its detail panel. From there you can inspect geometry-related information and update feature properties.

### 5. Switch the base map

Map currently supports multiple base map styles, including dark and satellite views, so you can choose the context that best fits the task.

## Core Design

Map separates spatial editing into three concerns:

- **server-backed spatial data** such as layers, features, and vertices
- **client-side interaction state** such as drawing mode and selected feature
- **entity overlays** sourced from device or entity state

This design keeps the product flexible:

- persistent geometry lives on the server
- short-lived interaction state lives in the client
- geographic context can be embedded into other surfaces such as dashboards

## Map and Dashboard Integration

Saved layers can be embedded into dashboard map panels. This makes the map system more than a standalone page: it becomes a reusable spatial component across the product.

## Practical Notes

- The main map currently focuses on one active layer at a time.
- The client remembers the last viewed map position and zoom locally.
- Base maps depend on external tile providers.
- Initial positioning prefers the last stored view, then browser geolocation, then a fallback default.
