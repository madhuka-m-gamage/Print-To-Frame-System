import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, CheckSquare, Square, MinusSquare } from 'lucide-react';

/**
 * Standardized Sortable and Filterable Data Table for list views.
 */
export default function SortableTable({
  columns = [],
  data = [],
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  idKey = 'id',
  emptyMessage = 'No records found.',
  bulkActions,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find(c => c.key === sortKey);
    return [...data].sort((a, b) => {
      let valA = typeof col?.accessor === 'function' ? col.accessor(a) : a[sortKey];
      let valB = typeof col?.accessor === 'function' ? col.accessor(b) : b[sortKey];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortKey, sortDirection, columns]);

  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < data.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      onSelectionChange && onSelectionChange([]);
    } else {
      onSelectionChange && onSelectionChange(data.map(d => d[idKey] || d._firestoreId));
    }
  };

  const toggleSelectRow = (id, e) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      {/* Floating Bulk Actions Toolbar */}
      {selectable && selectedIds.length > 0 && (
        <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between shadow-[0_0_20px_rgba(0,218,243,0.15)] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <CheckSquare size={16} />
            <span>{selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions}
            <button
              onClick={() => onSelectionChange && onSelectionChange([])}
              className="text-[10px] font-bold text-on-surface-variant hover:text-on-surface px-2 py-1 rounded bg-surface-container border border-outline-variant"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-xl border border-outline overflow-hidden bg-surface-container shadow-md">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container-high border-b-2 border-outline text-xs uppercase font-extrabold text-on-surface tracking-wider">
                {selectable && (
                  <th className="p-3 w-10 text-center" scope="col">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      aria-label="Select all rows"
                      aria-checked={allSelected ? "true" : someSelected ? "mixed" : "false"}
                      className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center p-1 rounded min-w-[28px] min-h-[28px] focus-visible:ring-2 focus-visible:ring-primary mx-auto"
                    >
                      {allSelected ? (
                        <CheckSquare size={14} className="text-primary" />
                      ) : someSelected ? (
                        <MinusSquare size={14} className="text-primary" />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </th>
                )}
                {columns.map(col => {
                  const isSorted = sortKey === col.key;
                  const ariaSortValue = isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={col.sortable !== false ? ariaSortValue : undefined}
                      className={`p-3 font-extrabold ${col.className || ''}`}
                    >
                      {col.sortable !== false ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className={`flex items-center gap-1.5 w-full uppercase tracking-wider font-extrabold cursor-pointer select-none hover:text-on-surface transition-colors focus-visible:ring-2 focus-visible:ring-primary rounded ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}
                        >
                          <span>{col.label}</span>
                          <span className="opacity-60" aria-hidden="true">
                            {isSorted ? (
                              sortDirection === 'asc' ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />
                            ) : (
                              <ChevronsUpDown size={11} />
                            )}
                          </span>
                          <span className="sr-only">
                            {isSorted ? `, sorted ${ariaSortValue}` : ', not sorted'}
                          </span>
                        </button>
                      ) : (
                        <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                          <span>{col.label}</span>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0)} className="p-8 text-center text-on-surface-variant">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedData.map((row, idx) => {
                  const rowId = row[idKey] || row._firestoreId || idx;
                  const isSelected = selectedIds.includes(rowId);
                  return (
                    <tr
                      key={rowId}
                      onClick={() => onRowClick && onRowClick(row)}
                      onKeyDown={(e) => {
                        if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }}
                      tabIndex={onRowClick ? 0 : undefined}
                      role={onRowClick ? "button" : undefined}
                      className={`transition-colors ${
                        onRowClick ? 'cursor-pointer hover:bg-surface-container-high/60 focus-visible:bg-surface-container-high/60 focus-visible:outline-none' : ''
                      } ${isSelected ? 'bg-primary/10' : idx % 2 === 0 ? 'bg-transparent' : 'bg-surface-container-high/40'}`}
                    >
                      {selectable && (
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => toggleSelectRow(rowId, e)}
                            aria-label={`Select row ${rowId}`}
                            aria-checked={isSelected}
                            className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center p-1 rounded min-w-[28px] min-h-[28px] focus-visible:ring-2 focus-visible:ring-primary mx-auto"
                          >
                            {isSelected ? (
                              <CheckSquare size={14} className="text-primary" />
                            ) : (
                              <Square size={14} />
                            )}
                          </button>
                        </td>
                      )}
                      {columns.map(col => {
                        const cellVal = typeof col.render === 'function'
                          ? col.render(row)
                          : typeof col.accessor === 'function'
                            ? col.accessor(row)
                            : row[col.key];

                        return (
                          <td
                            key={col.key}
                            className={`p-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.cellClassName || ''}`}
                          >
                            {cellVal ?? '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
