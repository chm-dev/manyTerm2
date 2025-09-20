import React from 'react';

const TestDragButton = () => {
  const handleDragStart = (e) => {
    console.log('Test drag started');
    e.dataTransfer.setData('text/plain', 'test-drag-data');
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    console.log('Drag over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    console.log('Dropped:', data);
  };

  return (
    <div>
      <button 
        draggable 
        onDragStart={handleDragStart}
        style={{ 
          padding: '10px', 
          margin: '10px', 
          backgroundColor: '#007acc', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px' 
        }}
      >
        Test Drag Button
      </button>
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ 
          width: '200px', 
          height: '100px', 
          border: '2px dashed #ccc', 
          margin: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        Drop Zone
      </div>
    </div>
  );
};

export default TestDragButton;
