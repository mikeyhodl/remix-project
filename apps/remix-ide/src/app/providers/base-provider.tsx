import React from 'react' // eslint-disable-line
import * as packageJson from '../../../../../package.json'
import { IProvider, JsonDataRequest, JsonDataResult } from './abstract-provider'
import { Plugin } from '@remixproject/engine'
import { createBaseAccountSDK } from '@base-org/account'

const profile = {
  name: 'base-provider',
  displayName: 'Base Wallet Provider',
  kind: 'provider',
  description: 'injected Provider',
  methods: ['sendAsync', 'init'],
  version: packageJson.version
}

export class BaseProvider extends Plugin implements IProvider {
  provider: any
  options: {[id: string]: any} = {}
  constructor() {
    super(profile)
  }

  async init() {
    const baseSepoliaChainId = 84532
    const baseMainnetChainId = 8453

    const sdk = createBaseAccountSDK({
      appName: 'Remix IDE',
      appChainIds: [baseSepoliaChainId, baseMainnetChainId]
    })

    this.provider = sdk.getProvider()
    const addresses = await this.provider.request({method: 'eth_requestAccounts'});
    console.log('Base Wallet accounts:', addresses)
    return {}
  }

  sendAsync(data: JsonDataRequest): Promise<JsonDataResult> {
    return this.provider.request(data)
  }

  getInjectedProvider() {
    return this.provider
  }

  notFound() {
    return 'No injected provider found. Make sure your provider (e.g. MetaMask, ...) is active and running (when recently activated you may have to reload the page).'
  }

  body(): JSX.Element {
    return <div></div>
  }
}