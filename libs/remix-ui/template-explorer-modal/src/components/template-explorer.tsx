import isElectron from 'is-electron'
import React, { useContext, useEffect } from 'react'
import { TemplateCategory, TemplateExplorerProps, TemplateItem } from '../../types/template-explorer-types'
import { TemplateExplorerContext } from '../../context/template-explorer-context'

export function TemplateExplorer() {

  const { metadata, recentTemplates, dedupedTemplates, addRecentTemplate, plugin } = useContext(TemplateExplorerContext)

  // console.log('metadata', metadata)
  // console.log('templatesRepository', templatesRepository)

  // Get all unique tags from all templates
  // const allTags = useMemo((): string[] => {
  //   const tags: string[] = []

  //   if (templateRepository && Array.isArray(templateRepository)) {
  //     templateRepository.forEach((template: any) => {
  //       if (template && template.items && Array.isArray(template.items)) {
  //         template.items.forEach((item: any) => {
  //           if (item && item.tagList && Array.isArray(item.tagList)) {
  //             item.tagList.forEach((tag: string) => {
  //               if (typeof tag === 'string' && !tags.includes(tag)) {
  //                 tags.push(tag)
  //               }
  //             })
  //           }
  //         })
  //       }
  //     })
  //   }

  //   return tags.sort()
  // }, [])

  // // Recent templates (before filteredTemplates so it can be referenced later)
  // const recentTemplates = useMemo((): TemplateItem[] => {
  //   try {
  //     const raw = typeof window !== 'undefined' ? window.localStorage.getItem(RECENT_KEY) : null
  //     const list: string[] = raw ? JSON.parse(raw) : []
  //     const items: TemplateItem[] = []
  //     if (Array.isArray(templateRepository)) {
  //       list.forEach((val) => {
  //         for (const group of templateRepository as any[]) {
  //           if (group && Array.isArray(group.items)) {
  //             const found = group.items.find((it: any) => it && it.value === val)
  //             if (found) {
  //               items.push(found)
  //               break
  //             }
  //           }
  //         }
  //       })
  //     }
  //     //tag filter
  //     const filtered = selectedTag
  //       ? items.filter((it: any) => it && Array.isArray(it.tagList) && it.tagList.includes(selectedTag))
  //       : items
  //     return filtered
  //   } catch (e) {
  //     return []
  //   }
  // }, [selectedTag, recentBump])

  // // Filter templates based on selected tag
  // const filteredTemplates = useMemo((): TemplateCategory[] => {
  //   if (!selectedTag || !templateRepository || !Array.isArray(templateRepository)) {
  //     return templateRepository as TemplateCategory[] || []
  //   }

  //   return (templateRepository as TemplateCategory[]).map((template: any) => ({
  //     ...template,
  //     items: template.items.filter((item: any) =>
  //       item && item.tagList && Array.isArray(item.tagList) && item.tagList.includes(selectedTag)
  //     )
  //   })).filter((template: any) => template && template.items && template.items.length > 0)
  // }, [selectedTag])

  // // Dedupe templates across the whole page and avoid showing ones already in recents
  // const dedupedTemplates = useMemo((): TemplateCategory[] => {
  //   const recentSet = new Set<string>((recentTemplates || []).map((t: any) => t && t.value))
  //   const seen = new Set<string>()
  //   const makeUniqueItems = (items: any[]) => {
  //     const unique: any[] = []
  //     for (const it of items || []) {
  //       const val = it && it.value
  //       if (!val) continue
  //       if (recentSet.has(val)) continue
  //       if (seen.has(val)) continue
  //       seen.add(val)
  //       unique.push(it)
  //     }
  //     return unique
  //   }
  //   return (filteredTemplates || []).map((group: any) => ({
  //     ...group,
  //     items: makeUniqueItems(group && group.items ? group.items : [])
  //   })).filter((g: any) => g && g.items && g.items.length > 0)
  // }, [filteredTemplates, recentTemplates])

  // const handleTagClick = (tag: string) => {
  //   setSelectedTag(selectedTag === tag ? null : tag)
  // }

  // const clearFilter = () => {
  //   setSelectedTag(null)
  // }

  // const RECENT_KEY = 'remix.recentTemplates'

  // const addRecentTemplate = (templateValue: string) => {
  //   try {
  //     const raw = typeof window !== 'undefined' ? window.localStorage.getItem(RECENT_KEY) : null
  //     const list: string[] = raw ? JSON.parse(raw) : []
  //     const filtered = list.filter((v) => v !== templateValue)
  //     filtered.unshift(templateValue)
  //     const trimmed = filtered.slice(0, 4)
  //     if (typeof window !== 'undefined') window.localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed))
  //     setRecentBump((v) => v + 1)
  //   } catch (e) {

  //   }
  // }

  return (
    <div className="template-explorer-container overflow-y-auto" style={{ height: '350px', padding: '1rem' }}>

      {/* Recently Used Section */}
      {/* {recentTemplates && recentTemplates?.length > 0 && (
        <div className="template-category mb-4">
          <h4 className="category-title mb-3 text-white" style={{
            color: '#333',
            paddingBottom: '0.5rem',
            fontSize: '1.2rem',
            fontWeight: '600'
          }}>
            Recently used
          </h4>
          <div className="template-items-container d-flex flex-wrap gap-3 mb-2">
            {recentTemplates?.map((item: TemplateItem, itemIndex) => {
              item.templateType = metadata[item.value]
              if (item.templateType && item.templateType.disabled === true) return null
              if (item.templateType && item.templateType.desktopCompatible === false && isElectron()) return null
              return (
                <div
                  key={`recent-${item.value}-${itemIndex}`}
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
                  onClick={() => {
                    addRecentTemplate(item)
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
                      color: plugin?.theme?.currentTheme().name === 'Light' ? '#1B1D24' : '#FFF'
                    }}>
                      {item.displayName || item.value}
                    </h6>
                    {item.tagList && item.tagList.length > 0 && (
                      <div className="tag-list mb-1 d-flex flex-wrap gap-1">
                        {item.tagList.map((tag, tagIndex) => (
                          <span key={tagIndex} className="badge bg-primary" style={{
                            fontSize: '0.55rem',
                            padding: '0.1rem 0.25rem',
                            borderRadius: '2px'
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="card-body" style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {item.description && (
                      <p className="card-description mb-1 text-wrap" style={{
                        fontSize: '0.7rem',
                        lineHeight: '1.2',
                        margin: 0,
                        maxHeight: '1.8rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {item.description}
                      </p>
                    )}
                    {item.opts && Object.keys(item.opts).length > 0 && (
                      <div className="options-badges d-flex flex-wrap gap-1" style={{
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
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )} */}

      {dedupedTemplates?.map((template: TemplateCategory, templateIndex) => (
        <div key={template.name} className="template-category mb-4">
          <h4 className="category-title mb-3 text-dark" style={{
            color: '#333',
            paddingBottom: '0.5rem',
            fontSize: '1.2rem',
            fontWeight: '400'
          }}>
            {template.name.toUpperCase()}
          </h4>

          {template.description && (
            <p className="category-description mb-2 text-danger" style={{ color: '#666', fontSize: '0.9rem' }}>
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
                  onClick={() => {
                    console.log('Template selected:', item.value, item.opts)
                    addRecentTemplate(item)
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
                      color: plugin?.theme?.currentTheme().name === 'Light' ? '#1B1D24' : '#FFF'
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

          {/* Special handling for Cookbook section */}
          {template.name === 'Cookbook' && (
            <div className="cookbook-special-card" style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              textAlign: 'center'
            }}>
              <h6 className="mb-2" style={{ color: '#333', margin: 0 }}>
                More from Cookbook
              </h6>
              <p className="mb-3" style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
                {template.description}
              </p>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => template.onClick && template.onClick()}
                style={{ fontSize: '0.8rem' }}
              >
                {template.onClickLabel}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
