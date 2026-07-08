---
name: add-overlay-window
description: Complete checklist and procedure for creating and registering a custom overlay window in Tauri and routing it correctly in React.
---

# `add-overlay-window` Skill

This skill explains how to add a new overlay window (subwindow) invoked by shortcuts or similar triggers in the Mint application, then wire it correctly into Tauri configuration and React routing.

## Purpose
- Create an auxiliary screen displayed separately from the main window, such as a translucent or borderless clock or voice-input status display.
- Safely integrate Tauri window management with React static routing.

---

## Likely Files to Touch
- **Overlay UI**: `src/features/<feature_name>/components/<PascalComponentName>Overlay.tsx`
- **Window routing**: [src/core/windowRoutes.ts](../../../src/core/windowRoutes.ts)
- **Tauri window configuration**: [src-tauri/tauri.conf.json](../../../src-tauri/tauri.conf.json)
- **App shell entry**: [src/App.tsx](../../../src/App.tsx)

---

## Required Architecture Rules
1. **Use the static routing map (`WINDOW_ROUTES`)**: Window display routing must be statically mapped through the `WINDOW_ROUTES` object. Dynamic imports and runtime discovery are forbidden.
2. **Support mock query parameters**: Code that reads `getCurrentWindow().label` must go through the automatic mock (`tauriMock.ts`) so standalone browser verification can simulate window display with the `?label=<label>` query parameter.

---

## Procedure

### Step 1: Create the Overlay Component
Create the component displayed in the window under the feature folder, for example `src/features/clock/components/ClockOverlay.tsx`.

```tsx
import React from "react";

export const MyOverlay: React.FC = () => {
  return (
    <div className="glass-panel overlay-container">
      <h2>My Overlay Content</h2>
    </div>
  );
};
```

### Step 2: Register It in React Static Routing
Open [src/core/windowRoutes.ts](../../../src/core/windowRoutes.ts) and add the mapping between the window label and component.

```typescript
import { MyOverlay } from "../features/my_feature/components/MyOverlay";

export const WINDOW_ROUTES: Record<string, React.FC> = {
  clock: ClockOverlay,
  my_overlay_label: MyOverlay, // Newly added window label and component mapping
};
```

### Step 3: Add the Window Definition to `tauri.conf.json`
Add the new window configuration under `app -> windows` in [src-tauri/tauri.conf.json](../../../src-tauri/tauri.conf.json).
Overlay windows usually need settings such as borderless display, transparent background, and always-on-top behavior.

```json
{
  "label": "my_overlay_label",
  "title": "My Overlay",
  "width": 400,
  "height": 200,
  "resizable": false,
  "fullscreen": false,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "visible": false
}
```

### Step 4: Verify Routing in the Browser Mock Environment
To verify display in a standalone browser, open the app with `?label=my_overlay_label` in the URL.
Confirm that the code below in [App.tsx](../../../src/App.tsx) displays the overlay component matching the query-parameter label.

```typescript
// Routing section in App.tsx
if (label && label in WINDOW_ROUTES) {
  const OverlayComponent = WINDOW_ROUTES[label];
  return <OverlayComponent />;
}
```

---

## Definition of Done
- [ ] The window is defined in `tauri.conf.json`.
- [ ] The window label and component are statically registered in `windowRoutes.ts`.
- [ ] The target overlay component renders correctly when the browser URL includes `?label=<label>`.
- [ ] `npm run build` passes without errors.
- [ ] `npm run verify:architecture` passes.

---

## Required Verification
1. **Static verification**: `npm run verify:architecture`
2. **Browser verification**: After starting `npm run dev`, open `http://localhost:5173/?label=my_overlay_label` in the browser and confirm that the intended design and UI appear.
3. **Build verification**: `npm run build`

---

## Common Failures
- **Conflicting transparency settings (`transparent`)**: `tauri.conf.json` sets `"transparent": true`, but CSS assigns an opaque background such as `background: white` to `body` or the root element, preventing transparency.
- **Import mismatch**: Adding the route to `windowRoutes.ts` introduces an import error and breaks the build.
