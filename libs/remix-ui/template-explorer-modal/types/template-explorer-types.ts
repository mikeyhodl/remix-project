
export interface TemplateExplorerWizardState {
  workspaceTemplateChosen: string
  workspaceTemplateGroupChosen: string
  workspaceName: string
  defaultWorkspaceName: string
  topLeftNagivationName: string
  initializeAsGitRepo: boolean
  workspaceGeneratedWithAi: boolean
  searchTerm: string
  metadata: MetadataType
  templateRepository: TemplateCategory[]
  selectedTag: string | null
  setSearchTerm: (term: string) => void
}

export interface TemplateExplorerContextType {
  plugin: any
  templateRepository: TemplateCategory[]
  metadata: any[]
  selectedTag: string | null
  recentTemplates: TemplateItem[]
  filteredTemplates: TemplateCategory[]
  dedupedTemplates: TemplateCategory[]
  setSearchTerm: (term: string) => void
  handleTagClick: (tag: string) => void
  clearFilter: () => void
  addRecentTemplate: (template: TemplateItem) => void
  RECENT_KEY: string
  allTags: string[]
}

export enum TemplateExplorerWizardAction {
  SET_WORKSPACE_TEMPLATE = 'SET_WORKSPACE_TEMPLATE',
  SET_WORKSPACE_TEMPLATE_WIZARD_STEP = 'SET_WORKSPACE_TEMPLATE_WIZARD_STEP',
  SET_WORKSPACE_TEMPLATE_GROUP = 'SET_WORKSPACE_TEMPLATE_GROUP',
  SET_WORKSPACE_NAME = 'SET_WORKSPACE_NAME',
  SET_DEFAULT_WORKSPACE_NAME = 'SET_DEFAULT_WORKSPACE_NAME',
  SET_TOP_LEFT_NAVIGATION_NAME = 'SET_TOP_LEFT_NAVIGATION_NAME',
  SET_INITIALIZE_AS_GIT_REPO = 'SET_INITIALIZE_AS_GIT_REPO',
  SET_WORKSPACE_GENERATED_WITH_AI = 'SET_WORKSPACE_GENERATED_WITH_AI',
  END_WORKSPACE_WIZARD = 'END_WORKSPACE_WIZARD',
  SET_RECENT_BUMP = 'SET_RECENT_BUMP',
  SET_SELECTED_TAG = 'SET_SELECTED_TAG',
  CLEAR_SELECTED_TAG = 'CLEAR_SELECTED_TAG',
  SET_METADATA = 'SET_METADATA',
  SET_TEMPLATE_REPOSITORY = 'SET_TEMPLATE_REPOSITORY',
  SELECT_TEMPLATE = 'SELECT_TEMPLATE',
  GENERATE_TEMPLATE = 'GENERATE_TEMPLATE',
  MODIFY_WORKSPACE = 'MODIFY_WORKSPACE',
  REVIEW_WORKSPACE = 'REVIEW_WORKSPACE',
  IMPORT_WORKSPACE = 'IMPORT_WORKSPACE',
  FINALIZE_WORKSPACE_CREATION = 'FINALIZE_WORKSPACE_CREATION',
  ABORT_WORKSPACE_CREATION = 'ABORT_WORKSPACE_CREATION',
  BACK_ONE_STEP = 'BACK_ONE_STEP',
  SET_SEARCH_TERM = 'SET_SEARCH_TERM'
}

export interface TemplateItem {
  value: string
  displayName?: string
  description?: string
  tagList?: string[]
  IsArtefact?: boolean
  opts?: {
    upgradeable?: string
    mintable?: boolean
    burnable?: boolean
    pausable?: boolean
  }
  templateType?: any
}

export interface TemplateCategory {
  name: string
  description?: string
  hasOptions?: boolean
  IsArtefact?: boolean
  tooltip?: string
  onClick?: () => void
  onClickLabel?: string
  items: TemplateItem[]
}

export type TemplateRepository = TemplateCategory[]

export type MetadataType = Record<string, MetadataItem>

export type MetadataItem =
| {
    type: 'git';
    url: string;
    branch: string;
    forceCreateNewWorkspace: boolean;
  }
| {
    type: 'plugin';
    name: string;
    endpoint: string;
    params: string[];
    forceCreateNewWorkspace?: boolean;
    desktopCompatible?: boolean;
    disabled?: boolean;
  }

export interface TemplateExplorerProps {
  plugin?: any
}

export interface TopCardProps {
  title: string
  description: string
  icon: string
  onClick: () => void
  importWorkspace: boolean
}
