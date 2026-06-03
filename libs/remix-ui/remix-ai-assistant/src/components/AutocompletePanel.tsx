import React, { useEffect, useState, useRef } from 'react'

export interface Command {
  name: string
  description: string
  shortcut?: string
  category?: string
}

interface AutocompletePanelProps {
  isVisible: boolean
  searchTerm: string
  onSelect: (command: Command) => void
  position?: { top: number; left: number }
  themeTracker?: any
  selectedIndex: number
  onSelectedIndexChange: (index: number) => void
}

// Available commands - this could be moved to a config file or fetched dynamically
const AVAILABLE_COMMANDS: Command[] = [
  // Core commands
  // { name: 'generate', description: 'Generate smart contracts or code', shortcut: '/g', category: 'Generate' },
  // { name: 'workspace', description: 'Generate a new workspace', shortcut: '/w', category: 'Generate' },
  // { name: 'setAssistant', description: 'Set AI assistant provider', category: 'Settings' },
  // { name: 'ollama', description: 'Configure Ollama integration', category: 'Settings' },
  
  // Compilation & Analysis
  { name: 'compile', description: 'Compile current contract', category: 'Build' },
  // { name: 'slither', description: 'Run Slither security analysis', category: 'Analysis' },
  // { name: 'mythril', description: 'Run Mythril security scan', category: 'Analysis' },
  
  // Deployment & Verification
  { name: 'deploy', description: 'Deploy contract to network', category: 'Deploy' },
  { name: 'etherscan', description: 'Fetch contract from Etherscan', category: 'Import' },
  // { name: 'verify', description: 'Verify contract on block explorer', category: 'Deploy' },
  
  // Testing & Debugging
  // { name: 'test', description: 'Run contract tests', category: 'Test' },
  // { name: 'debug', description: 'Debug transaction', category: 'Debug' },
  
  // DeFi & Integrations
  { name: 'thegraph', description: 'Fetch data from The Graph', category: 'Data' },
  { name: 'alchemy', description: 'Fetch data from Alchemy', category: 'Data' },
  { name: 'circle', description: 'Circle integration', category: 'DeFi' },
  // { name: 'uniswap', description: 'Uniswap integration', category: 'DeFi' },
  // { name: 'aave', description: 'Aave integration', category: 'DeFi' },
  
  // Documentation & Help
  // { name: 'help', description: 'Show available commands', category: 'Help' },
  // { name: 'docs', description: 'Open documentation', category: 'Help' },

  // Frontend & UI
  { name: 'create a dapp [quickdapp agent]', description: 'DApp development', category: 'Frontend' },
]

