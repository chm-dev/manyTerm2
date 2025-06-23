import React, { useState, useRef } from 'react';
import { Layout, Model, TabNode } from 'flexlayout-react';
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
            setModel(Model.fromJson(result.layoutJson));
            // Update counters based on loaded layout
            let maxTerm = 0;
            let maxEdit = 0;
            result.layoutJson.layout.children.forEach(tabset => {
              tabset.children.forEach(tab => {
                if (tab.component === 'terminal') {
                  const num = parseInt(tab.name.split(' ')[1]);
                  if (num > maxTerm) maxTerm = num;
                } else if (tab.component === 'editor') {
                  const num = parseInt(tab.name.split(' ')[1]);
                  if (num > maxEdit) maxEdit = num;
                }
              });
            });
            setTerminalCounter(maxTerm || 1);
            setEditorCounter(maxEdit || 1);
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
      console.log('Saving layout:', newModel.toJson());
      window.electronAPI.saveLayout(newModel.toJson());
    }
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
