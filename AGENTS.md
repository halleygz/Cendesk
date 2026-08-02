# Cendesk Development Guide

## Product

Cendesk is a compact desktop file-transfer client for the `croc` CLI. It is a Wails v2 application with a React and Vite frontend and a Go backend. The frontend is a desktop application surface, not a browser marketing site.

## Project Map

- `frontend/src/App.tsx`: transfer UI and user interactions.
- `frontend/src/useCrocTransfer.ts`: frontend transfer state and Wails event subscription.
- `frontend/src/wails.ts`: typed wrapper for generated Wails bindings and runtime events.
- `frontend/src/styles.css`: application visual system and responsive layout.
- `app.go`: Wails-bound Go methods, native dialogs, and filesystem actions.
- `internal/croc/`: Croc process management, parsing, and transfer events.

## UI Principles

- Design for a resizable desktop window first, while retaining the current narrow-window layout. Avoid dashboard chrome, oversized cards, generic gradients, and web-only patterns.
- Treat send, receive, waiting, transfer, error, cancellation, and completion as first-class states. Do not hide transfer status, the Croc code, security context, or terminal errors behind ambiguous interactions.
- Keep native file and directory selection in Go through Wails runtime dialogs. The web UI must not assume browser filesystem APIs exist.
- Use semantic controls, visible keyboard focus, readable contrast, and buttons with explicit labels. Drag-and-drop is an enhancement, not the only way to select files.

## Wails Boundaries

- Keep TypeScript calls aligned with exported methods on `App`; update `frontend/src/wails.ts` and generated bindings through Wails when a Go method changes.
- Do not introduce a local HTTP API, browser-only storage for secrets, or staging uploads. Pass selected filesystem paths directly to Croc via the existing bridge.
- Croc codes are transfer secrets. Do not persist them, log them, or add telemetry around them.
- Preserve event-driven transfer updates via `croc:event`. Ensure subscriptions are cleaned up if their lifecycle changes.

## Validation

- For frontend changes, run `npm run typecheck` and `npm run build` from `frontend/`.
- For Go changes, run `go test ./...` from the repository root.
- Use `wails build` when the Wails shell, bindings, or native integration changes and the local environment supports it.
- Keep user-authored worktree changes intact. Do not reset, checkout, or overwrite unrelated work.
