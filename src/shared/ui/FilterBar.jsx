import React from 'react';
import { Search, X, Filter } from 'lucide-react';

/**
 * Standardized Search & Filter Bar across all modules.
 * @param {Object} props
 * @param {string} props.searchQuery - Current search text
 * @param {Function} props.onSearchChange - Search handler (e.g. (val) => setSearch(val))
 * @param {string} [props.placeholder="Search..."] - Input placeholder
 * @param {string} [props.activeFilter] - Selected category/stage filter
 * @param {Function} [props.onFilterChange] - Filter change handler
 * @param {Array<{id: string, label: string, count?: number}>} [props.filterOptions] - Filter options list
 * @param {number} [props.totalCount] - Total items count
 * @param {number} [props.filteredCount] - Filtered items count
 * @param {React.ReactNode} [props.children] - Additional controls (e.g. sub-tabs, export buttons)
 */
export default function FilterBar({
  searchQuery = '',
  onSearchChange,
  placeholder = 'Search by name, company, ID...',
  activeFilter,
  onFilterChange,
  filterOptions = [],
  totalCount,
  filteredCount,
  children
}) {
  return (
    <div className="bg-surface-container-high p-3 sm:p-4 rounded-xl border border-outline mb-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-sm">
      {/* Left: Search input & filter pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/70 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder || "Search records"}
            className="w-full pl-9 pr-8 py-2 bg-surface-container-highest border border-outline rounded-xl text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant font-medium focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange && onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors focus-visible:ring-2 focus-visible:ring-primary"
              title="Clear search"
              aria-label="Clear search query"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills (if provided) */}
        {filterOptions.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5" role="group" aria-label="Category filters">
            <span className="text-xs font-semibold text-on-surface-variant/70 flex items-center mr-1 hidden sm:flex">
              <Filter size={12} className="mr-1" aria-hidden="true" /> Filter:
            </span>
            {filterOptions.map((opt) => {
              const isSelected = activeFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onFilterChange && onFilterChange(opt.id)}
                  aria-pressed={isSelected}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(0,218,243,0.25)]'
                      : 'bg-surface-container-highest text-on-surface hover:border-primary/50 border border-outline font-bold'
                  }`}
                >
                  <span>{opt.label}</span>
                  {typeof opt.count === 'number' && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-black/20 text-on-primary font-bold'
                          : 'bg-surface-container-highest text-on-surface-variant'
                      }`}
                    >
                      {opt.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Extra controls / counts */}
      <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-outline-variant/40">
        {children}

        {typeof totalCount === 'number' && (
          <div className="text-xs text-on-surface-variant font-medium whitespace-nowrap px-2">
            Showing{' '}
            <span className="font-bold text-on-surface">
              {typeof filteredCount === 'number' ? filteredCount : totalCount}
            </span>{' '}
            of <span className="font-bold text-on-surface">{totalCount}</span> items
          </div>
        )}
      </div>
    </div>
  );
}
