import React, { useState, useRef, useEffect } from 'react';
import { Layout, Model, TabNode, Actions } from 'flexlayout-react';
import TerminalComponent from './components/TerminalComponent.jsx';
import EditorComponent from './components/EditorComponent.jsx';
import TopBar from './components/TopBar.jsx';
import { useFocusManager } from './hooks/useFocusManager.js';
import 'flexlayout-react/style/dark.css';
import './App.css';

const App = () => {
  const layoutRef = useRef(null);
  const [terminalCounter, setTerminalCounter] = useState(1);
  const [editorCounter, setEditorCounter] = useState(1);
  const [currentDragData, setCurrentDragData] = useState(null);
  const [model, setModel] = useState(null); // Initialize model as null
  const [editorStates, setEditorStates] = useState({}); // To store { editorId: { content: '', language: '' } }

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
                name: 'Terminal 1',
                component: 'terminal',
                id: 'terminal-1'
              }
            ]
          },
          {
            type: 'tabset',
            weight: 30,
            children: [
              {
                type: 'tab',
                name: 'Editor 1',
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
            let maxTerm = 0;
            let maxEdit = 0;

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
            setModel(Model.fromJson(loadedModelJson)); // Create the model instance for FlexLayout

            setTerminalCounter(maxTerm || 1); // Fallback to 1 if no tabs found or numbers are weird
            setEditorCounter(maxEdit || 1);   // Fallback to 1
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

  const factory = node => {
    if (!model) return null; // Model might not be ready yet
    const component = node.getComponent();
    const id = node.getId();

    switch (component) {
      case 'terminal':
        return (
          <TerminalComponent
            key={id}
            terminalId={id}
            onResize={(cols, rows) => handleTerminalResize(id, cols, rows)}
            registerFocusable={registerFocusable}
            unregisterFocusable={unregisterFocusable}
          />
        );
      case 'editor':
        return (
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
  const onExternalDrag = e => {
    console.log('onExternalDrag called:', e.dataTransfer.types);

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
        }
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

  return (
    <div className="app">
      {' '}
      <TopBar
        onAddTerminal={addNewTerminal}
        onAddEditor={addNewEditor}
        layoutRef={layoutRef}
        terminalCounter={terminalCounter}
        editorCounter={editorCounter}
        onUpdateCounters={onUpdateCounters}
        onStartDrag={onStartDrag}
      />
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
