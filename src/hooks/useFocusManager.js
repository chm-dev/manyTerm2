import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook to manage focus cycling between components
 * @param {Object} model - The FlexLayout model
 * @returns {Object} Focus management functions and state
 */
export const useFocusManager = (model) => {
  const focusableComponents = useRef(new Map());
  const currentFocusIndex = useRef(-1);
  const componentOrder = useRef([]);

  // Register a focusable component
  const registerFocusable = useCallback((componentId, focusFunction, componentType = 'unknown') => {
    focusableComponents.current.set(componentId, {
      focus: focusFunction,
      type: componentType,
      id: componentId
    });
    
    // Update the component order based on layout
    updateComponentOrder();
  }, []);

  // Unregister a focusable component
  const unregisterFocusable = useCallback((componentId) => {
    focusableComponents.current.delete(componentId);
    updateComponentOrder();
  }, []);

  // Update component order based on current layout
  const updateComponentOrder = useCallback(() => {
    if (!model) return;

    const newOrder = [];
      // Use model.visitNodes to traverse the layout
    try {
      model.visitNodes((node) => {
        if (node.getType() === 'tab') {
          const id = node.getId();
          if (focusableComponents.current.has(id)) {
            newOrder.push(id);
          }
        }
      });
    } catch (error) {
      console.warn('Error traversing layout nodes:', error);
    }

    componentOrder.current = newOrder;
  }, [model]);

  // Get currently visible/active tabs
  const getVisibleComponents = useCallback(() => {
    if (!model) return [];    const visibleIds = [];

    try {
      // Visit all nodes to find active tabs in tabsets
      model.visitNodes((node) => {
        if (node.getType() === 'tabset') {
          const selectedTab = node.getSelectedNode ? node.getSelectedNode() : null;
          if (selectedTab && focusableComponents.current.has(selectedTab.getId())) {
            visibleIds.push(selectedTab.getId());
          }
        }
      });
    } catch (error) {
      console.warn('Error getting visible components:', error);
    }

    return visibleIds;
  }, [model]);
  // Focus next component
  const focusNext = useCallback(() => {
    const visibleIds = getVisibleComponents();
    if (visibleIds.length === 0) return;

    // Find current focus index in visible components
    let nextIndex;
    if (currentFocusIndex.current === -1 || !visibleIds.includes(componentOrder.current[currentFocusIndex.current])) {
      // No current focus or current focus not visible, start from first visible
      nextIndex = 0;
    } else {
      // Find next visible component (round-robin)
      const currentId = componentOrder.current[currentFocusIndex.current];
      const currentVisibleIndex = visibleIds.indexOf(currentId);
      nextIndex = (currentVisibleIndex + 1) % visibleIds.length; // This already implements round-robin
    }

    const targetId = visibleIds[nextIndex];
    const component = focusableComponents.current.get(targetId);
    
    if (component && component.focus) {
      try {
        component.focus();
        currentFocusIndex.current = componentOrder.current.indexOf(targetId);
        console.log(`Focused component: ${targetId} (${component.type})`);
      } catch (error) {
        console.warn(`Failed to focus component ${targetId}:`, error);
      }
    }
  }, [getVisibleComponents]);

  // Focus previous component
  const focusPrevious = useCallback(() => {
    const visibleIds = getVisibleComponents();
    if (visibleIds.length === 0) return;

    // Find current focus index in visible components
    let prevIndex;
    if (currentFocusIndex.current === -1 || !visibleIds.includes(componentOrder.current[currentFocusIndex.current])) {
      // No current focus or current focus not visible, start from last visible
      prevIndex = visibleIds.length - 1;
    } else {
      // Find previous visible component (round-robin)
      const currentId = componentOrder.current[currentFocusIndex.current];
      const currentVisibleIndex = visibleIds.indexOf(currentId);
      prevIndex = currentVisibleIndex === 0 ? visibleIds.length - 1 : currentVisibleIndex - 1; // This already implements round-robin
    }

    const targetId = visibleIds[prevIndex];
    const component = focusableComponents.current.get(targetId);
    
    if (component && component.focus) {
      try {
        component.focus();
        currentFocusIndex.current = componentOrder.current.indexOf(targetId);
        console.log(`Focused component: ${targetId} (${component.type})`);
      } catch (error) {
        console.warn(`Failed to focus component ${targetId}:`, error);
      }
    }
  }, [getVisibleComponents]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+Tab - focus next component
      if (event.ctrlKey && event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        focusNext();
      }
      // Ctrl+Shift+Tab - focus previous component
      else if (event.ctrlKey && event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        focusPrevious();
      }
    };

    // Use capture phase to intercept events before they reach the terminal
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [focusNext, focusPrevious]);

  // Update component order when layout changes
  useEffect(() => {
    const interval = setInterval(() => {
      updateComponentOrder();
    }, 1000); // Check every second for layout changes

    return () => clearInterval(interval);
  }, [updateComponentOrder]);

  return {
    registerFocusable,
    unregisterFocusable,
    focusNext,
    focusPrevious,
    getVisibleComponents
  };
};
