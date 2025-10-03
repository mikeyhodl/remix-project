import { toast } from 'react-toastify'
import { type ModelType } from '../store'
import remixClient from '../../remix-client'
import { router } from '../../App'
import { trackMatomoEvent, LearnethEvents } from '@remix-api'

function getFilePath(file: string): string {
  const name = file.split('/')
  return name.length > 1 ? `${name[name.length - 1]}` : ''
}

const Model: ModelType = {
  namespace: 'remixide',
  state: {
    errors: [],
    success: false,
    errorLoadingFile: false,
    // theme: '',
    localeCode: 'en'
  },
  reducers: {
    save(state, { payload }) {
      return { ...state, ...payload }
    },
  },
  effects: {
    *connect(_, { put }) {
      toast.info('connecting to the REMIX IDE')

      yield put({
        type: 'loading/save',
        payload: {
          screen: true,
        },
      })

      yield remixClient.onload(() => {
        remixClient.call('manager', 'activatePlugin', 'solidityUnitTesting')
      })

      toast.dismiss()

      yield put({
        type: 'loading/save',
        payload: {
          screen: false,
        },
      });

      // Type-safe Matomo tracking helper
      const trackLearnethEvent = (event: ReturnType<typeof LearnethEvents[keyof typeof LearnethEvents]>) => {
        trackMatomoEvent(remixClient, event);
      };

      // Legacy _paq compatibility layer for existing learneth tracking calls
      (window as any)._paq = {
        push: (args: any[]) => {
          if (args[0] === 'trackEvent' && args.length >= 3) {
            // Convert legacy _paq.push(['trackEvent', 'category', 'action', 'name']) 
            // to matomo plugin call with legacy string signature
            const [, category, action, name, value] = args;
            remixClient.call('matomo' as any, 'trackEvent', category, action, name, value);
          } else {
            // For other _paq commands, pass through as-is
            console.warn('Learneth: Unsupported _paq command:', args);
          }
        }
      };
      
      // Make trackLearnethEvent available globally for the effects
      (window as any).trackLearnethEvent = trackLearnethEvent;

      yield router.navigate('/home')
    },
    *displayFile({ payload: step }, { select, put }) {
      let content = ''
      let path = ''
      if (step.solidity?.file) {
        content = step.solidity.content
        path = getFilePath(step.solidity.file)
      }
      if (step.js?.file) {
        content = step.js.content
        path = getFilePath(step.js.file)
      }
      if (step.vy?.file) {
        content = step.vy.content
        path = getFilePath(step.vy.file)
      }

      if (!content) {
        return
      }

      (<any>window).trackLearnethEvent(LearnethEvents.displayFile(`${(step && step.name)}/${path}`))

      toast.info(`loading ${path} into IDE`)
      yield put({
        type: 'loading/save',
        payload: {
          screen: true,
        },
      })

      const { detail, selectedId } = yield select((state) => state.workshop)

      const workshop = detail[selectedId]

      path = `.learneth/${workshop.name}/${step.name}/${path}`
      try {
        const isExist = yield remixClient.call('fileManager', 'exists' as any, path)
        if (!isExist) {
          yield remixClient.call('fileManager', 'setFile', path, content)
        }
        yield remixClient.call('fileManager', 'switchFile', `${path}`)
        yield put({
          type: 'remixide/save',
          payload: { errorLoadingFile: false },
        })
        toast.dismiss()
      } catch (error) {
        (<any>window).trackLearnethEvent(LearnethEvents.displayFileError(error.message))
        toast.dismiss()
        toast.error('File could not be loaded. Please try again.')
        yield put({
          type: 'remixide/save',
          payload: { errorLoadingFile: true },
        })
      }
      yield put({
        type: 'loading/save',
        payload: {
          screen: false,
        },
      })
    },
    *testStep({ payload: step }, { select, put }) {
      yield put({
        type: 'loading/save',
        payload: {
          screen: true,
        },
      })

      try {
        yield put({
          type: 'remixide/save',
          payload: { success: false },
        })
        const { detail, selectedId } = yield select((state) => state.workshop)

        const workshop = detail[selectedId]

        let path: string
        if (step.solidity.file) {
          path = getFilePath(step.solidity.file)
          path = `.learneth/${workshop.name}/${step.name}/${path}`
          yield remixClient.call('fileManager', 'switchFile', `${path}`)
        }

        path = getFilePath(step.test.file)
        path = `.learneth/${workshop.name}/${step.name}/${path}`
        yield remixClient.call('fileManager', 'setFile', path, step.test.content)

        const result = yield remixClient.call('solidityUnitTesting', 'testFromPath', path)

        if (!result) {
          yield put({
            type: 'remixide/save',
            payload: { errors: ['Compiler failed to test this file']},
          });
          (<any>window).trackLearnethEvent(LearnethEvents.testStepError('Compiler failed to test this file'))
        } else {
          const success = result.totalFailing === 0;
          if (success) {
            yield put({
              type: 'remixide/save',
              payload: { errors: [], success: true },
            })
          } else {
            yield put({
              type: 'remixide/save',
              payload: {
                errors: result.errors.map((error: {message: any}) => error.message),
              },
            })
          }
          (<any>window).trackLearnethEvent(LearnethEvents.testStep(String(success)))
        }
      } catch (err) {
        yield put({
          type: 'remixide/save',
          payload: { errors: [String(err)]},
        });
        (<any>window).trackLearnethEvent(LearnethEvents.testStepError(String(err)))
      }
      yield put({
        type: 'loading/save',
        payload: {
          screen: false,
        },
      })
    },
    *showAnswer({ payload: step }, { select, put }) {
      yield put({
        type: 'loading/save',
        payload: {
          screen: true,
        },
      })

      toast.info('loading answer into IDE')

      try {
        const content = step.answer.content
        let path = getFilePath(step.answer.file)

        const { detail, selectedId } = yield select((state) => state.workshop)

        const workshop = detail[selectedId]
        path = `.learneth/${workshop.name}/${step.name}/${path}`
        yield remixClient.call('fileManager', 'setFile', path, content)
        yield remixClient.call('fileManager', 'switchFile', `${path}`);

        (<any>window).trackLearnethEvent(LearnethEvents.showAnswer(path))
      } catch (err) {
        yield put({
          type: 'remixide/save',
          payload: { errors: [String(err)]},
        });
        (<any>window).trackLearnethEvent(LearnethEvents.showAnswerError(err.message))
      }

      toast.dismiss()
      yield put({
        type: 'loading/save',
        payload: {
          screen: false,
        },
      })
    },
    *testSolidityCompiler(_, { put, select }) {
      try {
        yield remixClient.call('solidity', 'getCompilationResult');
        (<any>window).trackLearnethEvent(LearnethEvents.testSolidityCompiler())
      } catch (err) {
        const errors = yield select((state) => state.remixide.errors)
        yield put({
          type: 'remixide/save',
          payload: {
            errors: [...errors, "The `Solidity Compiler` is not yet activated.<br>Please activate it using the `SOLIDITY` button in the `Featured Plugins` section of the homepage.<img class='img-thumbnail mt-3' src='assets/activatesolidity.png'>"],
          },
        });
        (<any>window).trackLearnethEvent(LearnethEvents.testSolidityCompilerError(err.message))
      }
    }
  },
}

export default Model
