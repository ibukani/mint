---
name: create-static-feature
description: Create a new static feature module (tool) for the mint desktop application, adhering to the static feature-module architecture guidelines.
---

# `create-static-feature` Skill

This skill guides you through creating a new static feature module (e.g. a tool) in the `mint` repository.
It ensures that you follow the **Static Feature-Module Architecture** described in `.agents/AGENTS.md`.

## Prerequisites
Ensure that you are in the project root directory of `mint`.

## Step-by-Step Instructions

1. **Scaffold the Feature Boilerplate Files**
   Run the scaffolding script to generate the folder and placeholder files:
   ```bash
   node scripts/scaffold-feature.js <feature_name> [PascalComponentName]
   ```
   *Example*: `node scripts/scaffold-feature.js search_tool SearchTool`
   This will generate:
   - `src/features/<feature_name>/types.ts`
   - `src/features/<feature_name>/components/<PascalComponentName>Settings.tsx`
   - `src-tauri/src/features/<feature_name>.rs`
   - It will also automatically append `pub mod <feature_name>;` to `src-tauri/src/features/mod.rs` (if it exists).

2. **Register Frontend Settings Type**
   Open `src/core/context/AppSettings.tsx` and:
   - Import the settings type:
     ```typescript
     import { PascalComponentNameSettings } from "../../features/feature_name/types";
     ```
   - Add the property to the global `AppSettings` interface:
     ```typescript
     export interface AppSettings {
       // ... existing properties
       camelName: PascalComponentNameSettings;
     }
     ```

3. **Register Backend Settings Struct (Rust)**
   Open `src-tauri/src/core/settings.rs` and:
   - Define the settings struct:
     ```rust
     #[derive(Serialize, Deserialize, Clone, Debug)]
     #[serde(rename_all = "camelCase")]
     pub struct PascalComponentNameSettings {
         pub enabled: bool,
         pub shortcut: String,
     }
     impl Default for PascalComponentNameSettings {
         fn default() -> Self {
             Self {
                 enabled: false,
                 shortcut: "Ctrl+Alt+Key".to_string(), // Replace with custom shortcut
             }
         }
     }
     ```
   - Add the field to the `AppSettings` struct:
     ```rust
     pub struct AppSettings {
         // ... existing fields
         pub snake_name: PascalComponentNameSettings,
     }
     ```
   - Add the field initializer to the `Default` implementation for `AppSettings`:
     ```rust
     impl Default for AppSettings {
         fn default() -> Self {
             Self {
                 // ... existing fields
                 snake_name: PascalComponentNameSettings::default(),
             }
         }
     }
     ```

4. **Update Browser Mock Settings**
   Open `src/core/mocks/tauriMock.ts` and `src/core/mocks/vitestSetup.ts`:
   - Add the settings field and its default values to the `defaultSettings` constant:
     ```typescript
     camelName: {
       enabled: false,
       shortcut: "Ctrl+Alt+Key",
     },
     ```

5. **Register UI Component in settings Sidebar**
   Open `src/App.tsx` and:
   - Import the settings component:
     ```typescript
     import { PascalComponentNameSettings } from "./features/feature_name/components/PascalComponentNameSettings";
     ```
   - In `AppContent`, update `activeTab` useState union type to include the feature's `"camelName"` (e.g. `useState<"general" | "clock" | "v2t" | "camelName">`).
   - Add a navigation button in the sidebar panel:
     ```tsx
     <button
       className={`nav-button \${activeTab === "camelName" ? "active" : ""}`}
       onClick={() => setActiveTab("camelName")}
     >
       Display Name
     </button>
     ```
   - Render the component in the main content pane:
     ```tsx
     {activeTab === "camelName" && <PascalComponentNameSettings />}
     ```

6. **Validate Architecture Integration**
   Run the static validator to ensure everything is registered correctly:
   ```bash
   npm run verify:architecture
   ```
   If there are errors, correct them before proceeding.
