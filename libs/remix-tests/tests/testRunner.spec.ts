import * as async from 'async'
import { ethers } from 'ethers'
import * as assert from 'assert'
import { Provider, extendProvider } from '@remix-project/remix-simulator'

import { compileFileOrFiles } from '../src/compiler'
import { deployAll } from '../src/deployer'
import { runTest, compilationInterface } from '../src/index'
import { ResultsInterface, TestCbInterface, ResultCbInterface } from '../src/index'

// deepEqualExcluding allows us to exclude specific keys whose values vary.
// In this specific test, we'll use this helper to exclude `time` keys.
// Assertions for the existence of these will be made at the correct places.
function deepEqualExcluding(a: any, b: any, excludedKeys: string[]) {
  function removeKeysFromObject(obj: any, excludedKeys: string[]) {
    if (obj !== Object(obj)) {
      return obj
    }

    if (Object.prototype.toString.call(obj) !== '[object Array]') {
      obj = Object.assign({}, obj)
      for (const key of excludedKeys) {
        delete obj[key]
      }

      return obj
    }

    const newObj = []
    for (const idx in obj) {
      newObj[idx] = removeKeysFromObject(obj[idx], excludedKeys);
    }

    return newObj
  }

  const aStripped: any = removeKeysFromObject(a, excludedKeys);
  const bStripped: any = removeKeysFromObject(b, excludedKeys);
  assert.deepEqual(aStripped, bStripped)
}

let accounts: string[]
const simulatorProvider: any = new Provider()

async function compileAndDeploy(filename: string, callback: any) {
  const sourceASTs: any = {}
  await simulatorProvider.init()
  const provider = new ethers.BrowserProvider(simulatorProvider)
  extendProvider(provider)
  let compilationData: any
  async.waterfall([
    function getAccountList(next: any): void {
      provider.send("eth_requestAccounts", []) 
        .then(( _accounts: string[]) => {
          accounts = _accounts
          next(undefined)
        })
        .catch((_err: Error | null | undefined) => next(_err))
    },
    function compile(next: any): void {
      compileFileOrFiles(filename, false, { accounts, provider }, null, next)
    },
    function deployAllContracts(compilationResult: compilationInterface, asts, next: any): void {
      for (const filename in asts) {
        if (filename.endsWith('_test.sol'))
          sourceASTs[filename] = asts[filename].ast
      }
      // eslint-disable-next-line no-useless-catch
      try {
        compilationData = compilationResult
        deployAll(compilationResult, provider, accounts, false, null, next)
      } catch (e) {
        throw e
      }
    }
  ], function (_err: Error | null | undefined, contracts: any): void {
    callback(null, compilationData, contracts, sourceASTs, accounts, provider)
  })
}