export const AutocompletePanel: React.FC<AutocompletePanelProps> = ({
  isVisible,
  searchTerm,
  onSelect,
  position,
  themeTracker,
  selectedIndex,
  onSelectedIndexChange
}) => {
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!searchTerm || !searchTerm.startsWith('/')) {
      setFilteredCommands([])
      return
    }

    const search = searchTerm.toLowerCase().slice(1) // Remove the '/' prefix
    
    // If search is empty (just '/'), show all commands
    const filtered = search.length === 0 
      ? AVAILABLE_COMMANDS 
      : AVAILABLE_COMMANDS.filter(cmd => 
          cmd.name.toLowerCase().includes(search.toLowerCase()) ||
          cmd.shortcut?.toLowerCase().includes(search.toLowerCase()) ||
          cmd.description.toLowerCase().includes(search.toLowerCase())
        )

    // Sort by relevance only if there's a search term
    if (search.length > 0) {
      filtered.sort((a, b) => {
        const aName = a.name.toLowerCase().slice(1)
        const bName = b.name.toLowerCase().slice(1)
        const aShortcut = a.shortcut?.toLowerCase().slice(1) || ''
        const bShortcut = b.shortcut?.toLowerCase().slice(1) || ''

        // Exact match
        if (aName === search || aShortcut === search) return -1
        if (bName === search || bShortcut === search) return 1

        // Prefix match
        if (aName.startsWith(search) || aShortcut.startsWith(search)) return -1
        if (bName.startsWith(search) || bShortcut.startsWith(search)) return 1

        // Alphabetical
        return aName.localeCompare(bName)
      })
    }

    setFilteredCommands(filtered)
  }, [searchTerm])

  useEffect(() => {
    // Ensure selected item is visible
    if (selectedIndex >= 0 && selectedIndex < itemRefs.current.length) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

  useEffect(() => {
    // Reset selected index when filtered commands change
    if (selectedIndex >= filteredCommands.length) {
      onSelectedIndexChange(Math.max(0, filteredCommands.length - 1))
    }
  }, [filteredCommands.length, selectedIndex, onSelectedIndexChange])

  if (!isVisible || filteredCommands.length === 0) {
    return null
  }

  const isDarkTheme = themeTracker?.name?.toLowerCase() === 'dark'
  const backgroundColor = isDarkTheme ? '#2d2d3d' : '#ffffff'
  const borderColor = isDarkTheme ? '#3d3d4d' : '#d1d5db'
  const hoverColor = isDarkTheme ? '#3d3d4d' : '#f3f4f6'
  const selectedColor = isDarkTheme ? '#4d4d5d' : '#e5e7eb'
  const textColor = isDarkTheme ? '#e0e0e0' : '#1f2937'
  const secondaryTextColor = isDarkTheme ? '#9ca3af' : '#6b7280'
  const categoryColor = isDarkTheme ? '#6b7280' : '#9ca3af'

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(cmd)
    return acc
  }, {} as Record<string, Command[]>)

  // Create flat list of commands for index tracking
  const flatCommands = Object.entries(groupedCommands).flatMap(([_, commands]) => commands)

  return (
    <div
      ref={panelRef}
      className="position-absolute rounded shadow-lg overflow-auto"
      style={{
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: '8px',
        maxHeight: '300px',
        backgroundColor,
        border: `1px solid ${borderColor}`,
        zIndex: 1000
      }}
      data-id="autocomplete-panel"
    >
      {Object.entries(groupedCommands).map(([category, commands]) => {
        return (
          <div key={category}>
            <div
              className="px-3 py-1 small font-weight-bold"
              style={{ color: categoryColor, fontSize: '0.75rem' }}
            >
              {category}
            </div>
            {commands.map((cmd) => {
              const index = flatCommands.indexOf(cmd)
              const isSelected = index === selectedIndex
              
              return (
                <button
                  key={cmd.name}
                  ref={(el) => itemRefs.current[index] = el}
                  className="d-flex align-items-center justify-content-between w-100 px-3 py-2 border-0 text-left"
                  style={{
                    backgroundColor: isSelected ? selectedColor : 'transparent',
                    color: textColor,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected ? selectedColor : hoverColor
                    onSelectedIndexChange(index)
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected ? selectedColor : 'transparent'
                  }}
                  onClick={() => onSelect(cmd)}
                  data-id={`autocomplete-item-${cmd.name}`}
              >
                <div className="d-flex flex-column">
                  <div className="d-flex align-items-center">
                    <span className="font-weight-medium">{cmd.name}</span>
                    {cmd.shortcut && (
                      <span 
                        className="ms-2 px-1 rounded small"
                        style={{ 
                          backgroundColor: isDarkTheme ? '#1d1d2d' : '#f9fafb',
                          color: secondaryTextColor,
                          fontSize: '0.75rem'
                        }}
                      >
                        {cmd.shortcut}
                      </span>
                    )}
                  </div>
                  <span 
                    className="small" 
                    style={{ color: secondaryTextColor, fontSize: '0.8rem' }}
                  >
                    {cmd.description}
                  </span>
                </div>
                {isSelected && (
                  <span 
                    className="small ms-2" 
                    style={{ color: secondaryTextColor, fontSize: '0.75rem' }}
                  >
                    Enter
                  </span>
                )}
              </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}