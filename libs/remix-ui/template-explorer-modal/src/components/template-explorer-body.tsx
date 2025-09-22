import React from 'react'
import { TopCard } from './topCard'
import { TopCardProps } from '../../types/template-explorer-types'
import { TemplateExplorer } from './template-explorer'
import { TopCards } from './topCards'

export interface TemplateExplorerBodyProps {
  topCards: TopCardProps[]
  plugin: any
}

export function TemplateExplorerBody({ topCards, plugin }: TemplateExplorerBodyProps) {
  return (
    <section>
      <TopCards />
      <div className="body overflow-y-hidden">
        <label className="text-dark fs-5">Workspace Templates</label>
        <TemplateExplorer plugin={plugin} />
      </div>
    </section>
  )
}
