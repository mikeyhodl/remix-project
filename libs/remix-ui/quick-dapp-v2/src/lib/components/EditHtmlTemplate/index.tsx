/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Button, Row, Col, Card } from 'react-bootstrap';
import { FormattedMessage, useIntl } from 'react-intl';
import { toPng } from 'html-to-image';
import { AppContext } from '../../contexts';
import DeployPanel from '../DeployPanel';
// remixClient removed - using plugin from context instead
import { InBrowserVite } from '../../InBrowserVite';
import { DappOperations } from '@remix-ui/helper';

interface Pages {
  [key: string]: string
}

export const readDappFiles = async (
  plugin: any,
  currentPath: string,
  map: Map<string, string>,
  rootPathLength: number
) => {
  try {
    const files = await plugin.call('fileManager', 'readdir', currentPath);

    for (const [filePath, fileData] of Object.entries(files)) {
      // @ts-ignore
      if (fileData.isDirectory) {
        await readDappFiles(plugin, filePath, map, rootPathLength);
      } else {
        const content = await plugin.call('fileManager', 'readFile', filePath);
        let virtualPath = filePath.substring(rootPathLength);
        if (!virtualPath.startsWith('/')) virtualPath = '/' + virtualPath;
        map.set(virtualPath, content);
      }
    }
  } catch (e) {
    console.error(`[QuickDapp-LOG] Error reading '${currentPath}':`, e);
  }
}

