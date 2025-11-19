import { PluginClient } from '@remixproject/plugin';
import { createClient } from '@remixproject/plugin-webview';
import { initInstance, emptyInstance } from './actions';

class RemixClient extends PluginClient {
  constructor() {
    super();
    this.methods = ['edit', 'clearInstance'];
    createClient(this);
  }

  edit({ address, abi, network, name, devdoc, methodIdentifiers, solcVersion, htmlTemplate, pages }: any): void {
    initInstance({
      address,
      abi,
      network,
      name,
      devdoc,
      methodIdentifiers,
      solcVersion,
      htmlTemplate,
      pages
    });
  }

  clearInstance(): void {
    emptyInstance();
  }
}

export default new RemixClient();
