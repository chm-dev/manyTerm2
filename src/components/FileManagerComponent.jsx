import React, { useState, useEffect, useRef } from 'react';
import { FileManager } from '@cubone/react-file-manager';
import '@cubone/react-file-manager/dist/style.css';

const FileManagerComponent = ({ 
  fileManagerId, 
  registerFocusable, 
  unregisterFocusable 
}) => {
  const containerRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize with some default files/folders (this could be replaced with actual file system integration)
  useEffect(() => {
    // Load initial file structure from Electron's file system
    loadFilesFromFileSystem('/');
  }, []);

  // Register this component for focus management
  useEffect(() => {
    if (registerFocusable && containerRef.current) {
      const focusableElement = {
        id: fileManagerId,
        element: containerRef.current,
        focus: () => {
          const fileManagerElement = containerRef.current.querySelector('[tabindex="0"]');
          if (fileManagerElement) {
            fileManagerElement.focus();
          }
        }
      };
      
      registerFocusable(focusableElement);
      
      return () => {
        if (unregisterFocusable) {
          unregisterFocusable(fileManagerId);
        }
      };
    }
  }, [fileManagerId, registerFocusable, unregisterFocusable]);

  const loadFilesFromFileSystem = async (path) => {
    setIsLoading(true);
    try {
      if (window.electronAPI && window.electronAPI.getDirectoryContents) {
        const result = await window.electronAPI.getDirectoryContents(path);
        if (result.success) {
          setFiles(result.files);
        } else {
          console.error('Failed to load directory contents:', result.error);
          // Fallback to demo data
          setFiles(getDemoFiles());
        }
      } else {
        // Fallback to demo data if Electron API is not available
        setFiles(getDemoFiles());
      }
    } catch (error) {
      console.error('Error loading files:', error);
      setFiles(getDemoFiles());
    }
    setIsLoading(false);
  };

  const getDemoFiles = () => [
    {
      name: "Documents",
      isDirectory: true,
      path: "/Documents",
      updatedAt: new Date().toISOString(),
    },
    {
      name: "Pictures",
      isDirectory: true,
      path: "/Pictures",
      updatedAt: new Date().toISOString(),
    },
    {
      name: "Downloads",
      isDirectory: true,
      path: "/Downloads",
      updatedAt: new Date().toISOString(),
    },
    {
      name: "example.txt",
      isDirectory: false,
      path: "/example.txt",
      updatedAt: new Date().toISOString(),
      size: 1024,
    },
    {
      name: "README.md",
      isDirectory: false,
      path: "/README.md",
      updatedAt: new Date().toISOString(),
      size: 2048,
    }
  ];

  const handleFileOpen = async (file) => {
    if (file.isDirectory) {
      // Navigate to directory
      await loadFilesFromFileSystem(file.path);
      setCurrentPath(file.path);
    } else {
      // Open file in editor or default application
      if (window.electronAPI && window.electronAPI.openFile) {
        await window.electronAPI.openFile(file.path);
      }
    }
  };

  const handleFolderChange = async (path) => {
    setCurrentPath(path);
    await loadFilesFromFileSystem(path);
  };

  const handleCreateFolder = async (name, parentFolder) => {
    setIsLoading(true);
    try {
      const newFolderPath = `${parentFolder.path === '/' ? '' : parentFolder.path}/${name}`;
      
      if (window.electronAPI && window.electronAPI.createFolder) {
        const result = await window.electronAPI.createFolder(newFolderPath);
        if (result.success) {
          // Refresh the current directory
          await loadFilesFromFileSystem(currentPath);
        } else {
          console.error('Failed to create folder:', result.error);
        }
      } else {
        // Demo mode - just add to local state
        const newFolder = {
          name,
          isDirectory: true,
          path: newFolderPath,
          updatedAt: new Date().toISOString(),
        };
        setFiles(prev => [...prev, newFolder]);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
    setIsLoading(false);
  };

  const handleDelete = async (filesToDelete) => {
    setIsLoading(true);
    try {
      if (window.electronAPI && window.electronAPI.deleteFiles) {
        const result = await window.electronAPI.deleteFiles(filesToDelete.map(f => f.path));
        if (result.success) {
          // Refresh the current directory
          await loadFilesFromFileSystem(currentPath);
        } else {
          console.error('Failed to delete files:', result.error);
        }
      } else {
        // Demo mode - remove from local state
        setFiles(prev => prev.filter(file => 
          !filesToDelete.some(deleteFile => deleteFile.path === file.path)
        ));
      }
    } catch (error) {
      console.error('Error deleting files:', error);
    }
    setIsLoading(false);
  };

  const handleRename = async (file, newName) => {
    setIsLoading(true);
    try {
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
      const newPath = `${parentPath}/${newName}`;
      
      if (window.electronAPI && window.electronAPI.renameFile) {
        const result = await window.electronAPI.renameFile(file.path, newPath);
        if (result.success) {
          // Refresh the current directory
          await loadFilesFromFileSystem(currentPath);
        } else {
          console.error('Failed to rename file:', result.error);
        }
      } else {
        // Demo mode - update local state
        setFiles(prev => prev.map(f => 
          f.path === file.path 
            ? { ...f, name: newName, path: newPath }
            : f
        ));
      }
    } catch (error) {
      console.error('Error renaming file:', error);
    }
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    await loadFilesFromFileSystem(currentPath);
  };

  const handleDownload = async (filesToDownload) => {
    try {
      if (window.electronAPI && window.electronAPI.downloadFiles) {
        await window.electronAPI.downloadFiles(filesToDownload.map(f => f.path));
      } else {
        console.log('Download would start for:', filesToDownload.map(f => f.name));
      }
    } catch (error) {
      console.error('Error downloading files:', error);
    }
  };

  const handleError = (error, file) => {
    console.error('File Manager Error:', error, 'File:', file);
  };

  return (
    <div 
      ref={containerRef}
      className="file-manager-container"
      style={{ 
        height: '100%', 
        width: '100%',
        overflow: 'hidden'
      }}
    >
      <FileManager
        files={files}
        height="100%"
        width="100%"
        initialPath={currentPath}
        isLoading={isLoading}
        layout="grid"
        collapsibleNav={true}
        defaultNavExpanded={true}
        enableFilePreview={true}
        fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        primaryColor="#6155b4"
        permissions={{
          create: true,
          upload: false, // Disable upload for now
          move: true,
          copy: true,
          rename: true,
          download: true,
          delete: true,
        }}
        onFileOpen={handleFileOpen}
        onFolderChange={handleFolderChange}
        onCreateFolder={handleCreateFolder}
        onDelete={handleDelete}
        onRename={handleRename}
        onRefresh={handleRefresh}
        onDownload={handleDownload}
        onError={handleError}
        onSelectionChange={(selectedFiles) => {
          console.log('Selected files:', selectedFiles);
        }}
      />
    </div>
  );
};

export default FileManagerComponent;