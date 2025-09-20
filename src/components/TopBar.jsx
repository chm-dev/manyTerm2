import React, { useState } from 'react';

const TopBar = ({ onAddTerminal, onAddEditor, layoutRef, terminalCounter, editorCounter, onUpdateCounters, onStartDrag }) => {
  const [draggedComponent, setDraggedComponent] = useState(null);

  const componentTypes = [
    {
      type: 'terminal',
      name: 'Terminal',
      icon: '🖥️',
      description: 'Terminal Component'
    },
    {
      type: 'editor',
      name: 'Editor', 
      icon: '📝',
      description: 'Monaco Editor Component'
    }
  ];

  const handleWindowControl = (action) => {
    if (window.electronAPI) {
      window.electronAPI.windowControl(action);
    }
  };const handleDragStart = (e, componentType) => {
    console.log('Drag started for:', componentType);
    setDraggedComponent(componentType);
    
    // Create the tab configuration for FlexLayout using the next counter values
    const newCounter = componentType.type === 'terminal' ? 
      (terminalCounter + 1) :
      (editorCounter + 1);
    
    const tabJson = {
      type: "tab",
      name: `${componentType.name} ${newCounter}`,
      component: componentType.type,
      id: `${componentType.type}-${newCounter}`
    };
    
    console.log('Tab JSON for drag:', tabJson);
    
    // Update counters when drag starts
    if (onUpdateCounters) {
      onUpdateCounters(componentType.type, newCounter);
    }
    
    // Store the drag data for the external drag handler
    if (onStartDrag) {
      onStartDrag(tabJson);
    }
    
    // Set drag data in the format FlexLayout expects (like the demo)
    const dragData = "FlexLayoutTab:" + JSON.stringify(tabJson);
    e.dataTransfer.setData('text/plain', dragData);
    e.dataTransfer.effectAllowed = 'copy';
    
    console.log('Drag data set:', dragData);
  };

  const handleDragEnd = () => {
    setDraggedComponent(null);
  };

  const handleClick = (componentType) => {
    if (componentType.type === 'terminal') {
      onAddTerminal();
    } else if (componentType.type === 'editor') {
      onAddEditor();
    }
  };  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="top-bar-title">
          FlexClaude2
        </div>
        <div className="component-buttons">
          {componentTypes.map((component) => (
            <div
              key={component.type}
              className={`component-button ${draggedComponent?.type === component.type ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, component)}
              onDragEnd={handleDragEnd}
              onClick={() => handleClick(component)}
              title={`Click to add or drag to place ${component.description}`}
            >
              <span className="component-icon">{component.icon}</span>
              <span className="component-name">{component.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="top-bar-center">
        <div className="drag-hint">
          💡 Drag components to layout or click to add
        </div>
      </div>
      
      <div className="top-bar-right">
        <div className="window-controls">
          <button 
            className="window-control minimize"
            onClick={() => handleWindowControl('minimize')}
            title="Minimize"
          >
            ‒
          </button>
          <button 
            className="window-control maximize"
            onClick={() => handleWindowControl('maximize')}
            title="Maximize/Restore"
          >
            ⬜
          </button>
          <button 
            className="window-control close"
            onClick={() => handleWindowControl('close')}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
