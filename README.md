# FlexClaude Terminal

A flexible terminal emulator with a drag-and-drop interface, built with Electron and React. This application allows users to arrange terminal and code editor components within a customizable layout.

## Features

*   **Dynamic Layout:** Utilize a drag-and-drop interface powered by FlexLayout to arrange your workspace.
*   **Integrated Terminal:** Embed multiple terminal instances using Xterm.js.
*   **Code Editor:** Includes a Monaco-based code editor for quick edits and viewing files.
*   **Persistent State:** Saves your layout and editor content automatically.
*   **Component Management:** Easily add new terminal or editor tabs.

## Tech Stack

*   **Electron:** For building the cross-platform desktop application.
*   **React:** For building the user interface.
*   **Vite:** As the frontend build tool and development server.
*   **FlexLayout (React):** For the draggable and resizable grid layout.
*   **Xterm.js:** For the integrated terminal emulator.
*   **Monaco Editor (React):** For the integrated code editor.
*   **@lydell/node-pty:** For Node.js pseudo-terminal support, enabling communication with underlying shell processes.

## Development Setup

To set up the project for development and run it on your local machine, follow these steps.

### Prerequisites

*   **Node.js:** v18.x or later recommended.
*   **npm:** Comes bundled with Node.js.
*   **Git:** For cloning the repository.

You will also need to install the project dependencies after cloning the repository:
```bash
# Navigate to the project directory first
npm install
```

### Running the Application

Once prerequisites are met and dependencies are installed, run the application in development mode:

```bash
npm run dev
```
This command concurrently starts the Vite development server for the React frontend and the Electron application. Wait for the Vite server to start (you'll see a message like `VITE vX.Y.Z  ready in XXX ms`) before the Electron window appears.

## Building the Application

To build the application for production:

1.  **Build the React frontend:**
    This step bundles and optimizes the React code.
    ```bash
    npm run build
    ```
    The output will be placed in the `dist/build` directory (or similar, check `vite.config.js`).

2.  **Package the Electron application:**
    This step takes the built frontend and packages it into an executable for your platform using Electron Builder.
    ```bash
    npm run build:electron
    ```
    The packaged application will be found in the `dist` directory (or as specified in `package.json` under `build.directories.output`).

## Project Structure

A brief overview of the key directories:

*   `.github/`: Contains GitHub specific files, like workflow configurations or issue templates.
    *   `copilot-instructions.md`: Instructions for AI code generation tools.
*   `dist/`: This directory will contain the packaged application after running `npm run build:electron`.
*   `node_modules/`: Contains all the npm dependencies.
*   `src/`: Contains the source code for the Electron application's renderer process (React frontend) and main process.
    *   `components/`: React components used to build the UI (e.g., `TerminalComponent.jsx`, `EditorComponent.jsx`).
    *   `hooks/`: Custom React hooks (e.g., `useFocusManager.js`).
    *   `App.jsx`: The main React application component orchestrating the layout and components.
    *   `main.js`: The entry point for Electron's main process. Handles window creation, IPC, etc.
    *   `preload.js`: Electron preload script for securely exposing Node.js/Electron APIs to the renderer process.
*   `index.html`: The main HTML file for the React application.
*   `package.json`: Lists project dependencies and defines scripts.
*   `vite.config.js`: Configuration file for Vite.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details (if one exists), or refer to the `license` field in `package.json`.
