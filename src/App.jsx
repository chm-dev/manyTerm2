import React, { useState, useRef } from 'react';
import { Layout, Model, TabNode } from 'flexlayout-react';
import TerminalComponent from './components/TerminalComponent.jsx';
import EditorComponent from './components/EditorComponent.jsx';
import TopBar from './components/TopBar.jsx';
import 'flexlayout-react/style/light.css';
import './App.css';

const App = () => {
  const layoutRef = useRef(null);
  const [terminalCounter, setTerminalCounter] = useState(1);
  const [editorCounter, setEditorCounter] = useState(1);
  const [currentDragData, setCurrentDragData] = useState(null);
  
  // Initial layout configuration
  const [model] = useState(() => {
    const json = {      global: {
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
        type: "row",
        weight: 100,
        children: [
          {
            type: "tabset",
            weight: 70,
            children: [
              {
                type: "tab",
                name: "Terminal 1",
                component: "terminal",
                id: "terminal-1"
              }
            ]
          },
          {
            type: "tabset",
            weight: 30,
            children: [
              {
                type: "tab",
                name: "Editor 1",
                component: "editor",
                id: "editor-1"
              }
            ]
          }
        ]
      }
    };
    return Model.fromJson(json);
  });

  const factory = (node) => {
    const component = node.getComponent();
    const id = node.getId();
    
    switch (component) {
      case 'terminal':
        return <TerminalComponent 
          key={id} 
          terminalId={id} 
          onResize={(cols, rows) => handleTerminalResize(id, cols, rows)}
        />;
      case 'editor':
        return <EditorComponent key={id} editorId={id} />;
      default:
        return <div>Unknown component: {component}</div>;
    }
  };  const handleTerminalResize = (terminalId, cols, rows) => {
    if (window.electronAPI) {
      window.electronAPI.resizeTerminal(terminalId, cols, rows);
    }
  };  const onExternalDrag = (e) => {
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
  };  const onUpdateCounters = (componentType, newCounter) => {
    if (componentType === 'terminal') {
      setTerminalCounter(newCounter);
    } else if (componentType === 'editor') {
      setEditorCounter(newCounter);
    }
  };

  const onStartDrag = (dragData) => {
    console.log('Setting current drag data:', dragData);
    setCurrentDragData(dragData);
  };

  const addNewTerminal = () => {
    const newCounter = terminalCounter + 1;
    setTerminalCounter(newCounter);
    
    layoutRef.current.addTabToActiveTabSet({
      type: "tab",
      name: `Terminal ${newCounter}`,
      component: "terminal",
      id: `terminal-${newCounter}`
    });
  };

  const addNewEditor = () => {
    const newCounter = editorCounter + 1;
    setEditorCounter(newCounter);
    
    layoutRef.current.addTabToActiveTabSet({
      type: "tab",
      name: `Editor ${newCounter}`,
      component: "editor",
      id: `editor-${newCounter}`
    });
  };  return (
    <div className="app">      <TopBar 
        onAddTerminal={addNewTerminal}
        onAddEditor={addNewEditor}
        layoutRef={layoutRef}
        terminalCounter={terminalCounter}
        editorCounter={editorCounter}
        onUpdateCounters={onUpdateCounters}
        onStartDrag={onStartDrag}
      /><div className="layout-container">
        <Layout
          ref={layoutRef}
          model={model}
          factory={factory}
          onExternalDrag={onExternalDrag}
        />
      </div>
    </div>
  );
};

export default App;
