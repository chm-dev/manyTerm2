import React, { useState, useRef } from 'react';
import { Layout, Model, TabNode } from 'flexlayout-react';
import TerminalComponent from './components/TerminalComponent.jsx';
import EditorComponent from './components/EditorComponent.jsx';
import 'flexlayout-react/style/light.css';
import './App.css';

const App = () => {
  const layoutRef = useRef(null);
  
  // Initial layout configuration
  const [model] = useState(() => {
    const json = {
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
  };

  const handleTerminalResize = (terminalId, cols, rows) => {
    if (window.electronAPI) {
      window.electronAPI.resizeTerminal(terminalId, cols, rows);
    }
  };

  const addNewTerminal = () => {
    const terminalCount = model.getNodeById('terminal-1') ? 
      model.toJson().layout.children.filter(child => 
        child.children?.some(tab => tab.component === 'terminal')
      ).reduce((count, tabset) => 
        count + tabset.children.filter(tab => tab.component === 'terminal').length, 0
      ) : 0;
    
    const newTerminalId = `terminal-${terminalCount + 1}`;
    
    layoutRef.current.addTabToActiveTabSet({
      type: "tab",
      name: `Terminal ${terminalCount + 1}`,
      component: "terminal",
      id: newTerminalId
    });
  };

  const addNewEditor = () => {
    const editorCount = model.getNodeById('editor-1') ? 
      model.toJson().layout.children.filter(child => 
        child.children?.some(tab => tab.component === 'editor')
      ).reduce((count, tabset) => 
        count + tabset.children.filter(tab => tab.component === 'editor').length, 0
      ) : 0;
    
    const newEditorId = `editor-${editorCount + 1}`;
    
    layoutRef.current.addTabToActiveTabSet({
      type: "tab",
      name: `Editor ${editorCount + 1}`,
      component: "editor",
      id: newEditorId
    });
  };

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={addNewTerminal} className="toolbar-button">
          + Terminal
        </button>
        <button onClick={addNewEditor} className="toolbar-button">
          + Editor
        </button>
      </div>
      <div className="layout-container">
        <Layout
          ref={layoutRef}
          model={model}
          factory={factory}
        />
      </div>
    </div>
  );
};

export default App;
