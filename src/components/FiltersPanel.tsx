import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

interface Option {
  value: string
  count: number
  label?: string
}

interface FiltersPanelProps {
  levelOptions: Option[]
  levelFilter: Set<string>
  onToggleLevel: (level: string) => void
  sourceOptions: Option[]
  sourceFilter: Set<string>
  onToggleSource: (source: string) => void
  onSelectAllSources: () => void
  allSourcesActive: boolean
  metadataOptions: Map<string, string[]>
  metadataFilters: Record<string, string[]>
  addMetadataFilter: (key: string, value: string) => void
  removeMetadataFilter: (key: string, value: string) => void
  searchTerm: string
  onSearchChange: (value: string) => void
  onClearAll: () => void
  hasActiveFilter: boolean
}

export function FiltersPanel({
  levelOptions,
  levelFilter,
  onToggleLevel,
  sourceOptions,
  sourceFilter,
  onToggleSource,
  onSelectAllSources,
  allSourcesActive,
  metadataOptions,
  metadataFilters,
  addMetadataFilter,
  removeMetadataFilter,
  searchTerm,
  onSearchChange,
  onClearAll,
  hasActiveFilter,
}: FiltersPanelProps) {
  const [selectedKey, setSelectedKey] = useState('')
  const [selectedValue, setSelectedValue] = useState('')

  const valuesForKey = useMemo(
    () => metadataOptions.get(selectedKey) ?? [],
    [metadataOptions, selectedKey],
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedKey || !selectedValue) {
      return
    }

    addMetadataFilter(selectedKey, selectedValue)
    setSelectedValue('')
  }

  const renderCheckbox = (option: Option, isChecked: boolean, onToggle: () => void) => (
    <label key={option.value} className="filter-checkbox">
      <input type="checkbox" checked={isChecked} onChange={onToggle} />
      <span className="filter-name">{option.label ?? option.value}</span>
      <span className="filter-count">{option.count}</span>
    </label>
  )

  return (
    <aside className="filters-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Filters</p>
          <h2>Slice the log stream</h2>
        </div>
        <button className="text-button" onClick={onClearAll} disabled={!hasActiveFilter}>
          Clear all
        </button>
      </div>

      <div className="filters-scroll">
        <section className="filter-group">
          <div className="filter-card">
            <p className="filter-label">Log level</p>
            <div className="filter-list">
              {levelOptions.map((option) =>
                renderCheckbox(option, levelFilter.has(option.value), () => onToggleLevel(option.value)),
              )}
            </div>
          </div>
        </section>

        <section className="filter-group">
          <div className="filter-card">
            <div className="filter-section-header">
              <p className="filter-label">Source file</p>
              <button type="button" className="pill-button" onClick={onSelectAllSources} disabled={allSourcesActive}>
                Select all
              </button>
            </div>
            <div className="filter-list">
              {sourceOptions.map((option) =>
                renderCheckbox(option, sourceFilter.has(option.value), () => onToggleSource(option.value)),
              )}
            </div>
          </div>
        </section>

        <section className="filter-group">
          <div className="filter-card">
            <p className="filter-label">Metadata / kwargs</p>
            <form className="metadata-form" onSubmit={handleSubmit}>
              <label>
                <span className="sr-only">Metadata key</span>
                <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
                  <option value="">Select key</option>
                  {Array.from(metadataOptions.keys())
                    .sort()
                    .map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Metadata value</span>
                <select
                  value={selectedValue}
                  onChange={(event) => setSelectedValue(event.target.value)}
                  disabled={!selectedKey}
                >
                  <option value="">Select value</option>
                  {valuesForKey.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={!selectedKey || !selectedValue}>
                Add
              </button>
            </form>

            <div className="metadata-chips">
              {Object.entries(metadataFilters).length === 0 && <p className="muted">No metadata filters</p>}
              {Object.entries(metadataFilters).map(([key, values]) =>
                values.map((value) => (
                  <span className="chip" key={`${key}-${value}`}>
                    <strong>{key}</strong>
                    <span>=</span>
                    <span>{value}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${key}=${value}`}
                      onClick={() => removeMetadataFilter(key, value)}
                    >
                      ×
                    </button>
                  </span>
                )),
              )}
            </div>
          </div>
        </section>

        <section className="filter-group">
          <div className="filter-card">
            <p className="filter-label">Full-text search</p>
            <input
              type="search"
              placeholder="Search message, raw text, kwargs..."
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        </section>
      </div>
    </aside>
  )
}
