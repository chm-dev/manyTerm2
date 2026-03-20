import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { Layout, Model, TabNode, Actions } from 'flexlayout-react';
import { useFocusManager } from './hooks/useFocusManager.js';
import './scss/style.scss';

const TerminalComponent = lazy(() => import('./components/TerminalComponent.jsx'));
const EditorComponent = lazy(() => import('./components/EditorComponent.jsx'));
const SpreadsheetComponent = lazy(() => import('./components/SpreadsheetComponent.jsx'));
const TopBar = lazy(() => import('./components/TopBar.jsx'));

const normalizeSpreadsheetData = (rawData) => {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return [{ name: 'Sheet1' }];
  }

  return rawData.map((sheet, index) => ({
    ...sheet,
    name: sheet?.name || `Sheet${index + 1}`,
    data: Array.isArray(sheet?.data) ? sheet.data : [],
  }));
};

const App = () => {
  const layoutRef = useRef(null);
  const [terminalCounter, setTerminalCounter] = useState(1);
  const [editorCounter, setEditorCounter] = useState(1);
  const [spreadsheetCounter, setSpreadsheetCounter] = useState(1);
  const [currentDragData, setCurrentDragData] = useState(null);
  const currentShellDragIdRef = useRef(null); // Stores shell ID during drag (getData() is restricted during dragover)
  const spreadsheetStatesRef = useRef({});
  const [model, setModel] = useState(null); // Initialize model as null
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [editorStates, setEditorStates] = useState({}); // To store { editorId: { content: '', language: '' } }
  const [spreadsheetStates, setSpreadsheetStates] = useState({}); // To store { spreadsheetId: { data: [] } }
  const [isTopBarVisible, setIsTopBarVisible] = useState(false); // Top bar hidden by default

  // Default layout configuration
  const defaultJson = {
    global: {
      tabEnableClose: true,
        tabEnableRename: true,
        tabSetEnableClose: false,
        tabSetEnableDrop: true,
        tabSetEnableDrag: true,
        tabSetEnableRename: false,
        borderEnableDrop: true
      },
      borders: [],
      layout: {
        type: 'row',
        weight: 100,
        children: [
          {
            type: 'tabset',
            weight: 70,
            children: [
               {
                 type: 'tab',
                 name: 'terminal',
                 component: 'terminal',
                 id: 'terminal-1',
                 config: {
                   shellId: 'cmd'
                 }
               }
            ]
          },
          {
            type: 'tabset',
            weight: 30,
            children: [
              {
                type: 'tab',
                name: 'editor',
                component: 'editor',
                id: 'editor-1'
              }
            ]
          }
        ]
      }    };
    // Don't create model fromJson here yet
  // }); REMOVE THIS

  // Initialize focus manager
  const { registerFocusable, unregisterFocusable } = useFocusManager(model);

  useEffect(() => {
    const loadLayout = async () => {
      if (window.electronAPI && window.electronAPI.loadLayout) {
        try {
          const result = await window.electronAPI.loadLayout();
          if (result.success && result.layoutJson) {
            console.log('Loaded layout from store:', result.layoutJson);
            const loadedModelJson = result.layoutJson; // Work with the raw JSON

            const newEditorStates = {};
            const newSpreadsheetStates = {};
            let maxTerm = 0;
            let maxEdit = 0;
            let maxSpreadsheet = 0;

            // Recursive function to traverse the layout JSON
            const processNodeConfig = (node) => {
              if (node.type === 'tab') { // In JSON, it's 'type', not getNodeType()
                if (node.component === 'editor') {
                  const editorId = node.id;
                  // Ensure config exists and has the properties before trying to access them
                  if (node.config && (node.config.editorContent !== undefined || node.config.editorLanguage !== undefined)) {
                    newEditorStates[editorId] = {
                      content: node.config.editorContent || '', // Default to empty string if undefined
                      language: node.config.editorLanguage || 'javascript' // Default language
                    };
                  }
                  // Extract number from name for counter
                  const nameParts = node.name.split(' ');
                  const num = parseInt(nameParts[nameParts.length - 1]);
                  if (!isNaN(num) && num > maxEdit) maxEdit = num;

                } else if (node.component === 'terminal') {
                  const nameParts = node.name.split(' ');
                  const num = parseInt(nameParts[nameParts.length - 1]);
                  if (!isNaN(num) && num > maxTerm) maxTerm = num;
                } else if (node.component === 'spreadsheet') {
                  const spreadsheetId = node.id;
                  if (node.config && node.config.spreadsheetData !== undefined) {
                    newSpreadsheetStates[spreadsheetId] = {
                      data: normalizeSpreadsheetData(node.config.spreadsheetData)
                    };
                  }

                  const nameParts = node.name.split(' ');
                  const num = parseInt(nameParts[nameParts.length - 1]);
                  if (!isNaN(num) && num > maxSpreadsheet) maxSpreadsheet = num;
                }
              }
              if (node.children) {
                node.children.forEach(processNodeConfig);
              }
            };

            // Start processing from the main layout children or root
            if (loadedModelJson.layout && loadedModelJson.layout.children) {
              loadedModelJson.layout.children.forEach(processNodeConfig);
            } else if (loadedModelJson.layout) { // Handle cases where layout might be a single tabset/tab
                processNodeConfig(loadedModelJson.layout)
            }


            setEditorStates(newEditorStates);
            setSpreadsheetStates(newSpreadsheetStates);
            spreadsheetStatesRef.current = newSpreadsheetStates;
            setModel(Model.fromJson(loadedModelJson)); // Create the model instance for FlexLayout

            setTerminalCounter(maxTerm || 1); // Fallback to 1 if no tabs found or numbers are weird
            setEditorCounter(maxEdit || 1);
            setSpreadsheetCounter(maxSpreadsheet || 1);   // Fallback to 1
            return;
          } else if (result.error) {
            console.error('Failed to load layout:', result.error);
          }
        } catch (err) {
          console.error('Error calling loadLayout:', err);
        }
      }
      // If load failed or no saved layout, use default
      console.log('Using default layout');
      setModel(Model.fromJson(defaultJson));
      setTerminalCounter(1); // Reset counters for default layout
      setEditorCounter(1);   // Reset counters for default layout
    };
    loadLayout();
  }, []); // Empty dependency array ensures this runs only once on mount

// Keyboard shortcut handler for Ctrl+T to toggle top bar
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 't') {
        event.preventDefault();
        event.stopPropagation();
        setIsTopBarVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const factory = node => {
    if (!model) return null; // Model might not be ready yet
    const component = node.getComponent();
    const id = node.getId();
    const config = node.getConfig();

    switch (component) {
      case 'terminal':
        return (
          <Suspense fallback={<div className="terminal-container" />}>
            <TerminalComponent
              key={id}
              terminalId={id}
              shellId={config?.shellId}
              onResize={(cols, rows) => handleTerminalResize(id, cols, rows)}
              onProcessExit={handleTerminalProcessExit}
              registerFocusable={registerFocusable}
              unregisterFocusable={unregisterFocusable}
            />
          </Suspense>
        );
      case 'editor':
        return (
          <Suspense fallback={<div className="editor-container" />}>
            <EditorComponent
              key={id}
              editorId={id}
              registerFocusable={registerFocusable}
              unregisterFocusable={unregisterFocusable}
              initialContent={editorStates[id]?.content}
              initialLanguage={editorStates[id]?.language}
              onContentChange={handleEditorContentChange}
              onLanguageChange={handleEditorLanguageChange}
            />
          </Suspense>
        );
      case 'spreadsheet':
        return (
          <Suspense fallback={<div className="spreadsheet-container" />}>
            <SpreadsheetComponent
              key={id}
              spreadsheetId={id}
              layoutRevision={layoutRevision}
              initialData={spreadsheetStates[id]?.data}
              onDataChange={handleSpreadsheetDataChange}
              registerFocusable={registerFocusable}
              unregisterFocusable={unregisterFocusable}
            />
          </Suspense>
        );
      default:
        return <div>Unknown component: {component}</div>;
    }
  };
  const handleTerminalResize = (terminalId, cols, rows) => {
    if (window.electronAPI) {
      window.electronAPI.resizeTerminal(terminalId, cols, rows);
    }
  };

  const handleTerminalProcessExit = (terminalId) => {
    if (!model) return;
    const node = model.getNodeById(terminalId);
    if (node) {
      model.doAction(Actions.deleteTab(terminalId));
    }
  };
  const onExternalDrag = e => {
    // Check if this is a shell button drag
    if (e.dataTransfer.types.includes('application/shellid')) {
      e.dataTransfer.dropEffect = 'copy';

      // NOTE: dataTransfer.getData() returns empty string during dragover (browser security restriction).
      // We use currentShellDragIdRef which was populated during the dragstart event instead.
      const shellId = currentShellDragIdRef.current;

      const tabJson = {
        type: 'tab',
        name: 'Terminal',
        component: 'terminal',
        id: `terminal-${Date.now()}`,
        config: {
          shellId: shellId
        }
      };

      return {
        json: tabJson,
        onDrop: (node, event) => {
          currentShellDragIdRef.current = null;
        }
      };
    }

    // Check if this is our FlexLayout tab drag
    if (e.dataTransfer.types.includes('text/plain') && currentDragData) {
      console.log('Using stored drag data:', currentDragData);

      // Set the drop effect
      e.dataTransfer.dropEffect = 'copy';

      // Return the configuration for FlexLayout
      return {
        json: currentDragData,
        onDrop: (node, event) => {
          console.log('External drag completed:', node);
          setCurrentDragData(null); // Clear the drag data
        }
      };
    }

    return undefined;
  };
  const onUpdateCounters = (componentType, newCounter) => {
    if (componentType === 'terminal') {
      setTerminalCounter(newCounter);
    } else if (componentType === 'editor') {
      setEditorCounter(newCounter);
    } else if (componentType === 'spreadsheet') {
      setSpreadsheetCounter(newCounter);
    }
  };

  const onStartDrag = dragData => {
    console.log('Setting current drag data:', dragData);
    setCurrentDragData(dragData);
  };

  const addNewTerminal = () => {
    const newCounter = terminalCounter + 1;
    setTerminalCounter(newCounter);

    layoutRef.current.addTabToActiveTabSet({
      type: 'tab',
      name: `Terminal ${newCounter}`,
      component: 'terminal',
      id: `terminal-${newCounter}`
    });
  };

  const addNewEditor = () => {
    const newCounter = editorCounter + 1;
    setEditorCounter(newCounter);

    layoutRef.current.addTabToActiveTabSet({
      type: 'tab',
      name: `Editor ${newCounter}`,
      component: 'editor',
      id: `editor-${newCounter}`
    });
  };

  const addNewSpreadsheet = () => {
    const newCounter = spreadsheetCounter + 1;
    setSpreadsheetCounter(newCounter);

    layoutRef.current.addTabToActiveTabSet({
      type: 'tab',
      name: `Spreadsheet ${newCounter}`,
      component: 'spreadsheet',
      id: `spreadsheet-${newCounter}`
    });
  };

  const addSplitTerminal = (shellId) => {
    const newCounter = terminalCounter + 1;
    setTerminalCounter(newCounter);

    layoutRef.current.addSplitToActiveNode({
      type: 'tab',
      name: `Terminal ${newCounter}`,
      component: 'terminal',
      id: `terminal-${newCounter}`,
      config: {
        shellId: shellId
      }
    }, 'row', -1, true);
  };

  const handleModelChange = (newModel) => {
    if (window.electronAPI && window.electronAPI.saveLayout) {
      // Before saving, embed editor states into the model
      // The 'newModel' is the current model from FlexLayout's perspective
      const jsonOutput = newModel.toJson();

      // Recursive function to update config within the JSON structure
      const updateNodeInJson = (nodeJson) => {
        if (nodeJson.type === 'tab' && nodeJson.component === 'editor') {
          const editorId = nodeJson.id;
          if (editorStates[editorId]) { // If we have state for this editor
            nodeJson.config = { ...(nodeJson.config || {}) }; // Ensure config object exists
            nodeJson.config.editorContent = editorStates[editorId].content;
            nodeJson.config.editorLanguage = editorStates[editorId].language;
          }
        } else if (nodeJson.type === 'tab' && nodeJson.component === 'spreadsheet') {
          const spreadsheetId = nodeJson.id;
          const spreadsheetState = spreadsheetStatesRef.current[spreadsheetId] || spreadsheetStates[spreadsheetId];
          if (spreadsheetState) {
            nodeJson.config = { ...(nodeJson.config || {}) };
            nodeJson.config.spreadsheetData = spreadsheetState.data;
          }
        }
        // Note: shellId is already in the config from when we create the terminal
        // No need to update it here - it's preserved from creation
        if (nodeJson.children) {
          nodeJson.children.forEach(updateNodeInJson);
        }
      };

      // Apply the updates to the layout part of the JSON
      if (jsonOutput.layout && jsonOutput.layout.children) {
        jsonOutput.layout.children.forEach(updateNodeInJson);
      } else if (jsonOutput.layout) { // Handle cases like a single tabset or tab at the root
        updateNodeInJson(jsonOutput.layout);
      }

      // console.log('Saving layout via onModelChange with editor states:', jsonOutput);
      window.electronAPI.saveLayout(jsonOutput);
    }

    setLayoutRevision(prevRevision => prevRevision + 1);
  };

  const handleEditorContentChange = (editorId, content) => {
    setEditorStates(prevStates => {
      const newEditorStates = {
        ...prevStates,
        [editorId]: {
          ...(prevStates[editorId] || { language: 'javascript' }), // Default language if new
          content
        }
      };

      // Use the 'model' state variable directly
      if (model && window.electronAPI && window.electronAPI.saveLayout) {
        const jsonToSave = model.toJson();

        const updateNodeRecursively = (nodeJson) => {
            if (nodeJson.type === 'tab' && nodeJson.component === 'editor') {
                const currentTabId = nodeJson.id;
                if (newEditorStates[currentTabId]) { // Use data from newEditorStates
                    nodeJson.config = { ...(nodeJson.config || {}),
                                        editorContent: newEditorStates[currentTabId].content,
                                        editorLanguage: newEditorStates[currentTabId].language };
                }
            }
            if (nodeJson.children) {
                nodeJson.children.forEach(updateNodeRecursively);
            }
        };
        if (jsonToSave.layout && jsonToSave.layout.children) { jsonToSave.layout.children.forEach(updateNodeRecursively); }
        else if (jsonToSave.layout) { updateNodeRecursively(jsonToSave.layout); }

        // console.log('Saving layout due to editor content change:', jsonToSave);
        window.electronAPI.saveLayout(jsonToSave);
      }
      return newEditorStates;
    });
  };

  const handleEditorLanguageChange = (editorId, language) => {
    setEditorStates(prevStates => {
      const newEditorStates = {
        ...prevStates,
        [editorId]: {
          ...(prevStates[editorId] || { content: '' }), // Default content if new
          language
        }
      };

      // Use the 'model' state variable directly
      if (model && window.electronAPI && window.electronAPI.saveLayout) {
        const jsonToSave = model.toJson();

        const updateNodeRecursively = (nodeJson) => {
            if (nodeJson.type === 'tab' && nodeJson.component === 'editor') {
                const currentTabId = nodeJson.id;
                if (newEditorStates[currentTabId]) { // Use data from newEditorStates
                    nodeJson.config = { ...(nodeJson.config || {}),
                                        editorContent: newEditorStates[currentTabId].content,
                                        editorLanguage: newEditorStates[currentTabId].language };
                }
            }
            if (nodeJson.children) {
                nodeJson.children.forEach(updateNodeRecursively);
            }
        };
        if (jsonToSave.layout && jsonToSave.layout.children) { jsonToSave.layout.children.forEach(updateNodeRecursively); }
        else if (jsonToSave.layout) { updateNodeRecursively(jsonToSave.layout); }

        // console.log('Saving layout due to editor language change:', jsonToSave);
        window.electronAPI.saveLayout(jsonToSave);
      }
      return newEditorStates;
    });
  };

  const handleSpreadsheetDataChange = useCallback((spreadsheetId, data) => {
    const normalizedData = normalizeSpreadsheetData(data);
    const previousData = spreadsheetStatesRef.current[spreadsheetId]?.data;
    if (previousData === normalizedData) {
      return;
    }

    const previousJson = previousData ? JSON.stringify(previousData) : '';
    const nextJson = JSON.stringify(normalizedData);
    if (previousJson === nextJson) {
      return;
    }

    spreadsheetStatesRef.current = {
      ...spreadsheetStatesRef.current,
      [spreadsheetId]: {
        data: normalizedData
      }
    };

    if (model && window.electronAPI && window.electronAPI.saveLayout) {
      const jsonToSave = model.toJson();

      const updateNodeRecursively = (nodeJson) => {
        if (nodeJson.type === 'tab' && nodeJson.component === 'spreadsheet') {
          const currentTabId = nodeJson.id;
          const spreadsheetState = spreadsheetStatesRef.current[currentTabId];
          if (spreadsheetState) {
            nodeJson.config = {
              ...(nodeJson.config || {}),
              spreadsheetData: spreadsheetState.data
            };
          }
        }

        if (nodeJson.children) {
          nodeJson.children.forEach(updateNodeRecursively);
        }
      };

      if (jsonToSave.layout && jsonToSave.layout.children) {
        jsonToSave.layout.children.forEach(updateNodeRecursively);
      } else if (jsonToSave.layout) {
        updateNodeRecursively(jsonToSave.layout);
      }

      window.electronAPI.saveLayout(jsonToSave);
    }
  }, [model]);

  return (
    <div className={`app ${isTopBarVisible ? 'top-bar-visible' : 'top-bar-hidden'}`}>
      {isTopBarVisible && (
        <Suspense fallback={null}>
          <TopBar
            onAddTerminal={addNewTerminal}
            onAddEditor={addNewEditor}
            onAddSpreadsheet={addNewSpreadsheet}
            onAddSplitTerminal={addSplitTerminal}
            layoutRef={layoutRef}
            terminalCounter={terminalCounter}
            editorCounter={editorCounter}
            spreadsheetCounter={spreadsheetCounter}
            onUpdateCounters={onUpdateCounters}
            onStartDrag={onStartDrag}
            onShellDragStart={(shellId) => { currentShellDragIdRef.current = shellId; }}
          />
        </Suspense>
      )}
      <div className="layout-container">
        {model && (
          <Layout
            ref={layoutRef}
            model={model}
            factory={factory}
            onExternalDrag={onExternalDrag}
            onModelChange={handleModelChange}
          />
        )}
      </div>
    </div>
  );
};

export default App;
