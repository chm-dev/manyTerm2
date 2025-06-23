import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

const EditorComponent = ({
  editorId,
  registerFocusable,
  unregisterFocusable,
  initialContent,
  onContentChange,
  initialLanguage,
  onLanguageChange
}) => {
  const [code, setCode] = useState(initialContent !== undefined ? initialContent : '// Welcome to FlexClaude Terminal Editor\n// Start typing your code here...\n\nfunction hello() {\n  console.log("Hello, World!");\n}\n\nhello();');
  const [language, setLanguage] = useState(initialLanguage || 'javascript');
  const editorRef = useRef(null);

  // Effect to update code when initialContent changes (e.g. loading from store after component is already mounted)
  useEffect(() => {
    if (initialContent !== undefined && initialContent !== code) {
      setCode(initialContent);
    }
  }, [initialContent]);

  useEffect(() => {
    if (initialLanguage && initialLanguage !== language) {
      setLanguage(initialLanguage);
    }
  }, [initialLanguage]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Set up the dark theme
    monaco.editor.defineTheme('vs-dark-custom', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#cccccc',
        'editorCursor.foreground': '#ffffff',
        'editor.lineHighlightBackground': '#2d2d30',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41'
      }
    });
    
    monaco.editor.setTheme('vs-dark-custom');
    
    // Set up auto-resize
    const resizeEditor = () => {
      editor.layout();
    };
    
    window.addEventListener('resize', resizeEditor);
    
    // Clean up event listener
    return () => {
      window.removeEventListener('resize', resizeEditor);
    };
  };

  const handleEditorChange = (value) => {
    const newCode = value || '';
    setCode(newCode);
    if (onContentChange) {
      onContentChange(editorId, newCode);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    if (onLanguageChange) {
      onLanguageChange(editorId, newLanguage);
    }
  };

  // Handle layout changes by triggering editor resize
  useEffect(() => {
    const handleLayoutResize = () => {
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 100);
    };

    window.addEventListener('resize', handleLayoutResize);
    
    // Also trigger on component mount
    handleLayoutResize();

    return () => {
      window.removeEventListener('resize', handleLayoutResize);    };
  }, []);

  // Register/unregister with focus manager
  useEffect(() => {
    if (registerFocusable && editorRef.current) {
      const focusFunction = () => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      };
      
      registerFocusable(editorId, focusFunction, 'editor');
      
      return () => {
        if (unregisterFocusable) {
          unregisterFocusable(editorId);
        }
      };
    }
  }, [editorId, registerFocusable, unregisterFocusable, editorRef.current]);

  const languages = [
    'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c',
    'html', 'css', 'json', 'xml', 'markdown', 'sql', 'php', 'go', 'rust'
  ];

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#1e1e1e'
    }}>
      <div style={{ 
        height: '30px', 
        backgroundColor: '#2d2d30', 
        borderBottom: '1px solid #3e3e42',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: '10px'
      }}>
        <label style={{ color: '#cccccc', fontSize: '12px' }}>Language:</label>
        <select 
          value={language} 
          onChange={(e) => handleLanguageChange(e.target.value)}
          style={{
            backgroundColor: '#3c3c3c',
            color: '#cccccc',
            border: '1px solid #3e3e42',
            padding: '2px 5px',
            fontSize: '12px',
            borderRadius: '3px'
          }}
        >
          {languages.map(lang => (
            <option key={lang} value={lang}>
              {lang.charAt(0).toUpperCase() + lang.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark-custom"          options={{
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            renderLineHighlight: 'all',
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: 'line'
          }}
        />
      </div>
    </div>
  );
};

export default EditorComponent;
