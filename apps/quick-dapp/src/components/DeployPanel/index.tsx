import React, { useContext, useState, useEffect } from 'react';
import { Form, Button, Alert, Card, Row, Col, Collapse } from 'react-bootstrap';
import { ethers, namehash } from 'ethers';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  emptyInstance,
  resetInstance,
  getInfoFromNatSpec,
} from '../../actions';
import { AppContext } from '../../contexts';
import IpfsHttpClient from 'ipfs-http-client';
import { readDappFiles } from '../EditHtmlTemplate';
import { InBrowserVite } from '../../InBrowserVite';
import * as contentHash  from 'content-hash';
import { CID } from 'multiformats/cid';

const REMIX_BASE_DOMAIN = 'remixdapp.eth';
const REMIX_REGISTRAR_ADDRESS = '0x72b3F26BB531b8815D5dE64f5e67B854aa066530';

const ENS_RESOLVER_ABI = [
  "function setContenthash(bytes32 node, bytes calldata hash) external"
];

const REMIX_REGISTRAR_ABI = [
  "function register(string label, bytes contenthash) external returns (bytes32 subnode)"
];

function DeployPanel(): JSX.Element {
  const intl = useIntl()
  const { appState, dispatch } = useContext(AppContext);
  const { title, details, logo } = appState.instance; 
  const [showIpfsSettings, setShowIpfsSettings] = useState(false);
  const [ipfsHost, setIpfsHost] = useState('');
  const [ipfsPort, setIpfsPort] = useState('');
  const [ipfsProtocol, setIpfsProtocol] = useState('');
  const [ipfsProjectId, setIpfsProjectId] = useState('');
  const [ipfsProjectSecret, setIpfsProjectSecret] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState({ cid: '', error: '' }); 

  const [ensName, setEnsName] = useState('');
  const [isEnsLoading, setIsEnsLoading] = useState(false);
  const [ensResult, setEnsResult] = useState({ success: '', error: '' });

  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isPublishOpen, setIsPublishOpen] = useState(true);
  const [isEnsOpen, setIsEnsOpen] = useState(true);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader: any = new FileReader()
      reader.onloadend = () => {
        dispatch({ type: 'SET_INSTANCE', payload: { logo: reader.result } })
      }
      reader.readAsArrayBuffer(e.target.files[0])
    }
  }

  const getRemixIpfsSettings = () => {
    let result = null;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key && key.includes('remix.config')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));

          if (data && data["settings/ipfs-url"]) {
            result = {
              url: data["settings/ipfs-url"] || null,
              port: data["settings/ipfs-port"] || null,
              protocol: data["settings/ipfs-protocol"] || null,
              projectId: data["settings/ipfs-project-id"] || null,
              projectSecret: data["settings/ipfs-project-secret"] || null,
            };
            break;
          }
        } catch (err) {
          console.warn(`${key} JSON parse error:`, err);
        }
      }
    }

    return result;
  }

  useEffect(() => {
    const loadGlobalIpfsSettings = () => {
      try {
        const ipfsSettings = getRemixIpfsSettings();

        if (ipfsSettings && ipfsSettings.url) {
          const { 
            url: host, 
            port, 
            protocol, 
            projectId: id, 
            projectSecret: secret 
          } = ipfsSettings;

          setIpfsHost(host);
          setIpfsPort(port || '5001');
          setIpfsProtocol(protocol || 'https');
          setIpfsProjectId(id || '');
          setIpfsProjectSecret(secret || '');
        } 
      } catch (e) {
        console.error(e);
      }
      setShowIpfsSettings(true);
    };
    loadGlobalIpfsSettings();
  }, []);

  const handleIpfsDeploy = async () => {
    setIsDeploying(true);
    setDeployResult({ cid: '', error: '' });

    let builder: InBrowserVite;
    let jsResult: { js: string; success: boolean; error?: string };
    let filesMap: Map<string, string>;

    try {
      builder = new InBrowserVite();
      await builder.initialize();

      filesMap = new Map<string, string>();
      await readDappFiles('dapp', filesMap);

      if (filesMap.size === 0) {
        throw new Error("No DApp files");
      }

      jsResult = await builder.build(filesMap, '/src/main.jsx');
      if (!jsResult.success) {
        throw new Error(`DApp build failed: ${jsResult.error}`);
      }

    } catch (e) {
      console.error(e);
      setDeployResult({ cid: '', error: `DApp build failed: ${e.message}` });
      setIsDeploying(false);
      return;
    }


    let ipfsClient;
    try {
      const auth = (ipfsProjectId && ipfsProjectSecret)
        ? 'Basic ' + Buffer.from(ipfsProjectId + ':' + ipfsProjectSecret).toString('base64')
        : null;
        
      const headers = auth ? { Authorization: auth } : {};
      
      let clientOptions;
      if (ipfsHost) {
        clientOptions = {
          host: ipfsHost.replace(/^(https|http):\/\//, ''), 
          port: parseInt(ipfsPort) || 5001,
          protocol: ipfsProtocol || 'https',
          headers
        };
      } else {
         clientOptions = { host: 'ipfs.infura.io', port: 5001, protocol: 'https', headers };
      }
      
      ipfsClient = IpfsHttpClient(clientOptions);

    } catch (e) {
      console.error(e);
      setDeployResult({ cid: '', error: `IPFS: ${e.message}` });
      setIsDeploying(false);
      return;
    }

    try {
      const indexHtmlContent = filesMap.get('/index.html');
      if (!indexHtmlContent) {
        throw new Error("Cannot find index.html");
      }

      let modifiedHtml = indexHtmlContent;

      let logoDataUrl = '';
      if (logo && logo.byteLength > 0) {
        try {
          const base64data = btoa(
            new Uint8Array(logo).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          logoDataUrl = 'data:image/jpeg;base64,' + base64data;
        } catch (err) {
          console.error('Logo conversion failed during deploy:', err);
        }
      }

      const injectionScript = `
        <script>
          window.__QUICK_DAPP_CONFIG__ = {
            logo: "${logoDataUrl}",
            title: ${JSON.stringify(title || '')},
            details: ${JSON.stringify(details || '')}
          };
        </script>
      `;

      modifiedHtml = modifiedHtml.replace('</head>', `${injectionScript}\n</head>`);
      
      modifiedHtml = modifiedHtml.replace(
        /<script type="module"[^>]*src="(?:\/|\.\/)?src\/main\.jsx"[^>]*><\/script>/, 
        '<script type="module" src="./app.js"></script>'
      );
      
      modifiedHtml = modifiedHtml.replace(
        /<link rel="stylesheet"[^>]*href="(?:\/|\.\/)?src\/index\.css"[^>]*>/, 
        ''
      );

      const filesToUpload = [
        {
          path: 'index.html',
          content: modifiedHtml
        },
        {
          path: 'app.js',
          content: jsResult.js
        }
      ];

      let last: any;
      for await (const r of ipfsClient.addAll(filesToUpload, { wrapWithDirectory: true })) {
        last = r;
      }
      const rootCid = last?.cid?.toString() || '';
      setDeployResult({ cid: rootCid, error: '' });
      setIsDeploying(false);
      
      if (showIpfsSettings && ipfsHost) {
      }

    } catch (e) {
      setDeployResult({ cid: '', error: `IPFS: ${e.message}` });
      setIsDeploying(false); 
    }
  };
  
  const handleEnsLink = async () => {
    setIsEnsLoading(true);
    setEnsResult({ success: '', error: '' });

    const rawInput = ensName.trim();
    if (!rawInput || !deployResult.cid) {
      setEnsResult({ success: '', error: 'ENS name or IPFS CID is missing.' });
      setIsEnsLoading(false);
      return;
    }
    if (typeof window.ethereum === 'undefined') {
      setEnsResult({ success: '', error: 'MetaMask (or a compatible wallet) is not installed.' });
      setIsEnsLoading(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      if (network.chainId !== 1n) {
        throw new Error('Updating ENS records is supported only on Ethereum Mainnet (Chain ID: 1). Please switch your wallet network.');
      }

      const userAddress = await signer.getAddress();

      const pureCid = deployResult.cid.replace(/^ipfs:\/\//, '');
      const cidParsed = CID.parse(pureCid);
      const cidForEns = cidParsed.version === 0 ? pureCid : cidParsed.toV0().toString();
      const chHex = '0x' + contentHash.encode('ipfs-ns', cidForEns);

      const lower = rawInput.toLowerCase();
      const isRemixFullSubdomain = lower.endsWith(`.${REMIX_BASE_DOMAIN}`);
      const hasDot = lower.includes('.');

      if (!hasDot || isRemixFullSubdomain) {
        let label = lower;
        if (isRemixFullSubdomain) {
          label = lower.replace(`.${REMIX_BASE_DOMAIN}`, '');
        }
        if (!label) {
          throw new Error('Subdomain label is empty.');
        }

        const registrar = new ethers.Contract(
          REMIX_REGISTRAR_ADDRESS,
          REMIX_REGISTRAR_ABI,
          signer
        );

        const tx = await registrar.register(label, chHex);
        setEnsResult({ success: 'Transaction sent. Waiting for confirmation...', error: '' });
        await tx.wait();

        const fullName = `${label}.${REMIX_BASE_DOMAIN}`;
        setEnsResult({
          success: `'${fullName}' has been linked to the new DApp CID successfully!`,
          error: ''
        });
        return;
      }

      const ensDomain = rawInput;
      const ownerAddress = await provider.resolveName(ensDomain);

      if (!ownerAddress) {
        throw new Error(`'${ensDomain}' is not registered.`);
      }
      if (ownerAddress.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error(`The current wallet (${userAddress.slice(0, 6)}...) does not match the address record of '${ensDomain}'.`);
      }

      const resolver = await provider.getResolver(ensDomain);
      if (!resolver) {
        throw new Error(`Resolver for '${ensDomain}' was not found.`);
      }

      const writeableResolver = new ethers.Contract(
        resolver.address,
        ENS_RESOLVER_ABI,
        signer
      );

      const node = namehash(ensDomain);
      const tx = await writeableResolver.setContenthash(node, chHex);
      setEnsResult({ success: 'Transaction sent. Waiting for confirmation...', error: '' });
      await tx.wait();

      setEnsResult({
        success: `'${ensDomain}' has been updated to the new DApp CID successfully!`,
        error: ''
      });
    } catch (e: any) {
      console.error(e);
      let message = e.message || String(e);
      if (e.code === 'UNSUPPORTED_OPERATION' && e.message?.includes('setContenthash')) {
        message = "The current resolver doesn't support 'setContenthash'. You may need to switch to the Public Resolver in the ENS Manager.";
      }
      if (e.code === 'CALL_EXCEPTION') {
        message = message || 'The transaction reverted. The subdomain may already be taken, or you might not be the owner.';
      }
      setEnsResult({ success: '', error: `Failed to update ENS: ${message}` });
    } finally {
      setIsEnsLoading(false);
    }
  };

  return (
    <div>
      <Card className="mb-2">
        <Card.Header
          onClick={() => setIsDetailsOpen(!isDetailsOpen)}
          aria-controls="dapp-details-collapse"
          aria-expanded={isDetailsOpen}
          className="d-flex justify-content-between bg-transparent border-0"
          style={{ cursor: 'pointer' }}
        >
          Dapp details
          <i className={`fas ${isDetailsOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
        </Card.Header>
        <Collapse in={isDetailsOpen}>
          <Card.Body id="dapp-details-collapse">
            <Form.Group className="mb-3" controlId="formDappLogo">
              <Form.Label className="text-uppercase mb-0">Dapp logo</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              <Form.Text>64x64px (Optional)</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="formDappTitle">
              <Form.Label className="text-uppercase mb-0">Dapp Title</Form.Label>
              <Form.Control
                data-id="dappTitle"
                placeholder={intl.formatMessage({ id: 'quickDapp.dappTitle' })}
                value={title}
                onChange={({ target: { value } }) => {
                  dispatch({
                    type: 'SET_INSTANCE',
                    payload: { title: value },
                  });
                }}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formDappDescription">
              <Form.Label className="text-uppercase mb-0">Dapp Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                data-id="dappInstructions"
                placeholder={intl.formatMessage({ id: 'quickDapp.dappInstructions' })}
                value={details}
                onChange={({ target: { value } }) => {
                  dispatch({
                    type: 'SET_INSTANCE',
                    payload: { details: value },
                  });
                }}
              />
            </Form.Group>

          </Card.Body>
        </Collapse>
      </Card>
      
      <Card className="mb-2">
        <Card.Header
          onClick={() => setIsPublishOpen(!isPublishOpen)}
          aria-controls="publish-settings-collapse"
          aria-expanded={isPublishOpen}
          className="d-flex justify-content-between bg-transparent border-0"
          style={{ cursor: 'pointer' }}
        >
          Publish settings
          <i className={`fas ${isPublishOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
        </Card.Header>
        <Collapse in={isPublishOpen}>
          <Card.Body id="publish-settings-collapse">
            <Form>
              {showIpfsSettings && (
                <>
                  <h5 className="mb-2"><FormattedMessage id="quickDapp.ipfsSettings" defaultMessage="IPFS Settings" /></h5>
                  {showIpfsSettings && (!ipfsHost || !ipfsPort || !ipfsProtocol) && (
                    <Alert variant="info" className="mb-2 small">
                      <FormattedMessage
                        id="quickDapp.ipfsSettings.info"
                        defaultMessage="No global IPFS settings found. Please provide credentials below, or configure them in the 'Settings' plugin."
                      />
                    </Alert>
                  )}
                  <Form.Group className="mb-2" controlId="formIpfsHost">
                    <Form.Label className="text-uppercase mb-0">IPFS Host</Form.Label>
                    <Form.Control type="text" placeholder="e.g., ipfs.infura.io" value={ipfsHost} onChange={(e) => setIpfsHost(e.target.value)} />
                  </Form.Group>
                  <Form.Group className="mb-2" controlId="formIpfsPort">
                    <Form.Label className="text-uppercase mb-0">IPFS Port</Form.Label>
                    <Form.Control type="text" placeholder="e.g., 5001" value={ipfsPort} onChange={(e) => setIpfsPort(e.target.value)} />
                  </Form.Group>
                  <Form.Group className="mb-2" controlId="formIpfsProtocol">
                    <Form.Label className="text-uppercase mb-0">IPFS Protocol</Form.Label>
                    <Form.Control type="text" placeholder="e.g., https" value={ipfsProtocol} onChange={(e) => setIpfsProtocol(e.target.value)} />
                  </Form.Group>
                  <Form.Group className="mb-2" controlId="formIpfsProjectId">
                    <Form.Label className="text-uppercase mb-0">Project ID (Optional)</Form.Label>
                    <Form.Control type="text" placeholder="Infura Project ID" value={ipfsProjectId} onChange={(e) => setIpfsProjectId(e.target.value)} />
                  </Form.Group>
                  <Form.Group className="mb-2" controlId="formIpfsProjectSecret">
                    <Form.Label className="text-uppercase mb-0">Project Secret (Optional)</Form.Label>
                    <Form.Control type="password" placeholder="Infura Project Secret" value={ipfsProjectSecret} onChange={(e) => setIpfsProjectSecret(e.target.value)} />
                  </Form.Group>
                  <hr />
                </>
              )}
              
              <Button
                data-id="deployDapp-IPFS"
                variant="primary"
                type="button"
                className="mt-3 w-100"
                onClick={handleIpfsDeploy}
                disabled={isDeploying || (showIpfsSettings && !ipfsHost)}
              >
                {isDeploying ? (
                  <><i className="fas fa-spinner fa-spin me-1"></i> <FormattedMessage id="quickDapp.deploying" defaultMessage="Deploying..." /></>
                ) : (
                  <FormattedMessage id="quickDapp.deployToIPFS" defaultMessage="Deploy to IPFS" />
                )}
              </Button>

              {deployResult.cid && (
                <Alert variant="success" className="mt-3 small" style={{ wordBreak: 'break-all' }}>
                  <div className="fw-bold">Deployed Successfully!</div>
                  <div><strong>CID:</strong> {deployResult.cid}</div>
                  <hr className="my-2" />
                  <a href={`https://gateway.ipfs.io/ipfs/${deployResult.cid}`} target="_blank" rel="noopener noreferrer">
                    View on ipfs.io Gateway
                  </a>
                </Alert>
              )}
              {deployResult.error && (
                <Alert variant="danger" className="mt-3 small">
                  {deployResult.error}
                </Alert>
              )}

            </Form>
          </Card.Body>
        </Collapse>
      </Card>

      {deployResult.cid && (
        <Card className="mb-2">
          <Card.Header
            onClick={() => setIsEnsOpen(!isEnsOpen)}
            aria-controls="ens-settings-collapse"
            aria-expanded={isEnsOpen}
            className="d-flex justify-content-between bg-transparent border-0"
            style={{ cursor: 'pointer' }}
          >
            Link to ENS
            <i className={`fas ${isEnsOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
          </Card.Header>
          <Collapse in={isEnsOpen}>
            <Card.Body id="ens-settings-collapse">
              <Form.Group className="mb-2" controlId="formEnsName">
                <Form.Label className="text-uppercase mb-0">ENS Domain</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="e.g., my-app.eth OR my-app" 
                  value={ensName} 
                  onChange={(e) => setEnsName(e.target.value)} 
                />
                <Form.Text>
                  Enter your full ENS domain (e.g., `my-dapp.eth`) or a subdomain name (e.g., `my-app`) to use `my-app.remixdapp.eth`.
                </Form.Text>
              </Form.Group>
              <Button 
                variant="secondary" 
                className="w-100" 
                onClick={handleEnsLink} 
                disabled={isEnsLoading || !ensName}
              >
                {isEnsLoading ? (
                  <><i className="fas fa-spinner fa-spin me-1"></i> Linking...</>
                ) : (
                  'Link ENS Name'
                )}
              </Button>
              {ensResult.success && (
                <Alert variant="success" className="mt-3 small">{ensResult.success}</Alert>
              )}
              {ensResult.error && (
                <Alert variant="danger" className="mt-3 small">{ensResult.error}</Alert>
              )}

            </Card.Body>
          </Collapse>
        </Card>
      )}

      <div className="mt-3">
        <Button
          size="sm"
          variant="outline-secondary"
          data-id="resetFunctions"
          onClick={() => { resetInstance(); }}
        >
          <FormattedMessage id="quickDapp.resetFunctions" />
        </Button>
        <Button
          size="sm"
          variant="outline-danger"
          data-id="deleteDapp"
          className="ms-3"
          onClick={() => { emptyInstance(); }}
        >
          <FormattedMessage id="quickDapp.deleteDapp" />
        </Button>
      </div>

    </div>
  );
}

export default DeployPanel;