describe('testRunner', function () {
  let tests: any[] = [], results: ResultsInterface;

  const testCallback: TestCbInterface = (err, test) => {
    if (err) { throw err }

    if (test.type === 'testPass' || test.type === 'testFailure') {
      assert.ok(test.time, 'test time not reported')
      assert.ok(!Number.isInteger(test.time || 0), 'test time should not be an integer')
    }

    tests.push(test)
  }

  const resultsCallback = (done) => {
    return (err, _results) => {
      if (err) { throw err }
      results = _results
      done()
    }
  }

  describe('#runTest', function () {
    this.timeout(10000)
    describe('assert library OK method tests', () => {
      const filename: string = __dirname + '/examples_0/assert_ok_test.sol'

      before((done) => {
        compileAndDeploy(filename, (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) => {
          runTest('AssertOkTest', contracts.AssertOkTest, compilationData[filename]['AssertOkTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should have 1 passing test', () => {
        assert.equal(results.passingNum, 1)
      })

      it('should have 1 failing test', () => {
        assert.equal(results.failureNum, 1)
      })

      const hhLogs1 = [["AssertOkTest", "okPassTest"]]
      const hhLogs2 = [["AssertOkTest", "okFailTest"]]
      it('should return', () => {
        deepEqualExcluding(tests, [
          { type: 'accountList', value: accounts },
          { type: 'contract', value: 'AssertOkTest', filename: __dirname + '/examples_0/assert_ok_test.sol' },
          { type: 'testPass', debugTxHash: '0x5b665752a4faf83229259b9b2811d3295be0af633b0051d4b90042283ef55707', value: 'Ok pass test', filename: __dirname + '/examples_0/assert_ok_test.sol', context: 'AssertOkTest', hhLogs: hhLogs1 },
          { type: 'testFailure', debugTxHash: '0xa0a30ad042a7fc3495f72be7ba788d705888ffbbec7173f60bb27e07721510f2', value: 'Ok fail test', filename: __dirname + '/examples_0/assert_ok_test.sol', errMsg: 'okFailTest fails', context: 'AssertOkTest', hhLogs: hhLogs2, assertMethod: 'ok', location: '366:36:0', expected: 'true', returned: 'false' },
        
        ], ['time','type','debugTxHash','location','expected','returned','errMsg','assertMethod','provider'])
      })
    })

    describe('assert library EQUAL method tests', function () {
      const filename: string = __dirname + '/examples_0/assert_equal_test.sol'

      before((done) => {
        compileAndDeploy(filename, (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) => {
          runTest('AssertEqualTest', contracts.AssertEqualTest, compilationData[filename]['AssertEqualTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should have 6 passing test', () => {
        assert.equal(results.passingNum, 6)
      })

      it('should have 6 failing test', () => {
        assert.equal(results.failureNum, 6)
      })

      it('should return', () => {
        deepEqualExcluding(tests, [
          { type: 'accountList', value: accounts },
          { type: 'contract', value: 'AssertEqualTest', filename: __dirname + '/examples_0/assert_equal_test.sol' },
          { type: 'testPass', debugTxHash: '0x6d3203cc918bbd8592dd68c7ee4552f527bcfac12d4021145d523030f88e692f', value: 'Equal uint pass test', filename: __dirname + '/examples_0/assert_equal_test.sol', context: 'AssertEqualTest' },
          { type: 'testFailure', debugTxHash: '0x6fcf21d7c305b2971213a89ef736d466aee91606ba8c2abb08817548580e01db', value: 'Equal uint fail test', filename: __dirname + '/examples_0/assert_equal_test.sol', errMsg: 'equalUintFailTest fails', context: 'AssertEqualTest', assertMethod: 'equal', location: '273:57:0', expected: '2', returned: '1' },
          { type: 'testPass', debugTxHash: '0xd7d5beb25fa90bff661c11a4228f1c732154ba6c429ad6198ce9baf84888b352', value: 'Equal int pass test', filename: __dirname + '/examples_0/assert_equal_test.sol', context: 'AssertEqualTest' },
          { type: 'testFailure', debugTxHash: '0xb3d6bbe39a1b67477ab30f6f1202ac2f27802f219511e9e75bc08bb6222d0c0b', value: 'Equal int fail test', filename: __dirname + '/examples_0/assert_equal_test.sol', errMsg: 'equalIntFailTest fails', context: 'AssertEqualTest', assertMethod: 'equal', location: '493:45:0', expected: '2', returned: '-1' },
          { type: 'testPass', debugTxHash: '0x230a6155b9f779b9961b09b3260f47f7e61e88b85f8b06a4cd2034e813e91624', value: 'Equal bool pass test', filename: __dirname + '/examples_0/assert_equal_test.sol', context: 'AssertEqualTest' },
          { type: 'testFailure', debugTxHash: '0x3f9cde012b98e4598859f2bba85b02f756da84b4e8395cc3593f7000ae1e4444', value: 'Equal bool fail test', filename: __dirname + '/examples_0/assert_equal_test.sol', errMsg: 'equalBoolFailTest fails', context: 'AssertEqualTest', assertMethod: 'equal', location: '708:52:0', expected: false, returned: true },
          { type: 'testPass', debugTxHash: '0x2feb8a28b8301c7f79a037bf1880e6c41ef0cb37e76e82a07ab2b72634f665cb', value: 'Equal address pass test', filename: __dirname + '/examples_0/assert_equal_test.sol', context: 'AssertEqualTest' },
          { type: 'testFailure', debugTxHash: '0x760866aae3dc4e7b5982baba92eb0f1fc1fe068d404e1002fe601d39ff322cef', value: 'Equal address fail test', filename: __dirname + '/examples_0/assert_equal_test.sol', errMsg: 'equalAddressFailTest fails', context: 'AssertEqualTest', assertMethod: 'equal', location: '1015:130:0', expected: '0x1c6637567229159d1eFD45f95A6675e77727E013', returned: '0x7994f14563F39875a2F934Ce42cAbF48a93FdDA9' },
          { type: 'testPass', debugTxHash: '0xc609ef971d66b04e91ba86724c5bc37afc2134d748406dee95df38394a915374', value: 'Equal bytes32 pass test', filename: __dirname + '/examples_0/assert_equal_test.sol', context: 'AssertEqualTest' },
          { type: 'testFailure', debugTxHash: '0x4c55df486129b619dcea50388230257dc56fd80dedbd1704967f58351460c9d5', value: 'Equal bytes32 fail test', filename: __dirname + '/examples_0/assert_equal_test.sol', errMsg: 'equalBytes32FailTest fails', context: 'AssertEqualTest', assertMethod: 'equal', location: '1670:48:0', expected: '0x72656d6978000000000000000000000000000000000000000000000000000000', returned: '0x72656d6979000000000000000000000000000000000000000000000000000000' },
          { type: 'testPass', debugTxHash: '0x4ec2920dc10695b02e0821c8b4af9b019ae3e1d89e95d77ebf2004c04ad3ac41', value: 'Equal string pass test', filename: __dirname + '/examples_0/assert_equal_test.sol', context: 'AssertEqualTest' },
          { type: 'testFailure', debugTxHash: '0x945de18ad79a33b734d7c2bcbc9933e9cb17e75bc82c4fa1477d1ef9bc0b27ba', value: 'Equal string fail test', filename: __dirname + '/examples_0/assert_equal_test.sol', errMsg: 'equalStringFailTest fails', context: 'AssertEqualTest', assertMethod: 'equal', location: '1916:81:0', expected: 'remix-tests', returned: 'remix' }
        ], ['time', 'provider'])
      })
    })

    describe('assert library NOTEQUAL method tests', function () {
      const filename: string = __dirname + '/examples_0/assert_notEqual_test.sol'

      before((done) => {
        compileAndDeploy(filename, (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) => {
          runTest('AssertNotEqualTest', contracts.AssertNotEqualTest, compilationData[filename]['AssertNotEqualTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should have 6 passing test', () => {
        assert.equal(results.passingNum, 6)
      })

      it('should have 6 failing test', () => {
        assert.equal(results.failureNum, 6)
      })

      it('should return', () => {
        deepEqualExcluding(tests, [
          { type: 'accountList', value: accounts },
          { type: 'contract', value: 'AssertNotEqualTest', filename: __dirname + '/examples_0/assert_notEqual_test.sol' },
          { type: 'testPass', debugTxHash: '0x26ed22eee5f4a825571d4da8cf9947c808ccf13609531b10b10046cdf3bcaacc', value: 'Not equal uint pass test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', context: 'AssertNotEqualTest' },
          { type: 'testFailure', debugTxHash: '0xcd124d8e18d68d3cbaccfd6d67e34c39f9266999abafda6e7e2c5df9a3e001ef', value: 'Not equal uint fail test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', errMsg: 'notEqualUintFailTest fails', context: 'AssertNotEqualTest', assertMethod: 'notEqual', location: '288:63:0', expected: '1', returned: '1' },
          { type: 'testPass', debugTxHash: '0xfea7150a8d2d92c63846ed113141805a434c3fd28d2ce7af7ee97b916be48e21', value: 'Not equal int pass test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', context: 'AssertNotEqualTest' },
          { type: 'testFailure', debugTxHash: '0x64059b9c3e3fc1426f0fdd7064b575c21cd461373048805dd281c2a371a2d28b', value: 'Not equal int fail test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', errMsg: 'notEqualIntFailTest fails', context: 'AssertNotEqualTest', assertMethod: 'notEqual', location: '525:52:0', expected: '-2', returned: '-2' },
          { type: 'testPass', debugTxHash: '0x42f96c676916eebf4377de4796d46b9ab5c14e2fcb3917dab67f322ba1c69d2d', value: 'Not equal bool pass test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', context: 'AssertNotEqualTest' },
          { type: 'testFailure', debugTxHash: '0xdaad6b68f12d624801de3b6cb5f8548da8a626a9812c0b953e6391ae92022db0', value: 'Not equal bool fail test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', errMsg: 'notEqualBoolFailTest fails', context: 'AssertNotEqualTest', assertMethod: 'notEqual', location: '760:57:0', expected: true, returned: true },
          { type: 'testPass', debugTxHash: '0x0bdf9b8731aa86c7244c33f8e688aa87e7b4621c4066cee7af80370089ed026c', value: 'Not equal address pass test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', context: 'AssertNotEqualTest' },
          // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
          { type: 'testFailure', debugTxHash: '0x9a4c7916f1c50086812a855f079e70fce7f3a96dd99b664fd70ce2e6ba5b1c42', value: 'Not equal address fail test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', errMsg: 'notEqualAddressFailTest fails', context: 'AssertNotEqualTest', assertMethod: 'notEqual', location: '1084:136:0', expected: 0x7994f14563F39875a2F934Ce42cAbF48a93FdDA9, returned: 0x7994f14563F39875a2F934Ce42cAbF48a93FdDA9 },
          { type: 'testPass', debugTxHash: '0x1fc1a10c6765a2d2ac362cb4320a173e987017c9caba509ffce21326bd07320b', value: 'Not equal bytes32 pass test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', context: 'AssertNotEqualTest' },
          { type: 'testFailure', debugTxHash: '0x240663857caa213eb10dc2e7d6336e4541616508df253e9b322406308bbd18e7', value: 'Not equal bytes32 fail test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', errMsg: 'notEqualBytes32FailTest fails', context: 'AssertNotEqualTest', assertMethod: 'notEqual', location: '1756:54:0', expected: '0x72656d6978000000000000000000000000000000000000000000000000000000', returned: '0x72656d6978000000000000000000000000000000000000000000000000000000' },
          { type: 'testPass', debugTxHash: '0x00cebd7ecf595a8b763605abfdc0a38e94d8fab813f4b974d63c76f8af12fbe6', value: 'Not equal string pass test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', context: 'AssertNotEqualTest' },
          { type: 'testFailure', debugTxHash: '0xdf0338a9b2558b6c7e6cc8d273a1185fefd816ab1e0d5494046741c3623b67f3', value: 'Not equal string fail test', filename: __dirname + '/examples_0/assert_notEqual_test.sol', errMsg: 'notEqualStringFailTest fails', context: 'AssertNotEqualTest', assertMethod: 'notEqual', location: '2026:81:0', expected: 'remix', returned: 'remix' },
        ], ['time', 'provider'])
      })
    })

    describe('assert library GREATERTHAN method tests', function () {
      const filename: string = __dirname + '/examples_0/assert_greaterThan_test.sol'

      before((done) => {
        compileAndDeploy(filename, (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) => {
          runTest('AssertGreaterThanTest', contracts.AssertGreaterThanTest, compilationData[filename]['AssertGreaterThanTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should have 4 passing test', () => {
        assert.equal(results.passingNum, 4)
      })

      it('should have 3 failing test', () => {
        assert.equal(results.failureNum, 3)
      })
      it('should return', () => {
        deepEqualExcluding(tests, [
          { type: 'accountList', value: accounts },
          { type: 'contract', value: 'AssertGreaterThanTest', filename: __dirname + '/examples_0/assert_greaterThan_test.sol' },
          { type: 'testPass', debugTxHash: '0x5b7e39d04492f372d03c44b7ce46d759809572f051730967b44fb344a29637c1', value: 'Greater than uint pass test', filename: __dirname + '/examples_0/assert_greaterThan_test.sol', context: 'AssertGreaterThanTest' },
          { type: 'testFailure', debugTxHash: '0xb9f8412a5c425bfb5c1aca0fbbee504bb50e6ffdd48ae8475a6129b448eb148d', value: 'Greater than uint fail test', filename: __dirname + '/examples_0/assert_greaterThan_test.sol', errMsg: 'greaterThanUintFailTest fails', context: 'AssertGreaterThanTest', assertMethod: 'greaterThan', location: '303:69:0', expected: '4', returned: '1' },
          { type: 'testPass', debugTxHash: '0x7241db3dcf943fedb26a0774193d76f09c07dbe66bc0844856611eb4b1eab92a', value: 'Greater than int pass test', filename: __dirname + '/examples_0/assert_greaterThan_test.sol', context: 'AssertGreaterThanTest' },
          { type: 'testFailure', debugTxHash: '0xf5a2bff062a887db30aecac3cac4f1c717d02a47ba9aa14b478b8be8a3cf25c8', value: 'Greater than int fail test', filename: __dirname + '/examples_0/assert_greaterThan_test.sol', errMsg: 'greaterThanIntFailTest fails', context: 'AssertGreaterThanTest', assertMethod: 'greaterThan', location: '569:67:0', expected: '1', returned: '-1' },
          { type: 'testPass', debugTxHash: '0x761f39ba9cf9dc7099119f4bf2f5174b23591021059ce906c4453b31f3936893', value: 'Greater than uint int pass test', filename: __dirname + '/examples_0/assert_greaterThan_test.sol', context: 'AssertGreaterThanTest' },
          { type: 'testFailure', debugTxHash: '0xe9a991b9b2d489a7ffdca896df1ca44ebb248a21429096a3da4851dde8caee38', value: 'Greater than uint int fail test', filename: __dirname + '/examples_0/assert_greaterThan_test.sol', errMsg: 'greaterThanUintIntFailTest fails', context: 'AssertGreaterThanTest', assertMethod: 'greaterThan', location: '845:71:0', expected: '2', returned: '1' },
          { type: 'testPass', debugTxHash: '0x08599a07d0bc2377a7ce7440a5b198cf90db304872e3241346dc2cfcdc908f4d', value: 'Greater than int uint pass test', filename: __dirname + '/examples_0/assert_greaterThan_test.sol', context: 'AssertGreaterThanTest' },
        ], ['time', 'provider'])
      })
    })

    describe('assert library LESSERTHAN method tests', function () {
      const filename: string = __dirname + '/examples_0/assert_lesserThan_test.sol'

      before((done) => {
        compileAndDeploy(filename, (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) => {
          runTest('AssertLesserThanTest', contracts.AssertLesserThanTest, compilationData[filename]['AssertLesserThanTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should have 3 passing test', () => {
        assert.equal(results.passingNum, 3)
      })

      it('should have 3 failing test', () => {
        assert.equal(results.failureNum, 3)
      })

      it('should return', () => {
        deepEqualExcluding(tests, [
          { type: 'accountList', value: accounts },
          { type: 'contract', value: 'AssertLesserThanTest', filename: __dirname + '/examples_0/assert_lesserThan_test.sol' },
          { type: 'testPass', debugTxHash: '0x0bb5c432f207d0b06313f3d4301941180e272df101051b461010a7a9bc541abd', value: 'Lesser than uint pass test', filename: __dirname + '/examples_0/assert_lesserThan_test.sol', context: 'AssertLesserThanTest' },
          { type: 'testFailure', debugTxHash: '0xda14c46e9ae63abbdf9b2b445f4ba72af323872c421f25827eaf3a5f8f2f51d2', value: 'Lesser than uint fail test', filename: __dirname + '/examples_0/assert_lesserThan_test.sol', errMsg: 'lesserThanUintFailTest fails', context: 'AssertLesserThanTest', assertMethod: 'lesserThan', location: '298:67:0', expected: '2', returned: '4' },
          { type: 'testPass', debugTxHash: '0x63b153709b0cf0e668a6e1ae5a6a605d2be45bb34260e255e49c5cbf8e311c7f', value: 'Lesser than int pass test', filename: __dirname + '/examples_0/assert_lesserThan_test.sol', context: 'AssertLesserThanTest' },
          { type: 'testFailure', debugTxHash: '0x7f0ce5b0051ea27f1ca0c4f331057c3aedf2c6b9332d96e8fc426cc68b2c115c', value: 'Lesser than int fail test', filename: __dirname + '/examples_0/assert_lesserThan_test.sol', errMsg: 'lesserThanIntFailTest fails', context: 'AssertLesserThanTest', assertMethod: 'lesserThan', location: '557:65:0', expected: '-1', returned: '1' },
          { type: 'testPass', debugTxHash: '0x33e5635976dd05cd9b11f3921cc64b98c241fd0dc204270efa5facc82688213c', value: 'Lesser than uint int pass test', filename: __dirname + '/examples_0/assert_lesserThan_test.sol', context: 'AssertLesserThanTest' },
          { type: 'testFailure', debugTxHash: '0x37544ea1add799d952b526f0dbe7b379931d194cadc88e06df45f8a7812a7ffc', value: 'Lesser than int uint fail test', filename: __dirname + '/examples_0/assert_lesserThan_test.sol', errMsg: 'lesserThanIntUintFailTest fails', context: 'AssertLesserThanTest', assertMethod: 'lesserThan', location: '826:69:0', expected: '1', returned: '1' },
        ], ['time', 'provider'])
      })
    })

    describe('test with before', function () {
      const filename: string = __dirname + '/examples_1/simple_storage_test.sol'

      before((done) => {
        compileAndDeploy(filename, (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) => {
          runTest('MyTest', contracts.MyTest, compilationData[filename]['MyTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should have 3 passing test', () => {
        assert.equal(results.passingNum, 3)
      })

      it('should have 1 failing test', () => {
        assert.equal(results.failureNum, 1)
      })

      it('should return 6 messages', () => {
        deepEqualExcluding(tests, [
          { type: 'accountList', value: accounts },
          { type: 'contract', value: 'MyTest', filename: __dirname + '/examples_1/simple_storage_test.sol' },
          { type: 'testPass', debugTxHash: '0x6b1211fa24c6df39e124b712824efff4c31816d0d53eed716af7daf2b29a3449', value: 'Initial value should be100', filename: __dirname + '/examples_1/simple_storage_test.sol', context: 'MyTest' },
          { type: 'testPass', debugTxHash: '0xe8e55ccadf02e6d6760eedec83b6f2276b5b2913946b74fa910bdb1e8d4380ea', value: 'Initial value should not be200', filename: __dirname + '/examples_1/simple_storage_test.sol', context: 'MyTest' },
          { type: 'testFailure', debugTxHash: '0x0522e123decc83a97163d2f14cef127fe221849586afc817031e819e688d186d', value: 'Should trigger one fail', filename: __dirname + '/examples_1/simple_storage_test.sol', errMsg: 'uint test 1 fails', context: 'MyTest', assertMethod: 'equal', location: '532:51:1', expected: '2', returned: '1' },
          { type: 'testPass', debugTxHash: '0xe23a73e021a53d6e031c528ea7221d10192986ecc4e50c4687958a391f57e30c', value: 'Should trigger one pass', filename: __dirname + '/examples_1/simple_storage_test.sol', context: 'MyTest' }
        ], ['time', 'provider'])
      })
    })

    describe('test with beforeEach', function () {
      const filename: string = __dirname + '/examples_2/simple_storage_test.sol'

      before(done => {
        compileAndDeploy(filename, function (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) {
          runTest('MyTest', contracts.MyTest, compilationData[filename]['MyTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should have 2 passing tests', () => {
        assert.equal(results.passingNum, 2)
      })

      it('should 0 failing tests', () => {
        assert.equal(results.failureNum, 0)
      })

      it('should return 4 messages', () => {
        deepEqualExcluding(tests, [
          { type: 'accountList', value: accounts },
          { type: 'contract', value: 'MyTest', filename: __dirname + '/examples_2/simple_storage_test.sol' },
          { type: 'testPass', debugTxHash: '0x46d13ad189581683418002fa433f5ae81e75203487f9f827c6d2943bde07cfdf', value: 'Initial value should be100', filename: __dirname + '/examples_2/simple_storage_test.sol', context: 'MyTest' },
          { type: 'testPass', debugTxHash: '0x8ec9cacad766180de59973c20212b7663c81a36235fca5095bb2a6c222845b8e', value: 'Value is set200', filename: __dirname + '/examples_2/simple_storage_test.sol', context: 'MyTest' }
        ], ['time', 'provider'])
      })
    })

    // Test string equality
    describe('test string equality', function () {
      const filename: string = __dirname + '/examples_3/simple_string_test.sol'

      before(done => {
        compileAndDeploy(filename, function (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) {
          runTest('StringTest', contracts.StringTest, compilationData[filename]['StringTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should 2 passing tests', () => {
        assert.equal(results.passingNum, 2)
      })

      it('should return 4 messages', () => {
        deepEqualExcluding(tests, [
          { type: 'accountList', value: accounts },
          { type: 'contract', value: 'StringTest', filename: __dirname + '/examples_3/simple_string_test.sol' },
          { type: 'testPass', debugTxHash: '0x89cecb0cd204ed4aa300ef6a09f9cf84ac42168399b028f210fe2438a3a44114', value: 'Initial value should be hello world', filename: __dirname + '/examples_3/simple_string_test.sol', context: 'StringTest' },
          { type: 'testPass', debugTxHash: '0xb5b470f03494b1c6627fe96fae9982a440e8f72128b24c1a802b703f278c5ae3', value: 'Value should not be hello wordl', filename: __dirname + '/examples_3/simple_string_test.sol', context: 'StringTest' }
        ], ['time', 'provider'])
      })
    })

    // Test multiple directory import in test contract
    describe('test multiple directory import in test contract', function () {
      const filename: string = __dirname + '/examples_5/test/simple_storage_test.sol'

      before(done => {
        compileAndDeploy(filename, function (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) {
          runTest('StorageResolveTest', contracts.StorageResolveTest, compilationData[filename]['StorageResolveTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should 3 passing tests', () => {
        assert.equal(results.passingNum, 3)
      })

      it('should return 4 messages', () => {
        deepEqualExcluding(tests, [
          { type: 'accountList', value: accounts },
          { type: 'contract', value: 'StorageResolveTest', filename: __dirname + '/examples_5/test/simple_storage_test.sol' },
          { type: 'testPass', debugTxHash: '0x6b1211fa24c6df39e124b712824efff4c31816d0d53eed716af7daf2b29a3449', value: 'Initial value should be100', filename: __dirname + '/examples_5/test/simple_storage_test.sol', context: 'StorageResolveTest' },
          { type: 'testPass', debugTxHash: '0x40e3cb74fd22afdd09b0721dbcdf8f5761c30a2ac81094b1320086a94225cb33', value: 'Check if even', filename: __dirname + '/examples_5/test/simple_storage_test.sol', context: 'StorageResolveTest' },
          { type: 'testPass', debugTxHash: '0xf9e719ad70505ad51a611d3e62c5959c9118d040945ceebe68ba27f73a2164c5', value: 'Check if odd', filename: __dirname + '/examples_5/test/simple_storage_test.sol', context: 'StorageResolveTest' }
        ], ['time', 'provider'])
      })
    })

    //Test SafeMath library methods
    describe('test SafeMath library', function () {
      const filename: string = __dirname + '/examples_4/SafeMath_test.sol'

      before(done => {
        compileAndDeploy(filename, function (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) {
          runTest('SafeMathTest', contracts.SafeMathTest, compilationData[filename]['SafeMathTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should have 7 passing tests', () => {
        assert.equal(results.passingNum, 7)
      })
      it('should have 0 failing tests', () => {
        assert.equal(results.failureNum, 0)
      })
    })

    //Test signed/unsigned integer weight
    describe('test number weight', function () {
      const filename: string = __dirname + '/number/number_test.sol'

      before(done => {
        compileAndDeploy(filename, function (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) {
          runTest('IntegerTest', contracts.IntegerTest, compilationData[filename]['IntegerTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
        })
      })

      after(() => { tests = [] })

      it('should have 6 passing tests', () => {
        assert.equal(results.passingNum, 6)
      })
      it('should have 2 failing tests', () => {
        assert.equal(results.failureNum, 2)
      })
    })

    // Test Transaction with custom sender & value
    // describe('various sender', function () {
    //   const filename: string = __dirname + '/various_sender/sender_and_value_test.sol'

    //   before(done => {
    //     compileAndDeploy(filename, function (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) {
    //       runTest('SenderAndValueTest', contracts.SenderAndValueTest, compilationData[filename]['SenderAndValueTest'], asts[filename], { accounts, provider }, testCallback, resultsCallback(done))
    //     })
    //   })

    //   after(() => { tests = [] })

    //   it('should have 17 passing tests', () => {
    //     assert.equal(results.passingNum, 17)
    //   })
    //   it('should have 0 failing tests', () => {
    //     assert.equal(results.failureNum, 0)
    //   })
    // })

    // Test `runTest` method without sending contract object (should throw error)
    // describe('runTest method without contract json interface', function () {
    //   const filename: string = __dirname + '/various_sender/sender_and_value_test.sol'
    //   const errorCallback: any = (done) => {
    //     return (err, _results) => {
    //       if (err && err.message.includes('Contract interface not available')) {
    //         results = _results
    //         done()
    //       }
    //       else throw err
    //     }
    //   }
    //   before(done => {
    //     compileAndDeploy(filename, function (_err: Error | null | undefined, compilationData: any, contracts: any, asts: any, accounts: string[], provider: any) {
    //       runTest('SenderAndValueTest', undefined, compilationData[filename]['SenderAndValueTest'], asts[filename], { accounts, provider }, testCallback, errorCallback(done))
    //     })
    //   })

    //   it('should have 0 passing tests', () => {
    //     assert.equal(results.passingNum, 0)
    //   })
    //   it('should have 0 failing tests', () => {
    //     assert.equal(results.failureNum, 0)
    //   })
    // })

  })
})
