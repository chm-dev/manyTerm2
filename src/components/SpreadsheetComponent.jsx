import React, { useCallback, useEffect, useRef } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';

const DEFAULT_SHEET_FONT_SIZE = 12;

// Convert fortune-sheet's internal 2D data array back to the flat celldata format
// that fortune-sheet uses for initialization ({r, c, v} entries).
const dataToCelldata = (data) => {
  if (!Array.isArray(data)) return [];
  const celldata = [];
  for (let r = 0; r < data.length; r++) {
    if (!data[r]) continue;
    for (let c = 0; c < data[r].length; c++) {
      if (data[r][c] != null) {
        celldata.push({ r, c, v: data[r][c] });
      }
    }
  }
  return celldata;
};

const SpreadsheetComponent = ({
  spreadsheetId,
  layoutRevision,
  initialData,
  onDataChange,
  registerFocusable,
  unregisterFocusable,
}) => {
  const containerRef = useRef(null);
  const workbookRef = useRef(null);
  const resizeRafRef = useRef(null);
  const persistRafRef = useRef(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const initialDataRef = useRef(
    initialData && initialData.length > 0 ? initialData : [{ name: 'Sheet1' }]
  );


  const persistWorkbookData = useCallback(() => {
    const workbookApi = workbookRef.current;
    if (!workbookApi || typeof workbookApi.getAllSheets !== 'function') {
      return;
    }

    const nextData = workbookApi.getAllSheets();
    if (!nextData) {
      return;
    }

    const persistedData = nextData.map((sheet, index) => {
      const sheetData = Array.isArray(sheet?.data) ? sheet.data : [];
      return {
        ...sheet,
        name: sheet?.name || `Sheet${index + 1}`,
        data: sheetData,
        // fortune-sheet initializes from celldata ({r,c,v} flat array), not data (2D array).
        // We must convert and persist celldata so the sheet restores correctly on reload.
        celldata: dataToCelldata(sheetData),
      };
    });

    if (onDataChange) {
      onDataChange(spreadsheetId, persistedData);
    }
  }, [spreadsheetId, onDataChange]);

  const scheduleWorkbookPersist = useCallback(() => {
    if (persistRafRef.current) {
      clearTimeout(persistRafRef.current);
    }

    // Use setTimeout instead of requestAnimationFrame: onOp fires inside React's
    // setState updater, so the new context hasn't been committed to ref.current yet.
    // setTimeout (macrotask) fires after React completes its render + useLayoutEffect.
    persistRafRef.current = setTimeout(() => {
      persistWorkbookData();
    }, 50);
  }, [persistWorkbookData]);

  const triggerSpreadsheetResize = useCallback(() => {
    if (resizeRafRef.current) {
      cancelAnimationFrame(resizeRafRef.current);
    }

    resizeRafRef.current = requestAnimationFrame(() => {
      // fortune-sheet listens for native window resize events internally.
      // Dispatching a synthetic resize notifies it when only the flex panel resizes.
      window.dispatchEvent(new Event('resize'));
    });
  }, []);

  useEffect(() => {
    if (registerFocusable && containerRef.current) {
      const focusFunction = () => {
        const focusTarget = containerRef.current.querySelector('textarea, [contenteditable="true"], .luckysheet-grid-window');
        if (focusTarget) {
          focusTarget.focus();
          return;
        }
        containerRef.current.focus();
      };

      registerFocusable(spreadsheetId, focusFunction, 'spreadsheet');

      return () => {
        if (unregisterFocusable) {
          unregisterFocusable(spreadsheetId);
        }
      };
    }

    return undefined;
  }, [spreadsheetId, registerFocusable, unregisterFocusable]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      const { width: prevWidth, height: prevHeight } = lastSizeRef.current;

      if (width === prevWidth && height === prevHeight) {
        return;
      }

      lastSizeRef.current = { width, height };
      triggerSpreadsheetResize();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current);
      }
    };
  }, [triggerSpreadsheetResize]);

  useEffect(() => {
    triggerSpreadsheetResize();
  }, [layoutRevision, triggerSpreadsheetResize]);

  useEffect(() => {
    return () => {
      if (persistRafRef.current) {
        clearTimeout(persistRafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="spreadsheet-container"
      tabIndex={0}
    >
      <Workbook
        ref={workbookRef}
        data={initialDataRef.current}
        defaultFontSize={DEFAULT_SHEET_FONT_SIZE}
        onOp={scheduleWorkbookPersist}
      />
    </div>
  );
};

export default SpreadsheetComponent;
