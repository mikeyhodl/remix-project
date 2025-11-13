export default async (opts?: any, contractContent?: string, dontIncludeReadme?: boolean) => {
  return {
    // @ts-ignore
    '.prettierrc.json': (await import('raw-loader!./.prettierrc')).default,
    // @ts-ignore
    'remix.config.json': (await import('raw-loader!./remix.config')).default,
    // @ts-ignore
    'README.md': dontIncludeReadme ? null : (await import('raw-loader!./README.md')).default,
  }
}