function EditHtmlTemplate(): JSX.Element {
  const intl = useIntl();
  const { appState, dispatch, dappManager, plugin } = useContext(AppContext);
  const { activeDapp } = appState;

  const [iframeError, setIframeError] = useState<string>('');
  const [showIframe, setShowIframe] = useState(true);
  const [isBuilderReady, setIsBuilderReady] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);

  const isAiUpdating = activeDapp ? (appState.dappProcessing[activeDapp.slug] || false) : false;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const builderRef = useRef<InBrowserVite | null>(null);
  const runBuildRef = useRef<(showNotification?: boolean) => Promise<void>>();

  const [showTips, setShowTips] = useState(false);
  const [showVmTips, setShowVmTips] = useState(false);

  useEffect(() => {
    if (!plugin) return;

    // Clear stuck processing state on mount if dapp files exist
    if (activeDapp && appState.dappProcessing[activeDapp.slug]) {
      console.log('[EditHtmlTemplate] Detected stuck processing state for', activeDapp.slug, '- clearing it');
      dispatch({
        type: 'SET_DAPP_PROCESSING',
        payload: { slug: activeDapp.slug, isProcessing: false }
      });
    }

    const onDappUpdated = (data: any) => {
      const isMatchingDapp = activeDapp && (
        data.slug === activeDapp.slug ||
        data.slug === activeDapp.workspaceName ||
        data.workspaceName === activeDapp.workspaceName
      );

      if (isMatchingDapp) {
        console.log('[EditHtmlTemplate] dappGenerated received for current dapp:', data.slug);
        dispatch({
          type: 'SET_DAPP_PROCESSING',
          payload: { slug: activeDapp.slug, isProcessing: false }
        });

        if (activeDapp.status === 'deployed') {
          plugin.call('notification', 'modal', {
            id: 'dapp-code-updated-warning',
            title: 'Code Updated',
            message: (
              <div>
                <p>The AI has successfully updated your dapp code.</p>
                <div className="alert alert-warning mb-0">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  <strong>Action Required:</strong> The live IPFS deployment is outdated.
                  Please <strong>"Deploy to IPFS"</strong> again.
                </div>
              </div>
            ),
            modalType: 'alert',
            okLabel: 'OK'
          });
        } else {
          plugin.call('notification', 'toast', 'The AI has successfully updated your dapp code.');
        }

        // Trigger preview refresh after files are written
        setTimeout(() => runBuildRef.current?.(true), 500);
      }
    };

    const onDappError = (errorData: any) => {
      const errorSlug = errorData?.slug;
      const isMatchingError = activeDapp && (
        !errorSlug ||
        errorSlug === activeDapp.slug ||
        errorSlug === activeDapp.workspaceName
      );

      if (isMatchingError) {
        const errorMessage = errorData?.error || errorData || 'Unknown Error';
        dispatch({
          type: 'SET_DAPP_PROCESSING',
          payload: { slug: activeDapp.slug, isProcessing: false }
        });
        plugin.call('notification', 'modal', {
          id: 'dapp-update-failed',
          title: 'Update Failed',
          message: (
            <div>
              <p>An error occurred while generating the code:</p>
              <div className="alert alert-danger mb-0" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {errorMessage}
              </div>
            </div>
          ),
          modalType: 'alert',
          okLabel: 'OK'
        });
      }
    };

    plugin.event.on('dappGenerated', onDappUpdated);
    plugin.event.on('dappGenerationError', onDappError);

    return () => {
      plugin.event.off('dappGenerated', onDappUpdated);
      plugin.event.off('dappGenerationError', onDappError);
    };
  }, [activeDapp, dispatch, plugin]);

  const handleDeleteDapp = async () => {
    if (!activeDapp || !dappManager || !plugin) return;

    const userConfirmed = await new Promise<boolean>((resolve) => {
      plugin.call('notification', 'modal', {
        id: 'quick-dapp-delete-confirm',
        title: 'Delete DApp?',
        message: (
          <div>
            <p>Are you sure you want to delete this DApp?</p>
            <p className="text-warning small mb-0">
              <i className="fas fa-exclamation-triangle me-1"></i>
              This will also delete the associated workspace and all its files. This action cannot be undone.
            </p>
          </div>
        ),
        modalType: 'confirm',
        okLabel: 'Yes, Delete',
        cancelLabel: 'Cancel',
        okFn: () => resolve(true),
        cancelFn: () => resolve(false),
        hideFn: () => resolve(false)
      });
    });

    if (!userConfirmed) return;

    const slugToDelete = activeDapp.slug;

    try {
      await dappManager.deleteDapp(slugToDelete);
      let updatedDapps = await dappManager.getDapps();
      if (!updatedDapps) updatedDapps = [];

      dispatch({ type: 'SET_DAPPS', payload: updatedDapps });
      dispatch({ type: 'SET_ACTIVE_DAPP', payload: null });

      if (updatedDapps.length === 0) {
        dispatch({ type: 'SET_VIEW', payload: 'create' });
      } else {
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
      }

    } catch (e: any) {
      console.error('[QuickDapp] Delete failed:', e);
      plugin.call('notification', 'toast', `Failed to delete DApp: ${e.message}`);
    }
  };

  const handleBack = async () => {
    if (!isAiUpdating && !isBuilding) {
      setIsCapturing(true);
      await captureAndSaveThumbnail();
      setIsCapturing(false);
    }
    if (dappManager && activeDapp) {
      try {
        const updatedConfig = await dappManager.getDappConfig(activeDapp.workspaceName);
        if (updatedConfig) {
          const updatedDapps = appState.dapps.map((d: any) =>
            d.slug === activeDapp.slug ? updatedConfig : d
          );
          dispatch({ type: 'SET_DAPPS', payload: updatedDapps });
        }
      } catch (e) {
        console.warn('[EditHtmlTemplate] Failed to update single dapp config', e);
      }
    }

    dispatch({ type: 'SET_ACTIVE_DAPP', payload: null });
    dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
  };

  const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  // Fix for unresponsive browser when creating thumbnail https://github.com/bubkoo/html-to-image/issues/542
  const getAllPropertyNames = () => {
    const names = [];
    const style = getComputedStyle(iframeRef.current);
    for (let i = 0; i < style.length; i++) {
      const name = style[i];
      if (!name.startsWith('--')) {
        names.push(name);
      }
    }
    return names;
  }

  const captureAndSaveThumbnail = async (force: boolean = false) => {
    if (!activeDapp || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!doc || !doc.body || doc.body.innerHTML === '') return;

    try {
      const identifier = activeDapp.inlineMode ? activeDapp.slug : activeDapp.workspaceName;
      const dappOps = DappOperations.from(identifier, plugin);
      await dappOps.switchToWorkspace();
      if (!force) {
        const previewExists = await dappOps.fileExists('preview.png');
        if (previewExists) {
          console.log('[Capture] Preview already exists, skipping');
          return;
        }
      }

      const propertyNames = getAllPropertyNames()
      const dataUrl = await toPng(doc.body, {
        quality: 0.8,
        width: 640,
        height: 360,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipAutoScale: true,
        pixelRatio: 1,
        imagePlaceholder: TRANSPARENT_PIXEL,
        fetchRequestInit: {
          cache: 'no-cache',
        },
        includeStyleProperties: propertyNames
      });

      await dappOps.writeFile('preview.png', dataUrl);
    } catch (error) {
      console.error('[Capture] Failed:', error);
    }
  };

  const runBuild = async (showNotification: boolean = false) => {

    if (!iframeRef.current || !activeDapp) return;
    if (isBuilding) return;

    if (!builderRef.current || !builderRef.current.isReady()) {
      setIframeError('Builder is initializing...');
      return;
    }

    setIsBuilding(true);
    setIframeError('');
    setRuntimeErrors([]);
    setShowIframe(true);
    // For workspace mode: use workspaceName, for inline mode: use slug
    const identifier = activeDapp.inlineMode ? activeDapp.slug : activeDapp.workspaceName;
    const dappOps = DappOperations.from(identifier, plugin);

    try {
      await dappOps.switchToWorkspace();
      // Additional delay to ensure workspace switch is fully processed
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.warn('[QuickDapp] Failed to auto-switch workspace:', e);
    }

    const { title, details, logo } = appState.instance;

    const builder = builderRef.current;
    const mapFiles = new Map<string, string>();
    let hasBuildableFiles = false;
    let indexHtmlContent = '';

    try {
      // Verify we're in the correct workspace
      const currentWs = await plugin.call('filePanel', 'getCurrentWorkspace');
      const expectedWs = dappOps.getWorkspaceName();
      console.log('[QuickDapp][runBuild] Current workspace:', currentWs?.name, 'Expected:', expectedWs);

      if (!dappOps.isInline() && currentWs?.name !== expectedWs) {
        console.warn('[QuickDapp][runBuild] Workspace mismatch! Retrying switch...');
        await plugin.call('filePanel', 'switchToWorkspace', {
          name: expectedWs,
          isLocalhost: false
        });
        await new Promise(r => setTimeout(r, 500));
      }

      const dappRootPath = dappOps.getSourceRoot();
      console.log('[QuickDapp][runBuild] Reading from:', dappRootPath, 'for dapp:', identifier);
      await readDappFiles(plugin, dappRootPath, mapFiles, 0);
      console.log('[QuickDapp][runBuild] Files read:', mapFiles.size, 'from', dappRootPath);

      if (mapFiles.size === 0) {
        const wsInfo = await plugin.call('filePanel', 'getCurrentWorkspace');
        setIframeError(`No files found in workspace root "${dappRootPath}". Current workspace: "${wsInfo?.name}". Expected: "${expectedWs}".`);
        setIsBuilding(false);
        return;
      }

      const indexHtmlPaths = dappOps.getPathVariations('index.html');

      for (const [path] of mapFiles.entries()) {
        if (path.match(/\.(js|jsx|ts|tsx)$/)) {
          hasBuildableFiles = true;
        }
        if (indexHtmlPaths.includes(path)) {
          indexHtmlContent = mapFiles.get(path)!;
        }
      }

    } catch (e: any) {
      setIframeError(`Failed to read DApp files: ${e.message}`);
      setIsBuilding(false);
      return;
    }

    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!doc) {
      setIsBuilding(false);
      return;
    }

    let logoDataUrl = '';
    if (logo && typeof logo === 'string' && logo.startsWith('data:image')) {
      logoDataUrl = logo;
    }

    const injectionScript = `
      <script>
        window.__QUICK_DAPP_CONFIG__ = {
          logo: ${JSON.stringify(logoDataUrl || '')},
          title: ${JSON.stringify(title || '')},
          details: ${JSON.stringify(details || '')}
        };
      </script>
    `;
    const debugScript = `<script>
window.onerror = function(msg, url, line, col, error) {
  try { parent.console.error('[DApp-iframe] Error:', msg, 'at', url, 'line', line); } catch(e) {}
  try { parent.postMessage({ source: 'quickdapp-preview', type: 'runtime-error', message: String(msg), file: url || '', line: line, col: col, stack: error && error.stack || '' }, '*'); } catch(e) {}
};
window.addEventListener('unhandledrejection', function(e) {
  try { parent.console.error('[DApp-iframe] Unhandled rejection:', e.reason); } catch(e2) {}
  try {
    var err = e.reason instanceof Error ? e.reason : null;
    var msg = err ? err.message : String(e.reason);
    parent.postMessage({ source: 'quickdapp-preview', type: 'runtime-error', message: msg, stack: err && err.stack || '' }, '*');
  } catch(e2) {}
});
</script>`;
    const ext = `<script>
(function() {
  if (parent.__remixVMBridge) {
    var _listeners = {};
    function emit(event, payload) {
      (_listeners[event] || []).slice().forEach(function(cb) {
        try { cb(payload); } catch (e) { setTimeout(function() { throw e; }, 0); }
      });
    }
    function setAccounts(accounts, emitChange) {
      window.ethereum.selectedAddress = accounts && accounts[0] ? accounts[0] : null;
      if (emitChange) {
        emit('accountsChanged', accounts || []);
      }
      return accounts;
    }
    function syncSelectedAddress(method, result) {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
        return setAccounts(result, false);
      }
      return result;
    }
    window.ethereum = {
      isMetaMask: false,
      isRemixVM: true,
      _events: {},
      request: function(args) {
        return parent.__remixVMBridge.request(args).then(function(result) {
          return syncSelectedAddress(args && args.method, result);
        });
      },
      send: function(method, params) {
        var requestArgs = typeof method === 'object' ? method : { method: method, params: params || [] };
        return parent.__remixVMBridge.request(requestArgs).then(function(result) {
          return syncSelectedAddress(requestArgs && requestArgs.method, result);
        });
      },
      on: function(event, cb) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(cb);
        return this;
      },
      removeListener: function(event, cb) {
        if (_listeners[event]) {
          _listeners[event] = _listeners[event].filter(function(l) { return l !== cb; });
        }
        return this;
      },
      removeAllListeners: function() { _listeners = {}; return this; }
    };
    window.ethereum.chainId = '0x539';
    window.ethereum.selectedAddress = null;
    window.__remixVMUpdateAccounts = function(accounts) {
      return setAccounts(accounts, true);
    };
  } else if (parent.window && parent.window.ethereum) {
    window.ethereum = parent.window.ethereum;
  }
})();
</script>`;

    try {
      if (hasBuildableFiles) {
        const entryPoint = dappOps.getEntryPoint('src/main.jsx');
        const result = await builder.build(mapFiles, entryPoint, undefined);
        if (!result.success) {
          doc.open();
          doc.write(`<pre style="color: red; white-space: pre-wrap;">${result.error || 'Unknown build error'}</pre>`);
          doc.close();
          setIsBuilding(false);
          return;
        }

        let finalHtml = indexHtmlContent || '<html><body><div id="root"></div></body></html>';

        if (finalHtml.includes('</head>')) {
          finalHtml = finalHtml.replace('</head>', `${debugScript}\n${injectionScript}\n${ext}\n</head>`);
        } else {
          finalHtml = `<html><head>${debugScript}${injectionScript}${ext}</head>${finalHtml}</html>`;
        }

        const scriptTag = `\n<script type="module">\n${result.js}\n</script>\n`;
        finalHtml = finalHtml.replace(
          /<script type="module"[^>]*src="(?:\/|\.\/)?src\/main\.jsx"[^>]*><\/script>/,
          scriptTag
        );
        finalHtml = finalHtml.replace(
          /<link rel="stylesheet"[^>]*href="(?:\/|\.\/)?src\/index\.css"[^>]*>/,
          ''
        );

        doc.open();
        doc.write(finalHtml);
        doc.close();
        console.log('[QuickDapp][runBuild] doc.write() completed (buildable)');

      } else {
        let finalHtml = indexHtmlContent;
        finalHtml = finalHtml.replace('</head>', `${debugScript}\n${injectionScript}\n${ext}\n</head>`);
        doc.open();
        doc.write(finalHtml);
        doc.close();
        console.log('[QuickDapp][runBuild] doc.write() completed (static HTML)');
      }

      if (showNotification) {
        captureAndSaveThumbnail(true);
        plugin.call('notification', 'modal', {
          id: 'dapp-preview-updated',
          title: 'Preview Updated',
          message: 'Preview refreshed successfully.',
          modalType: 'alert',
          okLabel: 'OK'
        });
      }

    } catch (e: any) {
      setIframeError(`Preview Error: ${e.message}`);
      setShowIframe(false);
    }

    setIsBuilding(false);
  }

  // Keep runBuildRef updated so event handlers always call the latest version
  runBuildRef.current = runBuild;

  const handleOpenAIAssistant = async () => {
    if (!activeDapp || !plugin) return;
    console.log('[QuickDapp] Opening AI Assistant for DApp update:', activeDapp.slug);

    // Check if AI is currently busy (streaming)
    const streamingEl = document.querySelector('[data-id="remix-ai-streaming"]');
    if (streamingEl?.getAttribute('data-streaming') === 'true') {
      plugin.call('notification', 'modal', {
        id: 'ai-assistant-busy',
        title: 'AI Assistant Busy',
        message: 'The AI Assistant is currently processing a request. Please wait for it to finish, then try again.',
        modalType: 'alert',
        okLabel: 'OK'
      });
      return;
    }

    // Gather current DApp file list for context
    let fileList: string[] = [];
    try {
      const srcFiles = await plugin.call('fileManager', 'readdir', 'src');
      if (srcFiles) {
        fileList = Object.keys(srcFiles).map(f => f.replace(/^src\//, 'src/'));
      }
    } catch (e) {
      console.warn('[QuickDapp] Could not read DApp files:', e);
    }

    // Build rich context prompt
    const dappName = activeDapp.config?.title || activeDapp.name || 'Untitled';
    const contractInfo = activeDapp.contract;
    const promptParts = [
      `I have an existing DApp called "${dappName}" in workspace "${activeDapp.workspaceName}".`,
      ``,
      `Contract: ${contractInfo?.name || 'Unknown'} at ${contractInfo?.address || 'unknown'}`,
      `Chain: ${contractInfo?.chainId || 'unknown'}`,
    ];

    if (fileList.length > 0) {
      promptParts.push(``, `Current DApp files:`, ...fileList.map(f => `- ${f}`));
    }

    promptParts.push(
      ``,
      `I want to update this DApp. Please list my DApp workspaces, confirm this is the right one, and then ask me what changes I'd like to make.`
    );

    const prompt = promptParts.join('\n');

    // Activate and focus AI Assistant
    try {
      await plugin.call('manager', 'activatePlugin', 'remix-ai-assistant');
    } catch (e) { /* may already be active */ }
    try {
      await plugin.call('rightSidePanel', 'focusPanel');
    } catch (e) { /* best-effort */ }

    // Send prompt to AI
    try {
      await plugin.call('remixaiassistant' as any, 'chatPipe', prompt);
    } catch (e) {
      console.warn('[QuickDapp] Could not send prompt to AI Assistant:', e);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function initBuilder() {
      if (builderRef.current) return;
      try {
        const builder = new InBrowserVite();
        await builder.initialize();
        if (mounted) {
          builderRef.current = builder;
          setIsBuilderReady(true);
        }
      } catch (err: any) {
        console.error('Failed to initialize InBrowserVite:', err);
        if (mounted) setIframeError(`Failed to initialize builder: ${err.message}`);
      }
    }
    initBuilder();
    return () => { mounted = false; };
  }, []);

  const isVM = !!activeDapp?.contract?.chainId && activeDapp.contract.chainId.toString().startsWith('vm');
  const [isCurrentProviderVM, setIsCurrentProviderVM] = useState(false);
  const [vmContractStatus, setVmContractStatus] = useState<'checking' | 'deployed' | 'not-found'>('checking');

  useEffect(() => {
    if (isBuilderReady && activeDapp && !isAiUpdating) {
      // VM dapps: wait until VM Worker is ready before building.
      if (isVM && !isCurrentProviderVM) {
        return;
      }
      setTimeout(() => runBuildRef.current?.(false), 100);
    }
  }, [isBuilderReady, isAiUpdating, activeDapp?.slug, isCurrentProviderVM]);

  // File change listener: auto-refresh preview when DApp files are modified
  const fileChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!plugin || !activeDapp || !isBuilderReady) return;

    const onFileChanged = (filePath: string) => {
      if (!filePath.match(/\.(jsx?|tsx?|html|css)$/)) return;

      if (isAiUpdating) return;

      console.log('[EditHtmlTemplate] File changed, scheduling preview refresh:', filePath);

      if (fileChangeDebounceRef.current) {
        clearTimeout(fileChangeDebounceRef.current);
      }
      fileChangeDebounceRef.current = setTimeout(() => {
        runBuildRef.current?.(false);
      }, 800);
    };

    plugin.on('fileManager', 'fileSaved', onFileChanged);

    return () => {
      if (fileChangeDebounceRef.current) {
        clearTimeout(fileChangeDebounceRef.current);
      }
      try { plugin.off('fileManager', 'fileSaved', onFileChanged); } catch (e) {}
    };
  }, [plugin, activeDapp?.workspaceName, isBuilderReady, isAiUpdating]);

  // Listen for runtime errors from the DApp preview iframe
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'quickdapp-preview' || event.data.type !== 'runtime-error') return;
      setRuntimeErrors(prev => {
        const base: string = event.data.message || 'Unknown error';
        const file = event.data.file && !event.data.file.includes('about:') ? event.data.file : '';
        const loc = event.data.line ? ` (${file ? file + ':' : 'line '}${event.data.line}${event.data.col ? ':' + event.data.col : ''})` : '';
        // Extract first useful frame from stack (e.g. "at App (about:srcdoc:42:15)")
        const stackFrame = event.data.stack ? (event.data.stack.split('\n').find((l: string) => l.trim().startsWith('at ') && !l.includes('esm.sh')) || '').trim() : '';
        const msg = base + loc + (stackFrame ? '\n' + stackFrame : '');
        if (prev.includes(msg) || prev.length >= 5) return prev;
        return [...prev, msg];
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Detect when blockchain VM is ready via contextChanged event (debounced).
  // Uses plugin.on (passive event) instead of plugin.call (blocked by engine queue).
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!plugin || !isVM) return;

    const onContextChanged = (context: string) => {
      if (!context || !context.startsWith('vm')) return;

      // Reset the debounce timer on every event
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setIsCurrentProviderVM(true);
      }, 1500);
    };

    plugin.on('blockchain', 'contextChanged', onContextChanged);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      try { plugin.off('blockchain', 'contextChanged', onContextChanged); } catch (e) {}
    };
  }, [plugin, isVM]);

  useEffect(() => {
    if (!isVM || !isCurrentProviderVM || !plugin || !activeDapp?.contract?.address) {
      setVmContractStatus('checking');
      return;
    }

    let cancelled = false;

    const checkContract = async () => {
      try {
        const web3 = (window as any).__remixVM_web3;
        if (!web3) {
          setVmContractStatus('deployed');
          return;
        }
        const result = await web3.send('eth_getCode', [activeDapp.contract.address, 'latest']);
        if (cancelled) return;
        if (result && result !== '0x' && result !== '0x0' && result.length > 2) {
          setVmContractStatus('deployed');
        } else {
          setVmContractStatus('not-found');
        }
      } catch (e) {
        if (cancelled) return;

        setVmContractStatus('deployed');
      }
    };

    checkContract();
    return () => { cancelled = true; };
  }, [isVM, isCurrentProviderVM, plugin, activeDapp?.contract?.address]);

  // Bridge setup: provides window.__remixVMBridge for DApp iframe to call VM directly.
  useEffect(() => {
    let isMounted = true;

    if (!isVM || !plugin) {
      delete (window as any).__remixVMBridge;
      return;
    }

    const getSelectedVMAccount = async (): Promise<string | null> => {
      const selected = await plugin.call('udappEnv', 'getSelectedAccount').catch(() => null);
      return typeof selected === 'string' ? selected : null;
    };

    const orderAccountsBySelected = (accounts: string[], selected: string | null) => {
      if (!selected) return accounts;
      const selectedLower = selected.toLowerCase();
      const match = accounts.find((account) => account.toLowerCase() === selectedLower);
      if (!match) return accounts;
      return [match, ...accounts.filter((account) => account.toLowerCase() !== selectedLower)];
    };

    const getOrderedVMAccounts = async (web3: any, method = 'eth_accounts', params: any[] = []) => {
      const accounts: string[] = await web3.send(method, params);
      return orderAccountsBySelected(accounts, await getSelectedVMAccount());
    };

    const bridge = {
      request: async ({ method, params }: { method: string; params?: any[] }) => {
        if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') {
          return null;
        }
        // Direct VM access: bypasses plugin queue (which gets permanently blocked)
        const web3 = (window as any).__remixVM_web3;
        if (!web3) {
          // VM not ready yet
          throw new Error('VM not ready');
        }
        try {
          if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
            const accounts = await getOrderedVMAccounts(web3, method, params || []);
            if (!isMounted) return;
            return accounts;
          }

          const nextParams = Array.isArray(params) ? [...params] : [];
          if ((method === 'eth_sendTransaction' || method === 'eth_call') && nextParams[0] && !nextParams[0].from) {
            const selected = await getSelectedVMAccount();
            if (selected) {
              nextParams[0] = { ...nextParams[0], from: selected };
            }
          }

          const result = await web3.send(method, nextParams);
          if (!isMounted) return;
          if (method === 'eth_sendTransaction') {
            // dumpState is non-critical, fire-and-forget
            plugin.call('blockchain', 'dumpState').catch(() => {});
          }
          return result;
        } catch (error: any) {
          if (!isMounted) return;
          console.error(`[QD] bridge:${method} ERROR:`, error);
          throw error;
        }
      }
    };

    (window as any).__remixVMBridge = bridge;

    let selectedAccount: string | null = null;
    let isCheckingAccount = false;
    let pendingAccountsChanged: string[] | null = null;

    const emitIframeAccountsChanged = (accounts: string[]) => {
      const updateAccounts = (iframeRef.current?.contentWindow as any)?.__remixVMUpdateAccounts;
      if (typeof updateAccounts === 'function') {
        updateAccounts(accounts);
        pendingAccountsChanged = null;
        return;
      }
      pendingAccountsChanged = accounts;
    };

    const checkSelectedAccount = async () => {
      if (!isMounted || isCheckingAccount) return;
      isCheckingAccount = true;
      try {
        if (pendingAccountsChanged) {
          emitIframeAccountsChanged(pendingAccountsChanged);
        }

        const nextSelectedAccount = await getSelectedVMAccount();
        if (!nextSelectedAccount) return;

        if (selectedAccount === null) {
          selectedAccount = nextSelectedAccount;
          return;
        }

        if (selectedAccount.toLowerCase() === nextSelectedAccount.toLowerCase()) return;

        const web3 = (window as any).__remixVM_web3;
        if (!web3) return;

        selectedAccount = nextSelectedAccount;
        const accounts = await getOrderedVMAccounts(web3);
        if (!isMounted) return;
        emitIframeAccountsChanged(accounts);
      } catch (e) {
        // Account-change propagation is best-effort; RPC calls still read the latest selected account.
      } finally {
        isCheckingAccount = false;
      }
    };

    checkSelectedAccount();
    const accountCheckInterval = window.setInterval(checkSelectedAccount, 1000);

    return () => {
      isMounted = false;
      window.clearInterval(accountCheckInterval);
      delete (window as any).__remixVMBridge;
    };
  }, [isVM, isCurrentProviderVM, plugin]);

  if (!activeDapp) return <div className="p-3">No active dapp selected.</div>;

  return (
    <div className="d-flex flex-column h-100">
      <div className="py-2 px-3 border-bottom d-flex align-items-center flex-shrink-0">
        <button
          className="btn btn-sm btn-secondary me-3"
          onClick={handleBack}
          disabled={isCapturing}
          data-id="back-to-dashboard-btn"
        >
          {isCapturing ? <><i className="fas fa-spinner fa-spin me-1"></i> Saving...</> : <><i className="fas fa-arrow-left me-1"></i> Back</>}
        </button>
        <div className="d-flex align-items-center flex-wrap gap-2">
          <span className="fw-bold text-body" style={{ fontSize: '1.1rem' }} data-id="editor-dapp-title">
            {activeDapp.config.title || activeDapp.name}
          </span>
          <span className="badge bg-secondary opacity-75">
            {activeDapp.contract.networkName}
          </span>
          <div className="vr mx-1 text-secondary opacity-50" style={{ height: '1.2rem' }}></div>
          <div className="d-flex align-items-center text-muted" title="Location in File Explorer">
            <i className="far fa-folder-open me-2 opacity-75"></i>
            <span className="font-monospace small opacity-75" data-id="editor-workspace-name">
              {activeDapp.workspaceName}
            </span>
          </div>
          <div className="vr mx-1 text-secondary opacity-50" style={{ height: '1.2rem' }}></div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              className="btn btn-link text-muted p-0 text-decoration-none"
              onClick={() => setShowTips(!showTips)}
              style={{ fontSize: '0.85rem' }}
            >
              <i className="far fa-question-circle me-1"></i>
              {showTips ? 'Hide Tips' : 'Help & Tips'}
            </button>
            {isVM && (
              <button
                className="btn btn-link text-warning p-0 text-decoration-none"
                onClick={() => setShowVmTips(!showVmTips)}
                style={{ fontSize: '0.85rem' }}
                title="VM Deployment Information"
                data-id="vm-deployment-btn"
              >
                <i className="fas fa-exclamation-triangle me-1"></i>
                {showVmTips ? 'Hide VM Info' : 'VM Info'}
              </button>
            )}
            <Button
              variant="success"
              size="sm"
              onClick={handleOpenAIAssistant}
              disabled={isAiUpdating}
              data-id="update-with-ai-btn"
            >
              <i className="fas fa-robot me-1"></i>
              Ask AI to Update
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => runBuild(true)}
              disabled={isBuilding || isAiUpdating}
              data-id="refresh-preview-btn"
            >
              {isBuilding ? <><i className="fas fa-spinner fa-spin me-1"></i> Building...</> : <><i className="fas fa-play me-1"></i> Refresh Preview</>}
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleDeleteDapp}
              disabled={isBuilding || isCapturing}
              data-id="delete-dapp-editor-btn"
            >
              <i className="fas fa-trash me-1"></i> Delete DApp
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-grow-1 position-relative" style={{ overflow: 'hidden' }}>
        <div className="container-fluid pt-3 h-100">
          <Row className="m-0 h-100">
            <Col xs={12} lg={8} className="pe-lg-3 d-flex flex-column qd-main-col">
              <Row className="flex-grow-1 mb-3">
                <Col xs={12} className="d-flex flex-column h-100">

                  {showTips && (
                    <div className="alert alert-info py-2 px-3 mb-2 small shadow-sm fade-in border-info bg-opacity-10">
                      <div className="fw-bold mb-1"><i className="fas fa-robot me-1"></i>AI Code Generation Tips</div>
                      <ul className="mb-0 ps-3">
                        <li>AI code might not be perfect. If the preview is broken:</li>
                        <li><strong>Option 1:</strong> Edit code manually in the <strong>File Explorer</strong> (left panel), then click <strong>Refresh Preview</strong>.</li>
                        <li><strong>Option 2:</strong> Click the <strong>Ask AI to Update</strong> button to ask the AI Assistant to fix it.</li>
                      </ul>
                    </div>
                  )}

                  {isVM && showVmTips && (
                    <div className={`alert py-2 px-3 mb-2 small shadow-sm d-flex align-items-start fade-in ${vmContractStatus === 'not-found' ? 'alert-danger border-danger' : 'alert-warning border-warning'}`} data-id="vm-warning-banner">
                      <i className={`fas ${vmContractStatus === 'not-found' ? 'fa-times-circle text-danger' : 'fa-exclamation-triangle text-warning'} me-2 mt-1`}></i>
                      <div>
                        <div className="fw-bold mb-1">Remix VM — Local Only</div>
                        {vmContractStatus === 'not-found' && (
                          <div className="text-danger mb-1">
                            <i className="fas fa-exclamation-circle me-1"></i>
                            No contract found at <code>{activeDapp.contract.address}</code>. The VM state may have been reset. Please redeploy the contract.
                          </div>
                        )}
                        {vmContractStatus === 'checking' && isCurrentProviderVM && (
                          <div className="mb-1">
                            <i className="fas fa-spinner fa-spin me-1"></i>
                            Checking contract status...
                          </div>
                        )}
                        <div className="mt-1 text-danger">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          You can deploy to IPFS, but the deployed DApp will not function — Remix VM only runs locally in this browser and is not accessible externally.
                        </div>
                        <div className="mt-1 text-warning">
                          <i className="fas fa-info-circle me-1"></i>
                          VM data is not permanently stored. Clearing browser data or switching workspaces may reset the VM state.
                        </div>
                      </div>
                    </div>
                  )}

                  <Card className="border flex-grow-1 d-flex position-relative">
                    <Card.Body className="p-0 d-flex flex-column position-relative" style={{ overflow: 'hidden' }}>
                      {isAiUpdating && (() => {
                        const progress = appState.generationProgress;
                        const generatedFiles = progress?.generatedFiles || [];
                        const currentFile = progress?.filename;
                        const statusText = progress?.status === 'generating_file' && currentFile
                          ? `Writing ${currentFile}`
                          : progress?.status === 'validating'
                            ? 'Validating file structure'
                            : progress?.status === 'parsing'
                              ? 'Parsing generated output'
                              : progress?.status === 'calling_llm'
                                ? 'Waiting for AI response'
                                : 'Updating DApp';

                        return (
                          <div className="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center qd-progress-overlay" data-id="ai-updating-overlay">
                            <div className="spinner-border qd-progress-spinner qd-progress-spinner--lg mb-3" role="status"></div>
                            <span className="qd-progress-status qd-progress-status--lg mb-2">{statusText}</span>
                            {generatedFiles.length > 0 && (
                              <div className="text-start mt-2 qd-progress-log qd-progress-log--lg" style={{ maxWidth: 380, width: '100%' }}>
                                {generatedFiles.map((f: string) => (
                                  <div key={f} className="qd-progress-log__done">{f}</div>
                                ))}
                                {progress?.status === 'generating_file' && currentFile && !generatedFiles.includes(currentFile) && (
                                  <div className="qd-progress-log__write">{currentFile}</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <iframe
                        ref={iframeRef}
                        style={{ width: '100%', height: '100%', minHeight: '800px', border: 'none', backgroundColor: 'white', display: iframeError ? 'none' : 'block' }}
                        title="dApp Preview"
                        sandbox="allow-popups allow-scripts allow-same-origin allow-forms allow-top-navigation"
                        data-id="dapp-preview-iframe"
                      />
                      {runtimeErrors.length > 0 && !isAiUpdating && (
                        <div className="position-absolute top-0 start-0 w-100 p-2" style={{ zIndex: 10 }}>
                          <div className="alert alert-danger d-flex align-items-center py-1 px-2 mb-0 small shadow-sm">
                            <i className="fas fa-exclamation-circle me-2 flex-shrink-0"></i>
                            <span className="text-break flex-grow-1">
                              <strong>Runtime Error:</strong> {runtimeErrors[runtimeErrors.length - 1]}
                            </span>
                            <button className="btn-close ms-2 flex-shrink-0" style={{ fontSize: '0.6rem' }} onClick={() => setRuntimeErrors([])}></button>
                          </div>
                        </div>
                      )}
                      {iframeError && (
                        <div className="d-flex align-items-center justify-content-center h-100 text-center p-4">
                          <div>
                            <i className="fas fa-exclamation-triangle text-warning mb-2" style={{ fontSize: '2rem' }}></i>
                            <h6 className="text-muted mb-2">Preview Error</h6>
                            <p className="text-muted small">{iframeError}</p>
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Col>
            <Col xs={12} lg={4} className="d-flex flex-column qd-side-col">
              <div className="flex-shrink-0">
                <DeployPanel />
              </div>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  );
}

export default EditHtmlTemplate;
