import isElectron from 'is-electron'
import React, { useContext, useEffect } from 'react'
import { TemplateCategory, TemplateExplorerProps, TemplateExplorerWizardAction, TemplateItem } from '../../types/template-explorer-types'
import { TemplateExplorerContext } from '../../context/template-explorer-context'
import { TemplateExplorerModalFacade } from '../utils/workspaceUtils'

export function TemplateExplorer() {

  const { metadata, dedupedTemplates, plugin, dispatch, facade, templateCategoryStrategy, state, theme } = useContext(TemplateExplorerContext)

  useEffect(() => {
    console.log('state', state)
  }, [])

  return (
    <div data-id="template-explorer-template-container" className="template-explorer-container overflow-y-auto" style={{ height: '350px', padding: '1rem' }}>

      {dedupedTemplates?.map((template: TemplateCategory, templateIndex) => (
        <div key={template.name} className="template-category mb-4" data-id={`template-category-${template.name}`}>
          <h4 className="category-title mb-3 text-dark" style={{
            color: '#667',
            paddingBottom: '0.5rem',
            fontSize: '1.2rem',
            fontWeight: '400'
          }}>
            {template.name.toUpperCase()}
          </h4>

          {template.description && (
            <p className="category-description mb-2 text-secondary" style={{ color: '#667', fontSize: '0.9rem' }}>
              {template.description}
            </p>
          )}

          <div className="template-items-container d-flex flex-wrap gap-3 mb-4">
            {template.items.map((item: TemplateItem, itemIndex) => {
              // Add template metadata
              item.templateType = metadata[item.value]

              // Skip disabled items
              if (item.templateType && item.templateType.disabled === true) return null

              // Skip desktop incompatible items in electron
              if (item.templateType && item.templateType.desktopCompatible === false && isElectron()) return null

              return (
                <div
                  data-id={`template-card-${item.value}-${itemIndex}`}
                  key={`${templateIndex}-${itemIndex}`}
                  className="template-card bg-light border-0"
                  style={{
                    width: '180px',
                    height: '110px',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onClick={async () => {
                    if (item.value === 'cookbook') {
                      await plugin.call('manager', 'activatePlugin', 'cookbookdev')
                      await plugin.call('sidePanel', 'focus', 'cookbookdev')
                      facade.closeWizard()
                      return
                    }
                    if (item?.IsArtefact && item.templateType === undefined) {
                      // facade.closeWizard()
                      // return
                    }
                    if (item.IsArtefact && item.templateType) {

                    }
                    if (item.templateType && item?.IsArtefact === false) {

                    }
                    facade.switchWizardScreen(dispatch, item, template, templateCategoryStrategy)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div className="card-header mb-1">
                    <h6 className="card-title mb-1" style={{
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      margin: 0,
                      lineHeight: '1.2',
                      color: theme?.name === 'Light' ? '#667' : '#a2a3bd'
                    }}>
                      {item.displayName || item.value}
                    </h6>

                  </div>
                  <div className="card-body d-flex flex-column justify-content-between overflow-y-auto" style={{
                    flex: 1,
                  }}>
                    {item.description && (
                      <p className="card-description mb-1 text-dark text-wrap text-truncate overflow-hidden" style={{
                        fontSize: '0.7rem',
                        margin: 0,
                      }}>
                        {item.description}
                      </p>
                    )}

                    {item.opts && Object.keys(item.opts).length > 0 && (
                      <div className="options-badges d-flex flex-wrap" style={{
                        marginTop: 'auto'
                      }}>
                        {item.opts.upgradeable && (
                          <span className="badge bg-success" style={{
                            fontSize: '0.5rem',
                            padding: '0.1rem 0.25rem',
                            borderRadius: '2px'
                          }}>
                            UUPS
                          </span>
                        )}
                        {item.opts.mintable && (
                          <span className="badge bg-warning text-dark" style={{
                            fontSize: '0.5rem',
                            padding: '0.1rem 0.25rem',
                            borderRadius: '2px'
                          }}>
                            Mint
                          </span>
                        )}
                        {item.opts.burnable && (
                          <span className="badge bg-danger" style={{
                            fontSize: '0.5rem',
                            padding: '0.1rem 0.25rem',
                            borderRadius: '2px'
                          }}>
                            Burn
                          </span>
                        )}
                        {item.opts.pausable && (
                          <span className="badge bg-secondary" style={{
                            fontSize: '0.5rem',
                            padding: '0.1rem 0.25rem',
                            borderRadius: '2px'
                          }}>
                            Pause
                          </span>
                        )}
                      </div>
                    )}

                    {item.tagList && item.tagList.length > 0 && (
                      <div className="tag-list d-flex flex-wrap gap-1 align-items-end">
                        {item.tagList.map((tag, tagIndex) => (
                          <span key={tagIndex} className="badge" style={{
                            fontSize: '0.55rem',
                            padding: '0.1rem 0.25rem',
                            borderRadius: '3px',
                            backgroundColor: '#64C4FF14',
                            color: '#64C4FF'
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
