import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { TemplateCategory, TemplateExplorerContextType, TemplateExplorerWizardAction, TemplateItem } from '../types/template-explorer-types'
import { initialState, templateExplorerReducer } from '../reducers/template-explorer-reducer'
import { metadata, templatesRepository } from '../src/utils/helpers'
import { AppContext } from '@remix-ui/app'

export const TemplateExplorerContext = createContext<TemplateExplorerContextType>({} as any)

export const TemplateExplorerProvider = ({ children }: { children: React.ReactNode }) => {
  // const [templateRepository, setTemplateRepository] = useState<TemplateCategory[]>([])
  // const [metadata, setMetadata] = useState<any[]>([])
  // const [selectedTag, setSelectedTag] = useState<string | null>(null)
  // const [recentBump, setRecentBump] = useState<number>(0)
  const [state, dispatch] = useReducer(templateExplorerReducer, initialState)
  const appContext = useContext(AppContext)

  useEffect(() => {
    dispatch({ type: TemplateExplorerWizardAction.SET_METADATA, payload: metadata })
    dispatch({ type: TemplateExplorerWizardAction.SET_TEMPLATE_REPOSITORY, payload: templatesRepository })

  }, [])

  const allTags = useMemo((): string[] => {
    const tags: string[] = []

    if (state.templateRepository && Array.isArray(state.templateRepository)) {
      state.templateRepository.forEach((template: any) => {
        if (template && template.items && Array.isArray(template.items)) {
          template.items.forEach((item: any) => {
            if (item && item.tagList && Array.isArray(item.tagList)) {
              item.tagList.forEach((tag: string) => {
                if (typeof tag === 'string' && !tags.includes(tag)) {
                  tags.push(tag)
                }
              })
            }
          })
        }
      })
    }

    return tags.sort()
  }, [])

  // Recent templates (before filteredTemplates so it can be referenced later)
  const recentTemplates = useMemo((): TemplateItem[] => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(RECENT_KEY) : null
      const list: string[] = raw ? JSON.parse(raw) : []
      const items: TemplateItem[] = []
      if (Array.isArray(state.templateRepository)) {
        list.forEach((val) => {
          for (const group of state.templateRepository as any[]) {
            if (group && Array.isArray(group.items)) {
              const found = group.items.find((it: any) => it && it.value === val)
              if (found) {
                items.push(found)
                break
              }
            }
          }
        })
      }
      //tag filter
      const filtered = state.selectedTag
        ? items.filter((it: any) => it && Array.isArray(it.tagList) && it.tagList.includes(state.selectedTag))
        : items
      return filtered
    } catch (e) {
      return []
    }
  }, [state.selectedTag, state.recentBump])

  // Filter templates based on selected tag
  const filteredTemplates = useMemo((): TemplateCategory[] => {
    if (!state.selectedTag || !state.templateRepository || !Array.isArray(state.templateRepository)) {
      return state.templateRepository as TemplateCategory[] || []
    }

    return (state.templateRepository as TemplateCategory[]).map((template: any) => ({
      ...template,
      items: template.items.filter((item: any) =>
        item && item.tagList && Array.isArray(item.tagList) && item.tagList.includes(state.selectedTag)
      )
    })).filter((template: any) => template && template.items && template.items.length > 0)
  }, [state.selectedTag])

  // Dedupe templates across the whole page and avoid showing ones already in recents
  const dedupedTemplates = useMemo((): TemplateCategory[] => {
    const recentSet = new Set<string>((recentTemplates || []).map((t: any) => t && t.value))
    const seen = new Set<string>()
    const makeUniqueItems = (items: any[]) => {
      const unique: any[] = []
      for (const it of items || []) {
        const val = it && it.value
        if (!val) continue
        if (recentSet.has(val)) continue
        if (seen.has(val)) continue
        seen.add(val)
        unique.push(it)
      }
      return unique
    }
    return (filteredTemplates || []).map((group: any) => ({
      ...group,
      items: makeUniqueItems(group && group.items ? group.items : [])
    })).filter((g: any) => g && g.items && g.items.length > 0)
  }, [filteredTemplates, recentTemplates])

  const handleTagClick = (tag: string) => {
    dispatch({ type: TemplateExplorerWizardAction.SET_SELECTED_TAG, payload: state.selectedTag === tag ? null : tag })
  }

  const clearFilter = () => {
    dispatch({ type: TemplateExplorerWizardAction.SET_SELECTED_TAG, payload: null })
  }

  const RECENT_KEY = 'remix.recentTemplates'

  const addRecentTemplate = (template: TemplateItem) => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(RECENT_KEY) : null
      const list: string[] = raw ? JSON.parse(raw) : []
      const filtered = list.filter((v) => v !== template.value)
      filtered.unshift(template.value)
      const trimmed = filtered.slice(0, 4)
      if (typeof window !== 'undefined') window.localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed))
      dispatch({ type: TemplateExplorerWizardAction.SET_RECENT_BUMP, payload: state.recentBump + 1 })
    } catch (e) {

    }
  }

  return (
    <TemplateExplorerContext.Provider value={{ templateRepository: state.templateRepository, metadata: state.metadata, selectedTag: state.selectedTag, recentTemplates, filteredTemplates, dedupedTemplates, handleTagClick, clearFilter, addRecentTemplate, RECENT_KEY, allTags }}>
      {children}
    </TemplateExplorerContext.Provider>
  )
}
